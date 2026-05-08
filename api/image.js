// ============================================================
//  PENSÉE IA — api/image.js
//  Génération d'images : Imagen 3 (Google) → Pollinations.ai
//  Modèle auto-sélectionné selon le contexte du prompt
// ============================================================

export const config = { runtime: 'edge' };

// ── Détection contextuelle du meilleur modèle ────────────────
function selectModel(prompt) {
    const p = prompt.toLowerCase();
    const realismKeywords = [
        'personne','homme','femme','fille','garçon','enfant','visage','portrait',
        'photo','photographe','photoréaliste','réaliste','realistic','photorealistic',
        'person','man','woman','girl','boy','face','people','human','skin','body',
        'rue','ville','abidjan','marché','quartier','foule','restaurant','intérieur',
        'street','city','crowd','indoor','outdoor','lifestyle'
    ];
    return realismKeywords.some(kw => p.includes(kw)) ? 'flux-realism' : 'flux-pro';
}

export default async function handler(req) {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { prompt } = body;

    if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt manquant." }), { status: 400 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // ── TENTATIVE 1 : Imagen 3 via Gemini API ─────────────────
    if (GEMINI_API_KEY) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "1:1",
                        safetyFilterLevel: "block_few",
                        personGeneration: "allow_adult"
                    }
                }),
                signal: AbortSignal.timeout(25000)
            });

            if (response.ok) {
                const data = await response.json();
                const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
                if (b64) {
                    return new Response(JSON.stringify({
                        source: "imagen3",
                        type: "base64",
                        data: b64,
                        mimeType: "image/png"
                    }), { status: 200, headers: { "Content-Type": "application/json" } });
                }
            }
        } catch (e) {
            console.warn("Imagen 3 indisponible :", e.message);
        }
    }

    // ── FALLBACK : Pollinations.ai — avec prompt enhancement ──
    try {
        // Étape 1 : Enrichissement du prompt via Gemini
        let enhancedPrompt = prompt;

        if (GEMINI_API_KEY) {
            try {
                const enhanceUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
                const enhanceRes = await fetch(enhanceUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `You are an expert image prompt engineer for AI image generation.
Transform the user prompt into a rich, detailed generation prompt optimized for quality and realism.

Rules:
- If the prompt involves a person/portrait: add "RAW photo, DSLR, 8K UHD, photorealistic, Canon EOS R5, natural lighting, sharp focus, f/2.8, bokeh, ultra-detailed skin texture, catchlights in eyes"
- If it's a scene/environment: add atmosphere, lighting direction, time of day, depth of field, lens type
- If it's an object/product: add studio lighting, surface texture, material detail, shadows
- If it's abstract/concept: add art style, color palette, mood, composition rules
- Always end with quality boosters: "masterpiece, best quality, highly detailed, 8K"
- Output ONLY the enhanced prompt. No explanation, no quotes, no preamble.

User prompt: "${prompt}"`
                            }]
                        }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
                    }),
                    signal: AbortSignal.timeout(8000)
                });

                if (enhanceRes.ok) {
                    const enhanceData = await enhanceRes.json();
                    const enhanced = enhanceData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                    if (enhanced && enhanced.length > 20) {
                        enhancedPrompt = enhanced;
                    }
                }
            } catch (e) {
                console.warn("Prompt enhancement skipped:", e.message);
            }
        }

        // Étape 2 : Sélection du modèle selon le contexte du prompt original
        const model = selectModel(prompt);
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const seed = Math.floor(Math.random() * 999999);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=${model}&seed=${seed}&nologo=true&enhance=false`;

        return new Response(JSON.stringify({
            source: "pollinations",
            model,
            type: "url",
            url: pollinationsUrl,
            enhanced: enhancedPrompt !== prompt
        }), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (e) {
        return new Response(JSON.stringify({
            error: "Génération d'image impossible : " + e.message
        }), { status: 502 });
    }
}
