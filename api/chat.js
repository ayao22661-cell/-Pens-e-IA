module.exports = async function handler(req, res) {
    // 1. On n'accepte que les requêtes POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    // 2. Récupération du message de l'utilisateur
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    // 3. Récupération de l'unique clé Google
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "Clé API non configurée." });

    try {
        // 4. Appel à l'API Gemini 2.0 Flash
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        maxOutputTokens: 2000,
                        temperature: 0.3
                    }
                })
            }
        );

        const data = await response.json();

        // 5. Gestion des erreurs Google
        if (!response.ok) {
            return res.status(500).json({ error: "Gemini erreur " + response.status + " : " + (data.error?.message || response.statusText) });
        }

        // 6. Extraction du texte et renvoi à l'interface
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Aucune réponse reçue.";
        return res.status(200).json([{ generated_text: reply }]);

    } catch (error) {
        return res.status(500).json({ error: "Catch : " + error.message });
    }
}
