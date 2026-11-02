// ============================================================
//  PENSÉE IA — src/ui/brand.js
//  Le point Labs (charte KWENI) : un carré en grille 2×2 qui devient
//  un élément vivant.
//   - avatar : point lumineux ; en réflexion, des ondes carrées s'en
//     propagent ; en écriture, il bat doucement
//   - jauge d'usage : cadre carré de progression autour du point
//   - grand point d'accueil qui respire
//   - signature « par KWENI LABS » avec le monogramme K
// ============================================================

// Grille 2×2 : 4 cellules de 20 séparées de 4 (carré de 44, centré)
const GRID = '<rect x="-22" y="-22" width="20" height="20"/><rect x="2" y="-22" width="20" height="20"/>'
    + '<rect x="-22" y="2" width="20" height="20"/><rect x="2" y="2" width="20" height="20"/>';

/**
 * Point + deux ondes (animées en CSS selon l'état du message).
 * @param {object} o
 * @param {number} [o.size]
 * @param {string} [o.className]  is-breathing (accueil)
 */
export function dotMark({ size = 20, className = '', label = '' } = {}) {
    const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg class="pz-dot ${className}" width="${size}" height="${size}" viewBox="-50 -50 100 100" ${a11y}>`
        + '<rect class="pz-wave" x="-22" y="-22" width="44" height="44" style="--d:0s"/>'
        + '<rect class="pz-wave" x="-22" y="-22" width="44" height="44" style="--d:0.9s"/>'
        + `<g class="pz-core">${GRID}</g>`
        + '</svg>';
}

/**
 * Jauge d'usage : le cadre représente la part restante, le point reste au centre.
 * @param {number} remainingRatio  entre 0 et 1
 */
export function ringGauge(remainingRatio, size = 26) {
    const r = Math.max(0, Math.min(1, remainingRatio));
    const level = r > 0.5 ? 'is-ok' : r > 0.2 ? 'is-low' : 'is-empty';
    const C = 4 * 76;  // périmètre du cadre de 76
    // Le tracé part du milieu du bord haut, comme une aiguille à midi
    const frame = 'M0,-38 H38 V38 H-38 V-38 Z';
    return `<svg class="pz-ring ${level}" width="${size}" height="${size}" viewBox="-50 -50 100 100" role="img" aria-label="${Math.round(r * 100)} % restant">`
        + `<path class="pz-ring-track" d="${frame}"/>`
        + `<path class="pz-ring-arc" d="${frame}" stroke-dasharray="${(C * r).toFixed(1)} ${C}" style="stroke-linecap:butt"/>`
        + '<rect class="pz-ring-core" x="-14" y="-14" width="28" height="28"/>'
        + '</svg>';
}

/** Monogramme K de la charte KWENI (tracés d'origine, coupes à 45°). */
export function kMark({ size = 22, dot = 'grid' } = {}) {
    const point = dot === 'grid'
        ? '<rect x="475" y="347" width="12.5" height="12.5" fill="var(--accent)"/><rect x="491.5" y="347" width="12.5" height="12.5" fill="var(--accent)"/>'
          + '<rect x="475" y="363.5" width="12.5" height="12.5" fill="var(--accent)"/><rect x="491.5" y="363.5" width="12.5" height="12.5" fill="var(--accent)"/>'
        : '<rect x="475" y="347" width="29" height="29" fill="var(--accent)"/>';
    return `<svg width="${size}" height="${size}" viewBox="258 97 284 282" aria-hidden="true" fill="currentColor">`
        + '<polygon points="260,99 288,99 288,230 419,99 539,99 403.5,234.5 480.5,311.5 461,331 364,234 471,127 430,127 288,269 288,375 260,375"/>'
        + '<polygon points="343,255 440,352 420.5,371.5 323.5,274.5"/>'
        + point + '</svg>';
}

/** Signature d'endossement « par KWENI LABS » (monogramme + filet + 2 lignes). */
export function labsSignature(line1 = 'Un produit') {
    return `<div class="pz-labs-sign">${kMark({ size: 22 })}<span class="pz-rule"></span>`
        + `<span><small>${line1}</small><strong>KWENI LABS</strong></span></div>`;
}

/** Remplace les visuels hérités par le point Labs et pose la signature KWENI LABS. */
export function mountBrand() {
    const welcome = document.querySelector('.welcome-logo');
    if (welcome) welcome.innerHTML = dotMark({ size: 64, className: 'is-breathing', label: 'Pensée' });

    // Fenêtre « À propos » : même logo, et signature Labs à la place du crédit seul
    const about = document.querySelector('#aboutModal svg[viewBox="0 0 100 100"]');
    if (about) about.outerHTML = dotMark({ size: 22 });
    const credit = document.querySelector('#aboutCredit');
    if (credit) credit.innerHTML = labsSignature('Un produit');

    // Pied de page : endossement discret
    const endorse = document.querySelector('#footerEndorse');
    if (endorse) endorse.innerHTML = kMark({ size: 10 }) + ' KWENI LABS';
}
