// ============================================================
//  PENSÉE IA — src/docs/chart-svg.js
//  Graphiques en SVG autonome : aperçu des slides et PDF (pdfmake).
//  Types : bar, line, pie, doughnut.
// ============================================================

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
}

export function formatNumber(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Md';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' k';
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/**
 * @param {{type:string, labels:string[], series:{name:string, values:number[]}[]}} chart
 * @param {{width:number, height:number, colors:string[], text:string, muted:string, line:string, bg?:string, font?:string}} o  couleurs hex sans #
 */
export function chartSvg(chart, { width = 640, height = 360, colors, text, muted, line, bg = 'FFFFFF', font = 'Helvetica, Arial, sans-serif' }) {
    const type = chart.type || 'bar';
    const labels = chart.labels || [];
    const series = (chart.series || []).filter(s => Array.isArray(s.values));
    const c = (i) => '#' + colors[i % colors.length];
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${font}">`];

    if (type === 'pie' || type === 'doughnut') {
        const values = (series[0]?.values || []).map(v => Math.max(0, Number(v) || 0));
        const total = values.reduce((a, b) => a + b, 0) || 1;
        const r = Math.min(height * 0.42, width * 0.25);
        const cx = r + 20;
        const cy = height / 2;
        let angle = -Math.PI / 2;
        values.forEach((v, i) => {
            const a = (v / total) * Math.PI * 2;
            if (a >= Math.PI * 2 - 1e-6) {
                parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c(i)}"/>`);
            } else if (a > 0) {
                const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
                const x2 = cx + r * Math.cos(angle + a), y2 = cy + r * Math.sin(angle + a);
                parts.push(`<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${c(i)}"/>`);
            }
            angle += a;
        });
        if (type === 'doughnut') parts.push(`<circle cx="${cx}" cy="${cy}" r="${(r * 0.58).toFixed(1)}" fill="#${bg}"/>`);
        // Légende
        const lx = cx + r + 30;
        const step = Math.min(30, (height - 40) / Math.max(1, values.length));
        values.forEach((v, i) => {
            const y = cy - (values.length * step) / 2 + i * step + step / 2;
            parts.push(`<rect x="${lx}" y="${y - 7}" width="14" height="14" rx="3" fill="${c(i)}"/>`);
            parts.push(`<text x="${lx + 22}" y="${y + 5}" font-size="14" fill="#${text}">${esc(labels[i] || '')}</text>`);
            parts.push(`<text x="${width - 10}" y="${y + 5}" font-size="14" text-anchor="end" font-weight="bold" fill="#${text}">${Math.round((v / total) * 100)} %</text>`);
        });
        parts.push('</svg>');
        return parts.join('');
    }

    // Axes communs (barres / lignes)
    const left = 56, right = 16, top = series.length > 1 ? 40 : 16, bottom = 44;
    const pw = width - left - right, ph = height - top - bottom;
    const all = series.flatMap(s => s.values.map(Number)).filter(Number.isFinite);
    const max = niceMax(Math.max(0, ...all));
    for (let i = 0; i <= 4; i++) {
        const y = top + ph - (ph * i) / 4;
        parts.push(`<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#${line}" stroke-width="1"/>`);
        parts.push(`<text x="${left - 8}" y="${y + 4}" font-size="12" text-anchor="end" fill="#${muted}">${formatNumber((max * i) / 4)}</text>`);
    }
    const n = Math.max(1, labels.length);
    const slot = pw / n;
    labels.forEach((l, i) => {
        parts.push(`<text x="${left + slot * i + slot / 2}" y="${height - bottom + 20}" font-size="12" text-anchor="middle" fill="#${muted}">${esc(String(l).slice(0, 14))}</text>`);
    });

    if (type === 'line') {
        series.forEach((s, si) => {
            const pts = s.values.map((v, i) => `${(left + slot * i + slot / 2).toFixed(1)},${(top + ph - (ph * (Number(v) || 0)) / max).toFixed(1)}`);
            parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${c(si)}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
            pts.forEach(p => { const [x, y] = p.split(','); parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${c(si)}"/>`); });
        });
    } else {
        const groupW = slot * 0.7;
        const barW = groupW / Math.max(1, series.length);
        series.forEach((s, si) => {
            s.values.forEach((v, i) => {
                const h = (ph * Math.max(0, Number(v) || 0)) / max;
                const x = left + slot * i + (slot - groupW) / 2 + barW * si;
                parts.push(`<rect x="${x.toFixed(1)}" y="${(top + ph - h).toFixed(1)}" width="${(barW - 3).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${c(si)}"/>`);
                if (series.length === 1 && n <= 8) {
                    parts.push(`<text x="${(x + (barW - 3) / 2).toFixed(1)}" y="${(top + ph - h - 6).toFixed(1)}" font-size="12" text-anchor="middle" font-weight="bold" fill="#${text}">${formatNumber(v)}</text>`);
                }
            });
        });
    }
    if (series.length > 1) {
        let x = left;
        series.forEach((s, si) => {
            parts.push(`<rect x="${x}" y="8" width="12" height="12" rx="3" fill="${c(si)}"/><text x="${x + 18}" y="18" font-size="13" fill="#${text}">${esc(s.name || '')}</text>`);
            x += 30 + String(s.name || '').length * 7.5;
        });
    }
    parts.push('</svg>');
    return parts.join('');
}
