import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

    const { prompt, files, userId } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant." });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(401).json({ error: "Clé API absente." });

    // Vérification et décompte des crédits en base
    if (userId) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: credit } = await supabase
            .from('credits')
            .select('credits_used')
            .eq('user_id', userId)
            .eq('date', today)
            .single();

        const used = credit?.credits_used ?? 0;
        if (used >= 15) {
            return res.status(429).json({ error: "Crédits épuisés. Reviens demain !" });
        }

        await supabase.from('credits').upsert({
            user_id: userId,
            date: today,
            credits_used: used + 1
        }, { onConflict: 'user_id,date' });
    }

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

    async function callGemini(modelName, attachedFiles) {
        const parts = [{ text: prompt }];

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
                    tools: [{ google_search: {} }],
                    generationConfig: {
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

    function isOverloaded(data, response) {
        if (response.status === 429) return true;
        const msg = (data.error?.message || "").toLowerCase();
        return msg.includes("high demand") || msg.includes("experiencing") || msg.includes("overloaded");
    }

    try {
        let lastData, lastResponse;

        for (const model of modelsToTry) {
            const { response, data } = await callGemini(model, files);
            lastData = data;
            lastResponse = response;

            if (response.ok && !data.error && data.candidates?.length > 0) {
                const reply = data.candidates[0].content.parts[0].text || "Réponse vide.";

                // Sauvegarde de la conversation en base
                if (userId) {
                    await supabase.from('conversations').insert([
                        { user_id: userId, role: 'user', content: prompt },
                        { user_id: userId, role: 'assistant', content: reply }
                    ]);
                }

                return res.status(200).json([{ generated_text: reply, used_model: model }]);
            }

            if (isOverloaded(data, response) || response.status === 404) {
                console.warn(`[INFO] Modèle ${model} indisponible. Essai du modèle suivant...`);
                continue; 
            }

            break;
        }

        const errMsg = lastData?.error?.message || "Les serveurs IA sont saturés. Réessaie dans quelques secondes.";
        return res.status(lastResponse?.status || 500).json({ error: errMsg });

    } catch (error) {
        return res.status(500).json({ error: "Erreur critique serveur : " + error.message });
    }
}
