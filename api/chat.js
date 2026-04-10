export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(401).json({ error: "Clé API absente." });

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000;

    async function callGemini() {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: 65536,
                        temperature: 0.2,
                        topP: 0.8,
                        topK: 40
                    }
                })
            }
        );
        const data = await response.json();
        return { response, data };
    }

    function isOverloaded(data) {
        const msg = (data.error?.message || "").toLowerCase();
        return msg.includes("high demand") || msg.includes("experiencing") || msg.includes("overloaded");
    }

    try {
        let lastData, lastResponse;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const { response, data } = await callGemini();
            lastData = data;
            lastResponse = response;

            // Succès
            if (response.ok && !data.error && data.candidates?.length > 0) {
                const reply = data.candidates[0].content.parts[0].text || "Réponse vide.";
                return res.status(200).json([{ generated_text: reply }]);
            }

            // Surcharge → on réessaie après délai
            if (isOverloaded(data) && attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                continue;
            }

            // Autre erreur → on sort immédiatement
            break;
        }

        // Après tous les essais, on retourne l'erreur
        const errMsg = lastData.error?.message || "Erreur API inconnue";
        return res.status(lastResponse.status || 500).json({ error: errMsg });

    } catch (error) {
        return res.status(500).json({ error: "Erreur serveur : " + error.message });
    }
}
