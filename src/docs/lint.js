// ============================================================
//  PENSÉE IA — src/docs/lint.js
//  Contrôle qualité des présentations et documents produits par
//  le modèle : les remarques lui sont renvoyées pour qu'il corrige.
// ============================================================

import { LAYOUT_NAMES } from './slides-layout.js';

export function lintDeck(spec) {
    const warn = [];
    const slides = spec.slides || [];
    if (slides.length < 3) warn.push('Moins de 3 slides : une présentation a besoin d\'une couverture, d\'un développement et d\'une conclusion.');
    if (slides[0]?.layout !== 'title') warn.push('La première slide devrait utiliser le layout "title".');
    let streak = 1;
    slides.forEach((s, i) => {
        const n = i + 1;
        if (!LAYOUT_NAMES.includes(s.layout)) warn.push(`Slide ${n} : layout inconnu "${s.layout}" (affichée en "bullets").`);
        if (s.title && s.title.length > 90) warn.push(`Slide ${n} : titre trop long (${s.title.length} car.) — vise moins de 70.`);
        if ((s.bullets || []).length > 6) warn.push(`Slide ${n} : ${s.bullets.length} puces — 6 maximum, découpe en deux slides.`);
        for (const b of s.bullets || []) {
            const text = typeof b === 'string' ? b : b?.text || '';
            if (text.length > 140) { warn.push(`Slide ${n} : puce trop longue (« ${text.slice(0, 40)}… ») — une puce = une idée en moins de 15 mots.`); break; }
        }
        if (s.layout === 'chart' && !(s.chart?.series || []).some(se => (se.values || []).length)) warn.push(`Slide ${n} : graphique sans données.`);
        if (s.layout === 'stats' && !(s.stats || []).length) warn.push(`Slide ${n} : layout "stats" sans chiffres.`);
        if (i > 0 && s.layout === slides[i - 1].layout && s.layout !== 'section') {
            streak++;
            if (streak === 3) warn.push(`Slides ${n - 2} à ${n} : trois "${s.layout}" d'affilée — varie les mises en page (stats, chart, timeline, comparison, two_columns…).`);
        } else streak = 1;
    });
    const bulletsShare = slides.filter(s => s.layout === 'bullets').length / Math.max(1, slides.length);
    if (slides.length >= 6 && bulletsShare > 0.5) warn.push('Plus de la moitié des slides sont des listes à puces : transforme les données en chiffres clés, graphiques, frises ou comparaisons.');
    if (slides.length >= 5 && !slides.some(s => s.layout === 'closing')) warn.push('Ajoute une slide "closing" (décision attendue, prochaines étapes, contact).');
    return warn;
}

export function lintDocument(spec) {
    const warn = [];
    const blocks = spec.blocks || [];
    const headings = blocks.filter(b => b.type === 'heading');
    if (blocks.length >= 8 && !headings.length) warn.push('Aucun titre : structure le document en sections (heading level 1 et 2).');
    blocks.forEach((b, i) => {
        if (b.type === 'paragraph' && String(b.text || '').length > 1100) warn.push(`Bloc ${i + 1} : paragraphe de ${b.text.length} caractères — découpe-le ou transforme-le en liste.`);
        if (b.type === 'table' && (b.rows || []).some(r => r.length !== (b.headers || []).length)) warn.push(`Bloc ${i + 1} : lignes du tableau de longueur différente des en-têtes.`);
        if (b.type === 'chart' && !(b.chart?.series || []).some(s => (s.values || []).length)) warn.push(`Bloc ${i + 1} : graphique sans données.`);
    });
    const rich = blocks.filter(b => ['callout', 'stats', 'table', 'chart', 'quote'].includes(b.type)).length;
    if (blocks.length >= 12 && rich === 0) warn.push('Document 100 % texte : ajoute des chiffres clés (stats), un tableau, un graphique ou des encadrés (callout) pour les points importants.');
    return warn;
}
