export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

    // On récupère désormais le prompt ET les fichiers binaires éventuels
    const { prompt, files } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(401).json({ error: "Clé API absente." });

    // 🏆 Liste complète des modèles exploitables (Capacité : +60 000 requêtes/jour)
    const modelsToTry = [
        "gemini-3.1-flash-lite", 
        "gemma-3-27b-it", 
        "gemma-3-12b-it", 
        "gemma-4-31b-it", 
        "gemma-4-26b-it", 
        "gemma-3-4b-it", 
        "gemma-3-2b-it", 
        "gemini-3-flash", 
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash", 
        "gemini-robotics-er-1.5-preview"
    ];

    // ✅ Fonction de génération multimodale avec recherche Google intégrée
    async function callGemini(modelName, attachedFiles) {
        // Préparation des "parts" (Texte + Fichiers binaires)
        const parts = [{ text: prompt }];

        // Si des fichiers binaires (PDF, Audio) sont présents, on les ajoute
        if (attachedFiles && attachedFiles.length > 0) {
            attachedFiles.forEach(file => {
                if (file.base64) {
                    parts.push({
                        inline_data: {
                            mime_type: file.mime,
                            data: file.base64
                        }
                    });
                }
            });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: parts }],
                    tools: [{ google_search: {} }], // Recherche Google temps réel activée
                    generationConfig: {
                        // Limite de sécurité à 15k pour les modèles Gemma 3
                        maxOutputTokens: modelName.includes("gemma-3") ? 15000 : 65536,
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

    // Détection des surcharges serveur
    function isOverloaded(data, response) {
        if (response.status === 429) return true;
        const msg = (data.error?.message || "").toLowerCase();
        return msg.includes("high demand") || msg.includes("experiencing") || msg.includes("overloaded");
    }

    try {
        let lastData, lastResponse;

        // Boucle de cascade (Fallback)
        for (const model of modelsToTry) {
            const { response, data } = await callGemini(model, files);
            lastData = data;
            lastResponse = response;

            // ✅ Succès
            if (response.ok && !data.error && data.candidates?.length > 0) {
                const reply = data.candidates[0].content.parts[0].text || "Réponse vide.";
                return res.status(200).json([{ generated_text: reply, used_model: model }]);
            }

            // ⚠️ Surcharge ou Modèle introuvable (404) → Passage au suivant
            if (isOverloaded(data, response) || response.status === 404) {
                console.warn(`[INFO] Modèle ${model} indisponible. Essai du modèle suivant...`);
                continue; 
            }

            // ❌ Erreur fatale (Sécurité, Clé expirée...) → Arrêt immédiat
            break;
        }

        const errMsg = lastData?.error?.message || "Les serveurs IA sont saturés. Réessaie dans quelques secondes.";
        return res.status(lastResponse?.status || 500).json({ error: errMsg });

    } catch (error) {
        return res.status(500).json({ error: "Erreur critique serveur : " + error.message });
    }
}
