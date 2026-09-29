// ============================================================
//  PENSÉE IA — src/sandbox/code-runner.js
//  Boutons "▶ Exécuter" / "Copier" des blocs de code des réponses.
//  Python → worker Pyodide (même /workspace que l'agent)
//  JS / HTML → iframe isolée
// ============================================================

import { workspaceId } from '../state.js';
import { runPython } from './python.js';
import { vfs, extOf, downloadRecord } from './vfs.js';
import { jsConsoleDocument, bytesToBase64 } from './preview.js';
import { terminal } from '../ui/terminal.js';
import { ICONS } from '../ui/icons.js';

async function runPythonBlock(btn, container, code) {
    const ws = workspaceId();
    btn.disabled = true;
    btn.textContent = '⏳ Python…';
    container.style.display = 'block';
    container.innerHTML = '<div class="pz-run-shell"><div class="pz-run-title">Python · WebAssembly · /workspace</div><pre class="pz-tool-log"></pre><div class="pz-run-files"></div></div>';
    const out = container.querySelector('pre');
    const filesEl = container.querySelector('.pz-run-files');
    const write = (s, cls) => {
        const span = document.createElement('span');
        if (cls) span.className = cls;
        span.textContent = s;
        out.appendChild(span);
    };

    terminal.log(`python  # bloc de code (${code.split('\n').length} lignes)`, 'cmd');
    const r = await runPython(code, {
        ws,
        onOutput: (s, stream) => { write(s, stream === 'stderr' ? 'pz-log-stderr' : ''); terminal.log(s, stream); },
        onStatus: (st) => { btn.textContent = { loading: '⏳ Chargement…', installing: '⏳ Paquets…', running: '⏳ Exécution…' }[st] || btn.textContent; },
    });
    if (r.result) write(r.result + '\n');
    if (r.error) { write(r.error + '\n', 'pz-log-stderr'); terminal.log(r.error + '\n', 'stderr'); }
    if (!r.stdout && !r.error && !r.result && !r.changed.length) write('✓ Exécution terminée.\n', 'pz-log-ok');

    for (const p of r.changed) {
        const rec = await vfs.read(ws, p);
        if (!rec) continue;
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extOf(p))) {
            const img = document.createElement('img');
            img.className = 'pz-tool-image';
            img.src = `data:${rec.mime};base64,${bytesToBase64(rec.data)}`;
            filesEl.before(img);
        }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pz-file-btn';
        b.textContent = `⬇ ${p}`;
        b.addEventListener('click', () => downloadRecord(rec));
        filesEl.appendChild(b);
    }

    btn.disabled = false;
    btn.textContent = '⏹ Fermer';
    btn.classList.add('running');
}

function runInIframe(btn, container, code, lang) {
    container.innerHTML = '';
    container.style.display = 'block';
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-modals');
    iframe.srcdoc = (lang === 'js' || lang === 'javascript')
        ? jsConsoleDocument(code)
        : lang === 'css' ? `<style>${code}</style><p style="font-family:sans-serif">Aperçu CSS appliqué.</p>` : code;
    container.appendChild(iframe);
    btn.classList.add('running');
    btn.textContent = '⏹ Fermer';
}

export function initCodeRunner() {
    document.getElementById('messages').addEventListener('click', async (e) => {
        const copy = e.target.closest('.pz-copy-code');
        if (copy) {
            try {
                await navigator.clipboard.writeText(decodeURIComponent(copy.dataset.code));
                copy.innerHTML = ICONS.check + 'Copié';
                setTimeout(() => { copy.innerHTML = ICONS.copy + 'Copier'; }, 1500);
            } catch { /* presse-papiers refusé */ }
            return;
        }

        const btn = e.target.closest('.run-btn');
        if (!btn) return;
        const container = document.getElementById(btn.dataset.runid);
        if (!container) return;
        if (btn.classList.contains('running')) {
            container.innerHTML = '';
            container.style.display = 'none';
            btn.classList.remove('running');
            btn.textContent = '▶ Exécuter';
            return;
        }
        const code = decodeURIComponent(btn.dataset.code);
        const lang = btn.dataset.lang;
        if (lang === 'py' || lang === 'python') runPythonBlock(btn, container, code);
        else runInIframe(btn, container, code, lang);
    });
}
