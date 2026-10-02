// ============================================================
//  PENSÉE IA — api/image.js
//  Génération d'images réalistes.
//
//  1. La demande est réécrite en une description visuelle claire, en anglais
//     (Gemma, quota large ; repli Flash Lite ; sinon la demande telle quelle).
//  2. L'image est produite par Cloudflare Workers AI (FLUX.1 schnell par défaut,
//     offre gratuite quotidienne). Variables : CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
//     (optionnel : CLOUDFLARE_IMAGE_MODEL).
//  3. L'image revient en base64 ; le client l'enregistre dans le stockage Supabase.
//
//  Coût : 1 message du quota, débité seulement si l'image est livrée.
// ============================================================

import { authenticate, HttpError, quotaGate, quotaCharge, refundCredit } from './_lib/auth.js';

const IMAGE_COST = 1;
const CF_MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
const REWRITE_MODELS = ['gemma-4-26b-a4b-it', 'gemini-3.1-flash-lite'];

const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const cfEnv = () => ({
    account: process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN,
});

// ── 1. Réécriture de la demande ──────────────────────────────
// Les modèles récents (FLUX) rendent mieux une phrase naturelle et précise
// qu'une liste de mots-clés (« 8K, masterpiece, Canon EOS… »).
const REWRITE_INSTRUCTIONS = `You turn a user's image request (often in French) into ONE prompt for a text-to-image model (FLUX).
Rules:
- Write in English, 40 to 90 words, plain descriptive sentences. No lists, no quotes, no preamble.
- Stay faithful to the request: same subject, same number of people, same place, same mood. Never add a celebrity or a brand.
- Keep every explicit detail (ethnicity, age, clothing, colors, text to write in the image — keep that text in its original language, in double quotes).
- Unless the user asks for a drawing, painting, 3D, anime, logo or another style, make it a realistic photograph: describe the framing (close-up, wide shot…), the light (time of day, direction, softness), the setting and textures, and one plausible camera/lens detail.
- If the user asks for a style, describe that style precisely instead of a photo.
- Places in Côte d'Ivoire / West Africa must look authentic (architecture, vegetation, light), not generic.
Return only the prompt.`;

async function rewritePrompt(request) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return request;
    for (const model of REWRITE_MODELS) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(9000),
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: `${REWRITE_INSTRUCTIONS}\n\nUser request:\n${request}` }] }],
                    generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
                }),
            });
            if (!res.ok) continue;
            const data = await res.json();
            const text = (data.candidates?.[0]?.content?.parts || [])
                .filter(p => !p.thought).map(p => p.text || '').join('')
                .replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
            if (text.length >= 20) return text.slice(0, 1800);
        } catch (_) { /* modèle suivant */ }
    }
    return request;
}

// ── 2. Génération ────────────────────────────────────────────
async function generateCloudflare(prompt) {
    const { account, token } = cfEnv();
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${CF_MODEL}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(50000),
        body: JSON.stringify({ prompt, steps: 8, seed: Math.floor(Math.random() * 2 ** 31) }),
    });
    const data = await res.json().catch(() => null);
    const image = data?.result?.image;
    if (!res.ok || !image) {
        const msg = data?.errors?.[0]?.message || `HTTP ${res.status}`;
        if (res.status === 429 || /neuron|limit|quota/i.test(msg)) {
            throw new HttpError(503, "Quota d'images du jour atteint. Réessaie demain.");
        }
        if (res.status === 401 || res.status === 403) {
            throw new HttpError(503, 'Génération d’images mal configurée (clé Cloudflare refusée).');
        }
        if (/nsfw|safety|flagged/i.test(msg)) {
            throw new HttpError(422, 'Cette image a été refusée par le filtre de sécurité. Reformule ta demande.');
        }
        throw new HttpError(502, `Le générateur d'images n'a pas répondu (${msg}).`);
    }
    return { data: image, mimeType: 'image/jpeg' };
}

// ── Point d'entrée ───────────────────────────────────────────
export async function POST(req) {
    let userId = null;
    let gate = null;
    try {
        ({ userId } = await authenticate(req));
        const body = await req.json().catch(() => ({}));
        const request = String(body.prompt || '').trim().slice(0, 2000);
        if (!request) throw new HttpError(400, 'Décris l’image à générer.');

        const { account, token } = cfEnv();
        if (!account || !token) {
            throw new HttpError(503, 'Génération d’images pas encore configurée (variables CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_API_TOKEN).');
        }

        gate = await quotaGate(userId);
        const prompt = await rewritePrompt(request);
        const image = await generateCloudflare(prompt);

        const quota = gate.mode === 'quota' ? await quotaCharge(userId, IMAGE_COST).catch(() => null) : null;
        gate = null; // livré : plus rien à rembourser
        return json({ type: 'base64', ...image, model: CF_MODEL, promptUsed: prompt, quota });
    } catch (e) {
        // Ancien système : le crédit pris à l'entrée est rendu si l'image n'a pas été livrée
        if (gate?.mode === 'legacy') await refundCredit(userId).catch(() => {});
        const status = e instanceof HttpError ? e.status : 500;
        return json({ error: e instanceof HttpError ? e.message : `Erreur image : ${e?.message || e}`, ...(e?.data || {}) }, status);
    }
}
