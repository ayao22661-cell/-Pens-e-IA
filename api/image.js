// ============================================================
//  PENSÉE IA — api/image.js (Vercel Edge)
//  Génération d'images via Imagen 3 (Google Cloud Vertex AI)
//  + fallback Gemini 2.0 Flash si Vertex indisponible
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
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Clé API absente." }), { status: 401 });
    }

    // ── Enrichissement automatique du prompt ──────────────────────────────
    // On améliore le prompt brut pour maximiser la qualité Imagen 3
    const enrichedPrompt = await enrichPrompt(prompt, GEMINI_API_KEY);

    // ── Tentative 1 : Imagen 3 via Gemini API (endpoint stable) ──────────
    try {
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`;

        const imagenBody = {
            instances: [{ prompt: enrichedPrompt }],
            parameters: {
                sampleCount: 1,
                aspectRatio: detectAspectRatio(prompt),
                safetyFilterLevel: "BLOCK_SOME",
                personGeneration: "ALLOW_ADULT"
            }
        };

        const imagenRes = await fetch(imagenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(imagenBody)
        });

        if (imagenRes.ok) {
            const imagenData = await imagenRes.json();
            const base64 = imagenData.predictions?.[0]?.bytesBase64Encoded;

            if (base64) {
                return new Response(JSON.stringify({
                    base64,
                    mimeType: "image/png",
                    model: "imagen-3",
                    enrichedPrompt
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        // Si Imagen retourne une erreur non critique, on log et on cascade
        const errText = await imagenRes.text().catch(() => "");
        console.warn(`Imagen 3 rejeté (${imagenRes.status}) :`, errText);

    } catch (e) {
        console.warn("Imagen 3 inaccessible, cascade vers Gemini Flash :", e.message);
    }

    // ── Tentative 2 : Gemini 2.0 Flash (génération d'image native) ────────
    try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_API_KEY}`;

        const geminiBody = {
            contents: [{
                role: "user",
                parts: [{ text: `Generate an image: ${enrichedPrompt}` }]
            }],
            generationConfig: {
                responseModalities: ["IMAGE", "TEXT"]
            }
        };

        const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody)
        });

        if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const parts = geminiData.candidates?.[0]?.content?.parts || [];

            for (const part of parts) {
                if (part.inlineData?.mimeType?.startsWith("image/")) {
                    return new Response(JSON.stringify({
                        base64: part.inlineData.data,
                        mimeType: part.inlineData.mimeType,
                        model: "gemini-2.0-flash",
                        enrichedPrompt
                    }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }
            }
        }

    } catch (e) {
        console.warn("Gemini Flash image échoué :", e.message);
    }

    // ── Aucun modèle n'a répondu ──────────────────────────────────────────
    return new Response(JSON.stringify({
        error: "La génération d'image est temporairement indisponible. Réessaie dans quelques secondes."
    }), { status: 503 });
}

// ── Enrichissement du prompt via Gemini ───────────────────────────────────
// Transforme "un lion" en prompt Imagen-ready avec style, lumière, composition
async function enrichPrompt(rawPrompt, apiKey) {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{
                            text: `Tu es un expert en prompt engineering pour la génération d'images IA (Imagen 3, Midjourney, DALL-E).
Transforme ce prompt court en un prompt détaillé et optimisé pour Imagen 3.
Ajoute : style visuel, éclairage, composition, qualité technique, ambiance.
Réponds UNIQUEMENT avec le prompt enrichi, rien d'autre. Maximum 200 mots. En anglais.

Prompt original : "${rawPrompt}"`
                        }]
                    }],
                    generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
                })
            }
        );

        if (res.ok) {
            const data = await res.json();
            const enriched = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (enriched && enriched.length > 20) return enriched;
        }
    } catch (e) {
        // Silencieux — le prompt brut reste utilisable
    }

    return rawPrompt; // Fallback sur le prompt original
}

// ── Détection automatique du ratio selon le prompt ────────────────────────
function detectAspectRatio(prompt) {
    const p = prompt.toLowerCase();
    if (p.includes("portrait") || p.includes("vertical") || p.includes("story")) return "9:16";
    if (p.includes("paysage") || p.includes("landscape") || p.includes("panorama") || p.includes("cinéma")) return "16:9";
    if (p.includes("bannière") || p.includes("banner") || p.includes("couverture")) return "3:1";
    return "1:1"; // Carré par défaut
}
