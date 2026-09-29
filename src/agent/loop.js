// ============================================================
//  PENSÉE IA — src/agent/loop.js
//  Boucle d'agent côté navigateur (même principe que Claude Code) :
//
//    appel modèle ──► texte / appels d'outils
//        ▲                     │
//        └── résultats ◄── exécution locale (Python, fichiers…)
//
//  jusqu'à ce que le modèle réponde sans outil. Un seul crédit par
//  message : les continuations présentent le jeton de tour signé.
// ============================================================

import { CONFIG } from '../config.js';
import { state, workspaceId } from '../state.js';
import { setCredits } from '../credits.js';
import { copyToWorkspace } from '../files.js';
import { generateOfficeFile, generatePdf } from '../generators.js';
import { terminal } from '../ui/terminal.js';
import { streamChat, ApiError } from './stream.js';
import { buildContents } from './history.js';
import { executeClientTool, FINAL_TOOLS } from './tools.js';

/**
 * @param {object} o
 * @param {string} o.userText
 * @param {object[]} o.files
 * @param {string|null} o.agentId
 * @param {string} o.memory
 * @param {import('../ui/turn-view.js').TurnView} o.view
 * @param {AbortSignal} o.signal
 * @returns {Promise<{text: string, sources: object[], trace: object[]}>}
 */
const CODE_TOOLS = new Set(['write_file', 'edit_file', 'bash', 'run_python']);

// Message technique envoyé au modèle (jamais affiché ni sauvegardé comme message utilisateur)
const REVIEW_PROMPT = `[AUTO-REVUE — consigne interne, pas un message de l'utilisateur]
Avant de conclure, relis et corrige le code comme un relecteur exigeant :
1. Relis réellement les fichiers créés ou modifiés (read_file, ou bash : cat / git diff).
2. Confronte-les à la demande initiale : tout est-il implémenté, complet, sans TODO, placeholder ni donnée factice ?
3. Le code a-t-il été exécuté ou testé avec succès ? Sinon, teste-le maintenant, cas limites compris.
4. Corrige chaque problème trouvé puis revérifie.
Si tout est conforme : réponds uniquement « ✓ Vérifié — » suivi d'une phrase. Sinon : corrige, puis résume précisément ce qui a changé. Si des livrables ont été modifiés, relivre-les avec present_files.`;

export async function runAgentTurn({ userText, files = [], agentId, memory = '', view, signal }) {
    const ws = workspaceId();
    const workspacePaths = files.length ? await copyToWorkspace(files, ws) : [];
    const contents = buildContents(state.history, userText, files, workspacePaths);
    const context = { memory, profile: localStorage.getItem('pensee_user_profile') || '' };

    let token = null;
    let model = null;
    let heavy = false;
    let reviewed = false;
    const sources = [];
    const trace = [];

    for (let step = 0; step < CONFIG.maxAgentSteps; step++) {
        const clientCalls = [];
        let done = null;

        await streamChat({
            agentId: agentId || 'default',
            mode: 'chat',
            messages: contents,
            context,
            continuation: token ? { token, model } : undefined,
        }, {
            signal,
            onEvent(ev) {
                switch (ev.t) {
                    case 'meta':
                        if (ev.turnToken) token = ev.turnToken;
                        if (typeof ev.credits === 'number') setCredits(ev.credits);
                        if (ev.heavy) heavy = true;
                        break;
                    case 'model': model = ev.v; break;
                    case 'emotion': view.emotion(ev.v); break;
                    case 'notice': view.note(ev.v, 'warn'); break;
                    case 'thinking': view.thinking(ev.v); break;
                    case 'text': view.text(ev.v); break;
                    case 'tool_call': {
                        const card = view.toolStart(ev);
                        if (ev.where === 'client') clientCalls.push({ ...ev, card });
                        else terminal.log(`${ev.name} ${JSON.stringify(ev.args)}`, 'cmd');
                        break;
                    }
                    case 'tool_result':
                        onServerResult(ev, { view, sources, trace });
                        break;
                    case 'append': contents.push(ev.content); break;
                    case 'done': done = ev; break;
                    case 'error': throw new ApiError(ev.code || 500, ev.v);
                }
            },
        });

        if (!done) throw new Error('Connexion interrompue pendant la réponse.');
        if (done.reason === 'blocked') view.note('Réponse bloquée par le filtre de sécurité du modèle.', 'warn');
        if (done.reason === 'max_tokens') view.note('Réponse tronquée (longueur maximale atteinte). Demande la suite.', 'warn');
        if (/malformed|unexpected_tool/.test(done.reason)) view.note("Le modèle n'a pas réussi à formuler son appel d'outil. Dis « continue » ou découpe la demande.", 'warn');
        if (done.reason !== 'client_tools') {
            // Tâche lourde qui a produit du code : une relecture obligatoire avant de conclure
            const producedCode = trace.some(t => CODE_TOOLS.has(t.name));
            if (heavy && producedCode && !reviewed && done.reason === 'stop' && step < CONFIG.maxAgentSteps - 2) {
                reviewed = true;
                view.note('Auto-vérification du travail…');
                contents.push({ role: 'user', parts: [{ text: REVIEW_PROMPT }] });
                continue;
            }
            break;
        }

        // ── Exécution locale des outils demandés ──────────────
        const responses = { ...done.serverResponses };
        let allFinal = true;
        for (const call of clientCalls) {
            if (signal.aborted) throw new DOMException('Annulé', 'AbortError');
            const res = await executeClientTool(call.name, call.args, { ws, card: call.card, terminal });
            view.toolEnd(call.id, res);
            trace.push({ name: call.name, summary: traceSummary(call), ok: res.ok });

            const meta = done.callMeta?.[call.id] || {};
            responses[call.id] = {
                functionResponse: { name: call.name, response: res.response, ...(meta.modelId ? { id: meta.modelId } : {}) },
            };
            if (!FINAL_TOOLS.has(call.name) || !res.ok) allFinal = false;
        }
        contents.push({ role: 'user', parts: done.order.map(id => responses[id]).filter(Boolean) });

        // Livrables affichés sans erreur : inutile de relancer le modèle… sauf relecture due
        if (allFinal) {
            if (heavy && !reviewed && trace.some(t => CODE_TOOLS.has(t.name)) && step < CONFIG.maxAgentSteps - 2) {
                reviewed = true;
                view.note('Auto-vérification du travail…');
                contents.push({ role: 'user', parts: [{ text: REVIEW_PROMPT }] });
                continue;
            }
            break;
        }
        if (step === CONFIG.maxAgentSteps - 1) view.note(`Limite de ${CONFIG.maxAgentSteps} étapes atteinte. Dis « continue » pour poursuivre.`, 'warn');
    }

    await handleLegacyMarkers(view);
    return { text: view.fullText(), sources, trace };
}

