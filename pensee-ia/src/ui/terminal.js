// ============================================================
//  PENSÉE IA — src/ui/terminal.js
//  Panneau "Terminal" : journal de tout ce que l'agent exécute,
//  invite Python pour l'utilisateur, explorateur de /workspace.
// ============================================================

import { workspaceId } from '../state.js';
import { vfs, downloadRecord } from '../sandbox/vfs.js';
import { runPython } from '../sandbox/python.js';
import { buildPreviewDocument, mountPreview } from '../sandbox/preview.js';
import { escapeHtml } from './dom.js';
import { ICONS } from './icons.js';

let panel, logEl, filesEl, inputEl, countEl;
let activeTab = 'log';

const fmtSize = (n) => n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(1)} Ko` : `${(n / 1048576).toFixed(1)} Mo`;

export const terminal = {
    /** @param {'cmd'|'stdout'|'stderr'|'info'|'ok'|'err'} kind */
    log(text, kind = 'stdout') {
        if (!logEl || !text) return;
        const span = document.createElement('span');
        span.className = `pz-term-${kind}`;
        span.textContent = kind === 'cmd' ? `\n$ ${text}\n` : (kind === 'stdout' || kind === 'stderr' ? text : `${text}\n`);
        logEl.appendChild(span);
        // Journal borné : on retire les plus anciennes lignes
        while (logEl.childNodes.length > 2000) logEl.firstChild.remove();
        logEl.scrollTop = logEl.scrollHeight;
    },

    open(tab = activeTab) {
        panel.classList.add('open');
        document.body.classList.add('pz-term-open');
        selectTab(tab);
        if (tab === 'log') inputEl.focus();
    },

    close() {
        panel.classList.remove('open');
        document.body.classList.remove('pz-term-open');
    },

    toggle() { panel.classList.contains('open') ? this.close() : this.open(); },

    refreshFiles,
};

function selectTab(tab) {
    activeTab = tab;
    panel.querySelectorAll('.pz-term-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    panel.querySelector('.pz-term-pane-log').hidden = tab !== 'log';
    panel.querySelector('.pz-term-pane-files').hidden = tab !== 'files';
    if (tab === 'files') refreshFiles();
}

async function refreshFiles() {
    if (!filesEl) return;
    const ws = workspaceId();
    const files = await vfs.list(ws).catch(() => []);
    countEl.textContent = files.length ? String(files.length) : '';
    if (activeTab !== 'files') return;

    if (!files.length) {
        filesEl.innerHTML = `<div class="pz-term-empty">/workspace est vide.<br>Les fichiers créés par Pensée ou joints à tes messages apparaîtront ici.</div>`;
        return;
    }
    const total = files.reduce((n, f) => n + f.size, 0);
    filesEl.innerHTML = `<div class="pz-term-files-head"><span>/workspace · ${files.length} fichier(s) · ${fmtSize(total)}</span><button type="button" class="pz-link-btn" data-act="clear">Tout effacer</button></div>`;
    for (const f of files) {
        const row = document.createElement('div');
        row.className = 'pz-term-file';
        const isHtml = /\.html?$/i.test(f.path);
        row.innerHTML = `<span class="pz-term-file-name" title="${escapeHtml(f.path)}">${ICONS.file} ${escapeHtml(f.path)}</span>
            <span class="pz-term-file-size">${fmtSize(f.size)}</span>
            ${isHtml ? `<button type="button" class="pz-icon-btn" data-act="preview" title="Aperçu">${ICONS.eye}</button>` : ''}
            <button type="button" class="pz-icon-btn" data-act="download" title="Télécharger">${ICONS.download}</button>
            <button type="button" class="pz-icon-btn" data-act="delete" title="Supprimer">✕</button>`;
        row.dataset.path = f.path;
        filesEl.appendChild(row);
    }
}

async function onFilesClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const ws = workspaceId();
    const path = btn.closest('.pz-term-file')?.dataset.path;
    if (btn.dataset.act === 'clear') {
        if (confirm('Effacer tous les fichiers de /workspace pour cette conversation ?')) await vfs.clear(ws);
    } else if (btn.dataset.act === 'download') {
        const rec = await vfs.read(ws, path);
        if (rec) downloadRecord(rec);
    } else if (btn.dataset.act === 'delete') {
        await vfs.remove(ws, path);
    } else if (btn.dataset.act === 'preview') {
        const doc = await buildPreviewDocument(ws, path);
        const holder = document.createElement('div');
        holder.className = 'pz-term-preview';
        filesEl.prepend(holder);
        const card = mountPreview(holder, doc, { title: path, onReload: () => buildPreviewDocument(ws, path) });
        card.classList.add('pz-preview-full');
        document.body.classList.add('pz-noscroll');
        card.querySelector('[data-act="expand"]').addEventListener('click', () => holder.remove(), { once: true });
    }
}

async function runUserPython() {
    const code = inputEl.value.trim();
    if (!code) return;
    inputEl.value = '';
    inputEl.style.height = '';
    const ws = workspaceId();
    terminal.log(code.split('\n').join('\n  '), 'cmd');
    const r = await runPython(code, {
        ws,
        onOutput: (s, stream) => terminal.log(s, stream),
        onStatus: (st) => { if (st === 'loading') terminal.log('Chargement de Python (première exécution)…', 'info'); },
    });
    if (r.result) terminal.log(r.result + '\n', 'stdout');
    if (r.error) terminal.log(r.error + '\n', 'stderr');
    if (r.changed.length) terminal.log(`✓ Fichiers modifiés : ${r.changed.join(', ')}`, 'ok');
}

export function initTerminal() {
    panel = document.createElement('aside');
    panel.id = 'pzTerminal';
    panel.className = 'pz-term';
    panel.setAttribute('aria-label', 'Terminal et espace de travail');
    panel.innerHTML = `
        <div class="pz-term-head">
            <button type="button" class="pz-term-tab active" data-tab="log">${ICONS.terminal} Terminal</button>
            <button type="button" class="pz-term-tab" data-tab="files">${ICONS.folder} Fichiers <span class="pz-term-count"></span></button>
            <span class="pz-term-spacer"></span>
            <button type="button" class="pz-icon-btn" data-act="close" title="Fermer">✕</button>
        </div>
        <div class="pz-term-pane-log">
            <pre class="pz-term-log"><span class="pz-term-info">Pensée · Python (WebAssembly) · /workspace
