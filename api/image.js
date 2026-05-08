// ============================================================
//  PENSÉE IA — api/image.js
//  Optimisé pour la netteté et la fidélité de Flux
// ============================================================

export const config = { runtime: 'edge' };

const MODELS = {
    portrait: 'flux-realism',
    horror:   'flux-pro',
    realism:  'flux-realism',
    default:  'flux-pro',
};

function selectModel(prompt) {
    const p = prompt.toLowerCase();
    if (/visage|portrait|personne|homme|femme|face|person|skin|peau|human/.test(p))
        return MODELS.portrait;
    if (/horreur|horror|dark|ghost|spirit|génie|lagune|shadow|nuit|demon|fantôme/.test(p))
        return MODELS.horror;
    if (/photo|réaliste|realistic|rue|ville|abidjan|street|city|outdoor/.test(p))
        return MODELS.realism;
    return MODELS.default;
}

function enrichPrompt(prompt) {
    const p = prompt.toLowerCase();
    
    // Flux nécessite du langage naturel descriptif plutôt que des listes de tags.
    // L'ajout de "High quality photograph of..." force le modèle dans un espace latent plus net.
    if (/visage|portrait|personne|homme|femme|face|person|skin|peau/.test(p)) {
        return `A highly detailed, ultra-sharp professional photograph of ${prompt}. Studio lighting, visible skin texture and pores, extreme focus on the subject, photorealistic.`;
    } else if (/horreur|horror|dark|ghost|génie|lagune|demon|fantôme|shadow|nuit/.test(p)) {
        return `A cinematic, intensely sharp and atmospheric shot of ${prompt}. Dramatic chiaroscuro lighting, deep contrast, highly detailed textures, photorealistic realism.`;
    } else if (/rue|ville|abidjan|marché|street|city|outdoor|architecture/.test(p)) {
        return `A perfectly focused, ultra-clear architectural street photography of ${prompt}. Taken during golden hour with vivid colors, extremely detailed environments and sharp edges.`;
    } else {
        return `A masterfully captured, crystal clear, sharp photograph of ${prompt}. High resolution, highly detailed, perfect lighting and focus.`;
    }
}

function pollinationsUrl(prompt, model, w, h, seed) {
    // Utilisation des paramètres d'URL pour sécuriser la requête. 
    // enhance=false est conservé car enhance=true (LLM de Pollinations) risque de diluer 
    // tes spécificités géographiques (comme Abidjan) par des décors génériques.
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&model=${model}&seed=${seed}&nologo=true&enhance=false`;
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Méthode non autorisée' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
    }

    let body = {};
    try { body = await req.json(); } catch {}

    const { prompt, width, height } = body;

    if (!prompt || !prompt.trim()) {
        return new Response(
            JSON.stringify({ error: 'Prompt manquant.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const model    = selectModel(prompt);
    const enriched = enrichPrompt(prompt.trim());
    const seed     = Math.floor(Math.random() * 99999) + 1;
    
    // VERROUILLAGE RÉSOLUTION :
    // On limite à 1024 max pour éviter le flou d'upscaling côté serveur gratuit
    // 1024x1024 est le "sweet spot" (environ 1 Megapixel) pour des détails tranchants sur Flux
    const finalW   = Math.min(width  || 1024, 1024);
    const finalH   = Math.min(height || 1024, 1024);

    const layers = [
        {
            layer: 'preview',
            width: 512, height: 512,
            url: pollinationsUrl(enriched, 'turbo', 512, 512, seed),
        },
        {
            layer: 'standard',
            width: 768, height: 768,
            url: pollinationsUrl(enriched, model, 768, 768, seed),
        },
        {
            layer: 'hd',
            width: finalW, height: finalH,
            url: pollinationsUrl(enriched, model, finalW, finalH, seed),
        },
    ];

    return new Response(JSON.stringify({
        source:         'pollinations',
        model,
        seed,
        image:          layers[2].url,
        width:          finalW,
        height:         finalH,
        pixelCount:     finalW * finalH,
        layers,
        promptOriginal: prompt,
        promptUsed:     enriched,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
