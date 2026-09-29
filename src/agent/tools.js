// ============================================================
//  PENSÉE IA — src/agent/tools.js
//  Outils exécutés dans le navigateur. Les noms et schémas sont
//  déclarés au modèle côté serveur (api/_lib/tools.js).
//
//  Chaque outil reçoit (args, ctx) et renvoie :
//    { ok, summary, response }   response → renvoyé au modèle
//  ctx = { ws, card, terminal }
// ============================================================

import { vfs, isTextPath, extOf, downloadRecord } from '../sandbox/vfs.js';
import { runPython } from '../sandbox/python.js';
import { buildPreviewDocument, mountPreview, bytesToBase64 } from '../sandbox/preview.js';
import { generateOfficeFile, generatePdf, generateImage, deliverWorkspaceFile, presentStoredFile } from '../generators.js';
import { execCommand, portUrl, publishFromMachine } from '../sandbox/machine.js';
import { escapeHtml } from '../ui/dom.js';

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

/** Tête + queue : le modèle voit le début et la fin d'une sortie longue. */
function clip(text, max = 10000) {
    const s = String(text || '');
    if (s.length <= max) return s;
    const head = Math.floor(max * 0.6);
    return `${s.slice(0, head)}\n… [${s.length - max} caractères omis] …\n${s.slice(-(max - head))}`;
}

const lineCount = (s) => (s ? s.split('\n').length : 0);

async function showWorkspaceImages(ws, paths, card) {
    for (const p of paths) {
        if (!IMAGE_EXT.has(extOf(p))) continue;
        const rec = await vfs.read(ws, p);
        if (!rec) continue;
        const bytes = typeof rec.data === 'string' ? new TextEncoder().encode(rec.data) : rec.data;
        const img = document.createElement('img');
        img.className = 'pz-tool-image';
        img.alt = p;
        img.src = `data:${rec.mime};base64,${bytesToBase64(bytes)}`;
        card.addOutput(img);
    }
}

function fileButtons(ws, paths, card) {
    if (!paths.length) return;
    const row = document.createElement('div');
    row.className = 'pz-file-row';
    for (const p of paths) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pz-file-btn';
        b.textContent = `⬇ ${p}`;
        b.addEventListener('click', async () => {
            const rec = await vfs.read(ws, p);
            if (rec) downloadRecord(rec);
        });
        row.appendChild(b);
    }
    card.addOutput(row);
}

function diffHtml(oldStr, newStr) {
    const del = oldStr.split('\n').map(l => `<span class="pz-diff-del">- ${escapeHtml(l)}</span>`).join('\n');
    const add = newStr.split('\n').map(l => `<span class="pz-diff-add">+ ${escapeHtml(l)}</span>`).join('\n');
    return `<pre class="pz-diff">${del}\n${add}</pre>`;
}

