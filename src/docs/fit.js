// ============================================================
//  PENSÉE IA — src/docs/fit.js
//  Ajustement automatique de la taille du texte à sa boîte
//  (estimation typographique : identique pour le .pptx et l'aperçu).
// ============================================================

const AVG_CHAR_EM = 0.52;   // largeur moyenne d'un caractère (Segoe UI / Inter), en em
const LINE_HEIGHT = 1.22;

/** Nombre de lignes occupées par un paragraphe à une taille donnée. */
export function linesFor(text, widthIn, sizePt, indentIn = 0) {
    const charsPerLine = Math.max(8, Math.floor(((widthIn - indentIn) * 72) / (sizePt * AVG_CHAR_EM)));
    return String(text || '').split('\n').reduce((n, part) => {
        const words = part.split(/\s+/);
        let lines = 1;
        let cur = 0;
        for (const w of words) {
            const len = w.length + (cur ? 1 : 0);
            if (cur + len > charsPerLine && cur > 0) { lines++; cur = w.length; } else cur += len;
        }
        return n + lines;
    }, 0);
}

/**
 * Plus grande taille (pt) ≤ max telle que les paragraphes tiennent dans la boîte.
 * @param {string[]} paragraphs
 * @param {{w:number,h:number}} box   en pouces
 * @param {object} o
 */
export function fitSize(paragraphs, box, { max = 24, min = 11, gapEm = 0.5, indentIn = 0 } = {}) {
    for (let size = max; size >= min; size -= 1) {
        const lines = paragraphs.reduce((n, p) => n + linesFor(p, box.w, size, indentIn), 0);
        const heightIn = (lines * size * LINE_HEIGHT + Math.max(0, paragraphs.length - 1) * size * gapEm) / 72;
        if (heightIn <= box.h) return size;
    }
    return min;
}

/** Tronque proprement un texte trop long (dernier recours). */
export function clampText(text, maxChars) {
    const s = String(text || '').trim();
    return s.length <= maxChars ? s : s.slice(0, maxChars - 1).replace(/\s+\S*$/, '') + '…';
}
