// ============================================================
//  PENSÉE IA — api/image.js (Vercel Edge)
//  Cascade : Imagen 4 Fast → Imagen 4 → Imagen 4 Ultra
//  Tous via l'API Gemini (même clé GEMINI_API_KEY)
// ============================================================

export const config = { runtime: 'edge' };

// Cascade des modèles image par ordre de vitesse/qualité
const IMAGE_MODELS = [
    { id: "imagen-4.0-fast-generate-preview-06-05", label: "Imagen 4 Fast" },
    { id: "imagen-4.0-generate-preview-06-05",      label: "Imagen 4"      },
    { id: "imagen-4.0-ultra-generate-preview-06-05",label: "Imagen 4 Ultra"}
];

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
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Clé API absente." }), { status: 401 });
    }

    const enrichedPrompt = await enrichPrompt(prompt, GEMINI_API_KEY);
    const aspectRatio    = detectAspectRatio(prompt);

    // ── Cascade Imagen 4 Fast → Imagen 4 → Imagen 4 Ultra ────────────────
    for (const model of IMAGE_MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:predict?key=${GEMINI_API_KEY}`;

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{ prompt: enrichedPrompt }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio,
                        safetyFilterLevel: "BLOCK_SOME",
                        personGeneration: "ALLOW_ADULT"
                    }
                })
            });

            if (res.ok) {
                const data = await res.json();
                const base64 = data.predictions?.[0]?.bytesBase64Encoded;

                if (base64) {
                    return new Response(JSON.stringify({
                        base64,
                        mimeType: "image/png",
                        model: model.label,
                        enrichedPrompt
                    }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }
            }

            const errBody = await res.text().catch(() => "");
            console.warn(`[${model.label}] ${res.status} :`, errBody.slice(0, 200));

            // Quota épuisé → inutile d'essayer les suivants
            if (res.status === 429) break;

        } catch (e) {
            console.warn(`[${model.label}] fetch échoué :`, e.message);
        }
    }

    return new Response(JSON.stringify({
        error: "Quota image épuisé pour aujourd'hui (25 images/jour sur le plan gratuit Google AI Studio)."
    }), { status: 503 });
}

// ── Enrichissement du prompt via Gemini 2.5 Flash ─────────────────────────
async function enrichPrompt(rawPrompt, apiKey) {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{
                            text: `You are an expert image prompt engineer for Imagen 4.
Rewrite this prompt into a detailed, optimized Imagen 4 prompt.
Add: visual style, lighting, composition, technical quality, mood, camera angle.
Reply ONLY with the enhanced prompt. Max 150 words. In English.

Original prompt: "${rawPrompt}"`
                        }]
                    }],
                    generationConfig: { maxOutputTokens: 250, temperature: 0.7 }
                })
            }
        );

        if (res.ok) {
            const data = await res.json();
            const enriched = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (enriched && enriched.length > 20) return enriched;
        }
    } catch (e) {
        // Silencieux
    }

    return rawPrompt;
}

// ── Détection automatique du ratio selon le prompt ────────────────────────
function detectAspectRatio(prompt) {
    const p = prompt.toLowerCase();
    if (p.includes("portrait") || p.includes("vertical") || p.includes("story")) return "9:16";
    if (p.includes("paysage") || p.includes("landscape") || p.includes("panorama") || p.includes("cinéma") || p.includes("cinema")) return "16:9";
    if (p.includes("bannière") || p.includes("banner") || p.includes("couverture") || p.includes("cover")) return "3:1";
    return "1:1";
}
