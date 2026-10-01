// ============================================================
//  PENSÉE IA — src/docs/slides-html.js
//  Aperçu HTML des slides, calculé à partir des mêmes éléments que
//  le .pptx (positions en %, tailles en unités de conteneur).
// ============================================================

import { layoutDeck, W, H } from './slides-layout.js';
import { FONTS } from './theme.js';
import { chartSvg } from './chart-svg.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PT = 100 / (W * 72);                     // 1 pt en cqw (largeur de diapo = 100cqw)
const pos = (el) => `left:${(el.x / W) * 100}%;top:${(el.y / H) * 100}%;width:${(el.w / W) * 100}%;height:${(el.h / H) * 100}%;`;
const rgba = (hex, alpha = 0) => `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${(100 - alpha) / 100})`;

function elementHtml(el, t) {
    switch (el.type) {
        case 'rect':
        case 'ellipse': {
            const radius = el.type === 'ellipse' ? '50%' : el.radius ? `${(el.radius / W) * 100}cqw` : '0';
            const border = el.line ? `box-shadow:inset 0 0 0 ${el.lineWidth || 1}px #${el.line};` : '';
            return `<div style="position:absolute;${pos(el)}background:${rgba(el.fill, el.alpha)};border-radius:${radius};${border}"></div>`;
        }
        case 'text': {
            const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.valign || 'top'];
            const groups = [[]];
            el.paras.forEach((p, i) => { groups[groups.length - 1].push(p); if (!p.inline && i < el.paras.length - 1) groups.push([]); });
            const paras = groups.map(g => `<p style="margin:0">${g.map(p =>
                `<span style="${p.bold ?? el.bold ? 'font-weight:700;' : ''}${p.color ? `color:#${p.color};` : ''}${p.size ? `font-size:${p.size * PT}cqw;` : ''}">${esc(p.text)}</span>`).join('')}</p>`).join('');
            return `<div style="position:absolute;${pos(el)}display:flex;flex-direction:column;justify-content:${justify};text-align:${el.align || 'left'};`
                + `font-size:${el.size * PT}cqw;line-height:1.22;color:#${el.color};font-weight:${el.font === 'head' ? 650 : el.bold ? 700 : 400};`
                + `letter-spacing:${(el.spacing || 0) * PT}cqw;overflow:hidden">${paras}</div>`;
        }
        case 'chart': {
            const svg = chartSvg(el.chart || {}, {
                width: Math.round(el.w * 72), height: Math.round(el.h * 72),
                colors: t.chart, text: t.text, muted: t.muted, line: t.line, bg: t.surface, font: FONTS.css,
            }).replace('<svg ', '<svg style="width:100%;height:100%" preserveAspectRatio="xMidYMid meet" ');
            return `<div style="position:absolute;${pos(el)}">${svg}</div>`;
        }
        case 'table': {
            const head = el.headers.map(h => `<th style="background:#${t.primary};color:#fff;text-align:left;padding:0 0.8em">${esc(h)}</th>`).join('');
            const body = el.rows.map((r, i) => `<tr style="background:#${i % 2 ? t.surface : t.bg}">${r.map(v =>
                `<td style="padding:0 0.8em;border-top:1px solid #${t.line}">${esc(v)}</td>`).join('')}</tr>`).join('');
            // Hauteur de la boîte = lignes × rowH (cf. slides-layout) : les lignes se répartissent comme dans le .pptx
            const rowStyle = `height:${100 / (el.rows.length + 1)}%`;
            return `<div style="position:absolute;${pos(el)}"><table style="width:100%;height:100%;border-collapse:collapse;font-size:${el.size * PT}cqw;color:#${t.text}"><thead><tr style="${rowStyle}">${head}</tr></thead><tbody>${body.replace(/<tr style="/g, `<tr style="${rowStyle};`)}</tbody></table></div>`;
        }
        default:
            return '';
    }
}

/** @returns {string[]} le HTML de chaque slide (conteneur 16:9 autonome) */
export function slidesHtml(spec) {
    const { theme: t, slides } = layoutDeck(spec);
    return slides.map(s => `<div class="pz-slide" style="position:relative;aspect-ratio:16/9;container-type:inline-size;overflow:hidden;`
        + `background:#${s.bg};font-family:${FONTS.css};border-radius:8px">${s.elements.map(el => elementHtml(el, t)).join('')}</div>`);
}
