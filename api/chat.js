// ============================================================
//  PENSÉE IA — api/chat.js (Vercel Edge · streaming NDJSON)
//
//  Un appel = une étape de la boucle d'agent :
//    1. auth + quota (1 crédit par message utilisateur, jeton de tour ensuite)
//    2. prompt système assemblé ICI (jamais fourni par le client)
//    3. appel modèle avec les outils ; les outils "serveur" (web_search,
//       fetch_url) sont exécutés ici et le modèle est relancé ;
//       les outils "client" (Python, fichiers, documents) terminent l'étape :
//       le navigateur les exécute puis rappelle /api/chat avec les résultats.
//
//  Flux de sortie : une ligne JSON par événement
//    {t:"meta"}  {t:"model"}  {t:"emotion"}  {t:"thinking"}  {t:"text"}
//    {t:"tool_call"}  {t:"tool_result"}  {t:"append"}  {t:"done"}  {t:"error"}
// ============================================================

export const config = { runtime: 'edge' };

import { buildSystemInstruction, AGENT_IDS } from './_lib/prompts.js';
import { authenticate, consumeCredit, refundCredit, signTurnToken, verifyTurnToken, HttpError } from './_lib/auth.js';
import { getKnowledgeContext } from './_lib/knowledge-context.js';
import { functionDeclarations, toolWhere, runServerTool } from './_lib/tools.js';
import {
    modelCascade, isGemma, streamGenerate, consumeStream, toPlainContents,
    neutralizeSignatures, THINKING_VARIANTS, thinkingConfig,
} from './_lib/gemini.js';
import { performWebSearch } from './search.js';

const MAX_OUTPUT = {
    code: 65536, creatif: 65536, recherche: 8192, strategie: 8192,
    visionnaire: 6144, audit: 8192, default: 16384, voice: 1024,
};
const MAX_SERVER_ROUNDS = 5;      // relances successives après des outils serveur
const MAX_EMPTY_RETRIES = 2;      // relances automatiques d'une réponse vide / appel mal formé
const MAX_CONTENTS = 120;         // messages max acceptés dans l'historique
const MAX_TOOL_RESPONSE_CHARS = 30000;

const jsonError = (status, error) =>
    new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });

export default async function handler(req) {
    if (req.method !== 'POST') return jsonError(405, 'Méthode non autorisée');

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return jsonError(500, 'Clé API absente côté serveur.');

    const body = await req.json().catch(() => null);
    if (!body) return jsonError(400, 'Corps de requête invalide.');

    // ── 1. Validation de l'entrée ────────────────────────────
    let contents;
    try {
        contents = sanitizeContents(body);
    } catch (e) {
        return jsonError(400, e.message);
    }
    const mode = body.mode === 'voice' ? 'voice' : 'chat';
    const agentId = AGENT_IDS.includes(body.agentId) ? body.agentId : 'default';
    const isContinuation = Boolean(body.continuation?.token);

    // ── 2. Auth + quota ──────────────────────────────────────
    let userId, credits = null, turnToken;
    try {
        ({ userId } = await authenticate(req));
        if (isContinuation) {
            if (!(await verifyTurnToken(body.continuation.token, userId))) {
                throw new HttpError(401, 'Tour expiré. Renvoie ton message.');
            }
            turnToken = body.continuation.token;
        } else {
            credits = await consumeCredit(userId);
            turnToken = await signTurnToken(userId);
        }
    } catch (e) {
        return jsonError(e.status || 500, e.message);
    }

    // ── 3. Contexte ─────────────────────────────────────────
    const lastUserText = findLastUserText(contents);
    const taskText = findTaskText(contents) || lastUserText;
    const heavy = mode === 'chat' && isHeavyTask(agentId, taskText);
    const ui = heavy && UI_TASK.test(taskText);
    const backend = heavy && BACKEND_TASK.test(taskText);
    const knowledge = mode === 'chat' ? await getKnowledgeContext(userId, agentId, lastUserText) : '';
    const context = body.context || {};
    const systemFor = (toolsEnabled) => buildSystemInstruction({
        heavy,
        ui,
        backend,
        agentId: agentId === 'default' ? null : agentId,
        mode,
        userMessage: lastUserText,
        memory: context.memory,
        profile: context.profile,
        knowledge,
        toolsEnabled,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (ev) => controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
            send({ t: 'meta', turnToken, credits, heavy });

            try {
                const ok = await runAgent({
                    send, contents, agentId, mode, isContinuation, systemFor, lastUserText, heavy,
                    preferredModel: body.continuation?.model, apiKey: GEMINI_API_KEY, signal: req.signal,
                });
                if (!ok && !isContinuation) await refundCredit(userId);
            } catch (e) {
                if (!isContinuation) await refundCredit(userId);
                send({ t: 'error', v: e.message || 'Erreur interne.' });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
        },
    });
}

