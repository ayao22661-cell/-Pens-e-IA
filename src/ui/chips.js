// ============================================================
//  PENSÉE IA — src/ui/chips.js
//  Puces "Sources" et trace compacte des outils utilisés.
// ============================================================

import { escapeHtml } from './dom.js';
import { ICONS } from './icons.js';

export function renderSources(sources) {
    const div = document.createElement('div');
    div.className = 'pz-sources';
    div.innerHTML = '<span class="pz-sources-label">Sources</span>';
    sources.forEach((src, i) => {
        const chip = document.createElement('a');
        chip.className = 'pz-source-chip';
        chip.href = src.url;
        chip.target = '_blank';
        chip.rel = 'noopener noreferrer';
        chip.title = src.title || src.url;
        let domain = 'Source';
        try { domain = new URL(src.url).hostname.replace(/^www\./, ''); } catch (_) { /* URL invalide */ }
        chip.innerHTML = `<span class="pz-source-n">[${src.n || i + 1}]</span> ${escapeHtml(domain)}`;
        div.appendChild(chip);
    });
    return div;
}

export const TOOL_LABELS = {
    bash: { icon: ICONS.terminal, label: 'Terminal' },
    open_port: { icon: ICONS.globe, label: 'Serveur' },
    run_python: { icon: ICONS.terminal, label: 'Python' },
    write_file: { icon: ICONS.pencil, label: 'Écriture' },
    edit_file: { icon: ICONS.pencil, label: 'Modification' },
    read_file: { icon: ICONS.file, label: 'Lecture' },
    list_files: { icon: ICONS.folder, label: 'Fichiers' },
    render_preview: { icon: ICONS.eye, label: 'Aperçu' },
    web_search: { icon: ICONS.search, label: 'Recherche web' },
    fetch_url: { icon: ICONS.globe, label: 'Lecture web' },
    generate_file: { icon: ICONS.doc, label: 'Document' },
    generate_pdf: { icon: ICONS.doc, label: 'PDF' },
    generate_image: { icon: ICONS.image, label: 'Image' },
};

/** Trace persistée ([TOOL_TRACE:...]) affichée au rechargement d'une conversation. */
export function renderToolTrace(trace) {
    const div = document.createElement('div');
    div.className = 'pz-trace';
    for (const t of trace) {
        const meta = TOOL_LABELS[t.name] || { icon: ICONS.tool, label: t.name };
        const chip = document.createElement('span');
        chip.className = 'pz-trace-chip' + (t.ok === false ? ' pz-trace-fail' : '');
        chip.innerHTML = `${meta.icon} ${escapeHtml(meta.label)}${t.summary ? ` · <span>${escapeHtml(t.summary)}</span>` : ''}`;
        div.appendChild(chip);
    }
    return div;
}
