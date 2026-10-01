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

// ── Où s'affiche l'usage (comme Claude) ──────────────────────
//  - rien en permanence ;
//  - une ligne discrète au-dessus de la saisie à partir de 80 %, puis à la limite ;
//  - le détail dans le menu « ··· » → Utilisation.

/** La ligne d'alerte vit juste au-dessus de la zone de saisie. */
function placeBanner() {
    const banner = els.alertBanner;
    const area = document.getElementById('inputArea');
    if (banner && area && banner.parentElement !== area) area.prepend(banner);
}

function setBanner(kind, html) {
    placeBanner();
    const banner = els.alertBanner;
    banner.className = kind ? `pz-usage-line ${kind}` : '';
    banner.style.display = kind ? 'flex' : 'none';
    banner.innerHTML = html ? `<span>${html}</span><button type="button" class="pz-usage-more">Détails</button>` : '';
    banner.querySelector('.pz-usage-more')?.addEventListener('click', () => toggleUsagePanel(true));
}

function setInputLocked(locked) {
    els.userInput.disabled = locked;
    els.uploadBtn.disabled = locked;
    els.userInput.placeholder = locked ? 'Limite atteinte — patiente jusqu’à la réinitialisation' : 'Discuter avec Pensée…';
    window.dispatchEvent(new Event('pensee:input'));
}

// ── Panneau « Utilisation » (menu ···) ───────────────────────
function usagePanel() {
    let panel = document.getElementById('usagePanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'usagePanel';
        panel.className = 'pz-usage-panel';
        panel.hidden = true;
        document.getElementById('memoryPanel')?.after(panel);
        document.addEventListener('click', (e) => {
            if (!panel.hidden && !panel.contains(e.target) && !e.target.closest('#usageBtn, .pz-usage-more')) toggleUsagePanel(false);
        });
    }
    return panel;
}

export function toggleUsagePanel(open) {
    const panel = usagePanel();
    panel.hidden = !open;
    if (open) {
        const more = document.getElementById('morePanel');
        if (more) more.style.display = 'none';
        renderUsagePanel();
    }
}

function renderUsagePanel() {
    const panel = document.getElementById('usagePanel');
    if (!panel || panel.hidden) return;
    const q = currentQuota();
    let body;
    if (q) {
        const left = Math.max(0, Math.floor(q.limit - q.used));
        const when = q.resetAt
            ? `Réinitialisation à <strong>${fmtTime(q.resetAt)}</strong> (dans ${fmtDelay(q.resetAt - Date.now())})`
            : `La fenêtre de ${q.hours} h démarre à ton prochain message`;
        body = `<div class="pz-usage-head">${ringGauge(Math.max(0, 1 - q.used / q.limit), 64)}
                <div><div class="pz-usage-big">${left}</div><div class="pz-usage-of">messages restants sur ${q.limit}</div></div></div>
            <div class="pz-usage-row">Fenêtre de ${q.hours} heures · ${when}</div>
            <p class="pz-usage-help">Une question, une recherche ou un document comptent pour 1 message. Une grosse tâche de code compte selon le travail réellement fait (environ 5). Une tâche commencée va toujours jusqu'au bout.</p>`;
    } else {
        body = `<div class="pz-usage-head">${ringGauge(state.creditsLeft / CONFIG.maxCredits, 64)}
                <div><div class="pz-usage-big">${state.creditsLeft}</div><div class="pz-usage-of">crédits restants sur ${CONFIG.maxCredits} aujourd'hui</div></div></div>
            <p class="pz-usage-help">Les crédits se renouvellent chaque jour à minuit (UTC).</p>`;
    }
    panel.innerHTML = `<div class="pz-usage-title">Utilisation</div>${body}`;
}

export function initUsageMenu() {
    const memoryBtn = document.getElementById('memoryBtn');
    if (!memoryBtn || document.getElementById('usageBtn')) return;
    const btn = memoryBtn.cloneNode(false);
    btn.id = 'usageBtn';
    btn.innerHTML = `${ringGauge(0.7, 14)} Utilisation`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleUsagePanel(true); });
    memoryBtn.after(btn);
    usagePanel();
}

export function renderCredits() {
    const q = currentQuota();

    if (!q) {
        // ── Ancien système : crédits journaliers ──
        const left = state.creditsLeft;
        setInputLocked(left === 0);
        if (left === 0) { setBanner('empty', "Crédits épuisés pour aujourd'hui. De nouveau disponibles demain."); setStatus('warn'); }
        else if (left <= 5) setBanner('low', `Plus que <strong>${left} message(s)</strong> aujourd'hui.`);
        else setBanner(null);
        renderUsagePanel();
        return;
    }

    // ── Quota par fenêtre glissante ──
    const ratio = Math.min(1, q.used / q.limit);
    const left = Math.max(0, Math.floor(q.limit - q.used));
    if (ratio >= 1) {
        setBanner('empty', `<strong>Limite atteinte</strong> — de nouveau disponible à <strong>${fmtTime(q.resetAt)}</strong> (dans ${fmtDelay(q.resetAt - Date.now())}).`);
        setInputLocked(true);
        setStatus('warn');
    } else {
        setInputLocked(false);
        if (ratio >= WARN_RATIO) {
            setBanner('low', `Plus que <strong>${left} message(s)</strong>` + (q.resetAt ? ` jusqu'à ${fmtTime(q.resetAt)}.` : '.'));
        } else {
            setBanner(null);
        }
    }
    renderUsagePanel();
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
