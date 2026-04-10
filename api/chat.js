export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    const keys = [
        process.env.GROQ_API_KEY_1,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3
    ].filter(Boolean);

    if (keys.length === 0) return res.status(500).json({ error: "Clé API non configurée." });

    const GROQ_API_KEY = keys[Math.floor(Math.random() * keys.length)];

    try {
        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 800,
                    temperature: 0.3
                })
            }
        );

        const rawText = await response.text();

        if (!response.ok) {
            return res.status(500).json({ error: "Groq erreur " + response.status + " : " + rawText });
        }

        const data = JSON.parse(rawText);
        const reply = data.choices?.[0]?.message?.content || "Aucune réponse reçue.";
        return res.status(200).json([{ generated_text: reply }]);

    } catch (error) {
        return res.status(500).json({ error: "Catch : " + error.message });
    }
}
