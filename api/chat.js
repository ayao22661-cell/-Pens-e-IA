// ============================================================
//  PENSÉE IA — api/chat.js (Vercel, sans Supabase)
//  Recherche web Google activée via tools
// ============================================================

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

    const { prompt, files } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(401).json({ error: "Clé API absente." });

    // Cascade de modèles — Gemini EN PREMIER (google_search dispo), Gemma en dernier recours
    const modelsToTry = [
        // 1. GEMINI PRIORITAIRES — google_search disponible
        "gemini-2.5-flash",                      // 250k TPM — meilleur raisonnement
        "gemini-2.5-flash-lite-preview-06-17",   // 250k TPM — backup léger (Gemini 2.5 Flash Lite)
        "gemini-2.0-flash",                      // backup Gemini 2 Flash
        "gemini-2.0-flash-lite",                 // backup Gemini 2 Flash Lite

        // 2. GEMMA — ⚠️ PAS de google_search, mémoire figée uniquement
        // Utilisés seulement si TOUS les modèles Gemini sont saturés
        "gemma-3-27b-it",        // 15k TPM (Risque de crash sur long historique)
        "gemma-3-12b-it",
        "gemma-3-4b-it",
        "gemma-3-2b-it"
    ];

    async function callGemini(modelName, attachedFiles) {
        const parts = [{ text: prompt }];

        // Ajouter les fichiers binaires (PDF, images, audio)
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

        // Construire le body — google_search uniquement sur les modèles Gemini
        // (les modèles Gemma ne supportent pas les tools)
        const isGemma = modelName.startsWith("gemma");
        const body = {
            contents: [{ parts }],
            generationConfig: {
                maxOutputTokens: 65536,
                temperature: 0.5,
                topP: 0.95,
                topK: 64
            }
        };
        // Recherche web activée pour les modèles Gemini uniquement
        // google_search est un outil natif Gemini — toolConfig mode "ANY" est incompatible avec lui
        if (!isGemma) {
            body.tools = [{ google_search: {} }];
            // Mode AUTO : Gemini décide, mais le prompt système l'incite à toujours chercher
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }
        );

        const data = await response.json();
        return { response, data };
    }

    function isOverloaded(data, response) {
        if (response.status === 429) return true;
        const msg = (data.error?.message || "").toLowerCase();
        return msg.includes("high demand") || msg.includes("experiencing") || msg.includes("overloaded");
    }

    try {
        let lastData, lastResponse;

        for (const model of modelsToTry) {
            const { response, data } = await callGemini(model, files);
            lastData     = data;
            lastResponse = response;

            if (response.ok && !data.error && data.candidates?.length > 0) {
                // Extraire le texte (peut y avoir plusieurs parts si grounding)
                const parts = data.candidates[0].content?.parts || [];
                const reply = parts.map(p => p.text || "").join("").trim() || "Réponse vide.";

                // Avertir si on est sur Gemma (pas de google_search)
                const isGemmaModel = model.startsWith("gemma");
                const prefix = isGemmaModel
                    ? "⚠️ *Mode mémoire — recherche web indisponible sur ce modèle.*\n\n"
                    : "";

                return res.status(200).json([{ generated_text: prefix + reply, used_model: model }]);
            }

            if (isOverloaded(data, response) || response.status === 404) {
                console.warn(`[INFO] ${model} indisponible — essai suivant...`);
                continue;
            }

            // Autre erreur non récupérable : on sort de la boucle
            break;
        }

        const errMsg = lastData?.error?.message || "Serveurs IA saturés. Réessaie dans quelques secondes.";
        return res.status(lastResponse?.status || 500).json({ error: errMsg });

    } catch (error) {
        return res.status(500).json({ error: "Erreur critique : " + error.message });
    }
}
