// ============================================================
//  PENSÉE IA — src/credits.js
//  Affichage de l'usage. Le décompte est fait UNIQUEMENT par le serveur.
//
//  Mode "quota" : fenêtre glissante de 5 h (45 messages par défaut),
//                 jauge, avertissement à 80 %, compte à rebours à 100 %.
//  Mode "legacy": anciens crédits journaliers, tant que la migration SQL
//                 du quota n'est pas appliquée.
// ============================================================

import { CONFIG } from './config.js';
import { state } from './state.js';
import { supabase, getAccessToken } from './supabase.js';
import { els, setStatus } from './ui/dom.js';
import { ringGauge } from './ui/brand.js';

const WARN_RATIO = 0.8;
let tickTimer = null;

// ── Chargement ───────────────────────────────────────────────
export async function loadCredits() {
    if (!state.currentUser) return;
    try {
        const res = await fetch('/api/quota', { headers: { Authorization: `Bearer ${await getAccessToken()}` } });
        const data = res.ok ? await res.json() : null;
        if (data?.mode === 'quota') { setQuota(data.quota); return; }
    } catch (_) { /* repli sur les crédits */ }
    await loadLegacyCredits();
}

async function loadLegacyCredits() {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('credits_used, last_reset_date')
        .eq('id', state.currentUser.id)
        .maybeSingle();
    if (error) { console.error('Erreur profil :', error); return; }
    const today = new Date().toISOString().slice(0, 10); // UTC, comme le serveur
    const sameDay = String(profile?.last_reset_date || '').slice(0, 10) === today;
    setCredits(CONFIG.maxCredits - (sameDay ? (profile?.credits_used || 0) : 0));
}

// ── Mises à jour envoyées par le serveur ─────────────────────
export function setQuota(quota) {
    if (!quota) return;
    state.quota = {
        used: Number(quota.used) || 0,
        limit: Number(quota.limit) || 45,
        hours: Number(quota.hours) || 5,
        resetAt: quota.resetAt ? new Date(quota.resetAt).getTime() : null,
    };
    renderCredits();
}

export function setCredits(remaining) {
    if (state.quota) return; // le quota prime sur l'ancien système
    state.creditsLeft = Math.max(0, Math.min(CONFIG.maxCredits, remaining));
    renderCredits();
}

/** L'utilisateur peut-il envoyer un message maintenant ? */
export function isBlocked() {
    const q = currentQuota();
    if (q) return q.used >= q.limit;
    return state.creditsLeft <= 0;
}

/** Quota à jour : une fenêtre expirée repart de zéro côté affichage aussi. */
function currentQuota() {
    const q = state.quota;
    if (!q) return null;
    if (q.resetAt && Date.now() >= q.resetAt) { q.used = 0; q.resetAt = null; }
    return q;
}

// ── Affichage ────────────────────────────────────────────────
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
function fmtDelay(ms) {
    const min = Math.max(1, Math.ceil(ms / 60000));
    const h = Math.floor(min / 60);
    return h ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

function ensureSubline() {
    let sub = document.getElementById('quotaReset');
    if (!sub) {
        sub = document.createElement('div');
        sub.id = 'quotaReset';
        sub.className = 'pz-quota-sub';
        document.getElementById('creditBar')?.after(sub);
    }
    return sub;
}

/** Anneau autour du point = part restante (remplace la barre de progression). */
function renderGauge(remainingRatio) {
    let g = document.getElementById('pzGauge');
    if (!g) {
        g = document.createElement('span');
        g.id = 'pzGauge';
        els.creditCount?.before(g);
    }
    g.innerHTML = ringGauge(remainingRatio, 24);
}

function setBanner(kind, html) {
    const banner = els.alertBanner;
    banner.className = kind ? `pz-quota-banner ${kind}` : '';
    banner.style.display = kind ? 'block' : 'none';
    banner.innerHTML = html || '';
}

function setInputLocked(locked) {
    els.userInput.disabled = locked;
    els.uploadBtn.disabled = locked;
    els.userInput.placeholder = locked ? 'Limite atteinte — patiente jusqu’à la réinitialisation' : 'Discuter avec Pensée…';
    window.dispatchEvent(new Event('pensee:input'));
}

export function renderCredits() {
    const q = currentQuota();
    const label = document.querySelector('#creditBar .credit-label');

    if (!q) {
        // ── Ancien système : crédits journaliers ──
        const left = state.creditsLeft;
        const pct = (left / CONFIG.maxCredits) * 100;
        if (label) label.textContent = 'Crédits';
        els.creditFill.style.width = pct + '%';
        els.creditFill.style.background = pct > 50 ? '#00e5a0' : pct > 20 ? '#f5c542' : '#ff6b6b';
        els.creditCount.textContent = `${left} / ${CONFIG.maxCredits}`;
        renderGauge(left / CONFIG.maxCredits);
        setInputLocked(left === 0);
        if (left === 0) { setBanner('empty', "Crédits épuisés pour aujourd'hui. Reviens demain !"); setStatus('warn'); }
        else if (left <= 5) setBanner('low', `Plus que ${left} message(s) aujourd'hui.`);
        else setBanner(null);
        return;
    }

    // ── Quota par fenêtre glissante ──
    const ratio = Math.min(1, q.used / q.limit);
    const left = Math.max(0, Math.floor(q.limit - q.used));
    if (label) label.textContent = `Usage · ${q.hours} h`;
    els.creditFill.style.width = `${Math.max(0, 100 - ratio * 100)}%`;
    els.creditFill.style.background = ratio < 0.6 ? 'var(--accent)' : ratio < WARN_RATIO ? '#f5c542' : '#ff6b6b';
    els.creditCount.textContent = `${left} / ${q.limit}`;
    renderGauge(Math.max(0, 1 - ratio));
    els.creditCount.title = `${left} message(s) restant(s) sur ${q.limit} dans cette fenêtre de ${q.hours} h`;

    const sub = ensureSubline();
    sub.textContent = q.resetAt
        ? `Réinitialisation à ${fmtTime(q.resetAt)}`
        : `Fenêtre de ${q.hours} h démarrée à ton prochain message`;

    if (ratio >= 1) {
        const wait = q.resetAt ? q.resetAt - Date.now() : 0;
        setBanner('empty', `<strong>Limite atteinte</strong> · ${q.limit} messages par fenêtre de ${q.hours} h. `
            + (q.resetAt ? `Réinitialisation dans <strong>${fmtDelay(wait)}</strong> (${fmtTime(q.resetAt)}).` : ''));
        setInputLocked(true);
        setStatus('warn');
    } else {
        setInputLocked(false);
        if (ratio >= WARN_RATIO) {
            setBanner('low', `Plus que <strong>${left} message(s)</strong> dans cette fenêtre`
                + (q.resetAt ? ` · réinitialisation à ${fmtTime(q.resetAt)}.` : '.'));
        } else {
            setBanner(null);
        }
    }
    scheduleTick();
}

/** Rafraîchit le compte à rebours, et réactive la saisie dès la fin de la fenêtre. */
function scheduleTick() {
    clearTimeout(tickTimer);
    const q = state.quota;
    if (!q?.resetAt) return;
    const untilReset = q.resetAt - Date.now();
    tickTimer = setTimeout(renderCredits, Math.max(1000, Math.min(30000, untilReset + 500)));
}
