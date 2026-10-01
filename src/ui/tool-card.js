// ============================================================
//  PENSÉE IA — src/ui/tool-card.js
//  Carte d'appel d'outil, façon terminal : en-tête (outil + cible
//  + statut), corps repliable (code, sortie en direct), zone de
//  résultat toujours visible (aperçu, image, fichier).
// ============================================================

import { escapeHtml, highlightIn, scrollToBottom } from './dom.js';
import { ICONS } from './icons.js';
import { TOOL_LABELS } from './chips.js';

const MAX_LOG_CHARS = 100_000;

export function argsSummary(name, args = {}) {
    switch (name) {
        case 'web_search': return `« ${args.query || ''} »`;
        case 'fetch_url': try { return new URL(args.url).hostname; } catch { return args.url || ''; }
        case 'bash': return (args.background ? '& ' : '$ ') + String(args.command || '').split('\n')[0].slice(0, 80);
        case 'open_port': return 'port ' + (args.port || '');
        case 'use_template': return `${args.name || 'fullstack'} → ${args.dir || 'app'}/`;
        case 'present_files': return (args.paths || []).join(', ');
        case 'run_python': {
            const line = String(args.code || '').split('\n').find(l => l.trim() && !l.trim().startsWith('#')) || '';
            return line.trim().slice(0, 60);
        }
        case 'write_file': case 'read_file': case 'edit_file': case 'render_preview': return args.path || '';
        case 'generate_file': return args.filename || args.type || '';
        case 'generate_pdf': return args.title || '';
        case 'generate_image': return String(args.prompt || '').slice(0, 50);
        default: return '';
    }
}

export function createToolCard({ name, args }) {
    const meta = TOOL_LABELS[name] || { icon: ICONS.tool, label: name };
    const el = document.createElement('div');
    el.className = 'pz-tool';
    el.dataset.state = 'running';
    el.dataset.tool = name;
    el.innerHTML = `
        <button type="button" class="pz-tool-head" aria-expanded="false">
            <span class="pz-tool-icon">${meta.icon}</span>
            <span class="pz-tool-label">${escapeHtml(meta.label)}</span>
            <span class="pz-tool-target"></span>
            <span class="pz-tool-detail"></span>
            <span class="pz-tool-status">${ICONS.spinner}</span>
            <span class="pz-tool-chevron">${ICONS.chevron}</span>
        </button>
        <div class="pz-tool-body"></div>
        <div class="pz-tool-out"></div>`;
    el.querySelector('.pz-tool-target').textContent = argsSummary(name, args);

    const head = el.querySelector('.pz-tool-head');
    const body = el.querySelector('.pz-tool-body');
    const out = el.querySelector('.pz-tool-out');
    const detail = el.querySelector('.pz-tool-detail');
    let logEl = null;
    let logChars = 0;

    const setOpen = (open) => {
        el.classList.toggle('open', open);
        head.setAttribute('aria-expanded', String(open));
    };
    head.addEventListener('click', () => setOpen(!el.classList.contains('open')));

    return {
        el,
        open: setOpen,

        setCode(code, lang = '') {
            const pre = document.createElement('pre');
            pre.className = 'pz-tool-code';
            const c = document.createElement('code');
            if (lang) c.className = `language-${lang}`;
            c.textContent = code;
            pre.appendChild(c);
            body.appendChild(pre);
            highlightIn(pre);
        },

        setHtml(html) {
            const div = document.createElement('div');
            div.className = 'pz-tool-html';
            div.innerHTML = html;
            body.appendChild(div);
        },

        appendLog(text, stream = 'stdout') {
            if (!text) return;
            if (!logEl) {
                logEl = document.createElement('pre');
                logEl.className = 'pz-tool-log';
                body.appendChild(logEl);
            }
            if (logChars > MAX_LOG_CHARS) return;
            logChars += text.length;
            const span = document.createElement('span');
            if (stream !== 'stdout') span.className = `pz-log-${stream}`;
            span.textContent = logChars > MAX_LOG_CHARS ? '\n… sortie tronquée …\n' : text;
            logEl.appendChild(span);
            logEl.scrollTop = logEl.scrollHeight;
            scrollToBottom();
        },

        setDetail(text) { detail.textContent = text || ''; },

        addOutput(node) {
            out.appendChild(node);
            scrollToBottom();
        },

        finish({ ok, summary } = {}) {
            el.dataset.state = ok === false ? 'error' : 'ok';
            el.querySelector('.pz-tool-status').innerHTML = ok === false ? ICONS.fail : ICONS.ok;
            detail.textContent = summary || '';
            if (ok === false) setOpen(true);
        },
    };
}
