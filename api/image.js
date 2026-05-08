// ============================================================
//  PENSÉE IA — api/image.js
//  Qualité proche DALL-E 3 · Pollinations gratuit & illimité
//  Stratégie : prompt engineering avancé + modèle optimal fixe
// ============================================================

export const config = { runtime: 'edge' };

// ── MODÈLES DISPONIBLES POLLINATIONS ─────────────────────────
// flux-realism  → photoréalisme, portraits, scènes urbaines   ← meilleur pour tout
// flux          → illustration, fantasy, créatif
// turbo         → preview rapide uniquement (qualité réduite)
// ─────────────────────────────────────────────────────────────

// Catégories de prompt pour orienter le style
const CATEGORIES = {
    PORTRAIT:      'portrait',
    SCENE_URBAINE: 'scene_urbaine',
    HORROR:        'horror',
    NATURE:        'nature',
    ILLUSTRATION:  'illustration',
    DEFAUT:        'defaut',
};

function detectCategory(prompt) {
    const p = prompt.toLowerCase();
    if (/visage|portrait|personne|homme|femme|fille|garçon|face|person|human|skin|peau|model|acteur|actrice/.test(p))
        return CATEGORIES.PORTRAIT;
    if (/horreur|horror|dark|ghost|spirit|génie|lagune|shadow|demon|fantôme|monstre|effrayant|sinistre|nuit noire/.test(p))
        return CATEGORIES.HORROR;
    if (/rue|ville|abidjan|marché|market|street|city|outdoor|architecture|quartier|bâtiment|immeuble|plateau|cocody|yopougon/.test(p))
        return CATEGORIES.SCENE_URBAINE;
    if (/nature|forêt|ocean|mer|plage|montagne|jungle|arbre|fleur|paysage|landscape|sunset|coucher|lever/.test(p))
        return CATEGORIES.NATURE;
    if (/dessin|illustration|cartoon|anime|manga|art|peinture|painting|digital|fantasy|imaginaire|concept/.test(p))
        return CATEGORIES.ILLUSTRATION;
    return CATEGORIES.DEFAUT;
}

// ── PROMPT ENGINEERING NIVEAU DALL-E 3 ───────────────────────
// Principe : sujet → contexte → lumière → style technique → qualité
// DALL-E 3 excelle parce qu'OpenAI réécrit le prompt en interne.
// On reproduit ça manuellement avec des blocs structurés.
// ─────────────────────────────────────────────────────────────
function enrichPrompt(prompt, category) {

    // Bloc qualité universel — injecté sur toutes les catégories
    const QUALITY = 'masterpiece, best quality, ultra-detailed, sharp focus, professional color grading, no blur, no noise, no watermark, no text';

    // Bloc négatif simulé via le prompt (Pollinations n'a pas de negative prompt natif,
    // on injecte "avoid:" qui est compris par les modèles Flux)
    const AVOID = 'avoid: blur, soft focus, noise, pixelation, low quality, watermark, text, signature, oversaturated, distorted anatomy, extra limbs';

    switch (category) {

        case CATEGORIES.PORTRAIT:
            return [
                `Hyper-realistic portrait photograph of ${prompt}.`,
                'Canon EOS R5, 85mm f/1.4 lens, shallow depth of field.',
                'Studio three-point lighting, visible skin pores and texture, catchlights in eyes.',
                'Natural skin tones, photorealistic, 8K UHD resolution.',
                QUALITY,
                AVOID,
            ].join(' ');

        case CATEGORIES.HORROR:
            return [
                `Cinematic horror scene: ${prompt}.`,
                'Shot on ARRI Alexa, anamorphic lens, 2.39:1 aspect ratio.',
                'Chiaroscuro lighting, deep shadows, mist atmosphere.',
                'Film grain texture, desaturated palette with cold blue and crimson accents.',
                'Hyper-detailed, photorealistic, terrifying atmosphere.',
                QUALITY,
                AVOID,
            ].join(' ');

        case CATEGORIES.SCENE_URBAINE:
            return [
                `Street photography of ${prompt}.`,
                'Leica Q2, 28mm lens, f/5.6, golden hour natural light.',
                'Vivid colors, deep shadows, crisp edges, motion frozen.',
                'Documentary style, authentic atmosphere, 4K resolution.',
                QUALITY,
                AVOID,
            ].join(' ');

        case CATEGORIES.NATURE:
            return [
                `Nature photography of ${prompt}.`,
                'Sony A7R IV, 24-70mm f/2.8, polarizing filter.',
                'Dramatic natural lighting, rich saturated colors, high dynamic range.',
                'National Geographic style, ultra-sharp foreground and background.',
                QUALITY,
                AVOID,
            ].join(' ');

        case CATEGORIES.ILLUSTRATION:
            return [
                `Digital art illustration of ${prompt}.`,
                'Concept art style, detailed brush strokes, rich color palette.',
                'Cinematic composition, dramatic lighting, highly detailed.',
                'ArtStation trending, professional digital painting.',
                QUALITY,
                AVOID,
            ].join(' ');

        default:
            return [
                `Photorealistic image of ${prompt}.`,
                'Professional photography, Canon EOS R5.',
                'Perfect exposure, natural lighting, high dynamic range.',
                '8K resolution, ultra-detailed.',
                QUALITY,
                AVOID,
            ].join(' ');
    }
}

// ── SÉLECTION DU MODÈLE PAR CATÉGORIE ────────────────────────
function selectModel(category) {
    // flux-realism sur tout sauf illustration pure
    if (category === CATEGORIES.ILLUSTRATION) return 'flux';
    return 'flux-realism';
}

// ── CONSTRUCTION URL POLLINATIONS ────────────────────────────
function pollinationsUrl(prompt, model, w, h, seed) {
    // VERSION SAFE : Retrait de nologo=true (anti-timeout) et safe=false (anti-rejet API)
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&model=${model}&seed=${seed}&enhance=false`;
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────────
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

    const category = detectCategory(prompt.trim());
    const model    = selectModel(category);
    const enriched = enrichPrompt(prompt.trim(), category);
    const seed     = Math.floor(Math.random() * 999999) + 1;

    // Résolution 1024×1024 — standard DALL-E 3
    // Pas de fetch serveur → pas de timeout serveur, le browser charge directement
    const finalW = Math.min(width  || 1024, 1024);
    const finalH = Math.min(height || 1024, 1024);

    const previewUrl  = pollinationsUrl(enriched, 'turbo', 512, 512, seed);
    const standardUrl = pollinationsUrl(enriched, model,   768, 768, seed);
    const hdUrl       = pollinationsUrl(enriched, model,   finalW, finalH, seed);

    return new Response(JSON.stringify({
        source:         'pollinations',
        model,
        category,
        seed,
        image:          hdUrl,
        width:          finalW,
        height:         finalH,
        layers: [
            { layer: 'preview',  width: 512,    height: 512,    url: previewUrl  },
            { layer: 'standard', width: 768,    height: 768,    url: standardUrl },
            { layer: 'hd',       width: finalW, height: finalH, url: hdUrl       },
        ],
        promptOriginal: prompt,
        promptUsed:     enriched,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
