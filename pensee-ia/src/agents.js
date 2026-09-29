// ============================================================
//  PENSÉE IA — src/agents.js
//  Agents : métadonnées d'affichage, auto-détection, sélecteur.
//  Les consignes de chaque agent sont côté serveur (api/_lib/prompts.js).
// ============================================================

import { state } from './state.js';
import { addMessage } from './ui/dom.js';
import { ICONS } from './ui/icons.js';

const icon = (body) => `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const AGENTS_CONFIG = {
    code: {
        id: 'code', label: 'Code', description: 'Dev, debug, exécution',
        icon: icon('<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><path d="M14 11v6M11 14h6"/>'),
    },
    recherche: {
        id: 'recherche', label: 'Recherche', description: 'Web, synthèse, actualité',
        icon: icon('<circle cx="8.5" cy="8.5" r="5"/><line x1="13" y1="13" x2="17" y2="17"/>'),
    },
    creatif: {
        id: 'creatif', label: 'Créatif', description: 'Storytelling, scripts, narration',
        icon: icon('<path d="M14.5 2.5c1.5 1.5 1.5 4 0 5.5L6 17l-4 1 1-4L11.5 5.5c1.5-1.5 4-1.5 3 3z"/><line x1="11" y1="5" x2="15" y2="9"/>'),
    },
    strategie: {
        id: 'strategie', label: 'Stratégie', description: 'Marketing, business, croissance',
        icon: icon('<polyline points="2,15 7,9 11,12 17,5"/><polyline points="13,5 17,5 17,9"/>'),
    },
    visionnaire: {
        id: 'visionnaire', label: 'Visionnaire', description: 'Insights systémiques, ruptures, second ordre',
        icon: icon('<path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="2.5"/>'),
    },
    audit: {
        id: 'audit', label: 'Audit', description: 'Contrôle qualité, preuve par exécution',
        icon: icon('<path d="M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5L10 2z"/><polyline points="7,10 9,12 13,8"/>'),
    },
};
window.AGENTS_CONFIG = AGENTS_CONFIG;

// ── Auto-détection par mots-clés ─────────────────────────────
const PATTERNS = {
    code: ['code', 'bug', 'erreur', 'débogue', 'debug', 'fonction', 'script', 'api', 'javascript', 'python',
        'html', 'css', 'react', 'composant', 'classe', 'variable', 'boucle', 'array', 'objet', 'json', 'sql',
        'base de données', 'deploy', 'vercel', 'github', 'npm', 'module', 'import', 'export', 'app', 'jeu', 'site'],
    recherche: ['recherche', 'actualité', "aujourd'hui", 'récent', 'dernière', 'news', 'quoi de neuf', 'tendance',
        '2025', '2026', 'vient de', 'annonce', 'trouve', 'cherche', 'infos sur'],
    creatif: ['écris', 'rédige', 'histoire', 'scénario', 'poème', 'chanson', 'personnage', 'scène', 'narration',
        'roman', 'nouvelle', 'dialogue', 'storyboard', 'synopsis', 'pitch', 'créatif', 'imaginaire', 'fiction'],
    strategie: ['stratégie', 'marketing', 'croissance', 'audience', 'vente', 'client', 'business', 'monétise',
        'revenus', 'youtube', 'tiktok', 'instagram', 'algorithme', 'contenu', 'brand', 'marque', 'campagne',
        'conversion', 'ux', 'ui', 'design', 'landing', 'funnel', 'acquisition'],
    visionnaire: ['futur', 'vision', 'rupture', 'disruption', 'innovation', 'système', 'pourquoi vraiment',
        'profondément', 'fondamentalement', 'ce que personne', 'big picture', 'macro', 'tendances profondes',
        'second ordre', 'comprends pas', 'sens de', 'impact réel', 'vraie question'],
};

export function detectAgent(message) {
    const clean = ' ' + message.toLowerCase().replace(/[.,!?;:()]/g, ' ') + ' ';
    let best = null;
    let bestScore = 0;
    for (const [id, keywords] of Object.entries(PATTERNS)) {
        // Espaces autour du mot-clé : évite "code" dans "encoder"
        const score = keywords.filter(kw => clean.includes(' ' + kw + ' ')).length;
        if (score > bestScore) { best = id; bestScore = score; }
    }
    return best;
}

// ── Badge & sélecteur ────────────────────────────────────────
export function updateAgentBadge(agentId) {
    const badge = document.getElementById('agentBadge');
    if (!badge) return;
    const iconEl = document.getElementById('agentBadgeIcon');
    const labelEl = document.getElementById('agentBadgeLabel');
    const agent = agentId && AGENTS_CONFIG[agentId];
    if (iconEl) {
        const wrap = document.createElement('span');
        wrap.innerHTML = agent ? agent.icon : ICONS.auto;
        const svgEl = wrap.firstElementChild;
        svgEl.id = 'agentBadgeIcon';
        iconEl.replaceWith(svgEl);
    }
    if (labelEl) labelEl.textContent = agent ? agent.label : 'Auto';
    badge.className = `agent-badge agent-${agent ? agentId : 'auto'}`;
}

export function refreshAgentButtons() {
    document.querySelectorAll('#agentSelector .agent-btn').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.agentId || null) === state.activeAgentId);
    });
}

export function setActiveAgent(id) {
    state.activeAgentId = id;
    updateAgentBadge(id);
    refreshAgentButtons();
}

export function initAgentSelector() {
    const container = document.getElementById('agentSelector');
    if (!container) return;
    const make = (id, html, title) => {
        const btn = document.createElement('button');
        btn.className = `agent-btn agent-btn-${id || 'auto'}`;
        btn.innerHTML = html;
        btn.title = title;
        if (id) btn.dataset.agentId = id;
        btn.addEventListener('click', () => setActiveAgent(id));
        container.appendChild(btn);
    };
    make(null, `${ICONS.auto} Auto`, 'Détection automatique');
    Object.values(AGENTS_CONFIG).forEach(a => make(a.id, `${a.icon} ${a.label}`, a.description));
    refreshAgentButtons();

    // Fermeture du menu au clic extérieur
    document.addEventListener('click', (e) => {
        const badge = document.getElementById('agentBadge');
        if (container.classList.contains('visible') && !badge?.contains(e.target) && !container.contains(e.target)) {
            container.classList.remove('visible');
        }
    });
}

/** Commande /agent <id|auto>. @returns {boolean} true si la commande a été traitée */
export function handleAgentCommand(text) {
    const match = text.match(/^\/agent(?:\s+(\w+))?/i);
    if (!match) return false;
    const id = (match[1] || '').toLowerCase();

    if (id === 'auto' || id === 'reset') {
        setActiveAgent(null);
        addMessage('bot', "Mode <strong>auto-détection</strong> activé. L'agent sera choisi selon le contenu de chaque message.", true);
        return true;
    }
    if (AGENTS_CONFIG[id]) {
        setActiveAgent(id);
        const a = AGENTS_CONFIG[id];
        addMessage('bot', `${a.icon} Agent <strong>${a.label}</strong> activé — ${a.description}.<br>Tape <code>/agent auto</code> pour revenir à la détection automatique.`, true);
        return true;
    }
    const list = Object.values(AGENTS_CONFIG).map(a => `<code>/agent ${a.id}</code> — ${a.label} : ${a.description}`).join('<br>');
    addMessage('bot', `Agents disponibles :<br><br>${list}<br><code>/agent auto</code> — Détection automatique<br><br>`
        + `<strong>Autres commandes :</strong><br><code>/memo [texte]</code> — Mémoriser une info<br>`
        + `<code>/memo global [texte]</code> — Mémoire globale<br><code>/profil [description]</code> — Définir ton profil<br>`
        + `<code>/profil reset</code> — Effacer le profil<br><code>/image [description]</code> — Générer une image<br>`
        + `<code>/fichiers</code> — Ouvrir le terminal et l'espace de travail`, true);
    return true;
}