Tout ce que l'agent exécute s'affiche ici. Tu peux aussi taper du Python ci-dessous.
</span></pre>
            <div class="pz-term-input">
                <span class="pz-term-prompt">py&gt;</span>
                <textarea rows="1" placeholder="print('bonjour')  —  Entrée pour exécuter, Maj+Entrée pour une nouvelle ligne" spellcheck="false"></textarea>
            </div>
        </div>
        <div class="pz-term-pane-files" hidden><div class="pz-term-files"></div></div>`;
    document.body.appendChild(panel);

    logEl = panel.querySelector('.pz-term-log');
    filesEl = panel.querySelector('.pz-term-files');
    inputEl = panel.querySelector('textarea');
    countEl = panel.querySelector('.pz-term-count');

    panel.querySelectorAll('.pz-term-tab').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));
    panel.querySelector('[data-act="close"]').addEventListener('click', () => terminal.close());
    filesEl.addEventListener('click', onFilesClick);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runUserPython(); }
    });
    inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
    });

    // Bouton d'ouverture dans l'en-tête
    const btn = document.createElement('button');
    btn.id = 'terminalBtn';
    btn.type = 'button';
    btn.title = 'Terminal & fichiers';
    btn.innerHTML = `${ICONS.terminal}<span class="pz-term-btn-label">Terminal</span>`;
    btn.addEventListener('click', () => terminal.toggle());
    document.getElementById('moreBtn')?.before(btn);

    window.addEventListener('pensee:vfs', () => refreshFiles());
    window.addEventListener('pensee:tab', () => {
        terminal.log('── conversation changée ──', 'info');
        refreshFiles();
    });
}