function onServerResult(ev, { view, sources, trace }) {
    const d = ev.display || {};
    let summary = d.error ? 'erreur' : '';
    if (ev.name === 'web_search' && d.results) {
        for (const r of d.results) {
            if (!sources.some(s => s.url === r.url)) sources.push({ n: sources.length + 1, title: r.title, url: r.url });
        }
        summary = `${d.results.length} résultat(s)`;
        trace.push({ name: 'web_search', summary: `« ${d.query} »`, ok: ev.ok });
    } else if (ev.name === 'fetch_url') {
        summary = d.error ? 'inaccessible' : `${Math.round((d.chars || 0) / 1000)}k caractères`;
        trace.push({ name: 'fetch_url', summary: d.url || '', ok: ev.ok });
    }
    view.toolEnd(ev.id, { ok: ev.ok, summary });
    terminal.log(d.error ? `✗ ${d.error}` : `✓ ${summary}`, d.error ? 'err' : 'ok');
}

function traceSummary(call) {
    const a = call.args || {};
    return a.paths ? a.paths.join(', ').slice(0, 60) : a.command ? String(a.command).slice(0, 60) : a.port ? 'port ' + a.port : a.path || a.filename || a.title || (a.prompt ? String(a.prompt).slice(0, 40) : '');
}

// ── Modèles sans outils (Gemma) : marqueurs texte hérités ─────
async function handleLegacyMarkers(view) {
    const text = view.fullText();
    const pdf = text.match(/\[GENERATE_PDF:\s*([^|\]]+)\|([\s\S]+)\][ \t]*$/i);
    const file = text.match(/\[GENERATE_FILE:\s*(xlsx|pptx|docx|csv)\s*\|\s*(\{[\s\S]*\})\]/i);
    if (!pdf && !file) return;

    view.rewriteSegments(t => t
        .replace(/\[GENERATE_PDF:\s*[^|\]]+\|[\s\S]+\][ \t]*$/i, '')
        .replace(/\[GENERATE_FILE:\s*(xlsx|pptx|docx|csv)\s*\|\s*\{[\s\S]*\}\]/i, '')
        .trim());
    try {
        if (pdf) view.append((await generatePdf({ title: pdf[1].trim(), html: pdf[2].trim() })).element);
        if (file) view.append((await generateOfficeFile({ type: file[1], ...JSON.parse(file[2]) })).element);
    } catch (e) {
        view.note('Génération du fichier impossible : ' + e.message, 'error');
    }
}
