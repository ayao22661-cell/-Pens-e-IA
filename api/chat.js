// ============================================================
//  PENSÉE IA — api/chat.js (Vercel Edge & Streaming)
//  Cascade intégrale (12 modèles), Routage dynamique, Buffer anti-hallucination
// ============================================================

export const config = {
    runtime: 'edge'
};

export default async function handler(req) {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
    }

    const bodyReq = await req.json().catch(() => ({}));
    const { prompt, files, requireWebSearch = false } = bodyReq;

    if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt manquant." }), { status: 400 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Clé API absente." }), { status: 401 });
    }

    const baseModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-3-flash-preview",
        "gemma-4-31b-it",
        "gemma-4-26b-it",
        "gemma-3-27b-it",
        "gemma-3-12b-it",
        "gemma-3-4b-it",
        "gemma-3-2b-it"
    ];

    const modelsToTry = requireWebSearch 
        ? baseModels.filter(m => !m.startsWith("gemma")) 
        : baseModels;

    function getApiVersion(modelName) {
        if (modelName.startsWith("gemini-3")) return "v1";
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
                        let responseBuffer = ""; 
                        
                        let streamTextBuffer = "";
                        const tagToHide = "[INSTRUCTION CRITIQUE : google_search]";

                        if (isGemma) {
                            controller.enqueue(new TextEncoder().encode("⚠️ *Mode mémoire local activé.*\n\n"));
                        }

                        try {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;

                                responseBuffer += decoder.decode(value, { stream: true });
                                const lines = responseBuffer.split('\n');
                                responseBuffer = lines.pop() || "";

                                for (const line of lines) {
                                    if (line.startsWith('data: ')) {
                                        const dataStr = line.slice(6).trim();
                                        if (dataStr === '[DONE]') continue;
                                        try {
                                            const dataObj = JSON.parse(dataStr);
                                            const textChunk = dataObj.candidates?.[0]?.content?.parts?.[0]?.text || "";
                                            
                                            if (textChunk) {
                                                streamTextBuffer += textChunk;

                                                if (streamTextBuffer.includes("[")) {
                                                    if (streamTextBuffer.includes(tagToHide)) {
                                                        streamTextBuffer = streamTextBuffer.replace(tagToHide, "");
                                                    } else if (streamTextBuffer.length > tagToHide.length + 15) {
                                                        const lastBracket = streamTextBuffer.lastIndexOf("[");
                                                        const safeToSend = streamTextBuffer.substring(0, lastBracket);
                                                        
                                                        if (safeToSend) {
                                                            controller.enqueue(new TextEncoder().encode(safeToSend));
                                                            streamTextBuffer = streamTextBuffer.substring(lastBracket);
                                                        }
                                                    }
                                                } else {
                                                    controller.enqueue(new TextEncoder().encode(streamTextBuffer));
                                                    streamTextBuffer = "";
                                                }
                                            }
                                        } catch (e) {
                                            // Ignorer les fragments JSON incomplets
                                        }
                                    }
                                }
                            }
                            
                            if (streamTextBuffer) {
                                controller.enqueue(new TextEncoder().encode(streamTextBuffer.replace(tagToHide, "")));
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
            return new Response(JSON.stringify({ error: errorData.error?.message || `Erreur API (${response.status})` }), { status: response.status });

        } catch (fetchError) {
            continue;
        }
    }

    return new Response(JSON.stringify({ error: "Serveurs IA saturés. Réessaie dans quelques secondes." }), { status: 503 });
}
