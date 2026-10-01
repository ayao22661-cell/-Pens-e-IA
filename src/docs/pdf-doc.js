// ============================================================
//  PENSÉE IA — src/docs/pdf-doc.js
//  Documents PDF mis en page (pdfmake) : couverture, sommaire,
//  titres numérotés, encadrés, tableaux, chiffres clés, citations,
//  graphiques vectoriels, en-têtes et pieds de page.
//  spec (JSON du modèle) → définition pdfmake.
// ============================================================

import { getTheme, mix } from './theme.js';
import { chartSvg } from './chart-svg.js';

const PAGE_W = 595.28;               // A4 en points
const MARGIN_X = 56;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const CALLOUTS = {
    info: { label: 'À noter', color: 'primary' },
    success: { label: 'Point fort', color: '16A34A' },
    warning: { label: 'Attention', color: 'D97706' },
    danger: { label: 'Risque', color: 'DC2626' },
    key: { label: 'À retenir', color: 'accent' },
};

/** "Texte avec **gras**" → runs pdfmake */
function rich(text) {
    const parts = String(text ?? '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map(p => (p.startsWith('**') && p.endsWith('**') ? { text: p.slice(2, -2), bold: true } : { text: p }));
}

function heading(block, t, counters, useToc) {
    const level = Math.min(3, Math.max(1, Number(block.level) || 1));
    if (level === 1) { counters[0]++; counters[1] = 0; }
    if (level === 2) counters[1]++;
    const num = level === 1 ? `${counters[0]}.` : level === 2 ? `${counters[0]}.${counters[1]}` : '';
    const label = num ? `${num}  ${block.text}` : block.text;
    const node = { text: label, style: `h${level}`, tocItem: useToc && level <= 2, tocStyle: level === 1 ? 'toc1' : 'toc2', tocMargin: level === 2 ? [14, 0, 0, 0] : [0, 6, 0, 0] };
    if (level === 1) {
        return [
            { ...node, headlineLevel: 1 },
            { canvas: [{ type: 'rect', x: 0, y: 0, w: 36, h: 3, color: `#${t.primary}` }], margin: [0, 4, 0, 12] },
        ];
    }
    return [node];
}

function callout(block, t) {
    const def = CALLOUTS[block.variant] || CALLOUTS.info;
    const hex = def.color === 'primary' ? t.primary : def.color === 'accent' ? t.accent : def.color;
    return {
        table: {
            widths: [4, '*'],
            body: [[
                { text: '', fillColor: `#${hex}` },
                {
                    stack: [
                        { text: (block.title || def.label).toUpperCase(), bold: true, fontSize: 8.5, color: `#${hex}`, characterSpacing: 1, margin: [0, 0, 0, 3] },
                        { text: rich(block.text), fontSize: 10.5, color: `#${t.text}`, lineHeight: 1.4 },
                    ],
                    fillColor: `#${mix(hex, 'FFFFFF', 0.92)}`,
                    margin: [12, 10, 12, 10],
                },
            ]],
        },
        layout: 'noBorders',
        margin: [0, 6, 0, 12],
    };
}

function table(block, t) {
    const headers = (block.headers || []).slice(0, 8);
    const rows = (block.rows || []).slice(0, 60).map(r => headers.map((_, i) => String(r[i] ?? '')));
    const numeric = headers.map((_, i) => rows.length > 0 && rows.every(r => /^[\s\d.,%+\-–FCFA€$k Mmd]*$/i.test(r[i]) && /\d/.test(r[i])));
    return [{
        table: {
            headerRows: 1,
            widths: headers.map((_, i) => (i === 0 ? '*' : 'auto')),
            body: [
                headers.map((h, i) => ({ text: h, bold: true, color: '#FFFFFF', fillColor: `#${t.primary}`, fontSize: 9.5, alignment: numeric[i] ? 'right' : 'left', margin: [6, 5, 6, 5] })),
                ...rows.map((r, ri) => r.map((v, i) => ({
                    text: v, fontSize: 9.5, color: `#${t.text}`, alignment: numeric[i] ? 'right' : 'left',
                    fillColor: ri % 2 ? `#${t.surface === 'FFFFFF' ? mix(t.line, 'FFFFFF', 0.6) : t.surface}` : null, margin: [6, 4, 6, 4],
                }))),
            ],
        },
        layout: {
            hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
            vLineWidth: () => 0,
            hLineColor: () => `#${t.line}`,
        },
        margin: [0, 6, 0, block.caption ? 4 : 14],
    }, ...(block.caption ? [{ text: block.caption, style: 'caption' }] : [])];
}

function stats(block, t) {
    const items = (block.stats || block.items || []).slice(0, 4);
    const gap = 10;
    const w = (CONTENT_W - gap * (items.length - 1)) / Math.max(1, items.length);
    return {
        columns: items.map((it, i) => ({
            width: w,
            table: {
                widths: ['*'],
                body: [[{
                    stack: [
                        { text: String(it.value ?? ''), fontSize: items.length > 3 ? 18 : 22, bold: true, color: `#${t.chart[i % t.chart.length]}` },
                        { text: it.label || '', fontSize: 9, color: `#${t.muted}`, margin: [0, 2, 0, 0] },
                    ],
                    fillColor: `#${t.surface === 'FFFFFF' ? mix(t.line, 'FFFFFF', 0.55) : t.surface}`,
                    margin: [10, 10, 10, 10],
                }]],
            },
            layout: 'noBorders',
        })),
        columnGap: gap,
        margin: [0, 6, 0, 14],
    };
}

function blockNodes(block, t, counters, useToc) {
    switch (block.type) {
        case 'heading': return heading(block, t, counters, useToc);
        case 'paragraph': return [{ text: rich(block.text), style: 'p' }];
        case 'bullets': return [{ ul: (block.items || []).map(i => ({ text: rich(i) })), style: 'list', markerColor: `#${t.primary}` }];
        case 'numbered': return [{ ol: (block.items || []).map(i => ({ text: rich(i) })), style: 'list', markerColor: `#${t.primary}` }];
        case 'callout': return [{ stack: [callout(block, t)], unbreakable: true }];
        case 'table': return table(block, t);
        case 'stats': return [{ stack: [stats(block, t)], unbreakable: true }];
        case 'quote': return [{
            unbreakable: true,
            table: { widths: [3, '*'], body: [[{ text: '', fillColor: `#${t.accent}` }, {
                stack: [{ text: `« ${block.text} »`, italics: true, fontSize: 12, color: `#${t.text}`, lineHeight: 1.4 },
                    ...(block.author ? [{ text: `— ${block.author}`, fontSize: 9.5, color: `#${t.muted}`, margin: [0, 4, 0, 0] }] : [])],
                margin: [12, 6, 0, 6],
            }]] },
            layout: 'noBorders', margin: [0, 6, 0, 14],
        }];
        case 'chart': {
            const svg = chartSvg(block.chart || {}, { width: CONTENT_W, height: 240, colors: t.chart, text: t.text, muted: t.muted, line: t.line, bg: 'FFFFFF', font: 'Roboto' });
            // Graphique et légende indissociables (jamais de légende orpheline en haut de page)
            return [{ stack: [{ svg, width: CONTENT_W, margin: [0, 6, 0, block.caption ? 4 : 14] }, ...(block.caption ? [{ text: block.caption, style: 'caption' }] : [])], unbreakable: true }];
        }
        case 'divider': return [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineWidth: 0.5, lineColor: `#${t.line}` }], margin: [0, 8, 0, 14] }];
        case 'page_break': return [{ text: '', pageBreak: 'after' }];
        default: return block.text ? [{ text: rich(block.text), style: 'p' }] : [];
    }
}

