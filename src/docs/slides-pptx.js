// ============================================================
//  PENSÉE IA — src/docs/slides-pptx.js
//  Rendu PowerPoint natif (PptxGenJS) des slides calculées par
//  slides-layout.js : textes, formes, graphiques et tableaux
//  restent modifiables dans PowerPoint.
// ============================================================

import { layoutDeck } from './slides-layout.js';
import { FONTS } from './theme.js';

/** Paragraphes du moteur → "runs" PptxGenJS. */
function runs(el) {
    return el.paras.map((p, i) => ({
        text: p.text ?? '',
        options: {
            breakLine: !p.inline && i < el.paras.length - 1,
            bold: p.bold ?? el.bold,
            color: p.color || el.color,
            fontSize: p.size || el.size,
        },
    }));
}

function addElement(pres, slide, el, t) {
    const box = { x: el.x, y: el.y, w: el.w, h: el.h };
    switch (el.type) {
        case 'rect':
        case 'ellipse':
            slide.addShape(el.type === 'ellipse' ? pres.ShapeType.ellipse : (el.radius ? pres.ShapeType.roundRect : pres.ShapeType.rect), {
                ...box,
                fill: { color: el.fill, transparency: el.alpha || 0 },
                line: el.line ? { color: el.line, width: el.lineWidth || 1 } : { type: 'none' },
                ...(el.radius ? { rectRadius: el.radius } : {}),
            });
            break;
        case 'text':
            slide.addText(runs(el), {
                ...box,
                fontFace: el.font === 'head' ? FONTS.head : FONTS.body,
                fontSize: el.size,
                color: el.color,
                bold: el.bold,
                align: el.align || 'left',
                valign: el.valign || 'top',
                margin: 0,
                lineSpacingMultiple: 1.05,
                paraSpaceAfter: 0,
                charSpacing: el.spacing || 0,
                fit: 'none',
                wrap: true,
            });
            break;
        case 'chart': {
            const c = el.chart || {};
            const type = { bar: pres.ChartType.bar, line: pres.ChartType.line, pie: pres.ChartType.pie, doughnut: pres.ChartType.doughnut }[c.type] || pres.ChartType.bar;
            const round = c.type === 'pie' || c.type === 'doughnut';
            const series = (c.series || []).filter(s => Array.isArray(s.values)).slice(0, round ? 1 : 6);
            const data = series.map(s => ({ name: s.name || '', labels: (c.labels || []).map(String), values: s.values.map(v => Number(v) || 0) }));
            slide.addChart(type, data, {
                ...box,
                chartColors: t.chart,
                showLegend: round || series.length > 1,
                legendPos: round ? 'r' : 't',
                legendColor: t.text,
                legendFontSize: 12,
                legendFontFace: FONTS.body,
                catAxisLabelColor: t.muted,
                valAxisLabelColor: t.muted,
                catAxisLabelFontSize: 11,
                valAxisLabelFontSize: 10,
                catAxisLineShow: false,
                valAxisLineShow: false,
                valGridLine: { color: t.line, size: 0.75 },
                catGridLine: { style: 'none' },
                showValue: !round && series.length === 1 && (c.labels || []).length <= 8,
                showPercent: round,
                dataLabelColor: round ? 'FFFFFF' : t.text,
                dataLabelFontSize: 11,
                dataLabelFontBold: true,
                barGapWidthPct: 60,
                lineSize: 3,
                lineDataSymbolSize: 7,
                holeSize: 55,
                ...(c.type === 'bar' ? { barDir: 'col' } : {}),
            });
            break;
        }
        case 'table': {
            const head = el.headers.map(h => ({ text: String(h), options: { bold: true, color: 'FFFFFF', fill: { color: t.primary } } }));
            const body = el.rows.map((r, ri) => r.map(v => ({
                text: String(v),
                options: { color: t.text, fill: { color: ri % 2 ? t.surface : t.bg } },
            })));
            slide.addTable([head, ...body], {
                x: el.x, y: el.y, w: el.w,
                fontFace: FONTS.body,
                fontSize: el.size,
                rowH: el.rowH || (el.size * 2.1) / 72,
                margin: [0.04, 0.12, 0.04, 0.12],
                border: { type: 'solid', pt: 0.5, color: t.line },
                valign: 'middle',
                autoPage: false,
            });
            break;
        }
        default:
            break;
    }
}

/**
 * Construit le fichier .pptx.
 * @param {Function} PptxGenJS constructeur (global du navigateur ou module npm)
 * @param {object} spec
 * @returns {Promise<Blob|Buffer>} selon l'environnement (outputType)
 */
export async function buildPptx(PptxGenJS, spec, outputType = 'blob') {
    const { theme: t, slides } = layoutDeck(spec);
    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_WIDE';
    pres.title = spec.title || 'Présentation';
    pres.author = spec.author || 'Pensée IA';
    pres.company = spec.company || '';
    pres.theme = { headFontFace: FONTS.head, bodyFontFace: FONTS.body };

    for (const s of slides) {
        const slide = pres.addSlide();
        slide.background = { color: s.bg };
        for (const el of s.elements) addElement(pres, slide, el, t);
        if (s.notes) slide.addNotes(s.notes);
    }
    return pres.write({ outputType });
}
