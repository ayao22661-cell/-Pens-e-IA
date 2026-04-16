// ============================================================
//  api/embed.js — Transforme le texte en vecteur mathématique
// ============================================================
export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method !== "POST") {
        return new Response("Méthode non autorisée", { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { text } = body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!text) {
        return new Response(JSON.stringify({ error: "Texte manquant." }), { status: 400 });
    }

    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Clé API absente." }), { status: 401 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text: text }] }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Google rejetée (${response.status}) : ${errorData.error?.message || "Inconnue"}`);
        }
        
        const data = await response.json();
        if (!data.embedding || !data.embedding.values) {
            throw new Error("Structure de vecteur invalide retournée par Google.");
        }

        return new Response(JSON.stringify({ embedding: data.embedding.values }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
