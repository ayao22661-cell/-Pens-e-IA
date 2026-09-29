// ============================================================
//  PENSÉE IA — src/sandbox/python.js
//  Pont entre l'interface et le worker Pyodide.
//  - exécutions sérialisées (un seul interpréteur)
//  - délai max : le worker est terminé puis recréé au besoin
//  - /workspace synchronisé avec le système de fichiers virtuel
// ============================================================

import { vfs } from './vfs.js';

const RUN_TIMEOUT_MS = 90_000;     // après démarrage de l'exécution
const BOOT_TIMEOUT_MS = 120_000;   // premier chargement de Pyodide (réseau lent)

let worker = null;
let seq = 0;
let queue = Promise.resolve();

function getWorker() {
    if (!worker) worker = new Worker(new URL('./python.worker.js', import.meta.url));
    return worker;
}

function killWorker() {
    if (worker) worker.terminate();
    worker = null;
}

/**
 * Exécute du code Python dans /workspace.
 * @param {string} code
 * @param {object} o
 * @param {string} o.ws                 identifiant du workspace (conversation)
 * @param {(chunk: string, stream: 'stdout'|'stderr') => void} [o.onOutput]
 * @param {(status: string, detail?: string) => void} [o.onStatus]
 * @returns {Promise<{stdout: string, stderr: string, error: string|null, result: string|null,
 *                    changed: string[], deleted: string[], timedOut: boolean}>}
 */
export function runPython(code, { ws, onOutput, onStatus } = {}) {
    const job = queue.then(() => execute(code, { ws, onOutput, onStatus }));
    queue = job.catch(() => {});
    return job;
}

async function execute(code, { ws, onOutput = () => {}, onStatus = () => {} }) {
    const files = await vfs.snapshot(ws);
    const id = ++seq;
    const w = getWorker();
    let stdout = '';
    let stderr = '';

    const outcome = await new Promise((resolve) => {
        let timer = setTimeout(() => finish({ timedOut: true, phase: 'boot' }), BOOT_TIMEOUT_MS);

        function finish(res) {
            clearTimeout(timer);
            w.removeEventListener('message', onMsg);
            w.removeEventListener('error', onErr);
            resolve(res);
        }
        function onErr(e) {
            finish({ error: `Le worker Python a planté : ${e.message || 'erreur inconnue'}`, changed: [], deleted: [] });
        }
        function onMsg({ data }) {
            if (data.id !== id) return;
            if (data.type === 'stdout' || data.type === 'stderr') {
                if (data.type === 'stdout') stdout += data.data; else stderr += data.data;
                onOutput(data.data, data.type);
            } else if (data.type === 'status') {
                onStatus(data.status, data.detail);
                if (data.status === 'running') {
                    clearTimeout(timer);
                    timer = setTimeout(() => finish({ timedOut: true, phase: 'run' }), RUN_TIMEOUT_MS);
                }
            } else if (data.type === 'done') {
                finish(data);
            }
        }
        w.addEventListener('message', onMsg);
        w.addEventListener('error', onErr);
        w.postMessage({ id, code, files, ws });
    });

    if (outcome.timedOut) {
        killWorker(); // seul moyen fiable d'arrêter une boucle infinie
        const msg = outcome.phase === 'boot'
            ? "Chargement de Python trop long (connexion lente ?). Réessaie."
            : `Exécution interrompue après ${RUN_TIMEOUT_MS / 1000}s (boucle infinie ?). L'état Python a été réinitialisé.`;
        return { stdout, stderr, error: msg, result: null, changed: [], deleted: [], timedOut: true };
    }

    // Répercute les modifications de /workspace dans le système de fichiers virtuel
    const changedPaths = [];
    for (const f of outcome.changed || []) {
        try {
            await vfs.write(ws, f.path, f.data, { silent: true });
            changedPaths.push(f.path);
        } catch (e) {
            stderr += `⚠ ${f.path} non sauvegardé : ${e.message}\n`;
        }
    }
    for (const p of outcome.deleted || []) await vfs.remove(ws, p).catch(() => {});
    if (changedPaths.length) vfs.notify(ws);

    return {
        stdout, stderr,
        error: outcome.error || null,
        result: outcome.result ?? null,
        changed: changedPaths,
        deleted: outcome.deleted || [],
        timedOut: false,
    };
}
