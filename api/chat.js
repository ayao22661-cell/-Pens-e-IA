export default async function handler(req, res) {
    // 1. On n'accepte que les requêtes POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    // 2. Récupération du message de l'utilisateur
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    // 3. Récupération de l'unique clé Google configurée sur Vercel
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(401).json({ error: "Clé API non configurée sur Vercel." });

    try {
        // 4. Appel à l'API Gemini 2.5 Flash (Identifiant exact de tes quotas)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
            const statusCode = response.status;
            const errorMessage = data.error?.message || response.statusText;
            
            // Gestion spécifique du quota (Erreur 429)
            if (statusCode === 429) {
                return res.status(429).json({ error: "Quota atteint (5 req/min). Patiente un instant." });
            }
            
            return res.status(statusCode).json({ error: `Gemini ${statusCode} : ${errorMessage}` });
        }

        // 6. Extraction du texte et renvoi à l'interface
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Aucune réponse reçue.";
        
        // Formatage attendu par ia.js
        return res.status(200).json([{ generated_text: reply }]);

    } catch (error) {
        // Erreur critique Node.js
        return res.status(500).json({ error: "Erreur serveur (Catch) : " + error.message });
    }
}
