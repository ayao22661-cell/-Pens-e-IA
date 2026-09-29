// ============================================================
//  PENSÉE IA — src/sandbox/vfs.js
//  Système de fichiers virtuel /workspace, un par conversation,
//  persisté dans IndexedDB (survit au rechargement de la page).
// ============================================================

const DB_NAME = 'pensee-workspace';
const STORE = 'files';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_WORKSPACE_BYTES = 40 * 1024 * 1024;

let _dbPromise = null;

function db() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const store = req.result.createObjectStore(STORE, { keyPath: ['ws', 'path'] });
            store.createIndex('ws', 'ws');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return _dbPromise;
}

function tx(mode, fn) {
    return db().then(d => new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const result = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(result?.result ?? result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
    }));
}

/** "/workspace/./a/b.txt" → "a/b.txt". Refuse les chemins qui sortent du workspace. */
export function normalizePath(p) {
    const parts = [];
    for (const seg of String(p || '').replace(/\\/g, '/').replace(/^\/?workspace\/?/, '').split('/')) {
        if (!seg || seg === '.') continue;
        if (seg === '..') throw new Error(`Chemin hors de /workspace : ${p}`);
        parts.push(seg);
    }
    if (!parts.length) throw new Error('Chemin de fichier vide.');
    return parts.join('/');
}

const TEXT_EXT = new Set(['txt', 'md', 'csv', 'tsv', 'json', 'js', 'mjs', 'ts', 'jsx', 'tsx', 'html', 'htm', 'css',
    'scss', 'py', 'sql', 'xml', 'yaml', 'yml', 'svg', 'sh', 'env', 'ini', 'toml', 'java', 'kt', 'c', 'cpp', 'h',
    'cs', 'go', 'rs', 'rb', 'php', 'dart', 'lua', 'r', 'vue', 'svelte', 'log']);

export const MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    pdf: 'application/pdf', csv: 'text/csv', txt: 'text/plain', json: 'application/json', xml: 'application/xml',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm',
    html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', md: 'text/markdown', py: 'text/x-python',
};

export const extOf = (path) => (path.split('.').pop() || '').toLowerCase();
export const isTextPath = (path) => TEXT_EXT.has(extOf(path));
export const mimeOf = (path) => MIME[extOf(path)] || (isTextPath(path) ? 'text/plain' : 'application/octet-stream');

const sizeOf = (data) => typeof data === 'string' ? new Blob([data]).size : data.byteLength;

function notify(ws) {
    window.dispatchEvent(new CustomEvent('pensee:vfs', { detail: { ws } }));
}

export const vfs = {
    async list(ws) {
        const rows = await tx('readonly', s => s.index('ws').getAll(ws));
        return rows
            .map(r => ({ path: r.path, size: r.size, mime: r.mime, updatedAt: r.updatedAt, binary: typeof r.data !== 'string' }))
            .sort((a, b) => a.path.localeCompare(b.path));
    },

    async read(ws, path) {
        const rec = await tx('readonly', s => s.get([ws, normalizePath(path)]));
        return rec || null;
    },

    async readText(ws, path) {
        const rec = await this.read(ws, path);
        if (!rec) return null;
        return typeof rec.data === 'string' ? rec.data : new TextDecoder().decode(rec.data);
    },

    /** @param {string|Uint8Array} data */
    async write(ws, path, data, { silent = false } = {}) {
        const p = normalizePath(path);
        if (data instanceof ArrayBuffer) data = new Uint8Array(data);
        const size = sizeOf(data);
        if (size > MAX_FILE_BYTES) throw new Error(`Fichier trop volumineux (${(size / 1048576).toFixed(1)} Mo, max 10 Mo).`);

        const existing = await this.list(ws);
        const total = existing.filter(f => f.path !== p).reduce((n, f) => n + f.size, 0) + size;
        if (total > MAX_WORKSPACE_BYTES) throw new Error('Espace de travail plein (40 Mo). Supprime des fichiers.');

        await tx('readwrite', s => s.put({ ws, path: p, data, size, mime: mimeOf(p), updatedAt: Date.now() }));
        if (!silent) notify(ws);
        return p;
    },

    async remove(ws, path) {
        await tx('readwrite', s => s.delete([ws, normalizePath(path)]));
        notify(ws);
    },

    async clear(ws) {
        const files = await this.list(ws);
        await tx('readwrite', s => files.forEach(f => s.delete([ws, f.path])));
        notify(ws);
    },

    /** Tous les fichiers (données comprises) — utilisé pour monter /workspace dans Python. */
    async snapshot(ws) {
        return tx('readonly', s => s.index('ws').getAll(ws));
    },

    notify,
};

export function downloadRecord(rec) {
    const blob = new Blob([rec.data], { type: rec.mime || mimeOf(rec.path) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = rec.path.split('/').pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
