// ============================================================
//  PENSÉE IA — api/image.js
//  100% Pollinations.ai — Gratuit, Illimité
//  Pipeline : Sélection modèle → Enrichissement prompt → HD net
// ============================================================

export const config = { runtime: 'edge' };

// ── Modèles disponibles sur Pollinations ─────────────────────
// flux         → meilleur équilibre qualité/vitesse (défaut)
// flux-realism → portraits, photos réalistes, scènes urbaines
// flux-pro     → qualité maximale, plus lent
// turbo        → rapide, bon pour les previews

const MODELS = {
    portrait:     'flux-realism',   // visages, personnes, peau
    realism:      'flux-realism',   // photos, rues, villes
    artistic:     'flux-pro',       // illustration, art, horreur
    default:      'flux-pro',       // tout le reste
};

// ── Sélection intelligente du modèle ─────────────────────────
function selectModel(prompt) {
    const p = prompt.toLowerCase();

    const portraitKw = [
        'visage','portrait','personne','homme','femme','fille','garçon','enfant',
        'face','person','man','woman','girl','boy','people','human','skin','body',
        'peau','regard','yeux','bouche','cheveux'
    ];
    const realismKw = [
        'photo','photographe','photoréaliste','réaliste','realistic','photorealistic',
        'rue','ville','abidjan','marché','quartier','foule','restaurant','intérieur',
        'street','city','crowd','indoor','outdoor','lifestyle','building','architecture'
    ];
    const artisticKw = [
        'horreur','horror','fantastique','fantasy','illustration','painting','art',
        'dessin','cartoon','anime','dark','dystopie','mystère','génie','esprit','lagune',
        'supernatural','ghost','spirit','water','eau','nuit','night','ombre','shadow'
    ];

    if (portraitKw.some(kw => p.includes(kw))) return MODELS.portrait;
    if (artisticKw.some(kw => p.includes(kw))) return MODELS.artistic;
    if (realismKw.some(kw => p.includes(kw))) return MODELS.realism;
    return MODELS.default;
}

// ── Enrichissement du prompt selon le type de contenu ────────
// Clé anti-flou : les suffixes de netteté sont critiques pour Flux
function buildSharpPrompt(prompt, model) {
    const p = prompt.toLowerCase();

    // Suffixes universels anti-flou pour Flux
    const sharpness = [
        'tack sharp', 'razor sharp focus', 'high frequency detail',
        'crisp edges', 'ultra-detailed', '8K resolution', 'no blur',
        'perfect focus', 'maximum sharpness', 'HDR'
    ].join(', ');

    let styleBoost = '';

    // Portrait / Personnes
    if (/visage|portrait|personne|homme|femme|face|person|skin|peau/.test(p)) {
        styleBoost = [
            'RAW photo', 'DSLR photography', 'Canon EOS R5', '85mm f/1.4 lens',
            'studio lighting', 'Rembrandt lighting', 'catchlights in eyes',
            'ultra-detailed skin texture', 'pore-level detail', 'subsurface scattering',
            'photorealistic', 'hyperrealistic', 'editorial photography'
        ].join(', ');
    }
    // Scène urbaine / Abidjan / Extérieur
    else if (/rue|ville|abidjan|marché|quartier|street|city|outdoor|architecture/.test(p)) {
        styleBoost = [
            'architectural photography', 'wide angle lens 24mm', 'golden hour lighting',
            'volumetric light', 'atmospheric depth', 'cinematic composition',
            'rule of thirds', 'leading lines', 'vivid colors', 'high contrast'
        ].join(', ');
    }
    // Horreur / Fantastique / Série TikTok
    else if (/horreur|horror|dark|ghost|spirit|génie|eau|lagune|shadow|ombre|nuit/.test(p)) {
        styleBoost = [
            'cinematic horror', 'dramatic chiaroscuro lighting', 'deep shadows',
            'atmospheric fog', 'backlit silhouette', 'moody color grading',
            'desaturated palette with accent colors', 'film grain', 'anamorphic lens flare',
            'hyperdetailed textures', 'photorealistic horror'
        ].join(', ');
    }
    // Artistique / Illustration
    else if (/illustration|painting|art|dessin|anime|fantasy/.test(p)) {
        styleBoost = [
            'digital art', 'concept art', 'artstation trending', 'Greg Rutkowski style',
            'intricate details', 'rich color palette', 'professional illustration',
            'highly rendered', 'detailed linework'
        ].join(', ');
    }
    // Défaut : photoréaliste général
    else {
        styleBoost = [
            'professional photography', 'natural lighting', 'high dynamic range',
            'vivid colors', 'sharp focus throughout', 'commercial photography quality'
        ].join(', ');
    }

    // Négatif implicite via prompt (Flux ne supporte pas neg prompt natif via URL)
    const antiBlur = 'avoid: blur, soft focus, noise, grain, pixelation, low quality, watermark, overexposed, underexposed';

    return `${prompt}, ${styleBoost}, ${sharpness}, masterpiece, best quality — ${antiBlur}`;
}

