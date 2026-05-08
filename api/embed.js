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

    // CORRECTION 1 : Troncature de sécurité. 
    // text-embedding-004 accepte max ~2048 tokens (soit environ 7500 caractères).
    const safeText = text.slice(0, 7500);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text: safeText }] }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // CORRECTION 2 : On renvoie le vrai code d'erreur Google (400, 404, etc.) 
            // au lieu de tout transformer en 500.
            return new Response(JSON.stringify({ 
                error: `Erreur API Google (${response.status}) : ${errorData.error?.message || "Inconnue"}` 
            }), { status: response.status });
        }
        
        const data = await response.json();
        if (!data.embedding || !data.embedding.values) {
            return new Response(JSON.stringify({ error: "Structure de vecteur invalide retournée par Google." }), { status: 500 });
        }

        return new Response(JSON.stringify({ embedding: data.embedding.values }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
