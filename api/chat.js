// ============================================================
//  PENSÉE IA — api/chat.js (Vercel Edge & Streaming)
//  Multi-agents, systemInstruction natif Google, cascade blindée
// ============================================================

export const config = {
    runtime: 'edge'
};

// ============================================================
//  CONFIGURATION DES AGENTS
//  Chaque agent a : température, outils, modèle prioritaire
// ============================================================
const AGENTS = {
    code: {
        temperature: 0.2,
        topP: 0.90,
        topK: 40,
        useSearch: false,           // Le code ne nécessite pas de recherche web
        preferredModel: null        // Utilise la cascade normale
    },
    recherche: {
        temperature: 0.6,
        topP: 0.95,
        topK: 64,
        useSearch: true,            // Recherche web forcée
        preferredModel: "gemini-2.5-flash"  // Toujours le plus capable pour la synthèse
    },
    creatif: {
        temperature: 1.0,
        topP: 0.98,
        topK: 64,
        useSearch: false,
        preferredModel: null
    },
    strategie: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        useSearch: true,            // Données marché récentes utiles
        preferredModel: null
    },
    visionnaire: {
        temperature: 0.9,
        topP: 0.97,
        topK: 64,
        useSearch: true,            // Signaux faibles + tendances
        preferredModel: "gemini-2.5-flash"
    },
    audit: {
        temperature: 0.1,
        topP: 0.85,
        topK: 32,
        useSearch: false,
        preferredModel: null
    },
    default: {
        temperature: 0.5,
        topP: 0.95,
        topK: 64,
        useSearch: false,
        preferredModel: null
    }
};

export default async function handler(req) {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
    }

    const bodyReq = await req.json().catch(() => ({}));
    const { prompt, files, systemInstruction, agentId } = bodyReq;

    if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt manquant." }), { status: 400 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Clé API absente." }), { status: 401 });
    }

    // Récupération de la config agent (fallback sur default)
    const agentConfig = AGENTS[agentId] || AGENTS.default;

    // Modèles : si l'agent préfère un modèle, on le met en tête de cascade
    const baseModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemma-3-27b-it",
        "gemma-3-12b-it",
        "gemma-3-4b-it",
        "gemma-3-2b-it",
        "gemma-3-1b-it"
    ];

    let modelsToTry = baseModels;
    if (agentConfig.preferredModel) {
        // Mise en tête du modèle préféré sans doublon
        modelsToTry = [
            agentConfig.preferredModel,
            ...baseModels.filter(m => m !== agentConfig.preferredModel)
        ];
    }

    for (const model of modelsToTry) {
        const isGemma = model.startsWith("gemma");
        const parts = [{ text: prompt }];

        // Ajout des fichiers binaires
        if (files && files.length > 0) {
            files.forEach(file => {
                if (file.base64) {
                    parts.push({
                        inline_data: {
                            mime_type: file.mime,
                            data: file.base64
                        }
                    });
                }
            });
        }

        // ── Gestion du systemInstruction selon le modèle ──────────────
        // Gemma ne supporte PAS systemInstruction → on réinjecte dans le message
        // Gemini supporte le canal natif → on l'utilise
        let finalParts = parts;
        if (isGemma && systemInstruction) {
            finalParts = [
                {
                    text: "[INSTRUCTIONS SYSTÈME]\n" + systemInstruction + "\n\n[MESSAGE UTILISATEUR]\n" + parts[0].text
                },
                ...parts.slice(1) // Fichiers binaires intacts
            ];
        }

        // ── Configuration des outils (Search & Code Interpreter) ──────
        const canUseSearch = !isGemma && agentConfig.useSearch;
        // Activation de l'exécution de code pour les profils techniques et analytiques
        const canUseCodeExecution = !isGemma && ["code", "audit", "strategie", "default"].includes(agentId);

        const body = {
            ...((!isGemma && systemInstruction) && {
                systemInstruction: { parts: [{ text: systemInstruction }] }
            }),
            contents: [{ role: "user", parts: finalParts }],
            generationConfig: {
                maxOutputTokens: 65536,
                temperature: agentConfig.temperature,
                topP: agentConfig.topP,
                topK: agentConfig.topK
            }
        };

        let activeTools = [];
        if (canUseSearch) activeTools.push({ google_search: {} });
        if (canUseCodeExecution) activeTools.push({ codeExecution: {} });

        if (activeTools.length > 0) {
            body.tools = activeTools;
        }

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
                        let buffer = "";

                        // Avertissement silencieux si Gemma (sans révéler le modèle)
                        if (isGemma && agentConfig.useSearch) {
                            controller.enqueue(new TextEncoder().encode("⚠️ *Action dégradée : Modèle local activé. La recherche web demandée est indisponible.*\n\n"));
                        }

                        try {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;

                                buffer += decoder.decode(value, { stream: true });
                                const lines = buffer.split('\n');
                                buffer = lines.pop() || "";

                                for (const line of lines) {
                                    if (line.startsWith('data: ')) {
                                        const dataStr = line.slice(6).trim();
                                        if (dataStr === '[DONE]') continue;
                                        try {
                                            const dataObj = JSON.parse(dataStr);
                                            const parts = dataObj.candidates?.[0]?.content?.parts || [];
                                            const textChunk = parts
                                                .filter(p => typeof p.text === "string")
                                                .map(p => p.text)
                                                .join("");
                                            if (textChunk) {
                                                controller.enqueue(new TextEncoder().encode(textChunk));
                                            }
                                        } catch (e) {
                                            // Fragment JSON incomplet, ignoré
                                        }
                                    }
                                }
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

            if (response.status === 404 || response.status === 400 || response.status === 429 || response.status >= 500) {
                continue;
            }

            const errorData = await response.json().catch(() => ({}));
            const errMsg = errorData.error?.message || `Erreur de l'API (${response.status})`;
            return new Response(JSON.stringify({ error: errMsg }), { status: response.status });

        } catch (fetchError) {
            continue;
        }
    }

    return new Response(JSON.stringify({ error: "Serveurs IA saturés. Réessaie dans quelques secondes." }), { status: 503 });
}
