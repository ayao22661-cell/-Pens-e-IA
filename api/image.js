// ============================================================
//  PENSÉE IA — api/image.js
//  100% Pollinations.ai — Gratuit, Illimité, Anti-timeout
//  Pas de dépendance Gemini pour l'enrichissement
//  Edge-safe : tout tient dans 25s max
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
    let boost = '';

    if (/visage|portrait|personne|homme|femme|face|person|skin|peau/.test(p)) {
        boost = 'RAW photo, Canon EOS R5, 85mm f/1.4, sharp focus, studio lighting, ultra-detailed skin, catchlights, photorealistic, 8K UHD, no blur, crisp edges';
    } else if (/horreur|horror|dark|ghost|génie|lagune|demon|fantôme|shadow|nuit/.test(p)) {
        boost = 'cinematic horror, dramatic chiaroscuro, atmospheric fog, deep shadows, backlit silhouette, desaturated tones, film grain, anamorphic lens, hyperdetailed, tack sharp, 8K';
    } else if (/rue|ville|abidjan|marché|street|city|outdoor|architecture/.test(p)) {
        boost = 'architectural photography, 24mm wide angle, golden hour, volumetric light, vivid colors, high contrast, tack sharp, 8K UHD, crisp edges';
    } else {
        boost = 'professional photography, natural lighting, high dynamic range, ultra-detailed, tack sharp, razor sharp focus, 8K UHD, masterpiece, no blur';
    }

    const antiBlur = 'avoid blur, soft focus, noise, pixelation, low quality, watermark';
    return `${prompt}, ${boost}, best quality — ${antiBlur}`;
}

function pollinationsUrl(prompt, model, w, h, seed) {
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
    const finalW   = Math.min(width  || 1280, 1536);
    const finalH   = Math.min(height || 1280, 1536);

    // On retourne uniquement les URLs — zéro fetch côté Edge
    // Le frontend charge les couches directement depuis le navigateur
    // → Plus aucun risque de timeout Edge Function
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
