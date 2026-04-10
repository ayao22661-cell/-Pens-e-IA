export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(401).json({ error: "Clé API absente." });

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        // AUGMENTATION : On passe à 4000 pour des réponses plus longues
                        maxOutputTokens: 4000, 
                        // PRÉCISION : Une température basse évite que l'IA ne divague sur les gros fichiers
                        temperature: 0.2,
                        topP: 0.8,
                        topK: 40
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || "Erreur API" });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Réponse vide.";
        
        // On renvoie un tableau propre
        return res.status(200).json([{ generated_text: reply }]);

    } catch (error) {
        return res.status(500).json({ error: "Erreur serveur : " + error.message });
    }
}
