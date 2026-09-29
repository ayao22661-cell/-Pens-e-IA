// ============================================================
//  PENSÉE IA — src/sandbox/machine.js
//  Client de la machine Linux (api/sandbox.js).
//  Synchronisation de /workspace dans les deux sens :
//   - avant chaque commande : fichiers modifiés depuis la dernière synchro → machine
//   - après : fichiers créés/modifiés par la commande → /workspace (IndexedDB)
// ============================================================

import { getAccessToken } from '../supabase.js';
import { vfs, isTextPath } from './vfs.js';
import { bytesToBase64 } from './preview.js';

const MAX_UPLOAD_B64 = 3 * 1024 * 1024; // corps de requête Vercel ≈ 4,5 Mo
const syncKey = (ws) => `pz_sync_${ws}`;

function getLastSync(ws) {
    try { return Number(localStorage.getItem(syncKey(ws))) || 0; } catch { return 0; }
}
function setLastSync(ws, t) {
    try { localStorage.setItem(syncKey(ws), String(t)); } catch { /* stockage indisponible */ }
}

async function collectUploads(ws, full) {
    const since = full ? 0 : getLastSync(ws);
    const records = await vfs.snapshot(ws);
    const uploads = [];
    const skipped = [];
    let total = 0;
    for (const r of records) {
        if (r.updatedAt <= since) continue;
        const bytes = typeof r.data === 'string' ? new TextEncoder().encode(r.data) : r.data;
        const b64 = bytesToBase64(bytes);
        if (total + b64.length > MAX_UPLOAD_B64) { skipped.push(r.path); continue; }
        total += b64.length;
        uploads.push({ path: r.path, b64 });
    }
    return { uploads, skipped };
}

async function post(body, signal) {
    const token = await getAccessToken();
    return fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
        signal,
    });
}

async function readNdjson(res, onEvent) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const flush = (line) => {
        if (!line.trim()) return;
        try { onEvent(JSON.parse(line)); } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
    };
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
            flush(buf.slice(0, nl));
            buf = buf.slice(nl + 1);
        }
    }
    flush(buf);
}

const b64ToBytes = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

/**
 * Exécute une commande sur la machine Linux de la conversation.
 * @returns {Promise<{output: string, exitCode: number|null, timedOut: boolean, background: boolean,
 *                    changed: string[], skippedPull: string[], skippedPush: string[], ms: number}>}
 */
export async function execCommand(command, { ws, timeoutS, background = false, onOutput = () => {}, onStatus = () => {}, signal } = {}) {
    let fullSync = getLastSync(ws) === 0;

    for (let attempt = 0; attempt < 2; attempt++) {
        const { uploads, skipped: skippedPush } = await collectUploads(ws, fullSync);
        const res = await post({ action: 'exec', ws, command, timeoutS, background, uploads, fullSync }, signal);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Machine indisponible (HTTP ${res.status})`);
        }

        let output = '';
        let result = null;
        let needSync = false;
        const changed = [];
        let skippedPull = [];

        await readNdjson(res, (ev) => {
            if (ev.t === 'status') onStatus(ev.v);
            else if (ev.t === 'need_sync') needSync = true;
            else if (ev.t === 'out') { output += ev.s; onOutput(ev.s, ev.stream); }
            else if (ev.t === 'exit') result = ev;
            else if (ev.t === 'files') {
                skippedPull = ev.skipped || [];
                for (const f of ev.files || []) changed.push(f);
            } else if (ev.t === 'error') throw new Error(ev.v);
        });

        if (needSync) { fullSync = true; onStatus('Machine neuve : envoi de /workspace…'); continue; }
        if (!result) throw new Error('Connexion à la machine interrompue.');

        // Rapatriement des fichiers modifiés par la commande
        const paths = [];
        for (const f of changed) {
            try {
                const bytes = b64ToBytes(f.b64);
                await vfs.write(ws, f.path, isTextPath(f.path) ? new TextDecoder().decode(bytes) : bytes, { silent: true });
                paths.push(f.path);
            } catch (e) {
                console.warn('[machine] fichier non rapatrié :', f.path, e.message);
            }
        }
        setLastSync(ws, Date.now());
        if (paths.length) vfs.notify(ws);

        return {
            output, exitCode: result.code, timedOut: result.timedOut, background: result.background,
            changed: paths, skippedPull, skippedPush, ms: result.ms,
        };
    }
    throw new Error('Synchronisation impossible avec la machine.');
}

export async function portUrl(ws, port) {
    const res = await post({ action: 'url', ws, port });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.url;
}

export async function resetMachine(ws) {
    await post({ action: 'reset', ws });
    setLastSync(ws, 0);
}
