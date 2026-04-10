export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(401).json({ error: "Clé API absente." });

    // 🏆 Liste des modèles en cascade (Priorité au ratio Qualité / Quota)
    const modelsToTry = [
        // ━━━ LIGNE DE FRONT
        "gemini-3.1-flash-lite", // Bouclier principal : 500 requêtes/jour
        
        // ━━━ SECONDE LIGNE GEMINI
        "gemini-3-flash",        // Back-up 1 : 20 requêtes/jour
        "gemini-2.5-flash",      // Back-up 2 : 20 requêtes/jour (utile dès demain)
        "gemini-2.5-flash-lite", // Back-up 3 : 20 requêtes/jour

        // ━━━ ULTIMES RECOURS GEMMA (Versions "Instruction Tuned" pour le chat)
        "gemma-4-31b-it",        // Filet de sécurité 1 : 1 500 requêtes/jour
        "gemma-3-27b-it"         // Filet de sécurité 2 : 14 400 requêtes/jour
    ];

    // Modification : la fonction prend maintenant le nom du modèle en paramètre
    async function callGemini(modelName) {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    tools: [{ google_search: {} }],
                    generationConfig: {
                        maxOutputTokens: 65536,
                        temperature: 0.5,
                        topP: 0.95,
                        topK: 64
                    }
                })
            }
        );
        const data = await response.json();
        return { response, data };
    }

    // Modification : on ajoute la vérification du code HTTP 429
    function isOverloaded(data, response) {
        if (response.status === 429) return true;
        const msg = (data.error?.message || "").toLowerCase();
        return msg.includes("high demand") || msg.includes("experiencing") || msg.includes("overloaded");
    }

    try {
        let lastData, lastResponse;

        // Boucle sur les modèles au lieu d'une boucle de "retries" sur le même modèle
        for (const model of modelsToTry) {
            const { response, data } = await callGemini(model);
            lastData = data;
            lastResponse = response;

            // ✅ Succès
            if (response.ok && !data.error && data.candidates?.length > 0) {
                const reply = data.candidates[0].content.parts[0].text || "Réponse vide.";
                // On inclut le modèle utilisé pour tes tests/logs côté frontend
                return res.status(200).json([{ generated_text: reply, used_model: model }]);
            }

            // ⚠️ Surcharge ou Modèle introuvable (404) → on passe au modèle suivant en silence
            if (isOverloaded(data, response) || response.status === 404) {
                console.warn(`[INFO] Modèle ${model} indisponible (429 ou 404). Passage au suivant...`);
                continue;
            }

            // ❌ Erreur fatale (Clé API bloquée 401/403) → on sort immédiatement
            break;
        }

        // Si on arrive ici, c'est que tous les modèles ont échoué ou qu'une erreur fatale est survenue
        const errMsg = lastData?.error?.message || "Le serveur IA est très sollicité. Veuillez réessayer.";
        return res.status(lastResponse?.status || 500).json({ error: errMsg });

    } catch (error) {
        return res.status(500).json({ error: "Erreur serveur : " + error.message });
    }
}
