// ============================================================
//  PENSÉE IA — api/chat.js (Vercel Edge & Streaming)
//  Multi-agents, Security Validation, Intelligent Model Routing
// ============================================================

export const config = {
    runtime: 'edge'
};

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
    //  3. MODEL ROUTING INTELLIGENT
    // ============================================================
    let modelsToTry = [];
    
    if (agentId === 'code' || agentId === 'audit') {
        // Tâches complexes : Priorité absolue à Gemini 2.5 Pro (1M tokens)
        modelsToTry = [
            "gemini-2.5-pro",
            "gemini-2.5-flash", 
            "gemini-2.0-flash"
        ];
    } else if (agentId === 'creatif' || (prompt.length < 150 && (!files || files.length === 0))) {
        // Tâches simples ou purement créatives : Rapidité et Économie (Flash en priorité)
        modelsToTry = [
            "gemini-2.5-flash",
            "gemini-2.0-flash"
        ];
    } else {
        // Mix standard pour recherche, stratégie, visionnaire
        modelsToTry = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-2.5-pro"
        ];
    }

    // Fallback de sécurité global si Google censure/rate
    modelsToTry.push("gemma-3-27b-it", "gemma-3-12b-it");

    // ============================================================
    //  4. EXÉCUTION EN CASCADE
    // ============================================================
    for (const model of modelsToTry) {
        const isGemma = model.startsWith("gemma");
        const parts = [{ text: prompt }];

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

        // Gemma ne supporte PAS systemInstruction nativement
        let finalParts = parts;
        if (isGemma && systemInstruction) {
            finalParts = [
                { text: "[INSTRUCTIONS SYSTÈME]\n" + systemInstruction + "\n\n[MESSAGE UTILISATEUR]\n" + parts[0].text },
                ...parts.slice(1)
            ];
        }

        const canUseSearch = !isGemma && agentConfig.useSearch;
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
        if (canUseSearch) activeTools.push({ google_search: {} });
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
                        let buffer = "";

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
                                            // Ignore parsing errors for partial JSON
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
                continue; // Failover sur le modèle suivant
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
