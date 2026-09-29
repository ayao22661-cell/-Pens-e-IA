// ============================================================
//  PENSÉE IA — api/sandbox.js (Vercel Function · Node.js)
//
//  Vraie machine Linux pour l'agent (Vercel Sandbox, micro-VM
//  Firecracker) : Node, npm, git, python3, pip, réseau sortant.
//  Un sandbox par (utilisateur, conversation), nommé à partir de
//  l'identité AUTHENTIFIÉE : personne n'accède au sandbox d'un autre.
//
//  POST { action: 'exec', ws, command, timeoutS?, background?, uploads?, fullSync? }
//    → flux NDJSON :
//      {t:'status', v}            création / reprise / synchronisation
//      {t:'need_sync'}            sandbox neuf : renvoyer TOUS les fichiers (fullSync)
//      {t:'out', s, stream}       sortie en direct
//      {t:'exit', code, timedOut, background, ms}
//      {t:'files', files:[{path,b64}], skipped:[...]}   fichiers modifiés → /workspace
//      {t:'error', v}
//  POST { action: 'url', ws, port } → { url }
//  POST { action: 'reset', ws }     → { ok }
// ============================================================

import { Sandbox } from '@vercel/sandbox';
import { authenticate, isAuthEnabled, consumeCredit, refundCredit, HttpError } from './_lib/auth.js';

const ROOT = '/vercel/sandbox';                 // miroir de /workspace
export const PORTS = [3000, 5173, 8000, 8080];  // ports exposables (serveurs de dev)
const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_CMD_S = 120;
const MAX_CMD_S = 280;                          // < maxDuration (vercel.json : 300 s)
const BACKGROUND_WAIT_MS = 8000;
const MAX_STREAM_CHARS = 200_000;
const MAX_PULL_FILE = 512 * 1024;
const MAX_PULL_TOTAL = 3 * 1024 * 1024;
const EXCLUDES = ['node_modules', '.git', '__pycache__', '.next', '.cache', '.npm', '.venv', 'venv', '.pz_mark'];

const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function sandboxName(userId, ws) {
    const bytes = new TextEncoder().encode(`${userId || 'dev'}:${String(ws || 'local').slice(0, 100)}`);
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
    return `pz-${hash.slice(0, 24)}`;
}

/** Récupère le sandbox de la conversation, ou le crée (1 crédit). */
async function openSandbox(name, userId, onStatus) {
    try {
        const sb = await Sandbox.get({ name, resume: true });
        const dead = ['failed', 'aborted'].includes(sb.status)
            || (!sb.persistent && ['stopped', 'stopping'].includes(sb.status)); // non persistant : rien à reprendre
        if (!dead) return { sb, created: false };
        await sb.delete().catch(() => {});
    } catch (e) {
        if (e instanceof HttpError) throw e; // 404 attendu si le sandbox n'existe pas encore
    }

    await consumeCredit(userId); // créer une machine coûte un crédit ; l'utiliser ensuite est gratuit
    onStatus('Démarrage de la machine Linux…');
    const base = {
        name,
        runtime: 'node22',
        ports: PORTS,
        timeout: SANDBOX_TIMEOUT_MS,
        resources: { vcpus: 2 },
        tags: { app: 'pensee-ia' },
    };
    let sb;
    try {
        // Persistance : node_modules, builds… survivent entre deux sessions
        sb = await Sandbox.create({ ...base, persistent: true, keepLastSnapshots: { count: 1, deleteEvicted: true } });
    } catch (_) {
        try {
            sb = await Sandbox.create(base);
        } catch (e) {
            await refundCredit(userId);
            throw e;
        }
    }
    return { sb, created: true };
}