export const CLIENT_TOOLS = {
    async bash({ command = '', timeout_s, background = false }, { ws, card, terminal }) {
        card.setCode(command, 'bash');
        card.open(true);
        terminal.log(background ? `${command} &` : command, 'cmd');
        const r = await execCommand(command, {
            ws, timeoutS: timeout_s, background,
            onOutput: (s, stream) => { card.appendLog(s, stream); terminal.log(s, stream); },
            onStatus: (v) => { card.setDetail(v); terminal.log(v, 'info'); },
        });
        const status = r.timedOut ? `interrompu après ${Math.round(r.ms / 1000)}s`
            : r.background ? 'en arrière-plan'
            : `code ${r.exitCode} · ${(r.ms / 1000).toFixed(1)}s`;
        card.setDetail(status);
        if (r.changed.length) terminal.log(`✓ /workspace : ${r.changed.length} fichier(s) mis à jour`, 'ok');
        await showWorkspaceImages(ws, r.changed, card);
        const ok = r.background || (!r.timedOut && r.exitCode === 0);
        return {
            ok,
            summary: status,
            response: {
                exit_code: r.exitCode,
                timed_out: r.timedOut,
                background: r.background,
                output: clip(r.output, 14000),
                files_changed: r.changed.slice(0, 100),
                ...(r.skippedPull.length ? {
                    files_on_machine_only: r.skippedPull.slice(0, 50),
                    note_large_files: "Ces fichiers (> 512 Ko) existent bien sur la machine mais ne sont pas copiés dans /workspace. Pour les livrer à l'utilisateur, appelle present_files avec leur chemin (jusqu'à 50 Mo).",
                } : {}),
                ...(r.skippedPush.length ? { files_not_uploaded: r.skippedPush } : {}),
            },
        };
    },

    async present_files({ paths = [] }, { ws, card, terminal }) {
        const delivered = [];
        const errors = [];
        for (const raw of paths.slice(0, 10)) {
            const path = String(raw).replace(/^\/+/, '').replace(/^workspace\//, '');
            try {
                const rec = await vfs.read(ws, path).catch(() => null);
                // Petit fichier déjà dans /workspace : livré depuis le navigateur ; sinon publié depuis la machine
                const res = rec && rec.size <= 3 * 1024 * 1024
                    ? await deliverWorkspaceFile(rec)
                    : await presentStoredFile({ ...(await publishFromMachine(ws, path)), path });
                card.addOutput(res.element);
                delivered.push(path);
                terminal.log(`livré dans la conversation : ${path}`, 'ok');
            } catch (e) {
                errors.push(`${path} : ${e.message}`);
            }
        }
        return {
            ok: delivered.length > 0 && !errors.length,
            summary: `${delivered.length} fichier(s)`,
            response: { delivered, ...(errors.length ? { errors } : {}), note: delivered.length ? 'Fichiers proposés au téléchargement dans la conversation.' : undefined },
        };
    },

    async open_port({ port, title }, { ws, card, terminal }) {
        const url = await portUrl(ws, Number(port));
        const holder = document.createElement('div');
        card.addOutput(holder);
        const frame = document.createElement('div');
        frame.className = 'pz-preview';
        frame.innerHTML = `<div class="pz-preview-bar"><span class="pz-preview-dots"><i></i><i></i><i></i></span>
            <a class="pz-preview-title" target="_blank" rel="noopener"></a>
            <button type="button" class="pz-icon-btn" data-act="reload" title="Recharger">↻</button>
            <button type="button" class="pz-icon-btn" data-act="expand" title="Agrandir">⤢</button></div>`;
        const link = frame.querySelector('a');
        link.href = url;
        link.textContent = title ? `${title} · ${url}` : url;
        const iframe = document.createElement('iframe');
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups');
        iframe.src = url;
        frame.appendChild(iframe);
        frame.querySelector('[data-act="reload"]').addEventListener('click', () => { iframe.src = url; });
        frame.querySelector('[data-act="expand"]').addEventListener('click', () => {
            frame.classList.toggle('pz-preview-full');
            document.body.classList.toggle('pz-noscroll', frame.classList.contains('pz-preview-full'));
        });
        holder.appendChild(frame);
        terminal.log(`port ${port} → ${url}`, 'ok');
        return { ok: true, summary: url.replace(/^https?:\/\//, ''), response: { ok: true, url, note: "Aperçu affiché à l'utilisateur." } };
    },

    async run_python({ code = '' }, { ws, card, terminal }) {
        card.setCode(code, 'python');
        card.open(true);
        terminal.log(`python  # ${lineCount(code)} ligne(s)`, 'cmd');
        const r = await runPython(code, {
            ws,
            onOutput: (s, stream) => { card.appendLog(s, stream); terminal.log(s, stream); },
            onStatus: (st, detail) => {
                card.setDetail({ loading: 'chargement de Python…', installing: detail || 'installation…', running: 'exécution…' }[st] || '');
                if (st === 'loading') terminal.log('Chargement de Python (première exécution)…', 'info');
            },
        });
        if (r.result) card.appendLog(r.result + '\n');
        if (r.error) { card.appendLog(r.error + '\n', 'stderr'); terminal.log(r.error + '\n', 'stderr'); }
        if (r.changed.length) terminal.log(`✓ ${r.changed.join(', ')}`, 'ok');
        await showWorkspaceImages(ws, r.changed, card);
        fileButtons(ws, r.changed.filter(p => !IMAGE_EXT.has(extOf(p))), card);

        return {
            ok: !r.error,
            summary: r.error ? 'erreur' : r.changed.length ? `${r.changed.length} fichier(s)` : 'terminé',
            response: {
                stdout: clip(r.stdout),
                stderr: clip(r.stderr, 4000),
                result: r.result ? clip(r.result, 2000) : null,
                error: r.error,
                files_changed: r.changed,
                files_deleted: r.deleted,
            },
        };
    },

    async write_file({ path, content = '' }, { ws, card, terminal }) {
        const p = await vfs.write(ws, path, String(content));
        card.setCode(String(content), extOf(p));
        terminal.log(`écriture ${p} (${lineCount(content)} lignes)`, 'info');
        return { ok: true, summary: `${lineCount(content)} lignes`, response: { ok: true, path: p, lines: lineCount(content) } };
    },

    async read_file({ path, offset = 1, limit = 400 }, { ws }) {
        const rec = await vfs.read(ws, path);
        if (!rec) return { ok: false, summary: 'introuvable', response: { error: `Fichier introuvable : ${path}. Utilise list_files.` } };
        if (typeof rec.data !== 'string' && !isTextPath(rec.path)) {
            return { ok: false, summary: 'binaire', response: { error: `${rec.path} est un fichier binaire (${rec.size} octets). Analyse-le avec run_python.` } };
        }
        const text = typeof rec.data === 'string' ? rec.data : new TextDecoder().decode(rec.data);
        const lines = text.split('\n');
        const from = Math.max(1, Number(offset) || 1);
        const to = Math.min(lines.length, from + Math.max(1, Number(limit) || 400) - 1);
        const numbered = lines.slice(from - 1, to).map((l, i) => `${String(from + i).padStart(5)}\t${l}`).join('\n');
        return {
            ok: true,
            summary: `lignes ${from}-${to} / ${lines.length}`,
            response: { path: rec.path, total_lines: lines.length, from, to, content: clip(numbered, 40000) },
        };
    },

    async edit_file({ path, old_string = '', new_string = '', replace_all = false }, { ws, card, terminal }) {
        const text = await vfs.readText(ws, path);
        if (text === null) return { ok: false, summary: 'introuvable', response: { error: `Fichier introuvable : ${path}` } };
        if (!old_string) return { ok: false, summary: 'old_string vide', response: { error: 'old_string ne peut pas être vide.' } };
        const count = text.split(old_string).length - 1;
        if (count === 0) {
            return { ok: false, summary: 'passage introuvable', response: { error: "old_string introuvable dans le fichier. Relis le fichier avec read_file et copie le passage exact (indentation comprise)." } };
        }
        if (count > 1 && !replace_all) {
            return { ok: false, summary: `${count} occurrences`, response: { error: `old_string apparaît ${count} fois. Ajoute du contexte pour le rendre unique, ou passe replace_all=true.` } };
        }
        const updated = replace_all ? text.split(old_string).join(new_string) : text.replace(old_string, () => new_string);
        const p = await vfs.write(ws, path, updated);
        card.setHtml(diffHtml(old_string, new_string));
        terminal.log(`modification ${p} (${count} remplacement(s))`, 'info');
        return { ok: true, summary: `${count} remplacement(s)`, response: { ok: true, path: p, replacements: count } };
    },

    async list_files(_args, { ws }) {
        const files = await vfs.list(ws);
        return {
            ok: true,
            summary: `${files.length} fichier(s)`,
            response: { root: '/workspace', files: files.map(f => ({ path: f.path, size: f.size })) },
        };
    },

    async render_preview({ path, title }, { ws, card, terminal }) {
        const doc = await buildPreviewDocument(ws, path);
        const holder = document.createElement('div');
        card.addOutput(holder);
        mountPreview(holder, doc, { title: title || path, onReload: () => buildPreviewDocument(ws, path) });
        terminal.log(`aperçu ${path}`, 'info');
        return { ok: true, summary: 'affiché', response: { ok: true, shown: path, note: "L'aperçu est affiché à l'utilisateur." } };
    },

    async generate_file(args, { card, terminal }) {
        const res = await generateOfficeFile(args);
        card.addOutput(res.element);
        terminal.log(`fichier généré ${res.filename}`, 'ok');
        return { ok: true, summary: res.filename, response: { ok: true, filename: res.filename, bytes: res.size, note: 'Fichier proposé au téléchargement et copié dans /workspace.' } };
    },

    async generate_pdf(args, { card, terminal }) {
        const res = await generatePdf(args);
        card.addOutput(res.element);
        terminal.log(`PDF généré ${res.filename}`, 'ok');
        return { ok: true, summary: res.filename, response: { ok: true, filename: res.filename, note: 'PDF proposé au téléchargement.' } };
    },

    async generate_image({ prompt = '' }, { card }) {
        const res = await generateImage(prompt);
        card.addOutput(res.element);
        return { ok: true, summary: 'image prête', response: { ok: true, note: "Image affichée à l'utilisateur." } };
    },
};

/** Outils dont le résultat n'a pas besoin d'être relu par le modèle (économise un appel). */
export const FINAL_TOOLS = new Set(['render_preview', 'open_port', 'present_files', 'generate_file', 'generate_pdf', 'generate_image']);

export async function executeClientTool(name, args, ctx) {
    const tool = CLIENT_TOOLS[name];
    if (!tool) return { ok: false, summary: 'inconnu', response: { error: `Outil inconnu : ${name}` } };
    try {
        return await tool(args || {}, ctx);
    } catch (e) {
        return { ok: false, summary: 'erreur', response: { error: e.message || String(e) } };
    }
}
