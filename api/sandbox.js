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

// Environnement de chaque commande : les serveurs de dev sont vus via *.vercel.run,
// il faut donc désactiver leurs contrôles d'hôte ; CI=1 évite les questions interactives.
const CMD_ENV = {
    CI: '1',
    __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: '.vercel.run', // Vite ≥ 6 (server.allowedHosts)
    DANGEROUSLY_DISABLE_HOST_CHECK: 'true',                // create-react-app / webpack-dev-server
    WDS_SOCKET_PORT: '443',                                // HMR derrière le proxy HTTPS
    HOST: '0.0.0.0',
    npm_config_yes: 'true',                                // npx sans confirmation
};
const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_CMD_S = 120;
const MAX_CMD_S = 280;                          // < maxDuration (vercel.json : 300 s)
const BACKGROUND_WAIT_MS = 8000;
const MAX_STREAM_CHARS = 200_000;
const MAX_PULL_FILE = 512 * 1024;
const MAX_PULL_TOTAL = 3 * 1024 * 1024;
const MAX_DOWNLOAD = 3 * 1024 * 1024;   // réponse de fonction Vercel ≤ 4,5 Mo (base64 ×1.33)
const MAX_PUBLISH = 50 * 1024 * 1024;

const MIME = {
    zip: 'application/zip', pdf: 'application/pdf', json: 'application/json', csv: 'text/csv', txt: 'text/plain',
    md: 'text/markdown', html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', jpg: 'image/jpeg',
    jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', gz: 'application/gzip', tgz: 'application/gzip',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp3: 'audio/mpeg', mp4: 'video/mp4', wav: 'audio/wav',
};

/** Envoie un fichier dans le bucket "attachments" et renvoie une URL signée 30 jours. */
async function publishToStorage(userId, path, buf) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const filename = path.split('/').pop();
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const storagePath = `fichiers/${userId}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const headers = { 'Authorization': `Bearer ${key}`, 'apikey': key };

    const up = await fetch(`${url}/storage/v1/object/attachments/${storagePath}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': MIME[ext] || 'application/octet-stream', 'x-upsert': 'true' },
        body: buf,
    });
    if (!up.ok) throw new Error((await up.json().catch(() => ({}))).message || `HTTP ${up.status}`);

    const sign = await fetch(`${url}/storage/v1/object/sign/attachments/${storagePath}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 30 }),
    });
    const signed = await sign.json().catch(() => ({}));
    if (!signed.signedURL) throw new Error('URL signée indisponible');
    return { filename, size: buf.length, storagePath, url: `${url}/storage/v1${signed.signedURL}` };
}
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

// Préparation d'une machine neuve (Amazon Linux 2023, utilisateur non root) :
//  - npm install -g sans sudo (préfixe dans le HOME)
//  - pip / pip3 installables en --user, binaires dans ~/.local/bin
//  - pip, zip, unzip, git installés en arrière-plan via dnf (sudo)
// Point de sauvegarde git après chaque commande : l'agent peut voir ce qui a changé
// (git diff HEAD~1) et revenir en arrière (git checkout <commit> -- fichier).
const CHECKPOINT = `
cd ${ROOT} 2>/dev/null && command -v git >/dev/null 2>&1 || exit 0
if [ ! -d .git ]; then
  git init -q && printf 'node_modules/\\n.venv/\\nvenv/\\n__pycache__/\\n.cache/\\n.next/\\n*.log\\n.env\\n' > .git/info/exclude
fi
git add -A >/dev/null 2>&1
git -c user.name='Pensée' -c user.email='pensee@local' commit -qm "$PZ_MSG" >/dev/null 2>&1
true
`;

async function checkpoint(sb, command) {
    await sb.runCommand({
        cmd: 'bash',
        args: ['-c', CHECKPOINT],
        env: { PZ_MSG: `pz: ${String(command).replace(/\s+/g, ' ').slice(0, 72)}` },
    }).catch(() => {});
}

const BOOTSTRAP = `
mkdir -p "$HOME/.npm-global" "$HOME/.local/bin"
npm config set prefix "$HOME/.npm-global" >/dev/null 2>&1
cat >> "$HOME/.bashrc" <<'RC'
export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"
export PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_INPUT=1
alias pip='python3 -m pip'
RC
nohup bash -c 'sudo dnf install -y -q python3-pip zip unzip git tar gzip >/tmp/pz_bootstrap.log 2>&1; touch /tmp/pz_bootstrap.done' >/dev/null 2>&1 &
true
`;

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

    // Préparation unique de la machine (idempotente : marqueur ~/.pz_boot), puis marqueur de synchro
    await sb.runCommand({
        cmd: 'bash',
        args: ['-c', `[ -f "$HOME/.pz_boot" ] || { ${BOOTSTRAP} touch "$HOME/.pz_boot"; }; touch /tmp/.pz_mark; sleep 0.01`],
    }).catch(() => {});

    const background = Boolean(body.background);
    const limitMs = background ? BACKGROUND_WAIT_MS : Math.min(Math.max(Number(body.timeoutS) || DEFAULT_CMD_S, 5), MAX_CMD_S) * 1000;
    const started = Date.now();
    const cmd = await sb.runCommand({
        cmd: 'bash',
        args: ['-lc', background ? `nohup bash -lc ${shellQuote(body.command)} > /tmp/pz_bg_$$.log 2>&1 & echo "PID $!"; sleep 5; tail -n 50 /tmp/pz_bg_$$.log` : body.command],
        cwd: ROOT,
        env: CMD_ENV,
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
    if (!background) await checkpoint(sb, body.command);
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

    // Publie un fichier de la machine dans Supabase Storage (livrable jusqu'à 50 Mo)
    if (body.action === 'publish') {
        const path = String(body.path || '').replace(/^\/+/, '').replace(/^workspace\//, '');
        if (!path || path.split('/').includes('..')) return json({ error: 'Chemin invalide.' }, 400);
        let buf;
        try {
            const sb = await Sandbox.get({ name });
            buf = await sb.readFileToBuffer({ path: `${ROOT}/${path}` });
        } catch (_) {
            return json({ error: 'Aucune machine active pour cette conversation.' }, 404);
        }
        if (!buf) return json({ error: `Fichier introuvable sur la machine : ${path}` }, 404);
        if (buf.length > MAX_PUBLISH) return json({ error: `Fichier trop volumineux (${(buf.length / 1048576).toFixed(1)} Mo, max 50 Mo).` }, 413);
        try {
            return json(await publishToStorage(userId, path, buf));
        } catch (e) {
            return json({ error: `Archivage impossible : ${e.message}` }, 502);
        }
    }

    // Récupère un fichier de la machine (livrables trop gros pour la synchro automatique)
    if (body.action === 'download') {
        const path = String(body.path || '').replace(/^\/+/, '').replace(/^workspace\//, '');
        if (!path || path.split('/').includes('..')) return json({ error: 'Chemin invalide.' }, 400);
        try {
            const sb = await Sandbox.get({ name });
            const buf = await sb.readFileToBuffer({ path: `${ROOT}/${path}` });
            if (!buf) return json({ error: `Fichier introuvable sur la machine : ${path}` }, 404);
            if (buf.length > MAX_DOWNLOAD) {
                return json({ error: `Fichier trop volumineux (${(buf.length / 1048576).toFixed(1)} Mo, max ${MAX_DOWNLOAD / 1048576} Mo). Compresse-le ou découpe-le.` }, 413);
            }
            return json({ path, b64: Buffer.from(buf).toString('base64') });
        } catch (e) {
            return json({ error: "Aucune machine active pour cette conversation." }, 404);
        }
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
