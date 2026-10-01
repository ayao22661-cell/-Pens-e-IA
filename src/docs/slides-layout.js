// ============================================================
//  PENSÉE IA — src/docs/slides-layout.js
//  Moteur de mise en page des présentations.
//  spec (JSON du modèle) → slides = [{ bg, elements, notes }]
//  Les mêmes éléments alimentent le .pptx (slides-pptx.js) et
//  l'aperçu HTML (slides-html.js) : ce que l'on voit = ce que l'on livre.
//
//  Unités : pouces (diapo 16:9 = 13.333 × 7.5), tailles de police en points.
//  Éléments : rect | ellipse | text | chart | table
// ============================================================

import { getTheme, mix } from './theme.js';
import { fitSize, linesFor, clampText } from './fit.js';

export const W = 13.333;
export const H = 7.5;
const M = 0.6;                       // marge latérale
const TOP = 1.6;                     // début de la zone de contenu
const BOTTOM = H - 0.75;             // fin de la zone de contenu (pied de page en dessous)
const CW = W - 2 * M;                // largeur utile

const txt = (x, y, w, h, paras, o = {}) => ({ type: 'text', x, y, w, h, paras: Array.isArray(paras) ? paras : [{ text: paras }], ...o });
const rect = (x, y, w, h, fill, o = {}) => ({ type: 'rect', x, y, w, h, fill, ...o });
const ellipse = (x, y, w, h, fill, o = {}) => ({ type: 'ellipse', x, y, w, h, fill, ...o });

// ── Éléments communs ───────────────────────────────────────────
function chrome(t, s, ctx) {
    const title = clampText(s.title || '', 110);
    const size = fitSize([title], { w: CW, h: 0.95 }, { max: 30, min: 20 });
    return [
        txt(M, 0.42, CW, 0.95, title, { size, color: t.text, font: 'head', valign: 'bottom' }),
        rect(M, 1.42, 0.7, 0.06, t.primary),
        txt(M, H - 0.5, CW * 0.7, 0.3, clampText(ctx.deckTitle, 80), { size: 10, color: t.muted }),
        txt(W - M - 2, H - 0.5, 2, 0.3, `${ctx.index} / ${ctx.total}`, { size: 10, color: t.muted, align: 'right' }),
    ];
}

/** Liste à puces dessinée ligne par ligne (marqueur coloré + texte), taille ajustée à la boîte. */
function bulletRows(t, items, box, { max = 26, min = 13, marker = t.primary, center = false } = {}) {
    const rows = items.map(b => ({
        text: clampText(typeof b === 'string' ? b : b.text, 220),
        sub: typeof b === 'object' && b.sub ? clampText(b.sub, 200) : '',
    }));
    const tw = box.w - 0.45;
    const size = fitSize(rows.flatMap(r => (r.sub ? [r.text, r.sub] : [r.text])), { w: tw, h: box.h }, { max, min, gapEm: 0.75 });
    const subSize = Math.max(min - 1, Math.round(size * 0.78));
    const lh = (size * 1.22) / 72;
    const baseGap = (size * 0.75) / 72;

    // Mesure, puis répartition de l'espace libre : pas de grand vide sous une liste courte
    const heights = rows.map(r => linesFor(r.text, tw, size) * lh
        + (r.sub ? 0.06 + linesFor(r.sub, tw, subSize) * (subSize * 1.22) / 72 : 0));
    const natural = heights.reduce((a, b) => a + b, 0) + baseGap * Math.max(0, rows.length - 1);
    const spare = Math.max(0, box.h - natural);
    const gap = baseGap + (rows.length > 1 ? Math.min(0.45, (spare * 0.6) / (rows.length - 1)) : 0);
    const used = natural + (gap - baseGap) * Math.max(0, rows.length - 1);
    let y = box.y + (center ? Math.max(0, (box.h - used) * 0.4) : 0);

    const out = [];
    rows.forEach((r, i) => {
        const mainH = linesFor(r.text, tw, size) * lh;
        out.push(rect(box.x, y + lh / 2 - 0.07, 0.14, 0.14, marker, { radius: 0.035 }));
        out.push(txt(box.x + 0.38, y, box.w - 0.38, mainH + 0.02, r.text, { size, color: t.text }));
        if (r.sub) {
            const sh = linesFor(r.sub, tw, subSize) * (subSize * 1.22) / 72;
            out.push(txt(box.x + 0.38, y + mainH + 0.06, box.w - 0.38, sh, r.sub, { size: subSize, color: t.muted }));
        }
        y += heights[i] + gap;
    });
    return out;
}

