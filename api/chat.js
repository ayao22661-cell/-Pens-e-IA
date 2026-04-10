export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Prompt manquant." });
    }

    const HF_API_KEY = process.env.HF_API_KEY;

    if (!HF_API_KEY) {
        return res.status(500).json({ error: "Clé API non configurée sur le serveur." });
    }

    try {
        const response = await fetch(
            "https://router.huggingface.co/hf-inference/models/deepseek-ai/deepseek-coder-6.7b-instruct/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${HF_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "deepseek-ai/deepseek-coder-6.7b-instruct",
                    messages: [
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 800,
                    temperature: 0.3
                })
            }
        );

        const data = await response.json();

        if (data.error) {
            return res.status(500).json({ error: data.error });
        }

        const reply = data.choices?.[0]?.message?.content || "Aucune réponse reçue.";
        return res.status(200).json([{ generated_text: reply }]);

    } catch (error) {
        console.error("Erreur Pensée IA:", error);
        return res.status(500).json({ error: "Erreur interne du serveur." });
    }
}