function shellQuote(s) {
    return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

async function pushFiles(sb, uploads) {
    const files = (uploads || [])
        .filter(f => f && typeof f.path === 'string' && !f.path.includes('..'))
        .map(f => ({ path: `${ROOT}/${f.path.replace(/^\/+/, '')}`, content: Buffer.from(String(f.b64 || ''), 'base64') }));
    if (!files.length) return 0;
    const dirs = [...new Set(files.map(f => f.path.slice(0, f.path.lastIndexOf('/'))))];
    await sb.runCommand({ cmd: 'mkdir', args: ['-p', ...dirs] });
    await sb.writeFiles(files);
    return files.length;
}

/** Fichiers créés/modifiés depuis le marqueur, rapatriés vers /workspace. */
async function pullChanged(sb) {
    const prune = EXCLUDES.map(d => `-name ${shellQuote(d)}`).join(' -o ');
    const list = await sb.runCommand({
        cmd: 'bash',
        args: ['-lc', `cd ${ROOT} && find . \\( ${prune} \\) -prune -o -type f -newer /tmp/.pz_mark -printf '%s %P\\n' | head -300`],
    });
    const lines = (await list.stdout()).split('\n').filter(Boolean);
    const files = [];
    const skipped = [];
    let total = 0;
    for (const line of lines) {
        const sp = line.indexOf(' ');
        const size = Number(line.slice(0, sp));
        const path = line.slice(sp + 1);
        if (size > MAX_PULL_FILE || total + size > MAX_PULL_TOTAL) { skipped.push(path); continue; }
        const buf = await sb.readFileToBuffer({ path: `${ROOT}/${path}` }).catch(() => null);
        if (!buf) continue;
        total += buf.length;
        files.push({ path, b64: Buffer.from(buf).toString('base64') });
    }
    return { files, skipped };
}

async function execStream({ userId, body, send }) {
    const name = await sandboxName(userId, body.ws);
    const { sb, created } = await openSandbox(name, userId, (v) => send({ t: 'status', v }));

    // Machine neuve mais le client n'a envoyé que ses derniers changements :
    // on lui demande l'intégralité de /workspace avant d'exécuter quoi que ce soit.
    if (created && !body.fullSync) {
        send({ t: 'need_sync' });
        return;
    }

    const pushed = await pushFiles(sb, body.uploads);
    if (pushed) send({ t: 'status', v: `${pushed} fichier(s) synchronisé(s)` });
    Promise.resolve().then(() => sb.extendTimeout(10 * 60 * 1000)).catch(() => {});

    await sb.runCommand({ cmd: 'bash', args: ['-lc', 'touch /tmp/.pz_mark && sleep 0.01'] });

    const background = Boolean(body.background);
    const limitMs = background ? BACKGROUND_WAIT_MS : Math.min(Math.max(Number(body.timeoutS) || DEFAULT_CMD_S, 5), MAX_CMD_S) * 1000;
    const started = Date.now();
    const cmd = await sb.runCommand({
        cmd: 'bash',
        args: ['-lc', background ? `nohup bash -lc ${shellQuote(body.command)} > /tmp/pz_bg_$$.log 2>&1 & echo "PID $!"; sleep 5; tail -n 50 /tmp/pz_bg_$$.log` : body.command],
        cwd: ROOT,
        detached: true,
    });

    let streamed = 0;
    let timedOut = false;
    const ac = new AbortController();
    const timer = setTimeout(() => { timedOut = true; ac.abort(); }, limitMs);
    try {
        for await (const line of cmd.logs({ signal: ac.signal })) {
            if (line.stream !== 'stdout' && line.stream !== 'stderr') continue;
            if (streamed < MAX_STREAM_CHARS) {
                const s = line.data.slice(0, MAX_STREAM_CHARS - streamed);
                streamed += s.length;
                send({ t: 'out', s, stream: line.stream });
                if (streamed >= MAX_STREAM_CHARS) send({ t: 'out', s: '\n… sortie tronquée (200 000 caractères) …\n', stream: 'stderr' });
            }
        }
    } catch (e) {
        if (!timedOut) throw e;
    } finally {
        clearTimeout(timer);
    }

    let code = null;
    if (timedOut && !background) {
        await Promise.resolve().then(() => cmd.kill('SIGKILL')).catch(() => {});
    } else {
        code = (await cmd.wait().catch(() => null))?.exitCode ?? null;
    }
    send({ t: 'exit', code, timedOut: timedOut && !background, background, ms: Date.now() - started });
    send({ t: 'files', ...(await pullChanged(sb)) });
}

export async function POST(req) {
    // Une vraie machine exécute des commandes arbitraires : jamais sans authentification.
    if (!isAuthEnabled() && process.env.SANDBOX_ALLOW_DEV !== '1') {
        return json({ error: "Terminal serveur désactivé : configure SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sur Vercel (authentification obligatoire)." }, 403);
    }

    let userId;
    try {
        ({ userId } = await authenticate(req));
    } catch (e) {
        return json({ error: e.message }, e.status || 401);
    }

    const body = await req.json().catch(() => ({}));
    const name = await sandboxName(userId, body.ws);

    if (body.action === 'url') {
        const port = Number(body.port);
        if (!PORTS.includes(port)) return json({ error: `Port non exposé. Ports disponibles : ${PORTS.join(', ')}` }, 400);
        try {
            const sb = await Sandbox.get({ name });
            return json({ url: sb.domain(port) });
        } catch (e) {
            return json({ error: "Aucune machine active pour cette conversation. Lance d'abord une commande." }, 404);
        }
    }

    if (body.action === 'reset') {
        try { const sb = await Sandbox.get({ name }); await sb.delete(); } catch (_) { /* déjà supprimé */ }
        return json({ ok: true });
    }

    if (body.action !== 'exec' || typeof body.command !== 'string' || !body.command.trim()) {
        return json({ error: 'Requête invalide.' }, 400);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (ev) => controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
            try {
                await execStream({ userId, body, send });
            } catch (e) {
                const msg = e instanceof HttpError ? e.message : `Erreur machine : ${e?.message || e}`;
                send({ t: 'error', v: msg });
            } finally {
                controller.close();
            }
        },
    });
    return new Response(stream, {
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' },
    });
}
