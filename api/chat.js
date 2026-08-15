// ============================================================
//  PENSÉE IA — api/chat.js (Vercel Edge & Streaming)
//  Multi-agents, Security Validation, Intelligent Model Routing
// ============================================================

export const config = {
    runtime: 'edge'
};

import { performWebSearch } from './search.js';

// ============================================================
//  CONFIGURATION DES AGENTS
// ============================================================
const AGENTS = {
    code: {
        temperature: 0.2,
        topP: 0.90,
        topK: 40,
        maxOutputTokens: 65536,
        useSearch: false,
    },
    recherche: {
        temperature: 0.6,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
        useSearch: true,
    },
    creatif: {
        temperature: 1.0,
        topP: 0.98,
        topK: 64,
        maxOutputTokens: 65536,
        useSearch: false,
    },
    strategie: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
        useSearch: true,
    },
    visionnaire: {
        temperature: 0.9,
        topP: 0.97,
        topK: 64,
        maxOutputTokens: 6144,
        useSearch: true,
    },
    audit: {
        temperature: 0.1,
        topP: 0.85,
        topK: 32,
        maxOutputTokens: 8192,
        useSearch: false,
    },
    default: {
        temperature: 0.5,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 16384,
        useSearch: false,
    }
};

// ============================================================
//  UTILITAIRE : Stripper les blocs de thinking Gemma
//  Gemma 4 encapsule son raisonnement entre <|channel>thought\n...<channel|>
//  Gemma 3 peut émettre des <think>...</think> ou [INTENT]...[OUTPUT] en texte brut
//  Ces deux formats doivent être supprimés avant d'envoyer au client.
// ============================================================
function stripGemmaThinking(text) {
    // Format Gemma 4 : <|channel>thought\n....<channel|>
    text = text.replace(/<\|channel>thought[\s\S]*?<channel\|>/g, "");
    // Format <think>...</think> (certains modèles Gemma 3)
    text = text.replace(/<think>[\s\S]*?<\/think>/g, "");
    // Nettoyage des éventuels sauts de ligne orphelins en début de réponse
    text = text.replace(/^\n+/, "");
    return text;
}

