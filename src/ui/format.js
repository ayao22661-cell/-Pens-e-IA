// ============================================================
//  PENSÉE IA — src/ui/format.js
//  Markdown → HTML assaini, blocs de code avec bouton ▶ Exécuter.
// ============================================================

import { escapeHtml } from './dom.js';
import { ICONS } from './icons.js';

const RUNNABLE = new Set(['html', 'css', 'javascript', 'js', 'python', 'py']);

/** Retire les marqueurs techniques stockés avec les messages. */
export function stripMarkers(text) {
    return String(text || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<think>[\s\S]*$/i, '')
        .replace(/\n?\[WEB_SOURCES:\[[\s\S]*?\]\]/g, '')
        .replace(/\n?\[TOOL_TRACE:\[[\s\S]*?\]\]/g, '');
}

let _renderer = null;
function renderer() {
    if (_renderer) return _renderer;
    _renderer = new marked.Renderer();
    _renderer.code = function (argsOrCode, _lang) {
        // marked ≥ v11 passe un objet, les versions antérieures (code, lang)
        const isObj = typeof argsOrCode === 'object' && argsOrCode !== null;
        const code = ((isObj ? argsOrCode.text : argsOrCode) || '').trim();
        const lang = ((isObj ? argsOrCode.lang : _lang) || '').toLowerCase().split(/\s/)[0];
        const runId = 'sandbox_' + Math.random().toString(36).slice(2, 9);
        const btn = RUNNABLE.has(lang)
            ? `<button class="run-btn" data-code="${encodeURIComponent(code)}" data-runid="${runId}" data-lang="${lang}">▶ Exécuter</button>`
            : '';
        return `<div class="code-block-wrapper"><div class="code-header"><span class="code-lang">${escapeHtml(lang || 'code')}</span>`
            + `<span class="pz-code-actions"><button class="pz-copy-code" data-code="${encodeURIComponent(code)}">${ICONS.copy}Copier</button>${btn}</span></div>`
            + `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(code)}</code></pre>`
            + `<div id="${runId}" class="sandbox-container"></div></div>`;
    };
    return _renderer;
}

export function formatResponse(text) {
    const clean = stripMarkers(text);
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
        return escapeHtml(clean).replace(/\n/g, '<br>');
    }
    try {
        const html = marked.parse(clean, { renderer: renderer(), breaks: true });
        let sanitized = DOMPurify.sanitize(html, {
            ADD_ATTR: ['data-code', 'data-runid', 'data-lang', 'target', 'download'],
        });
        // Liens Supabase Storage → puces de téléchargement
        sanitized = sanitized.replace(
            /<a[^>]+href="(https:\/\/[^"]+supabase\.co\/storage[^"]+)"[^>]*>([^<]+)<\/a>/gi,
            (_m, url, name) => `<a href="${url}" download="${name.trim()}" target="_blank" class="file-chip">${ICONS.file} ${name.trim()} ${ICONS.download}</a>`
        );
        return sanitized;
    } catch (e) {
        console.error('Erreur de parsing Markdown :', e);
        return escapeHtml(clean).replace(/\n/g, '<br>');
    }
}
