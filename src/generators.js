// ============================================================
//  PENSÉE IA — src/generators.js
//  Livrables : xlsx / pptx / docx / csv (navigateur), PDF (serveur),
//  images (/api/image). Persistance Supabase Storage 30 jours
//  + copie dans /workspace.
// ============================================================

import { state, workspaceId } from './state.js';
import { supabase, getAccessToken } from './supabase.js';
import { saveMessage } from './conversations.js';
import { vfs, MIME } from './sandbox/vfs.js';
import { escapeHtml } from './ui/dom.js';
import { ICONS } from './ui/icons.js';
import { setQuota } from './credits.js';

const LIBS = {
    xlsx: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
    pptx: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    docx: 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.js',
};

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Chargement impossible : ' + src));
        document.head.appendChild(s);
    });
}

const base64ToBytes = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const numeric = (v) => (typeof v === 'string' && /^-?\d+(?:[.,]\d+)?$/.test(v.trim()) ? Number(v.replace(',', '.')) : v);

function safeFilename(name, ext) {
    const base = String(name || `fichier.${ext}`).replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    return base.toLowerCase().endsWith('.' + ext) ? base : `${base}.${ext}`;
}

// ── Construction des fichiers bureautiques ──────────────────
async function buildOffice(spec) {
    const type = String(spec.type || '').toLowerCase();
    if (type === 'csv') {
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [(spec.headers || []).map(esc).join(','), ...(spec.rows || []).map(r => r.map(esc).join(','))];
        return new Blob(['﻿' + lines.join('\n')], { type: MIME.csv });
    }
    if (type === 'xlsx') {
        await loadScript(LIBS.xlsx);
        const wb = XLSX.utils.book_new();
        for (const sheet of spec.sheets || []) {
            const rows = (sheet.rows || []).map(r => r.map(numeric));
            const ws = XLSX.utils.aoa_to_sheet([sheet.headers || [], ...rows]);
            ws['!cols'] = (sheet.headers || []).map((h, ci) => ({
                wch: Math.min(Math.max(String(h).length, ...rows.map(r => String(r[ci] ?? '').length)) + 4, 40),
            }));
            XLSX.utils.book_append_sheet(wb, ws, String(sheet.name || `Feuille${wb.SheetNames.length + 1}`).slice(0, 31));
        }
        if (!wb.SheetNames.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Feuille1');
        return new Blob([base64ToBytes(XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }))], { type: MIME.xlsx });
    }
    if (type === 'pptx') {
        await loadScript(LIBS.pptx);
        const prs = new PptxGenJS();
        for (const slide of spec.slides || []) {
            const s = prs.addSlide();
            s.background = { color: 'FFFFFF' };
            s.addText(slide.title || '', { x: 0.5, y: 0.3, w: '90%', h: 1.0, fontSize: 28, bold: true, color: '1A7A5E', fontFace: 'Calibri' });
            if (slide.content) {
                s.addText(slide.content, { x: 0.5, y: 1.5, w: '90%', h: '70%', fontSize: 16, color: '333333', fontFace: 'Calibri', valign: 'top' });
            }
        }
        return new Blob([base64ToBytes(await prs.write({ outputType: 'base64' }))], { type: MIME.pptx });
    }
    if (type === 'docx') {
        await loadScript(LIBS.docx);
        const { Document, Paragraph, TextRun, HeadingLevel, Packer } = window.docx;
        const levels = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };
        const children = [];
        for (const sec of spec.sections || []) {
            if (sec.heading) children.push(new Paragraph({ text: sec.heading, heading: levels[sec.level] || HeadingLevel.HEADING_1 }));
            for (const para of String(sec.text || '').split(/\n{2,}/)) {
                children.push(new Paragraph({ children: [new TextRun({ text: para, size: 24 })], spacing: { after: 200 } }));
            }
        }
        const doc = new Document({ sections: [{ children }] });
        return new Blob([base64ToBytes(await Packer.toBase64String(doc))], { type: MIME.docx });
    }
    throw new Error(`Format non supporté : ${type}`);
}

