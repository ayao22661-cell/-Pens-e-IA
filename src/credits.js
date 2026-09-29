// ============================================================
//  PENSÉE IA — src/credits.js
//  Affichage des crédits. Le décompte est fait UNIQUEMENT par le
//  serveur (/api/chat, fonction SQL consume_credit) : le client lit.
// ============================================================

import { CONFIG } from './config.js';
import { state } from './state.js';
import { supabase } from './supabase.js';
import { els, setStatus } from './ui/dom.js';

export async function loadCredits() {
    if (!state.currentUser) return;
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

export function setCredits(remaining) {
    state.creditsLeft = Math.max(0, Math.min(CONFIG.maxCredits, remaining));
    renderCredits();
}

export function renderCredits() {
    const left = state.creditsLeft;
    const pct = (left / CONFIG.maxCredits) * 100;
    els.creditFill.style.width = pct + '%';
    els.creditFill.style.background = pct > 50 ? '#00e5a0' : pct > 20 ? '#f5c542' : '#ff6b6b';
    els.creditCount.textContent = `${left} / ${CONFIG.maxCredits}`;

    const banner = els.alertBanner;
    banner.className = '';
    banner.style.display = 'none';
    els.userInput.disabled = false;
    els.uploadBtn.disabled = false;

    if (left === 0) {
        banner.className = 'empty';
        banner.style.display = 'block';
        banner.textContent = "⚠️ Crédits épuisés pour aujourd'hui. Reviens demain !";
        els.userInput.disabled = true;
        els.uploadBtn.disabled = true;
        setStatus('warn');
    } else if (left <= 5) {
        banner.className = 'low';
        banner.style.display = 'block';
        banner.textContent = `⚡ Plus que ${left} message(s) disponible(s) aujourd'hui.`;
    }
}