export default async function handler(req) {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
    }

    // ============================================================
    //  1. SÉCURITÉ : VALIDATION SUPABASE (EDGE)
    // ============================================================
    const authHeader = req.headers.get('Authorization');
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let knowledgeUserId = null; // capturé pendant la validation auth

    // Si le système est configuré pour la prod (clés présentes), on verrouille.
    if (SUPABASE_URL && SUPABASE_KEY) {
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Accès refusé. Token manquant." }), { status: 401 });
        }

        try {
            const token = authHeader.replace('Bearer ', '');
            
            const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY }
            });
            if (!userRes.ok) throw new Error("Token expiré ou invalide.");
            const user = await userRes.json();
            knowledgeUserId = user.id; // ← capture pour le knowledge system

            const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=credits_used`, {
                headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
            });
            const profiles = await profRes.json();
            const creditsUsed = profiles[0]?.credits_used || 0;

            if (creditsUsed >= 20) {
                return new Response(JSON.stringify({ error: "Quota journalier épuisé (20/20)." }), { status: 403 });
            }

            await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${SUPABASE_KEY}`, 
                    'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ credits_used: creditsUsed + 1 })
            });

        } catch (e) {
            return new Response(JSON.stringify({ error: "Erreur de validation: " + e.message }), { status: 401 });
        }
    } else {
        console.warn("[PENSÉE] Mode dev : Variables Supabase manquantes, sécurité bypassée.");
    }

    // ============================================================
    //  2. TRAITEMENT DE LA REQUÊTE
    // ============================================================
    const bodyReq = await req.json().catch(() => ({}));
    const { prompt, files, systemInstruction: rawSystemInstruction, agentId } = bodyReq;

    // ============================================================
    //  Garde anti-auto-présentation : empêche le modèle de rappeler
    //  son identité ("Je suis Pensée IA...") à chaque réponse.
    //  Particulièrement nécessaire pour Gemma, qui suit moins bien
    //  les instructions implicites et a tendance à se réintroduire
    //  systématiquement quand l'identité figure dans le system prompt.
    // ============================================================
    const ANTI_INTRO_GUARD =
        "\n\n[RÈGLE DE COMPORTEMENT]\nNe te présente jamais (nom, identité, capacités, " +
        "qui t'a créé) sauf si l'utilisateur te le demande explicitement dans son message " +
        "actuel (ex: \"qui es-tu ?\", \"tu es quoi ?\"). Réponds directement et uniquement " +
        "à la question posée, sans préambule d'identité ni rappel de ton nom.";

    // Instruction émotion : le modèle préfixe chaque réponse avec un token JSON compact
    // sur UNE seule ligne, avant tout autre texte. Format : {"e":"EMOTION","i":INTENSITE}
    // Émotions possibles : confiance, hesitation, surprise, concentration, empathie, enthousiasme, incertitude
    // Intensité : float 0.0–1.0
    const EMOTION_INSTRUCTION =
        "\n\n[SIGNAL ÉMOTIONNEL + VOCAL — OBLIGATOIRE]\n" +
        "Commence CHAQUE réponse par un JSON compact sur UNE seule ligne, entre <EM> et </EM>.\n" +
        "Format EXACT (respecte tous les champs) :\n" +
        "<EM>{\"e\":\"EMOTION\",\"i\":INTENSITE,\"v\":\"VOIX\",\"r\":RYTHME}</EM>\n\n" +
        "Champs :\n" +
        "• e (émotion) : confiance | hesitation | surprise | concentration | empathie | enthousiasme | incertitude\n" +
        "• i (intensité) : float 0.0–1.0\n" +
        "• v (voix/posture vocale) : chaleureux | pose | vif | doux | grave | energique | curieux\n" +
        "  - chaleureux = ton proche, empathique. pose = calme, mesuré. vif = rapide, alerte.\n" +
        "  - doux = bienveillant, rassurant. grave = sérieux, réfléchi. energique = enthousiaste.\n" +
        "  - curieux = questionneur, montant en fin de phrase.\n" +
        "• r (rythme relatif) : float 0.7 (lent/posé) à 1.3 (rapide/enthousiaste). Défaut 1.0.\n\n" +
        "Exemples :\n" +
        "<EM>{\"e\":\"concentration\",\"i\":0.85,\"v\":\"grave\",\"r\":0.85}</EM>\n" +
        "<EM>{\"e\":\"enthousiasme\",\"i\":0.9,\"v\":\"energique\",\"r\":1.2}</EM>\n" +
        "<EM>{\"e\":\"empathie\",\"i\":0.7,\"v\":\"doux\",\"r\":0.9}</EM>\n\n" +
        "Choisis toujours selon le VRAI contenu de ta réponse. " +
        "Une mauvaise nouvelle → empathie + doux + 0.85. Une idée excitante → enthousiasme + energique + 1.15. " +
        "Cette balise est la toute première chose dans ta réponse. Ne la mentionne jamais à l'utilisateur.";

    if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt manquant." }), { status: 400 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Clé API absente." }), { status: 401 });
    }

    const agentConfig = AGENTS[agentId] || AGENTS.default;

    // ============================================================
    //  2bis. RECHERCHE WEB MANUELLE — déclenchée uniquement si
    //  l'agent l'autorise ET que la question nécessite réellement
    //  des informations récentes/externes (détection d'intention).
    // ============================================================

    // Détection : la question a-t-elle besoin d'une recherche web ?
    function needsWebSearch(text) {
        const t = text.toLowerCase();

        // Signaux négatifs explicites → pas de recherche
        const noSearchPatterns = [
            /^(bonjour|salut|bonsoir|hello|coucou|ça va|ca va|merci|svp|stp)\b/,
            /^(explique|c'est quoi|qu'est[-\s]ce que|définis|définition|comment fonctionne)/,
            /^(aide|aidez|help|aide[-\s]moi|peux[-\s]tu|pouvez[-\s]vous)\b/,
            /\b(écris|rédige|génère|crée|résume|traduis|corrige|améliore|reformule)\b/,
            /\b(mon code|ce code|ce texte|ce fichier|cette image|ci[-\s]dessus|ci[-\s]joint)\b/,
            /\b(exemple|exemples|liste|énumère|compare|différence entre)\b/,
            /\b(qu'est[-\s]ce que tu|tu es|tu peux|tu sais|tes capacités)\b/,
        ];
        if (noSearchPatterns.some(p => p.test(t))) return false;

        // Signaux positifs → recherche utile
        const yesSearchPatterns = [
            /\b(actu(alité)?s?|news|récent|dernier|dernière|aujourd'hui|maintenant|en ce moment)\b/,
            /\b(prix|tarif|cours|bourse|météo|résultat|score|classement|sondage|élection)\b/,
            /\b(qui est|c'est qui|c'est quoi comme|c'est quoi le)\b.{0,30}\b(président|ceo|directeur|champion)\b/,
            /\b(version|release|changelog|mise à jour|update)\b.{0,30}\b(20(2[3-9]|[3-9]\d))\b/,
            /\b(20(2[4-9]|[3-9]\d))\b/, // Mention d'une année récente
            /\b(sortie|lancé|annoncé|publié)\b.{0,30}(récemment|cette année|ce mois)/,
            /\b(site|lien|url|page web|article|source)\b/,
            /\b(recherche|cherche|trouve|infos? sur|renseigne[-\s]moi sur)\b/,
        ];
        if (yesSearchPatterns.some(p => p.test(t))) return true;

        // Par défaut : pas de recherche pour une question courte (<80 chars sans signal clair)
        return t.length > 120;
    }

    // ── RECHERCHE WEB + KNOWLEDGE CONTEXT (parallèle) ────────────
    const shouldSearch = agentConfig.useSearch && (
        agentId === 'recherche' || needsWebSearch(prompt)
    );

    // Fonctions knowledge inline (pas de fetch interne — Vercel Edge limitation)
    async function getKnowledgeContext(userId, agentIdK, promptK) {
        if (!SUPABASE_URL || !SUPABASE_KEY || !userId) return "";
        try {
            const sbH = {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json',
            };

            // Charge les exemples few-shot
            const rows = await fetch(
                `${SUPABASE_URL}/rest/v1/knowledge_examples?user_id=eq.${userId}&agent_id=eq.${agentIdK}&order=score.desc&limit=50`,
                { headers: sbH }
            ).then(r => r.ok ? r.json() : []).catch(() => []);

            // Charge le profil utilisateur
            const profiles = await fetch(
                `${SUPABASE_URL}/rest/v1/user_profile_cache?user_id=eq.${userId}&limit=1`,
                { headers: sbH }
            ).then(r => r.ok ? r.json() : []).catch(() => []);

            let contextBlock = "";

            // Profil
            if (profiles.length > 0) {
                try {
                    const p = JSON.parse(profiles[0].profile_json || '{}');
                    const lines = [];
                    if (p.expertise?.length)        lines.push(`Expertise : ${p.expertise.slice(0,8).join(', ')}`);
                    if (p.projects?.length)         lines.push(`Projets actifs : ${p.projects.slice(0,5).join(', ')}`);
                    if (p.frequent_domains?.length) lines.push(`Domaines fréquents : ${p.frequent_domains.join(', ')}`);
                    if (p.context)                  lines.push(`Contexte : ${p.context}`);
                    if (lines.length) {
                        contextBlock += `[PROFIL UTILISATEUR]\n${lines.join('\n')}\nAdapte ta réponse à ce profil. Ne réexplique pas ce qu'il maîtrise.\n\n`;
                    }
                } catch (_) {}
            }

            // Few-shot : similarité simple par mots-clés communs
            if (rows.length > 0) {
                const promptWords = new Set(
                    promptK.toLowerCase().replace(/[^a-zàâçéèêëîïôùûü\s]/g, ' ')
                        .split(/\s+/).filter(w => w.length > 4)
                );
                const scored = rows
                    .map(row => {
                        try {
                            const kw = JSON.parse(row.prompt_keywords || '[]');
                            const hits = kw.filter(w => promptWords.has(w)).length;
                            return { ...row, sim: hits / Math.max(promptWords.size, 1) };
                        } catch (_) { return { ...row, sim: 0 }; }
                    })
                    .filter(r => r.sim > 0.1)
                    .sort((a, b) => (b.sim * b.score) - (a.sim * a.score))
                    .slice(0, 2);

                if (scored.length > 0) {
                    const examples = scored.map((ex, i) =>
                        `Exemple ${i+1} (qualité ${ex.score}/10) :\n${ex.response_text.slice(0, 500)}`
                    ).join('\n\n---\n\n');
                    contextBlock += `[EXEMPLES DE RÉFÉRENCE — TES MEILLEURES RÉPONSES SIMILAIRES]\nCalibrage qualité — même niveau ou mieux. Ne les cite pas.\n\n${examples}\n\n`;
                }
            }

            return contextBlock;
        } catch (e) {
            console.warn('[Knowledge inline]', e.message);
            return "";
        }
    }

    const [searchSettled, knowledgeSettled] = await Promise.allSettled([
        shouldSearch ? performWebSearch(prompt, 5) : Promise.resolve(null),
        getKnowledgeContext(knowledgeUserId, agentId, prompt),
    ]);

    // Web search context
    let searchContextBlock = "";
    const sr = searchSettled.status === 'fulfilled' ? searchSettled.value : null;
    if (sr?.results?.length) {
        const lines = sr.results.map((r, i) =>
            `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`
        ).join('\n\n');
        searchContextBlock =
            `[CONTEXTE WEB ACTUALISÉ — résultats de recherche en temps réel]\n` +
            (sr.directAnswer ? `Réponse directe : ${sr.directAnswer}\n\n` : '') +
            `${lines}\n\n` +
            `Utilise ces informations pour répondre de façon précise et à jour. ` +
            `Cite tes sources quand c'est pertinent.\n\n`;
    }

    // Knowledge context
    const knowledgeContextBlock = knowledgeSettled.status === 'fulfilled'
        ? (knowledgeSettled.value || "")
        : "";

    // ── System instruction finale (assemblée ici, après knowledge) ──
    const systemInstruction = (rawSystemInstruction || "")
        + knowledgeContextBlock
        + ANTI_INTRO_GUARD
        + EMOTION_INSTRUCTION;

    // ── CASCADE DE MODÈLES — optimisée quotas août 2026 ──────────
    // Priorité aux modèles à fort quota RPD : Flash Lite (500) > Gemma 4 (14400) > Flash premium (20)
    let modelsToTry = [];

    if (agentId === 'code' || agentId === 'audit') {
        modelsToTry = [
            "gemini-3.5-flash-lite",   // 500 RPD — primaire
            "gemini-3.1-flash-lite",   // 500 RPD — fallback solide
            "gemini-3.7-flash",        // 20 RPD
            "gemini-3.6-flash",        // 20 RPD
            "gemma-4-31b-it",          // 14 400 RPD
            "gemma-4-26b-a4b-it",      // 14 400 RPD
        ];
    } else if (agentId === 'creatif') {
        modelsToTry = [
            "gemini-3.5-flash-lite",   // 500 RPD
            "gemini-3.6-flash",        // 20 RPD
            "gemini-3.1-flash-lite",   // 500 RPD
            "gemma-4-31b-it",          // 14 400 RPD
            "gemma-4-26b-a4b-it",      // 14 400 RPD
        ];
    } else {
        modelsToTry = [
            "gemini-3.5-flash-lite",   // 500 RPD — primaire volume
            "gemini-3.1-flash-lite",   // 500 RPD — primaire volume
            "gemini-3.7-flash",        // 20 RPD
            "gemini-3.6-flash",        // 20 RPD
            "gemini-3.5-flash",        // 20 RPD
            "gemini-3-flash",          // 20 RPD
            "gemma-4-31b-it",          // 14 400 RPD
            "gemma-4-26b-a4b-it",      // 14 400 RPD
        ];
    }

    // Socle volume — Gemma 3 en dernier recours (IDs à confirmer)
    const allFallback = [
        "gemma-3-27b-it",
        "gemma-3-12b-it",
        "gemma-3-4b-it",
    ];

    allFallback.forEach(m => {
        if (!modelsToTry.includes(m)) modelsToTry.push(m);
    });

    // Forçage du modèle utilisateur en tête si spécifié
    const { model } = bodyReq;
    if (model && !modelsToTry.includes(model)) {
        modelsToTry.unshift(model);
    }

    // ============================================================
    //  4. EXÉCUTION EN CASCADE
    // ============================================================
    for (const model of modelsToTry) {
        const isGemma = model.startsWith("gemma");
        // Contexte web injecté en texte brut → fonctionne pour Gemini ET Gemma
        const promptWithContext = searchContextBlock + prompt;
        const parts = [{ text: promptWithContext }];

        if (files && files.length > 0) {
            files.forEach(file => {
                if (file.base64) {
                    parts.push({
                        inline_data: { mime_type: file.mime, data: file.base64 }
                    });
                }
                if (file.url) {
                    parts.push({
                        file_data: { mime_type: file.mime || "image/jpeg", file_uri: file.url }
                    });
                }
            });
        }

        // Gemma ne supporte PAS systemInstruction nativement — injection dans le user message
        let finalParts = parts;
        if (isGemma && systemInstruction) {
            finalParts = [
                { text: "[INSTRUCTIONS SYSTÈME]\n" + systemInstruction + "\n\n[MESSAGE UTILISATEUR]\n" + parts[0].text },
                ...parts.slice(1)
            ];
        }

        // Le tool googleSearch natif n'est plus utilisé : la recherche est
        // désormais injectée manuellement en amont (searchContextBlock),
        // de façon identique pour tous les modèles, Gemma inclus.
        const canUseCodeExecution = !isGemma && ["code", "audit", "strategie", "default"].includes(agentId);

        let finalSystemInstruction = systemInstruction;
        if (isGemma && systemInstruction) {
            finalSystemInstruction = systemInstruction
                .replace(/\[INSTRUCTION CRITIQUE[^\]]*\][^\n]*/gi, "")
                .replace(/Tu DOIS utiliser google_search[^.]*\./gi, "")
                .trim();
        }

        const body = {
            ...((!isGemma && finalSystemInstruction) && {
                systemInstruction: { parts: [{ text: finalSystemInstruction }] }
            }),
            contents: [{ role: "user", parts: finalParts }],
            generationConfig: {
                maxOutputTokens: agentConfig.maxOutputTokens || 8192,
                temperature: agentConfig.temperature,
                topP: agentConfig.topP,
                topK: agentConfig.topK
            }
        };

        let activeTools = [];
        if (canUseCodeExecution) activeTools.push({ codeExecution: {} });
        if (activeTools.length > 0) body.tools = activeTools;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const stream = new ReadableStream({
                    async start(controller) {
                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        let sseBuffer = "";   // Buffer SSE ligne par ligne
                        let fullText = "";    // Accumulation totale pour détecter les marqueurs fichiers
                        let sentUpTo = 0;     // Curseur : nb de chars déjà envoyés au client

                        try {
                            let emotionSent = false;
                            let emotionBuffer = ""; // accumule jusqu'à </EM>

                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;

                                sseBuffer += decoder.decode(value, { stream: true });
                                const lines = sseBuffer.split('\n');
                                sseBuffer = lines.pop() || "";

                                for (const line of lines) {
                                    if (!line.startsWith('data: ')) continue;
                                    const dataStr = line.slice(6).trim();
                                    if (dataStr === '[DONE]') continue;
                                    try {
                                        const dataObj = JSON.parse(dataStr);
                                        const responseParts = dataObj.candidates?.[0]?.content?.parts || [];
                                        let textChunk = responseParts
                                            .filter(p => typeof p.text === "string" && !p.thought)
                                            .map(p => p.text)
                                            .join("");

                                        if (!textChunk) continue;

                                        if (isGemma) {
                                            textChunk = stripGemmaThinking(textChunk);
                                        }

                                        if (!textChunk) continue;

                                        // ── Extraction du token émotion ───────────────────
                                        // Le modèle émet <EM>{...}</EM> en tout début de réponse.
                                        // On accumule jusqu'à trouver </EM>, on extrait, on envoie
                                        // un signal spécial \x02EM:{...}\x03 au client, puis on
                                        // continue le stream sans cette balise.
                                        if (!emotionSent) {
                                            emotionBuffer += textChunk;
                                            const closeIdx = emotionBuffer.indexOf('</EM>');
                                            if (closeIdx !== -1) {
                                                emotionSent = true;
                                                const openIdx = emotionBuffer.indexOf('<EM>');
                                                if (openIdx !== -1) {
                                                    const emJson = emotionBuffer.slice(openIdx + 4, closeIdx);
                                                    // Signal émotion : \x02EM:{json}\x03 (non-printable delimiters)
                                                    controller.enqueue(new TextEncoder().encode(`\x02EM:${emJson}\x03`));
                                                }
                                                // Texte après </EM>
                                                textChunk = emotionBuffer.slice(closeIdx + 5).replace(/^\n/, '');
                                                emotionBuffer = "";
                                                if (!textChunk) continue;
                                            } else {
                                                // Pas encore </EM> — on accumule, rien à streamer
                                                continue;
                                            }
                                        }

                                        fullText += textChunk;

                                        // Stratégie de streaming sécurisée pour les marqueurs fichiers :
                                        // Un marqueur [GENERATE_FILE:...] ou [GENERATE_PDF:...] peut arriver
                                        // fragmenté sur plusieurs chunks SSE. On ne streame en temps réel
                                        // que le texte "safe" (avant tout marqueur potentiellement ouvert),
                                        // puis on envoie le marqueur complet uniquement une fois le stream fini.
                                        const markerOpenIdx = fullText.indexOf('\n[GENERATE_');
                                        const safeEnd = markerOpenIdx > -1 ? markerOpenIdx : fullText.length;

                                        if (safeEnd > sentUpTo) {
                                            const toSend = fullText.slice(sentUpTo, safeEnd);
                                            if (toSend) {
                                                controller.enqueue(new TextEncoder().encode(toSend));
                                            }
                                            sentUpTo = safeEnd;
                                        }

                                    } catch (e) {
                                        // Ignore les erreurs de parsing JSON partiel (chunks SSE incomplets)
                                    }
                                }
                            }

                            // Fin du stream : envoyer le(s) marqueur(s) fichier complets s'ils existent
                            // On cherche TOUS les marqueurs présents dans la réponse finale
                            const remainingText = fullText.slice(sentUpTo);
                            if (remainingText) {
                                controller.enqueue(new TextEncoder().encode(remainingText));
                            }

                        } catch (err) {
                            controller.enqueue(new TextEncoder().encode("\n[Interruption réseau locale]"));
                        } finally {
                            controller.close();
                        }
                    }
                });

                return new Response(stream, {
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive"
                    }
                });
            }

            // Tous les modèles Gemma peuvent retourner 400 pour des paramètres non supportés
            // (topK, systemInstruction mal formé, etc.) — on continue la cascade dans tous les cas
            if (response.status === 400 || response.status === 404 || response.status === 429 || response.status >= 500) {
                continue;
            }

            const errorData = await response.json().catch(() => ({}));
            return new Response(JSON.stringify({ error: errorData.error?.message || `Erreur API (${response.status})` }), { status: response.status });

        } catch (fetchError) {
            continue; // Failover sur erreur réseau
        }
    }

    // Si on sort de la boucle, tous les modèles ont échoué
    return new Response(JSON.stringify({ error: "Serveurs IA saturés. Réessaie dans quelques secondes." }), { status: 503 });
}
