// ============================================================
//  PENSÉE IA — api/chat.js (Vercel Edge & Streaming)
//  Recherche web activée, modèles cachés, cascade blindée
// ============================================================

export const config = {
    runtime: 'edge'
};

export default async function handler(req) {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
    }

    const bodyReq = await req.json().catch(() => ({}));
    // CORRECTION : Extraction du paramètre system
    const { prompt, files, system } = bodyReq;

    if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt manquant." }), { status: 400 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Clé API absente." }), { status: 401 });
    }

    const modelsToTry = [
        // --- Modèles Flash (Privilégier la performance) ---
        { name: "gemini-2.5-flash",      apiVersion: "v1beta" }, // 5 RPM
        { name: "gemini-2.0-flash",      apiVersion: "v1beta" }, // 15 RPM

        // --- Modèles Lite (Vitesse pure) ---
        { name: "gemini-2.5-flash-lite", apiVersion: "v1beta" }, // 10 RPM
        { name: "gemini-2.0-flash-lite", apiVersion: "v1beta" }, // 30 RPM

        // --- Famille Gemma (Open-weights, sans recherche web) ---
        { name: "gemma-3-27b-it",        apiVersion: "v1beta" }, // 30 RPM
        { name: "gemma-3-12b-it",        apiVersion: "v1beta" }, // 30 RPM
        { name: "gemma-3-4b-it",         apiVersion: "v1beta" }, // 30 RPM
        { name: "gemma-3-2b-it",         apiVersion: "v1beta" }, // 30 RPM
        { name: "gemma-3-1b-it",         apiVersion: "v1beta" }  // 30 RPM
    ];

    for (const modelEntry of modelsToTry) {
        const { name: model, apiVersion } = modelEntry;
        const isGemma = model.startsWith("gemma");
        const parts = [{ text: prompt }];

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

        // CORRECTION ARCHITECTURALE : Séparation stricte de l'identité et du prompt utilisateur
        if (system && isGemma) {
            // Fallback propre pour les modèles open-weights qui ne supportent pas toujours systemInstruction
            parts.unshift({ text: "INSTRUCTIONS SYSTÈME :\n" + system + "\n\n" });
        }

        const body = {
            contents: [{ parts }],
            generationConfig: {
                maxOutputTokens: 65536,
                temperature: 0.5,
                topP: 0.95,
                topK: 64
            }
        };

        if (!isGemma) {
            body.tools = [{ google_search: {} }];
            
            // Implémentation native de l'instruction système pour l'API Gemini
            if (system) {
                body.systemInstruction = {
                    parts: [{ text: system }]
                };
            }
        }

        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

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

                        if (isGemma) {
                            controller.enqueue(new TextEncoder().encode("⚠️ *Mode mémoire local activé.*\n\n"));
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
                                            const textChunk = dataObj.candidates?.[0]?.content?.parts?.[0]?.text || "";
                                            if (textChunk) {
                                                controller.enqueue(new TextEncoder().encode(textChunk));
                                            }
                                        } catch (e) {
                                            // Ignorer les fragments JSON incomplets
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

            if ([400, 404, 429].includes(response.status) || response.status >= 500) {
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
