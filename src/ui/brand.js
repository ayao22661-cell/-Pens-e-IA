// ============================================================
//  PENSÉE IA — src/ui/brand.js
//  Le Point de Pensée : le logo (un rond) devient un élément vivant.
//   - avatar : point lumineux ; en réflexion, des ondes s'en propagent ;
//     en écriture, il bat doucement
//   - jauge d'usage : anneau de progression autour du point
//   - grand point d'accueil qui respire
// ============================================================

/**
 * Point + deux ondes (animées en CSS selon l'état du message).
 * @param {object} o
 * @param {number} [o.size]
 * @param {string} [o.className]  is-breathing (accueil)
 */
export function dotMark({ size = 20, className = '', label = '' } = {}) {
    const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg class="pz-dot ${className}" width="${size}" height="${size}" viewBox="-50 -50 100 100" ${a11y}>`
        + '<circle class="pz-wave" r="22" style="--d:0s"/>'
        + '<circle class="pz-wave" r="22" style="--d:0.9s"/>'
        + '<circle class="pz-core" r="22"/>'
        + '</svg>';
}

/**
 * Anneau d'usage : l'arc représente la part restante, le point reste au centre.
 * @param {number} remainingRatio  entre 0 et 1
 */
export function ringGauge(remainingRatio, size = 26) {
    const r = Math.max(0, Math.min(1, remainingRatio));
    const level = r > 0.5 ? 'is-ok' : r > 0.2 ? 'is-low' : 'is-empty';
    const C = 2 * Math.PI * 40;
    return `<svg class="pz-ring ${level}" width="${size}" height="${size}" viewBox="-50 -50 100 100" role="img" aria-label="${Math.round(r * 100)} % restant">`
        + '<circle class="pz-ring-track" r="40"/>'
        + `<circle class="pz-ring-arc" r="40" stroke-dasharray="${(C * r).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90)"/>`
        + '<circle class="pz-ring-core" r="15"/>'
        + '</svg>';
}

/** Remplace les visuels hérités (étoile à rayons) par le point du logo. */
export function mountBrand() {
    const welcome = document.querySelector('.welcome-logo');
    if (welcome) welcome.innerHTML = dotMark({ size: 64, className: 'is-breathing', label: 'Pensée' });

    // Fenêtre « À propos » : même logo
    const about = document.querySelector('#aboutModal svg[viewBox="0 0 100 100"]');
    if (about) about.outerHTML = dotMark({ size: 22 });
}
