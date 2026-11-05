// ============================================================
//  PENSÉE IA — src/tiers.js
//  Sélecteur du « type d'IA » dans la zone de saisie.
//  Le client n'envoie qu'un identifiant Pensée ; le serveur
//  (api/_lib/tiers.js) choisit les modèles et la réflexion.
// ============================================================

import { state } from './state.js';

export const TIER_OPTIONS = [
    { id: 'auto',      label: 'Auto',      description: 'Choisit le bon type selon ta demande' },
    { id: 'eclair',    label: 'Éclair',    description: 'Réponses instantanées, sans réflexion' },
    { id: 'equilibre', label: 'Équilibre', description: 'Polyvalent, réfléchit quand il le faut' },
    { id: 'profonde',  label: 'Profonde',  description: 'Réflexion maximale, tâches complexes' },
];

const EFFORT_LABELS = { aucune: 'sans réflexion', faible: 'réflexion légère', moyenne: 'réflexion moyenne', elevee: 'réflexion élevée' };
const STORAGE_KEY = 'pensee_tier';

function load() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return TIER_OPTIONS.some(t => t.id === v) ? v : 'auto';
    } catch (_) { return 'auto'; }
}

state.tier = load();

function render() {
    const opt = TIER_OPTIONS.find(t => t.id === state.tier) || TIER_OPTIONS[0];
    const label = document.getElementById('tierBtnLabel');
    if (label) label.textContent = opt.label;
    document.querySelectorAll('#tierMenu .tier-opt').forEach(b => {
        const on = b.dataset.tier === state.tier;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', String(on));
    });
}

export function setTier(id) {
    state.tier = TIER_OPTIONS.some(t => t.id === id) ? id : 'auto';
    try { localStorage.setItem(STORAGE_KEY, state.tier); } catch (_) { /* stockage indisponible */ }
    render();
}

/** Affiche, dans l'infobulle, ce que le serveur a réellement choisi pour la dernière réponse. */
export function showResolvedTier(meta) {
    const btn = document.getElementById('tierBtn');
    if (!btn || !meta?.tierLabel) return;
    btn.title = `Dernière réponse : ${meta.tierLabel} · ${EFFORT_LABELS[meta.effort] || ''}`.trim();
}

export function initTierPicker() {
    const btn = document.getElementById('tierBtn');
    const menu = document.getElementById('tierMenu');
    if (!btn || !menu) return;

    menu.innerHTML = TIER_OPTIONS.map(t => `
        <button type="button" class="tier-opt" role="menuitemradio" data-tier="${t.id}">
            <span class="tier-opt-name">${t.id === 'auto' ? 'Auto' : 'Pensée ' + t.label}</span>
            <span class="tier-opt-desc">${t.description}</span>
        </button>`).join('');

    const close = () => { menu.classList.remove('visible'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !menu.classList.contains('visible');
        menu.classList.toggle('visible', open);
        btn.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', (e) => {
        const opt = e.target.closest('.tier-opt');
        if (!opt) return;
        setTier(opt.dataset.tier);
        close();
    });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target) && e.target !== btn) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    render();
}
