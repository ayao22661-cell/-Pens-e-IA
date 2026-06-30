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
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Clé secrète pour bypasser les RLS

    // Si le système est configuré pour la prod (clés présentes), on verrouille.
    if (SUPABASE_URL && SUPABASE_KEY) {
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Accès refusé. Token manquant." }), { status: 401 });
        }

        try {
            const token = authHeader.replace('Bearer ', '');
            
            // A. Vérification de l'identité via API Supabase
            const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY }
            });
            if (!userRes.ok) throw new Error("Token expiré ou invalide.");
            const user = await userRes.json();

            // B. Récupération des crédits dans la table profiles
            const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=credits_used`, {
                headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
            });
            const profiles = await profRes.json();
            const creditsUsed = profiles[0]?.credits_used || 0;

            // Limite fixée à 20 crédits par jour
            if (creditsUsed >= 20) {
                return new Response(JSON.stringify({ error: "Quota journalier épuisé (20/20)." }), { status: 403 });
            }

            // C. Débit immédiat du crédit pour éviter les doubles exécutions (Race Conditions)
            await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${SUPABASE_KEY}`, 
                    'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal' // Optimisation de la bande passante
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
    const { prompt, files, systemInstruction, agentId } = bodyReq;

    if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt manquant." }), { status: 400 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Clé API absente." }), { status: 401 });
    }

    const agentConfig = AGENTS[agentId] || AGENTS.default;

    // ============================================================
    //  2bis. RECHERCHE WEB MANUELLE (une seule fois, hors cascade)
    //  Remplace le tool googleSearch natif (Gemini uniquement) par
    //  une injection de contexte en texte brut, qui fonctionne donc
    //  identiquement sur Gemini ET sur Gemma (fallback inclus).
    // ============================================================
    let searchContextBlock = "";
    if (agentConfig.useSearch) {
        try {
            const searchResult = await performWebSearch(prompt, 5);
            if (searchResult?.results?.length) {
                const lines = searchResult.results.map((r, i) =>
                    `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`
                ).join('\n\n');

                searchContextBlock =
                    `[CONTEXTE WEB ACTUALISÉ — résultats de recherche en temps réel]\n` +
                    (searchResult.directAnswer ? `Réponse directe : ${searchResult.directAnswer}\n\n` : '') +
                    `${lines}\n\n` +
                    `Utilise ces informations pour répondre de façon précise et à jour. ` +
                    `Cite tes sources quand c'est pertinent.\n\n`;
            }
        } catch (e) {
            console.warn('[Chat] Recherche web indisponible :', e.message);
            // Pas de contexte injecté → le modèle répondra sur ses connaissances seules
        }
    }

   // ============================================================
    //  3. MODEL ROUTING INTELLIGENT (Priorité Disponibilité/Quotas)
    // ============================================================
    const { model } = bodyReq; 
    let modelsToTry = [];
    
    // Stratégie réaliste basée sur les quotas RPD réels :
    // - gemini-2.5-flash / 2.0-flash / 1.5-pro : RPD ~20 chacun → bonus ponctuel
    // - gemini-3.1-flash-lite : RPD 500 → meilleur compromis qualité/volume
    // - gemma : RPD 1.5K par variante, TPM illimité → socle de volume
    if (agentId === 'code' || agentId === 'audit') {
        modelsToTry = [
            "gemini-3.1-flash-lite",   // Bon compromis qualité/quota pour le code
            "gemini-2.5-flash",        // Bonus qualité (quota très limité, 20 RPD)
            "gemma-4-31b-it"           // Socle de volume
        ];
    } else if (agentId === 'creatif') {
        modelsToTry = [
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash-lite",   // Bonus (quota limité, 20 RPD)
            "gemma-3-27b-it"           // Socle de volume
        ];
    } else {
        // Pour les autres agents (stratégie, visionnaire, etc.)
        modelsToTry = [
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash",
            "gemma-4-31b-it",
            "gemma-3-27b-it"
        ];
    }

    // Ajout du reste des modèles Gemma en fin de file (secours ultime,
    // en cas de saturation totale des modèles ci-dessus)
    const allGemma = [
        "gemma-4-26b-it",
        "gemma-3-12b-it",
        "gemma-3-4b-it",
        "gemma-3-2b-it",
        "gemma-3-1b-it"
    ];

    allGemma.forEach(m => {
        if (!modelsToTry.includes(m)) modelsToTry.push(m);
    });

    // Forçage du modèle utilisateur en tête de liste si spécifié
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

                                        // Pour Gemma : stripper les blocs de thinking en texte brut
                                        // (<|channel>thought...<channel|> ou <think>...</think>)
                                        if (isGemma) {
                                            textChunk = stripGemmaThinking(textChunk);
                                        }

                                        if (!textChunk) continue;

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
