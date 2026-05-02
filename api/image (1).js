// ============================================================
//  PENSÉE IA — api/image.js
//  Génération d'images : Imagen 3 (Google) → Pollinations.ai
// ============================================================

export const config = { runtime: 'edge' };

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

    // ── FALLBACK : Pollinations.ai (gratuit, sans clé) ─────────
    try {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Math.floor(Math.random() * 999999);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&seed=${seed}&nologo=true`;

        return new Response(JSON.stringify({
            source: "pollinations",
            type: "url",
            url: pollinationsUrl
        }), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (e) {
        return new Response(JSON.stringify({
            error: "Génération d'image impossible : " + e.message
        }), { status: 502 });
    }
}