// ============================================================
//  BOUCLE SERVEUR
//  @returns {Promise<boolean>} false si aucun modèle n'a répondu
// ============================================================
async function runAgent({ send, contents, agentId, mode, isContinuation, systemFor, lastUserText, heavy, preferredModel, apiKey, signal }) {
    const cascade = modelCascade(agentId, preferredModel, heavy);
    let sigModel = isContinuation ? preferredModel : null; // modèle auteur des thoughtSignature présentes
    let emotionSent = false;
    let callSeq = 0;
    let emptyRetries = 0;

    for (let round = 0; round < MAX_SERVER_ROUNDS; round++) {
        const firstRound = round === 0 && !isContinuation;
        const result = await callWithCascade({
            cascade, contents, agentId, mode, systemFor, apiKey, signal, lastUserText, heavy, sigModel,
            forceTools: firstRound ? forcedTools(agentId, lastUserText) : null,
            allowPreSearch: firstRound,
            onModel: (model) => send({ t: 'model', v: model }),
            handlers: {
                onText: (v) => send({ t: 'text', v }),
                onThinking: (v) => send({ t: 'thinking', v }),
                onEmotion: (v) => { if (!emotionSent) { emotionSent = true; send({ t: 'emotion', v }); } },
            },
        });

        if (result.error) {
            send({ t: 'error', v: result.error, code: result.code });
            return false;
        }

        const { content, calls, finishReason, blockReason } = result;
        sigModel = result.model;
        // La cascade suivante (même requête) privilégie le modèle qui a répondu
        if (cascade[0] !== result.model) {
            cascade.splice(cascade.indexOf(result.model), 1);
            cascade.unshift(result.model);
        }

        // Réponse vide (réflexion seule) ou appel d'outil au JSON cassé : on relance avec une consigne
        const empty = !calls.length && !blockReason && !content.parts.some(p => p.text && p.text.trim());
        if (empty && emptyRetries < MAX_EMPTY_RETRIES && round < MAX_SERVER_ROUNDS - 1) {
            emptyRetries++;
            const malformed = /MALFORMED|UNEXPECTED_TOOL/i.test(finishReason || '');
            send({ t: 'notice', v: malformed ? "Appel d'outil mal formé — nouvelle tentative…" : 'Réponse vide — nouvelle tentative…' });
            nudgeLastUser(contents, malformed
                ? "[Consigne système] Ton dernier appel d'outil était mal formé (JSON invalide ou contenu trop long). Reprends exactement où tu en étais. Découpe les gros fichiers : write_file de moins de 250 lignes, puis complète avec d'autres write_file (fichiers séparés) ou edit_file. Échappe correctement les guillemets et retours à la ligne."
                : "[Consigne système] Ta dernière réponse était vide. Reprends où tu en étais : annonce ton plan en une phrase puis appelle l'outil nécessaire, ou donne ta réponse finale.");
            continue;
        }

        if (!calls.length) {
            send({ t: 'append', content });
            send({ t: 'done', reason: blockReason ? 'blocked' : (finishReason || 'STOP').toLowerCase() });
            return true;
        }

        // ── Appels d'outils ─────────────────────────────────
        const ids = calls.map(() => `call_${Date.now().toString(36)}_${callSeq++}`);
        calls.forEach((c, i) => send({
            t: 'tool_call', id: ids[i], name: c.name, args: c.args || {}, where: toolWhere(c.name),
        }));

        const serverIdx = calls.map((c, i) => i).filter(i => toolWhere(calls[i].name) === 'server');
        const executed = await Promise.all(serverIdx.map(i => runServerTool(calls[i].name, calls[i].args || {})));

        const serverResponses = {};
        serverIdx.forEach((i, k) => {
            const { response, display } = executed[k];
            send({ t: 'tool_result', id: ids[i], name: calls[i].name, ok: !response.error, display });
            serverResponses[ids[i]] = functionResponsePart(calls[i], response);
        });

        send({ t: 'append', content });

        const clientIdx = calls.map((c, i) => i).filter(i => toolWhere(calls[i].name) === 'client');
        if (clientIdx.length) {
            // Le navigateur exécute ses outils puis rappelle /api/chat
            // avec TOUTES les réponses, dans l'ordre des appels.
            send({
                t: 'done',
                reason: 'client_tools',
                order: ids,
                serverResponses,
                callMeta: Object.fromEntries(ids.map((id, i) => [id, { name: calls[i].name, modelId: calls[i].id || null }])),
            });
            return true;
        }

        contents.push(content, { role: 'user', parts: ids.map(id => serverResponses[id]) });
        send({ t: 'append', content: contents[contents.length - 1] });
    }

    send({ t: 'text', v: "\n\n*[Limite d'étapes atteinte pour cette réponse.]*" });
    send({ t: 'done', reason: 'max_rounds' });
    return true;
}