// ── Persistance ──────────────────────────────────────────────
async function persist(blob, folder, filename, tabId) {
    const userId = state.currentUser?.id || 'anon';
    const path = `${folder}/${userId}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { error } = await supabase.storage.from('attachments').upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    const { data } = await supabase.storage.from('attachments').createSignedUrl(path, 60 * 60 * 24 * 30);
    if (!data?.signedUrl) throw new Error('URL signée indisponible');
    await saveMessage('assistant', `[FILE_URL:${data.signedUrl}|${filename}|${path}]`, tabId);
    return data.signedUrl;
}

/**
 * Produit le fichier, le copie dans /workspace, l'archive, et renvoie une puce de téléchargement.
 * @returns {Promise<{filename: string, size: number, persisted: boolean, element: HTMLElement}>}
 */
async function deliver(blob, filename, folder, stored = null, { copyToWorkspace = true } = {}) {
    const tabId = state.activeTabId;
    const ws = workspaceId();
    if (copyToWorkspace) await vfs.write(ws, filename, new Uint8Array(await blob.arrayBuffer())).catch(() => {});

    let url = URL.createObjectURL(blob);
    let persisted = false;
    try {
        if (stored) {
            // Déjà archivé côté serveur (PDF) : on enregistre seulement la référence
            await saveMessage('assistant', `[FILE_URL:${stored.url}|${filename}|${stored.path}]`, tabId);
            url = stored.url;
        } else {
            url = await persist(blob, folder, filename, tabId);
        }
        persisted = true;
    } catch (e) {
        console.warn('[Fichier] Archivage Supabase échoué, lien local :', e.message);
    }

    const el = document.createElement('div');
    el.className = 'pz-deliverable';
    el.innerHTML = `<a href="${escapeHtml(url)}" ${persisted ? 'target="_blank" rel="noopener"' : `download="${escapeHtml(filename)}"`} class="file-chip pz-file-chip">${ICONS.file} ${escapeHtml(filename)} ${ICONS.download}</a>`
        + (persisted ? '<div class="pz-file-note">Disponible pendant 30 jours · copié dans /workspace</div>' : '<div class="pz-file-note">Copié dans /workspace</div>');
    return { filename, size: blob.size, persisted, element: el };
}

const fmtSize = (n) => n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(1)} Ko` : `${(n / 1048576).toFixed(1)} Mo`;

/** Livre dans la conversation un fichier déjà présent dans /workspace. */
export async function deliverWorkspaceFile(rec) {
    const filename = rec.path.split('/').pop();
    const blob = new Blob([rec.data], { type: rec.mime || 'application/octet-stream' });
    const res = await deliver(blob, filename, 'fichiers', null, { copyToWorkspace: false });
    res.element.querySelector('.pz-file-note').textContent = `${fmtSize(blob.size)} · /workspace/${rec.path}` + (res.persisted ? ' · disponible 30 jours' : '');
    return res;
}

/** Livre un fichier déjà archivé côté serveur (publié depuis la machine Linux). */
export async function presentStoredFile({ url, filename, storagePath, size, path }) {
    await saveMessage('assistant', `[FILE_URL:${url}|${filename}|${storagePath}]`);
    const el = document.createElement('div');
    el.className = 'pz-deliverable';
    el.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="file-chip pz-file-chip">${ICONS.file} ${escapeHtml(filename)} ${ICONS.download}</a>`
        + `<div class="pz-file-note">${fmtSize(size || 0)} · ${escapeHtml(path || filename)} · disponible 30 jours</div>`;
    return { filename, size, persisted: true, element: el };
}

// ── Présentations et documents mis en page (src/docs/) ───────
const DOC_LIBS = {
    pdfmake: 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.20/build/pdfmake.min.js',
    pdfFonts: 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.20/build/vfs_fonts.js',
};

/** Présentation .pptx (graphiques et tableaux natifs) + aperçu HTML des slides. */
export async function createPresentation(spec) {
    const [{ buildPptx }, { slidesHtml }, { lintDeck }] = await Promise.all([
        import('./docs/slides-pptx.js'), import('./docs/slides-html.js'), import('./docs/lint.js'),
    ]);
    await loadScript(LIBS.pptx);
    const raw = await buildPptx(window.PptxGenJS, spec, 'blob');
    const blob = new Blob([raw], { type: MIME.pptx }); // PptxGenJS renvoie application/zip
    const res = await deliver(blob, safeFilename(spec.filename || spec.title || 'presentation', 'pptx'), 'fichiers');
    return { ...res, previews: slidesHtml(spec), warnings: lintDeck(spec), slides: (spec.slides || []).length };
}

/** Document PDF mis en page (pdfmake) + URL locale pour l'aperçu. */
export async function createDocument(spec) {
    const [{ buildPdfDefinition }, { lintDocument }] = await Promise.all([import('./docs/pdf-doc.js'), import('./docs/lint.js')]);
    await loadScript(DOC_LIBS.pdfmake);
    await loadScript(DOC_LIBS.pdfFonts);
    const blob = await new Promise((resolve) => window.pdfMake.createPdf(buildPdfDefinition(spec)).getBlob(resolve));
    const res = await deliver(blob, safeFilename(spec.filename || spec.title || 'document', 'pdf'), 'generated_pdfs');
    return { ...res, previewUrl: URL.createObjectURL(blob), warnings: lintDocument(spec) };
}

export async function generateOfficeFile(spec) {
    const type = String(spec.type || '').toLowerCase();
    const blob = await buildOffice(spec);
    return deliver(blob, safeFilename(spec.filename, type), 'fichiers');
}

export async function generatePdf({ title, html }) {
    const token = await getAccessToken();
    const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, htmlContent: html, userId: state.currentUser?.id || 'anon' }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur PDF (${res.status})`);
    }
    // Deux formes de réponse : { mode:'base64', data } ou { mode:'supabase', url, filePath }
    const data = await res.json();
    const filename = safeFilename(String(title || 'document').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'document', 'pdf');
    if (data.mode === 'supabase' && data.url) {
        const blob = await fetch(data.url).then(r => r.blob()).catch(() => new Blob([], { type: 'application/pdf' }));
        return deliver(blob, filename, 'generated_pdfs', { url: data.url, path: data.filePath });
    }
    const blob = new Blob([base64ToBytes(String(data.data).split(',')[1])], { type: 'application/pdf' });
    return deliver(blob, filename, 'generated_pdfs');
}

