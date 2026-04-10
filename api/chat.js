export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(401).json({ error: "Clé API non configurée sur Vercel." });

    try {
        // Utilisation de gemini-1.5-flash-latest pour éviter l'erreur 404
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 2000, temperature: 0.3 }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error?.message || response.statusText;
            return res.status(response.status).json({ error: `Gemini ${response.status} : ${errorMessage}` });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Aucune réponse reçue.";
        return res.status(200).json([{ generated_text: reply }]);

    } catch (error) {
        return res.status(500).json({ error: "Catch Node.js : " + error.message });
    }
}