/** Ajoute une consigne au dernier message utilisateur (l'API exige l'alternance des rôles). */
function nudgeLastUser(contents, text) {
    const last = contents[contents.length - 1];
    if (last && last.role === 'user') last.parts.push({ text });
    else contents.push({ role: 'user', parts: [{ text }] });
}

function functionResponsePart(call, response) {
    let payload = response;
    const raw = JSON.stringify(response);
    if (raw.length > MAX_TOOL_RESPONSE_CHARS) payload = { truncated: true, content: raw.slice(0, MAX_TOOL_RESPONSE_CHARS) };
    const fr = { name: call.name, response: payload };
    if (call.id) fr.id = call.id;
    return { functionResponse: fr };
}

// ============================================================
//  CASCADE DE MODÈLES
// ============================================================
async function callWithCascade({ cascade, contents, agentId, mode, systemFor, apiKey, signal, forceTools, allowPreSearch, lastUserText, heavy, sigModel, onModel, handlers }) {
    const hasToolParts = contents.some(c => c.parts.some(p => p.functionCall || p.functionResponse));

    for (const model of cascade) {
        const gemma = isGemma(model);
        let useTools = mode === 'chat' && !gemma;
        const variants = gemma ? ['off'] : THINKING_VARIANTS[heavy ? 'heavy' : 'normal'];
        let variant = 0;
        const modelContents = sigModel && model !== sigModel && hasToolParts ? neutralizeSignatures(contents) : contents;

        // Plusieurs variantes par modèle si le 400 vient d'un paramètre non supporté
        for (let attempt = 0; attempt < 6; attempt++) {
            const body = await buildBody({
                model, contents: modelContents, agentId, mode, systemFor, useTools,
                thinking: thinkingConfig(variants[variant]),
                forceTools: useTools ? forceTools : null,
                preSearchQuery: allowPreSearch && !useTools && mode === 'chat' ? preSearchQuery(agentId, lastUserText) : null,
            });

            let response;
            try {
                response = await streamGenerate(model, body, apiKey, signal);
            } catch (e) {
                if (signal?.aborted) return { error: 'Requête annulée.' };
                break; // erreur réseau → modèle suivant
            }

            if (response.ok) {
                onModel(model);
                const out = await consumeStream(response, handlers);
                return { ...out, model };
            }

            if (response.status === 429 || response.status >= 500) break;

            const errMsg = (await response.json().catch(() => ({})))?.error?.message || '';
            if (response.status === 400 || response.status === 404) {
                if (/too long|exceeds? the maximum|context window|token count/i.test(errMsg)) {
                    return {
                        error: "Le contenu est trop volumineux pour être analysé en entier. Copie-colle uniquement la section qui t'intéresse.",
                        code: 413,
                    };
                }
                if (/thinking|thought/i.test(errMsg) && variant < variants.length - 1) { variant++; continue; }
                if (useTools && !hasToolParts && /function|tool/i.test(errMsg)) { useTools = false; continue; }
                break;
            }
            return { error: errMsg || `Erreur API (${response.status})`, code: response.status };
        }
    }
    return { error: 'Serveurs IA saturés. Réessaie dans quelques secondes.', code: 503 };
}

async function buildBody({ model, contents, agentId, mode, systemFor, useTools, thinking, forceTools, preSearchQuery: query }) {
    const systemInstruction = systemFor(useTools);
    let finalContents = contents;

    // Modèles sans outils : recherche web injectée en amont (heuristique)
    if (query) {
        const ctx = await performWebSearch(query, 5).then(formatSearchContext).catch(() => '');
        if (ctx) finalContents = prependToLastUser(contents, ctx);
    }

    const body = {
        contents: isGemma(model) ? toPlainContents(finalContents, systemInstruction) : finalContents,
        generationConfig: {
            maxOutputTokens: mode === 'voice' ? MAX_OUTPUT.voice : (MAX_OUTPUT[agentId] || MAX_OUTPUT.default),
        },
    };
    if (!isGemma(model)) body.systemInstruction = { parts: [{ text: systemInstruction }] };
    if (thinking) body.generationConfig.thinkingConfig = thinking;
    if (useTools) {
        body.tools = [{ functionDeclarations: functionDeclarations() }];
        if (forceTools) {
            body.toolConfig = { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: forceTools } };
        }
    }
    return body;
}