function takeawayBox(t, text, y) {
    const clean = clampText(text, 180);
    const size = fitSize([clean], { w: CW - 0.6, h: 0.55 }, { max: 16, min: 11 });
    return [
        rect(M, y, CW, 0.8, t.surface, { radius: 0.08, line: t.line }),
        rect(M, y, 0.08, 0.8, t.accent),
        txt(M + 0.3, y + 0.12, CW - 0.5, 0.56, [{ text: 'À retenir  ', bold: true, color: t.accent, inline: true }, { text: clean }], { size, color: t.text, valign: 'middle' }),
    ];
}

// ── Mises en page ──────────────────────────────────────────────
const LAYOUTS = {
    title(t, s, ctx) {
        const title = clampText(s.title || ctx.deckTitle, 90);
        const size = fitSize([title], { w: 8.4, h: 2.3 }, { max: 46, min: 30 });
        const els = [
            ellipse(8.6, -1.6, 6.4, 6.4, t.primary, { alpha: 82 }),
            ellipse(10.6, 3.6, 4.2, 4.2, t.secondary, { alpha: 80 }),
            ellipse(9.4, 4.9, 1.1, 1.1, t.accent, { alpha: 30 }),
            rect(M, 1.7, 0.9, 0.08, t.primary),
        ];
        if (s.kicker) els.push(txt(M, 1.15, 8.4, 0.45, clampText(s.kicker, 60).toUpperCase(), { size: 13, color: t.primary, bold: true, spacing: 2 }));
        const titleH = (linesFor(title, 8.4, size) * size * 1.22) / 72;
        els.push(txt(M, 1.95, 8.4, titleH + 0.1, title, { size, color: t.text, font: 'head', valign: 'top' }));
        if (s.subtitle) els.push(txt(M, 1.95 + titleH + 0.35, 8, 1.1, clampText(s.subtitle, 160), { size: 20, color: t.muted }));
        const meta = [s.author || ctx.author, s.date || ctx.date].filter(Boolean).join('  ·  ');
        if (meta) els.push(txt(M, H - 1.0, 8, 0.4, meta, { size: 13, color: t.muted }));
        return { bg: t.bg, elements: els };
    },

    section(t, s, ctx) {
        const bg = t.dark ? t.surface : t.primary;
        const fg = t.dark ? t.text : 'FFFFFF';
        const num = s.number || String(ctx.sectionIndex).padStart(2, '0');
        const title = clampText(s.title || '', 80);
        return {
            bg,
            elements: [
                txt(M, 1.0, 6, 2.6, num, { size: 140, color: t.dark ? t.primary : mix(t.primary, 'FFFFFF', 0.35), font: 'head', valign: 'top' }),
                rect(M, 3.85, 0.9, 0.08, t.dark ? t.primary : 'FFFFFF'),
                txt(M, 4.05, CW, 1.6, title, { size: fitSize([title], { w: CW, h: 1.6 }, { max: 44, min: 28 }), color: fg, font: 'head', valign: 'top' }),
                ...(s.subtitle ? [txt(M, 5.7, CW * 0.8, 0.9, clampText(s.subtitle, 140), { size: 18, color: t.dark ? t.muted : mix(t.primary, 'FFFFFF', 0.75) })] : []),
            ],
        };
    },

    bullets(t, s, ctx) {
        const items = (s.bullets || []).slice(0, 7);
        const hasTake = Boolean(s.takeaway);
        const box = { x: M, y: TOP + 0.1, w: s.image_hint ? CW * 0.6 : CW, h: (hasTake ? BOTTOM - 1.05 : BOTTOM) - TOP - 0.1 };
        return {
            bg: t.bg,
            elements: [...chrome(t, s, ctx), ...bulletRows(t, items, box, { center: true }), ...(hasTake ? takeawayBox(t, s.takeaway, BOTTOM - 0.85) : [])],
        };
    },

    two_columns(t, s, ctx) {
        const colW = (CW - 0.4) / 2;
        const els = [...chrome(t, s, ctx)];
        [s.left || {}, s.right || {}].forEach((col, i) => {
            const x = M + i * (colW + 0.4);
            els.push(rect(x, TOP, colW, BOTTOM - TOP, t.surface, { radius: 0.12, line: t.line }));
            els.push(rect(x, TOP, colW, 0.08, i === 0 ? t.primary : t.secondary));
            els.push(txt(x + 0.35, TOP + 0.3, colW - 0.7, 0.55, clampText(col.heading || '', 50), { size: 20, color: i === 0 ? t.primary : t.secondary, font: 'head' }));
            els.push(...bulletRows(t, (col.bullets || []).slice(0, 6), { x: x + 0.35, y: TOP + 1.0, w: colW - 0.7, h: BOTTOM - TOP - 1.25 },
                { max: 22, min: 12, marker: i === 0 ? t.primary : t.secondary }));
        });
        return { bg: t.bg, elements: els };
    },

    stats(t, s, ctx) {
        const stats = (s.stats || []).slice(0, 4);
        const n = Math.max(1, stats.length);
        const gap = 0.35;
        const cardW = (CW - gap * (n - 1)) / n;
        const cardH = s.takeaway ? 3.4 : 4.2;
        const y = TOP + 0.35;
        const els = [...chrome(t, s, ctx)];
        stats.forEach((st, i) => {
            const x = M + i * (cardW + gap);
            const color = t.chart[i % t.chart.length];
            const value = clampText(String(st.value ?? ''), 12);
            els.push(rect(x, y, cardW, cardH, t.surface, { radius: 0.14, line: t.line }));
            els.push(rect(x + 0.35, y + 0.4, 0.5, 0.08, color));
            els.push(txt(x + 0.3, y + 0.65, cardW - 0.6, 1.3, value, { size: fitSize([value], { w: cardW - 0.6, h: 1.25 }, { max: n <= 2 ? 66 : 54, min: 28 }), color, font: 'head', valign: 'middle' }));
            els.push(txt(x + 0.35, y + 2.0, cardW - 0.7, 0.75, clampText(st.label || '', 70), { size: fitSize([st.label || ''], { w: cardW - 0.7, h: 0.75 }, { max: 18, min: 12 }), color: t.text, bold: true }));
            if (st.detail && cardH > 3) els.push(txt(x + 0.35, y + 2.8, cardW - 0.7, cardH - 3.0, clampText(st.detail, 120), { size: 12, color: t.muted }));
        });
        if (s.takeaway) els.push(...takeawayBox(t, s.takeaway, BOTTOM - 0.85));
        return { bg: t.bg, elements: els };
    },

    chart(t, s, ctx) {
        const els = [...chrome(t, s, ctx)];
        const side = Boolean(s.takeaway);
        const chartW = side ? CW * 0.66 : CW;
        els.push(rect(M, TOP, chartW, BOTTOM - TOP, t.surface, { radius: 0.12, line: t.line }));
        els.push({ type: 'chart', x: M + 0.2, y: TOP + 0.2, w: chartW - 0.4, h: BOTTOM - TOP - 0.4, chart: s.chart || {} });
        if (side) {
            const x = M + chartW + 0.35;
            const w = CW - chartW - 0.35;
            const take = clampText(s.takeaway, 260);
            els.push(rect(x, TOP, w, BOTTOM - TOP, t.dark ? t.surface : mix(t.primary, 'FFFFFF', 0.92), { radius: 0.12 }));
            els.push(txt(x + 0.3, TOP + 0.35, w - 0.6, 0.4, 'À RETENIR', { size: 12, bold: true, color: t.primary, spacing: 2 }));
            els.push(txt(x + 0.3, TOP + 0.9, w - 0.6, BOTTOM - TOP - 1.2, take, { size: fitSize([take], { w: w - 0.6, h: BOTTOM - TOP - 1.2 }, { max: 22, min: 13 }), color: t.text, font: 'head' }));
        }
        return { bg: t.bg, elements: els };
    },

    table(t, s, ctx) {
        const headers = (s.headers || []).slice(0, 7);
        const rows = (s.rows || []).slice(0, 12).map(r => headers.map((_, i) => clampText(String(r[i] ?? ''), 60)));
        const rowsCount = rows.length + 1;
        const avail = BOTTOM - TOP - 0.1;
        const size = Math.max(10, Math.min(18, Math.floor((avail * 72) / (rowsCount * 2.2))));
        const rowH = Math.min(avail / rowsCount, (size * 2.9) / 72); // lignes aérées quand il y a de la place
        const els = [...chrome(t, s, ctx)];
        els.push({ type: 'table', x: M, y: TOP + 0.1, w: CW, h: rowH * rowsCount, rowH, headers, rows, size });
        return { bg: t.bg, elements: els };
    },

    timeline(t, s, ctx) {
        const steps = (s.steps || []).slice(0, 6);
        const n = Math.max(1, steps.length);
        const slot = CW / n;
        const lineY = TOP + 1.85;
        const els = [...chrome(t, s, ctx), rect(M + slot / 2, lineY - 0.02, CW - slot, 0.04, t.line)];
        steps.forEach((st, i) => {
            const cx = M + slot * i + slot / 2;
            const color = t.chart[i % t.chart.length];
            els.push(txt(cx - slot / 2 + 0.1, lineY - 1.05, slot - 0.2, 0.5, clampText(st.label || '', 22), { size: 16, bold: true, color, align: 'center' }));
            els.push(ellipse(cx - 0.36, lineY - 0.36, 0.72, 0.72, color));
            els.push(txt(cx - 0.36, lineY - 0.36, 0.72, 0.72, String(i + 1), { size: 20, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' }));
            const title = clampText(st.title || '', 50);
            els.push(txt(cx - slot / 2 + 0.12, lineY + 0.65, slot - 0.24, 0.85, title, { size: fitSize([title], { w: slot - 0.24, h: 0.85 }, { max: 21, min: 13 }), color: t.text, font: 'head', align: 'center' }));
            if (st.text) {
                const body = clampText(st.text, 160);
                els.push(txt(cx - slot / 2 + 0.12, lineY + 1.55, slot - 0.24, BOTTOM - lineY - 1.6, body, { size: fitSize([body], { w: slot - 0.24, h: BOTTOM - lineY - 1.6 }, { max: 16, min: 10 }), color: t.muted, align: 'center' }));
            }
        });
        return { bg: t.bg, elements: els };
    },

    comparison(t, s, ctx) {
        const cols = (s.columns || []).slice(0, 3);
        const n = Math.max(1, cols.length);
        const gap = 0.35;
        const colW = (CW - gap * (n - 1)) / n;
        const els = [...chrome(t, s, ctx)];
        cols.forEach((col, i) => {
            const x = M + i * (colW + gap);
            const hl = Boolean(col.highlight);
            els.push(rect(x, TOP, colW, BOTTOM - TOP, hl ? (t.dark ? mix(t.primary, t.bg, 0.8) : mix(t.primary, 'FFFFFF', 0.9)) : t.surface,
                { radius: 0.14, line: hl ? t.primary : t.line, lineWidth: hl ? 2 : 1 }));
            if (hl) els.push(txt(x + colW - 1.65, TOP + 0.25, 1.4, 0.35, 'RECOMMANDÉ', { size: 10, bold: true, color: t.primary, align: 'right', spacing: 1.5 }));
            els.push(txt(x + 0.35, TOP + 0.55, colW - 0.7, 0.6, clampText(col.heading || '', 40), { size: 22, color: hl ? t.primary : t.text, font: 'head' }));
            els.push(...bulletRows(t, (col.items || []).slice(0, 6), { x: x + 0.35, y: TOP + 1.35, w: colW - 0.7, h: BOTTOM - TOP - 1.6 },
                { max: 20, min: 11, marker: hl ? t.primary : t.muted }));
        });
        return { bg: t.bg, elements: els };
    },

    quote(t, s) {
        const quote = clampText(s.quote || '', 260);
        const size = fitSize([quote], { w: CW - 2, h: 3.2 }, { max: 34, min: 20 });
        return {
            bg: t.dark ? t.bg : t.surface === 'FFFFFF' ? t.bg : t.surface,
            elements: [
                txt(M + 0.6, 0.6, 2, 2, '“', { size: 160, color: t.primary, font: 'head', valign: 'top' }),
                txt(M + 1, 2.0, CW - 2, 3.3, quote, { size, color: t.text, font: 'head', valign: 'middle' }),
                rect(M + 1, 5.55, 0.7, 0.06, t.primary),
                txt(M + 1, 5.75, CW - 2, 0.45, clampText(s.author || '', 60), { size: 17, bold: true, color: t.text }),
                ...(s.role ? [txt(M + 1, 6.2, CW - 2, 0.4, clampText(s.role, 80), { size: 13, color: t.muted })] : []),
            ],
        };
    },

    closing(t, s, ctx) {
        const bg = t.dark ? t.bg : t.primary;
        const fg = t.dark ? t.text : 'FFFFFF';
        const title = clampText(s.title || 'Merci', 60);
        return {
            bg,
            elements: [
                ellipse(-1.4, 3.8, 5, 5, t.dark ? t.primary : 'FFFFFF', { alpha: t.dark ? 85 : 88 }),
                ellipse(10.4, -1.6, 4.6, 4.6, t.dark ? t.secondary : 'FFFFFF', { alpha: t.dark ? 85 : 90 }),
                txt(M, 2.2, CW, 1.6, title, { size: fitSize([title], { w: CW, h: 1.6 }, { max: 54, min: 32 }), color: fg, font: 'head', align: 'center', valign: 'middle' }),
                ...(s.subtitle ? [txt(M + 1, 3.9, CW - 2, 0.9, clampText(s.subtitle, 140), { size: 20, color: t.dark ? t.muted : mix(t.primary, 'FFFFFF', 0.8), align: 'center' })] : []),
                ...(s.contact ? [txt(M + 1, 5.1, CW - 2, 0.5, clampText(s.contact, 100), { size: 15, bold: true, color: fg, align: 'center' })] : []),
                ...(ctx.deckTitle ? [txt(M, H - 0.6, CW, 0.3, clampText(ctx.deckTitle, 80), { size: 10, color: t.dark ? t.muted : mix(t.primary, 'FFFFFF', 0.7), align: 'center' })] : []),
            ],
        };
    },
};

export const LAYOUT_NAMES = Object.keys(LAYOUTS);

/**
 * @param {object} spec { theme, title, author, date, slides:[{layout, …, notes}] }
 * @returns {{theme: object, slides: {bg:string, elements:object[], notes:string}[]}}
 */
export function layoutDeck(spec) {
    const t = getTheme(spec.theme);
    const list = (spec.slides || []).slice(0, 40);
    let sectionIndex = 0;
    const slides = list.map((s, i) => {
        const kind = LAYOUTS[s.layout] ? s.layout : (s.bullets ? 'bullets' : 'bullets');
        if (kind === 'section') sectionIndex++;
        const ctx = { index: i + 1, total: list.length, deckTitle: spec.title || '', author: spec.author || '', date: spec.date || '', sectionIndex };
        const out = LAYOUTS[kind](t, s, ctx);
        return { ...out, notes: s.notes || '' };
    });
    return { theme: t, slides };
}
