// ============================================================
//  PENSÉE IA — src/files.js
//  Pièces jointes : lecture, aperçu, copie dans /workspace,
//  archivage Supabase Storage.
// ============================================================

import { CONFIG } from './config.js';
import { state } from './state.js';
import { supabase } from './supabase.js';
import { vfs, isTextPath } from './sandbox/vfs.js';
import { els, escapeHtml, addMessage } from './ui/dom.js';

const MAX_FILE_MB = 10;               // limite du workspace
const INLINE_MIME = /^(application\/pdf|image\/(png|jpeg|webp|heic|heif)|audio\/|video\/)/; // lisibles nativement par le modèle

export function getLang(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return CONFIG.langMap[ext] || ext.toUpperCase() || 'Fichier';
}

function readAs(file, method) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Impossible de lire ' + file.name));
        r[method](file);
    });
}

async function toAttachment(file) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${file.name} dépasse ${MAX_FILE_MB} Mo.`);
    const isText = isTextPath(file.name) || file.type.startsWith('text/');
    const att = { name: file.name, lang: getLang(file.name), blob: file, mime: file.type || 'application/octet-stream', kind: isText ? 'text' : 'binary' };

    if (isText) {
        att.text = await readAs(file, 'readAsText');
    } else if (INLINE_MIME.test(att.mime) && file.size <= CONFIG.maxFileSizeMB * 1024 * 1024) {
        att.base64 = String(await readAs(file, 'readAsDataURL')).split(',')[1];
    }
    return att;
}

export async function addFiles(fileList) {
    for (const file of fileList) {
        if (state.attachedFiles.some(f => f.name === file.name)) continue;
        try {
            state.attachedFiles.push(await toAttachment(file));
        } catch (err) {
            addMessage('bot', '⚠️ ' + err.message);
        }
    }
    renderUploadPreview();
}

export function clearAttachments() {
    state.attachedFiles = [];
    els.fileInput.value = '';
    renderUploadPreview();
}

export function renderUploadPreview() {
    const box = els.uploadPreview;
    box.innerHTML = '';
    box.classList.toggle('visible', state.attachedFiles.length > 0);
    state.attachedFiles.forEach((file, i) => {
        const chip = document.createElement('div');
        chip.className = 'attached-chip';
        chip.innerHTML = `<span>📄 ${escapeHtml(file.name)} <span style="color:var(--text3)">(${escapeHtml(file.lang)})</span></span><button title="Retirer">✕</button>`;
        chip.querySelector('button').addEventListener('click', () => {
            state.attachedFiles.splice(i, 1);
            renderUploadPreview();
        });
        box.appendChild(chip);
    });
    window.dispatchEvent(new Event('pensee:input'));
}

/** Copie les pièces jointes dans /workspace pour que les outils puissent les lire. */
export async function copyToWorkspace(files, ws) {
    const copied = [];
    for (const f of files) {
        try {
            const data = f.kind === 'text' ? f.text : new Uint8Array(await f.blob.arrayBuffer());
            copied.push(await vfs.write(ws, f.name, data));
        } catch (e) {
            console.warn('[workspace] copie impossible :', f.name, e.message);
        }
    }
    return copied;
}

/** Archive les pièces jointes dans Supabase Storage. @returns marqueurs [SECURE_FILE:nom](chemin) */
export async function uploadAttachments(files) {
    const links = [];
    const userId = state.currentUser?.id || 'anonyme';
    for (const f of files) {
        const safeName = f.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `uploads/${userId}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage.from('attachments').upload(path, f.blob);
        if (error) {
            addMessage('bot', `· Erreur upload (${f.name}) : ${error.message}`);
            continue;
        }
        links.push(`[SECURE_FILE:${f.name}](${path})`);
    }
    return links;
}

export function initFileInputs() {
    els.uploadBtn.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', () => { if (els.fileInput.files.length) addFiles(els.fileInput.files); });

    document.addEventListener('dragover', (e) => { e.preventDefault(); els.dropOverlay.classList.add('visible'); });
    document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) els.dropOverlay.classList.remove('visible'); });
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        els.dropOverlay.classList.remove('visible');
        if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    });
}