// ── Outils imposés au premier tour ──────────────────────────
// Les modèles Lite appellent rarement un outil d'eux-mêmes : quand la demande
// l'exige explicitement, on force l'appel (mode ANY) au premier tour seulement.
const EXPLICIT_RUN = /\b(ex[ée]cut\w*|lance[rz]?|run|teste[rz]?|calcule[rz]?|simule[rz]?)\b[^.?!]{0,60}\bpython\b|\bpython\b[^.?!]{0,60}\b(ex[ée]cut\w*|lance[rz]?|run)\b/i;
const SHELL_TASK = /\b(npm|npx|pnpm|yarn|pip3?|git|bash|shell|terminal|ligne de commande|en commande|compile[rz]?|build|tests? unitaires|lance[rz]? (le|un) serveur|install(e|er|ez)\b)/i;

// ── Tâche lourde → modèles complets + réflexion maximale ─────
const CODE_WORK = /\b(cr[ée]e[rz]?|d[ée]veloppe[rz]?|code[rz]?|impl[ée]mente[rz]?|construi[st]|programme[rz]?|refactor\w*|d[ée]bogue[rz]?|debug\w*|corrige[rz]?|r[ée]pare[rz]?|optimise[rz]?|migre[rz]?|int[èe]gre[rz]?)\b[^.?!]{0,80}\b(app\w*|site|page|landing|dashboard|tableau de bord|interface|portfolio|maquette|formulaire|api|jeu|script|projet|programme|fonction|classe|module|composant|bug|erreur|code|backend|frontend|base de donn[ée]es|serveur|bot|extension|algorithme|plateforme|logiciel|outil)\b/i;
// Tâche avec une interface visible → direction artistique exigeante
const UI_TASK = /\b(app\w*|application|site|page|landing|dashboard|tableau de bord|interface|ui|ux|front\w*|react|vue|svelte|next|tailwind|composant|formulaire|jeu|game|portfolio|maquette|design|admin|back[- ]?office|crm|gestion)\b/i;

// Tâche qui manipule des données, des comptes ou une API → vrai backend exigé
const BACKEND_TASK = /\b(api|back[- ]?end|backend|serveur|server|base de donn[ée]es|bdd|database|sql\w*|postgres\w*|mysql|mongo\w*|prisma|supabase|firebase|crud|auth\w*|login|connexion|inscription|utilisateurs?|comptes?|r[ôo]les?|express|fastify|nest\w*|django|flask|fastapi|laravel|webhook|paiement|stripe|full[- ]?stack|gestion|crm|erp|admin|back[- ]?office|inventaire|stock|r[ée]servation|e-?commerce|boutique|commandes?|factur\w*|messagerie|chat en temps r[ée]el)\b/i;

