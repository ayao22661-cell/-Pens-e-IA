// ============================================================
//  PENSÉE IA — api/chat.js
//  Fonction serverless Vercel
//  ✅ La clé HF_API_KEY est lue depuis les variables Vercel
//     Elle n'est JAMAIS visible dans le navigateur
// ============================================================

export default async function handler(req, res) {

    // Autorise uniquement POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Prompt manquant." });
    }

    // ✅ Clé lue depuis l'environnement Vercel — jamais exposée
    const HF_API_KEY = process.env.HF_API_KEY;

    if (!HF_API_KEY) {
        return res.status(500).json({ error: "Clé API non configurée sur le serveur." });
    }

    try {
        const response = await fetch(
            "https://api-inference.huggingface.co/models/deepseek-ai/deepseek-coder-6.7b-instruct",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${HF_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 800,
                        temperature: 0.3,
                        return_full_text: false,
                        stop: ["### Utilisateur:"]
                    }
                })
            }
        );

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error("Erreur Pensée IA:", error);
        return res.status(500).json({ error: "Erreur interne du serveur." });
    }
}