/**
 * Génère une image via /api/image.
 * @returns {Promise<{element: HTMLElement, url: string}>}
 */
export async function generateImage(prompt) {
    const tabId = state.activeTabId;
    const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getAccessToken()}` },
        body: JSON.stringify({ prompt }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.quota) setQuota(data.quota);
    if (!res.ok) throw new Error(data.error || 'Génération échouée');

    let url = data.image || data.layers?.[2]?.url || data.url;
    let storagePath = '';
    if (data.type === 'base64') {
        const blob = new Blob([base64ToBytes(data.data)], { type: data.mimeType });
        url = URL.createObjectURL(blob);
        const ext = (data.mimeType || 'image/png').split('/')[1] || 'png';
        storagePath = `images/${state.currentUser?.id || 'anon'}/${Date.now()}.${ext}`;
        vfs.write(workspaceId(), `image_${Date.now()}.${ext}`, new Uint8Array(await blob.arrayBuffer())).catch(() => {});
        try {
            const { error } = await supabase.storage.from('attachments').upload(storagePath, blob, { contentType: data.mimeType });
            if (error) throw error;
            const { data: signed } = await supabase.storage.from('attachments').createSignedUrl(storagePath, 60 * 60 * 24 * 365);
            if (signed?.signedUrl) url = signed.signedUrl;
        } catch (e) {
            console.warn('Upload image échoué :', e.message);
            storagePath = '';
        }
    }
    await saveMessage('assistant', `[IMAGE_URL:${url}|${escapeHtml(prompt)}|${storagePath}]`, tabId);

    const el = document.createElement('div');
    el.className = 'pz-deliverable';
    el.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(prompt)}" class="pz-gen-image" loading="lazy">`
        + `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="pz-dl-link">${ICONS.download} Télécharger</a>`;
    el.querySelector('img').addEventListener('error', function () {
        this.replaceWith(Object.assign(document.createElement('em'), { className: 'pz-error', textContent: 'Image indisponible. Réessaie.' }));
    });
    return { element: el, url };
}