/**
 * @param {object} spec { theme, title, subtitle, author, organization, date, blocks:[…] }
 * @returns {object} définition pdfmake
 */
export function buildPdfDefinition(spec) {
    // Documents imprimés : thème clair (le thème sombre garde sa couleur d'accent)
    const base = getTheme(spec.theme);
    const t = base.dark ? { ...getTheme('moderne'), primary: base.primary === '2EE6A6' ? '0F9F6E' : base.primary, chart: base.chart } : base;
    const blocks = Array.isArray(spec.blocks) ? spec.blocks.slice(0, 400) : [];
    const h1Count = blocks.filter(b => b.type === 'heading' && (Number(b.level) || 1) === 1).length;
    const useCover = spec.cover !== false;
    const useToc = spec.toc ?? h1Count >= 3;
    const counters = [0, 0];
    const meta = [spec.author, spec.organization, spec.date].filter(Boolean).join('  ·  ');

    const content = [];
    if (useCover) {
        content.push(
            { canvas: [{ type: 'rect', x: -MARGIN_X, y: -72, w: PAGE_W, h: 330, color: `#${t.primary}` },
                { type: 'rect', x: -MARGIN_X, y: 258, w: PAGE_W, h: 6, color: `#${t.accent}` }], absolutePosition: { x: MARGIN_X, y: 72 } },
            { text: (spec.kicker || spec.organization || 'Document').toUpperCase(), color: `#${mix(t.primary, 'FFFFFF', 0.7)}`, fontSize: 9.5, bold: true, characterSpacing: 2, margin: [0, 60, 0, 14] },
            { text: spec.title || 'Document', color: '#FFFFFF', fontSize: 30, bold: true, lineHeight: 1.1 },
            ...(spec.subtitle ? [{ text: spec.subtitle, color: `#${mix(t.primary, 'FFFFFF', 0.85)}`, fontSize: 13, margin: [0, 12, 0, 0], lineHeight: 1.35 }] : []),
            { text: meta, absolutePosition: { x: MARGIN_X, y: 760 }, fontSize: 10, color: `#${t.muted}` },
            { text: '', pageBreak: 'after' },
        );
    }
    if (useToc) {
        content.push({ toc: { title: { text: 'Sommaire', style: 'tocTitle' } } }, { text: '', pageBreak: 'after' });
    }
    if (!useCover) {
        content.push({ text: spec.title || 'Document', style: 'docTitle' });
        if (spec.subtitle) content.push({ text: spec.subtitle, style: 'docSubtitle' });
        if (meta) content.push({ text: meta, fontSize: 9.5, color: `#${t.muted}`, margin: [0, 0, 0, 18] });
    }
    for (const b of blocks) content.push(...blockNodes(b, t, counters, useToc));

    const skipChrome = (page) => useCover && page === 1;
    return {
        pageSize: 'A4',
        pageMargins: [MARGIN_X, 64, MARGIN_X, 60],
        info: { title: spec.title || 'Document', author: spec.author || 'Pensée IA', creator: 'Pensée IA' },
        header: (page) => (skipChrome(page) ? null : {
            columns: [
                { text: spec.title || '', fontSize: 8, color: `#${t.muted}` },
                { text: spec.organization || '', fontSize: 8, color: `#${t.muted}`, alignment: 'right' },
            ],
            margin: [MARGIN_X, 28, MARGIN_X, 0],
        }),
        footer: (page, pages) => (skipChrome(page) ? null : {
            columns: [
                { canvas: [{ type: 'rect', x: 0, y: 4, w: 18, h: 2, color: `#${t.primary}` }], width: 30 },
                { text: `${page} / ${pages}`, alignment: 'right', fontSize: 8.5, color: `#${t.muted}` },
            ],
            margin: [MARGIN_X, 20, MARGIN_X, 0],
        }),
        pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0, // pas de titre orphelin en bas de page
        content,
        defaultStyle: { font: 'Roboto', fontSize: 10.5, color: `#${t.text}`, lineHeight: 1.35 },
        styles: {
            docTitle: { fontSize: 24, bold: true, color: `#${t.text}`, margin: [0, 0, 0, 6] },
            docSubtitle: { fontSize: 13, color: `#${t.muted}`, margin: [0, 0, 0, 6] },
            h1: { fontSize: 18, bold: true, color: `#${t.text}`, margin: [0, 16, 0, 2] },
            h2: { fontSize: 13.5, bold: true, color: `#${t.primary}`, margin: [0, 12, 0, 6] },
            h3: { fontSize: 11.5, bold: true, color: `#${t.text}`, margin: [0, 10, 0, 4] },
            p: { margin: [0, 0, 0, 9], alignment: 'justify' },
            list: { margin: [0, 0, 0, 10], lineHeight: 1.4 },
            caption: { fontSize: 8.5, italics: true, color: `#${t.muted}`, margin: [0, 0, 0, 14] },
            tocTitle: { fontSize: 18, bold: true, margin: [0, 0, 0, 16] },
            toc1: { fontSize: 11, bold: true },
            toc2: { fontSize: 10, color: `#${t.muted}` },
        },
    };
}