/** Texte de la demande en cours (ignore les consignes internes : auto-revue, relances). */
function findTaskText(contents) {
    for (let i = contents.length - 1; i >= 0; i--) {
        if (contents[i].role !== 'user') continue;
        const text = contents[i].parts
            .filter(p => typeof p.text === 'string' && !/^\[(AUTO-REVUE|Consigne système)/.test(p.text))
            .map(p => p.text).join('\n').trim();
        if (text) return text.slice(-4000);
    }
    return '';
}

function isHeavyTask(agentId, text) {
    const t = text || '';
    if (agentId === 'audit') return true;
    if (CODE_WORK.test(t) || SHELL_TASK.test(t)) return true;
    if (agentId === 'code' && (t.length > 250 || /```/.test(t))) return true;
    return t.length > 1500; // longue demande détaillée, quel que soit l'agent
}
function forcedTools(agentId, text) {
    if (agentId === 'recherche') return ['web_search'];
    if (agentId === 'audit') return ['run_python', 'bash', 'read_file', 'list_files'];
    // Tâches de code lourdes : pas d'appel imposé (le mode ANY interdit de rédiger le plan
    // avant d'agir) ; les modèles Flash complets choisissent leurs outils eux-mêmes.
    if (EXPLICIT_RUN.test(text || '') && !CODE_WORK.test(text || '')) return ['run_python', 'bash'];
    return null;
}

// ── Heuristique de recherche (uniquement pour les modèles sans outils) ──
function preSearchQuery(agentId, text) {
    if (!text) return null;
    const t = text.toLowerCase();
    if (agentId === 'recherche') return text.slice(0, 200);
    if (!['strategie', 'visionnaire'].includes(agentId)) return null;
    const yes = [
        /\b(actu(alité)?s?|news|récent|dernier|dernière|aujourd'hui|maintenant|en ce moment)\b/,
        /\b(prix|tarif|cours|bourse|météo|résultat|score|classement|sondage|élection)\b/,
        /\b(20(2[4-9]|[3-9]\d))\b/,
        /\b(recherche|cherche|trouve|infos? sur|renseigne[-\s]moi sur)\b/,
    ];
    return yes.some(p => p.test(t)) ? text.slice(0, 200) : null;
}

function formatSearchContext(sr) {
    if (!sr?.results?.length) return '';
    const lines = sr.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`).join('\n\n');
    return `[CONTEXTE WEB ACTUALISÉ — résultats de recherche en temps réel]\n`
        + (sr.directAnswer ? `Réponse directe : ${sr.directAnswer}\n\n` : '')
        + `${lines}\n\nUtilise ces informations et cite les sources [n] quand c'est pertinent.\n\n`;
}

function prependToLastUser(contents, text) {
    const copy = contents.slice();
    for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'user') {
            copy[i] = { role: 'user', parts: [{ text }, ...copy[i].parts] };
            break;
        }
    }
    return copy;
}

// ============================================================
//  VALIDATION DE L'HISTORIQUE ENVOYÉ PAR LE CLIENT
// ============================================================
function sanitizeContents(body) {
    let messages = body.messages;

    // Compatibilité : ancien format { prompt, files } (client en cache, mode vocal v1)
    if (!Array.isArray(messages) && typeof body.prompt === 'string') {
        const parts = [{ text: body.prompt }];
        for (const f of body.files || []) {
            if (f?.base64 && f.mime) parts.push({ inlineData: { mimeType: f.mime, data: f.base64 } });
        }
        messages = [{ role: 'user', parts }];
    }

    if (!Array.isArray(messages) || !messages.length) throw new Error('Historique de messages manquant.');

    const out = [];
    for (const m of messages.slice(-MAX_CONTENTS)) {
        const role = m?.role === 'model' || m?.role === 'assistant' ? 'model' : 'user';
        const parts = (Array.isArray(m?.parts) ? m.parts : []).map(sanitizePart).filter(Boolean);
        if (!parts.length) continue;
        // Fusion des messages consécutifs de même rôle (exigé par l'API)
        const prev = out[out.length - 1];
        if (prev && prev.role === role) prev.parts.push(...parts);
        else out.push({ role, parts });
    }
    if (!out.length || out[out.length - 1].role !== 'user') throw new Error('Le dernier message doit venir de l\'utilisateur.');
    if (out[0].role !== 'user') out.unshift({ role: 'user', parts: [{ text: '(suite de la conversation)' }] });
    return out;
}

function sanitizePart(p) {
    if (!p || typeof p !== 'object') return null;
    const sig = typeof p.thoughtSignature === 'string' ? { thoughtSignature: p.thoughtSignature } : {};
    if (typeof p.text === 'string') return { text: p.text, ...sig };
    const inline = p.inlineData || p.inline_data;
    if (inline?.data) return { inlineData: { mimeType: String(inline.mimeType || inline.mime_type || ''), data: String(inline.data) } };
    const file = p.fileData || p.file_data;
    if (file?.fileUri || file?.file_uri) return { fileData: { mimeType: String(file.mimeType || file.mime_type || ''), fileUri: String(file.fileUri || file.file_uri) } };
    if (p.functionCall?.name) {
        const fc = { name: String(p.functionCall.name), args: p.functionCall.args || {} };
        if (p.functionCall.id) fc.id = String(p.functionCall.id);
        return { functionCall: fc, ...sig };
    }
    if (p.functionResponse?.name) {
        const fr = { name: String(p.functionResponse.name), response: p.functionResponse.response || {} };
        if (p.functionResponse.id) fr.id = String(p.functionResponse.id);
        return { functionResponse: fr };
    }
    return null;
}

function findLastUserText(contents) {
    for (let i = contents.length - 1; i >= 0; i--) {
        if (contents[i].role !== 'user') continue;
        const text = contents[i].parts.filter(p => typeof p.text === 'string').map(p => p.text).join('\n').trim();
        if (text) return text.slice(-4000);
    }
    return '';
}
