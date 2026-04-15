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
    const { prompt, files } = bodyReq;

    if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt manquant." }), { status: 400 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Clé API absente." }), { status: 401 });
    }

    const modelsToTry = [
        // --- Modèles Flash stables (avec recherche web) ---
        "gemini-2.5-flash",        // 10 RPM
        "gemini-2.0-flash",        // 15 RPM
        "gemini-1.5-flash",        // 15 RPM

        // --- Famille Gemma (Open-weights, sans recherche web) ---
        "gemma-3-27b-it",          // 30 RPM
        "gemma-3-12b-it",          // 30 RPM
        "gemma-3-4b-it",           // 30 RPM
        "gemma-3-2b-it",           // 30 RPM
        "gemma-3-1b-it"            // 30 RPM
    ];

    function getApiVersion(modelName) {
        // gemini-2.x et gemma-3.x utilisent v1beta
        return "v1beta";
    }

    for (const model of modelsToTry) {
        const isGemma = model.startsWith("gemma");
        const apiVersion = getApiVersion(model);
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

                        // Avertissement silencieux pour Gemma, sans révéler le nom du modèle
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
                                            // Gemini avec google_search peut renvoyer plusieurs parts
                                            // (text + groundingMetadata). On concatène tous les parts textuels.
                                            const parts = dataObj.candidates?.[0]?.content?.parts || [];
                                            const textChunk = parts
                                                .filter(p => typeof p.text === "string")
                                                .map(p => p.text)
                                                .join("");
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

            // Bouclier anti-crash : on ignore les 404 (modèle introuvable), 400 (outil non supporté), 429 (surcharge) et 500+ (serveur mort)
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
