// ============================================================
//  PENSÉE IA — api/_lib/auth.js
//  Authentification Supabase, quota atomique, jetons de tour.
// ============================================================

export const MAX_DAILY_CREDITS = 20;
const TURN_TTL_MS = 45 * 60 * 1000; // un tour d'agent (boucle d'outils, tâches de code longues) dure au plus 45 min

function sbEnv() {
    return {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
}

function sbHeaders(key) {
    return { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' };
}

/** true si les variables Supabase sont présentes (mode production). */
export function isAuthEnabled() {
    const { url, key } = sbEnv();
    return Boolean(url && key);
}

/**
 * Valide le token Bearer auprès de Supabase.
 * @returns {Promise<{userId: string|null}>} userId null en mode dev (sans Supabase)
 * @throws {HttpError}
 */
export async function authenticate(req) {
    const { url, key } = sbEnv();
    if (!url || !key) {
        console.warn('[PENSÉE] Mode dev : variables Supabase absentes, authentification désactivée.');
        return { userId: null };
    }
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Accès refusé. Token manquant.');

    const res = await fetch(`${url}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': key },
    });
    if (!res.ok) throw new HttpError(401, 'Session expirée. Reconnecte-toi.');
    const user = await res.json();
    if (!user?.id) throw new HttpError(401, 'Utilisateur introuvable.');
    return { userId: user.id };
}

/**
 * Consomme 1 crédit de façon atomique (fonction SQL consume_credit).
 * Repli sur l'ancien mode lecture+écriture si la fonction n'est pas encore déployée.
 * @returns {Promise<number>} crédits restants
 * @throws {HttpError} 403 si le quota est épuisé
 */
export async function consumeCredit(userId) {
    const { url, key } = sbEnv();
    if (!url || !key || !userId) return MAX_DAILY_CREDITS;

    const rpc = await fetch(`${url}/rest/v1/rpc/consume_credit`, {
        method: 'POST',
        headers: sbHeaders(key),
        body: JSON.stringify({ p_user_id: userId, p_max: MAX_DAILY_CREDITS }),
    });

    if (rpc.ok) {
        const remaining = await rpc.json();
        if (typeof remaining === 'number' && remaining < 0) {
            throw new HttpError(403, `Quota journalier épuisé (${MAX_DAILY_CREDITS}/${MAX_DAILY_CREDITS}). Reviens demain !`);
        }
        return typeof remaining === 'number' ? remaining : MAX_DAILY_CREDITS;
    }

    // 404 = migration SQL pas encore appliquée → ancien comportement (non atomique)
    if (rpc.status !== 404) {
        console.warn('[PENSÉE] consume_credit a échoué :', rpc.status, await rpc.text().catch(() => ''));
    }
    return legacyConsumeCredit(url, key, userId);
}

async function legacyConsumeCredit(url, key, userId) {
    const today = new Date().toISOString().slice(0, 10);
    const profRes = await fetch(
        `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=credits_used,last_reset_date`,
        { headers: sbHeaders(key) }
    );
    const profiles = profRes.ok ? await profRes.json() : [];
    const p = profiles[0] || {};
    const used = String(p.last_reset_date || '').slice(0, 10) === today ? (p.credits_used || 0) : 0;
    if (used >= MAX_DAILY_CREDITS) {
        throw new HttpError(403, `Quota journalier épuisé (${MAX_DAILY_CREDITS}/${MAX_DAILY_CREDITS}). Reviens demain !`);
    }
    await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { ...sbHeaders(key), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ credits_used: used + 1, last_reset_date: today }),
    }).catch(() => {});
    return MAX_DAILY_CREDITS - used - 1;
}

/** Rend le crédit si aucun modèle n'a pu répondre. Silencieux. */
export async function refundCredit(userId) {
    const { url, key } = sbEnv();
    if (!url || !key || !userId) return;
    await fetch(`${url}/rest/v1/rpc/refund_credit`, {
        method: 'POST',
        headers: sbHeaders(key),
        body: JSON.stringify({ p_user_id: userId }),
    }).catch(() => {});
}

// ============================================================
//  JETONS DE TOUR
//  Un message utilisateur = 1 crédit, même si l'agent enchaîne
//  plusieurs appels (outils). Le premier appel renvoie un jeton
//  signé ; les appels de continuation le présentent au lieu de
//  consommer un nouveau crédit.
// ============================================================

function turnSecret() {
    return process.env.TURN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function b64url(bytes) {
    let s = '';
    for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(message) {
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(turnSecret()),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

export async function signTurnToken(userId) {
    // Sans secret (mode dev, variables absentes) : jeton non signé, accepté par verifyTurnToken
    if (!turnSecret()) return 'dev';
    const turnId = crypto.randomUUID();
    const exp = Date.now() + TURN_TTL_MS;
    const sig = await hmac(`${userId || 'dev'}.${turnId}.${exp}`);
    return `${turnId}.${exp}.${sig}`;
}

export async function verifyTurnToken(token, userId) {
    if (!turnSecret()) return true; // mode dev
    if (typeof token !== 'string') return false;
    const [turnId, exp, sig] = token.split('.');
    if (!turnId || !exp || !sig || Number(exp) < Date.now()) return false;
    const expected = await hmac(`${userId || 'dev'}.${turnId}.${exp}`);
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
}

export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
