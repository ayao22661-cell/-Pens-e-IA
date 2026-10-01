// ============================================================
//  PENSÉE IA — src/ui/brand.js
//  L'Étoile de Pensée : le logo (4 capsules croisées = 8 rayons)
//  devient un élément vivant de l'interface.
//   - avatar animé (repos / réflexion / écriture)
//   - jauge d'usage : rayons allumés = part restante
//   - étoile d'accueil, de connexion et de barre latérale
// ============================================================

const RAYS = 8;

/**
 * Étoile à 8 rayons indépendants, géométrie identique au logo
 * (capsules de 12 × 84 dans un repère 100 × 100, arrondi 6).
 * @param {object} o
 * @param {number} [o.size]      taille en px
 * @param {string} [o.className] classes CSS (états : is-thinking, is-writing)
 * @param {number} [o.lit]       nombre de rayons allumés (jauge) ; tous par défaut
 */
export function starSvg({ size = 20, className = '', lit = RAYS, label = '' } = {}) {
    const rays = Array.from({ length: RAYS }, (_, i) =>
        `<rect class="pz-ray${i < lit ? '' : ' is-off'}" style="--i:${i}" x="-6" y="-42" width="12" height="48" rx="6" transform="rotate(${i * 45})"/>`).join('');
    const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg class="pz-star ${className}" width="${size}" height="${size}" viewBox="-50 -50 100 100" ${a11y}>${rays}</svg>`;
}

/** Jauge étoile : la part restante allume les rayons dans le sens horaire. */
export function starGauge(remainingRatio, size = 26) {
    const lit = Math.max(0, Math.min(RAYS, Math.ceil(remainingRatio * RAYS - 1e-9)));
    const level = remainingRatio > 0.5 ? 'is-ok' : remainingRatio > 0.2 ? 'is-low' : 'is-empty';
    return starSvg({ size, lit, className: `pz-gauge ${level}`, label: `${Math.round(remainingRatio * 100)} % restant` });
}

/** Remplace les marques génériques de la page (points, logos) par l'étoile. */
export function mountBrand() {
    // Accueil : grande étoile qui respire
    const welcome = document.querySelector('.welcome-logo');
    if (welcome) welcome.innerHTML = starSvg({ size: 64, className: 'is-breathing', label: 'Pensée' });

    // Barre latérale et écran de connexion : le point vert devient une petite étoile
    for (const dot of document.querySelectorAll('.logo-dot, .login-logo-dot')) {
        const span = document.createElement('span');
        span.className = 'pz-brand-mark';
        span.innerHTML = starSvg({ size: dot.classList.contains('login-logo-dot') ? 22 : 18 });
        dot.replaceWith(span);
    }
}