// ── Enrichissement via Gemini (optionnel si clé dispo) ────────
async function geminiEnhance(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `You are an expert AI image prompt engineer specializing in Flux image models.

Your task: Transform the user's prompt into a highly detailed, sharp, photorealistic generation prompt optimized specifically for Flux-Pro and Flux-Realism models.

Critical rules for Flux models:
1. Be extremely descriptive about lighting (direction, color temperature, intensity)
2. Specify lens and camera settings for realism (85mm, f/2.8, ISO 100, etc.)
3. Add texture descriptors (fabric weave, skin pores, surface roughness)
4. Include composition rules (rule of thirds, leading lines, foreground/background separation)
5. Add sharpness keywords: "tack sharp", "razor sharp focus", "ultra-detailed", "8K"
6. NEVER add blur, softness, or dreamy effects
7. If horror/dark content: use "cinematic chiaroscuro", "atmospheric fog", "deep shadow pools"
8. Output ONLY the enhanced prompt. No explanation, no quotes.

User prompt: "${prompt}"`
                }]
            }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 600 }
        }),
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return (text && text.length > 30) ? text : null;
}

// ── Construction URL Pollinations optimisée ───────────────────
function buildPollinationsUrl(prompt, model, width, height, seed) {
    const encoded = encodeURIComponent(prompt);
    // enhance=false car on gère nous-mêmes l'enrichissement
    // nologo=true pour images propres
    return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=false`;
}

// ── Handler principal ─────────────────────────────────────────
export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { prompt, width, height } = body;

    if (!prompt || prompt.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Prompt manquant.' }), { status: 400 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // ── Résolution finale ─────────────────────────────────────
    // Pollinations supporte jusqu'à ~2048px mais 1280px = meilleur ratio qualité/netteté
    const finalWidth  = Math.min(width  || 1280, 1792);
    const finalHeight = Math.min(height || 1280, 1792);

    // ── Sélection du modèle ───────────────────────────────────
    const model = selectModel(prompt);

    // ── Enrichissement du prompt ──────────────────────────────
    let enhancedPrompt = null;
    let enhanceSource  = 'none';

    // Essai 1 : Gemini si clé disponible
    if (GEMINI_API_KEY) {
        try {
            enhancedPrompt = await geminiEnhance(prompt, GEMINI_API_KEY);
            if (enhancedPrompt) enhanceSource = 'gemini';
        } catch (e) {
            console.warn('Gemini enhance failed:', e.message);
        }
    }

    // Essai 2 : Enrichissement local (toujours disponible, 0 dépendance)
    if (!enhancedPrompt) {
        enhancedPrompt = buildSharpPrompt(prompt, model);
        enhanceSource  = 'local';
    }

    // ── Génération seed fixe + variante ──────────────────────
    // Seed fixe = reproductibilité / seed+1 = variante légère
    const seed = Math.floor(Math.random() * 99999) + 1;

    // ── Couches de rendu ──────────────────────────────────────
    // On retourne 3 URLs :
    // - preview  : 512px  — affichage immédiat pendant le chargement
    // - standard : 768px  — qualité intermédiaire
    // - hd       : résolution finale demandée
    const layers = [
        {
            layer:  'preview',
            width:  512,
            height: 512,
            url:    buildPollinationsUrl(enhancedPrompt, 'turbo', 512, 512, seed),
        },
        {
            layer:  'standard',
            width:  768,
            height: 768,
            url:    buildPollinationsUrl(enhancedPrompt, model, 768, 768, seed),
        },
        {
            layer:  'hd',
            width:  finalWidth,
            height: finalHeight,
            url:    buildPollinationsUrl(enhancedPrompt, model, finalWidth, finalHeight, seed),
        },
    ];

    return new Response(JSON.stringify({
        source:        'pollinations',
        model,
        enhanceSource,
        seed,
        // Image principale HD
        image:         layers[2].url,
        width:         finalWidth,
        height:        finalHeight,
        pixelCount:    finalWidth * finalHeight,
        // Couches progressives pour rendu animé côté frontend
        layers,
        // Prompts pour debug / transparence
        promptOriginal: prompt,
        promptUsed:     enhancedPrompt,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
