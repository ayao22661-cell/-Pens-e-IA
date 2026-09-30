// ============================================================
//  PENSÉE IA — src/sandbox/preview.js
//  Aperçu interactif d'une page HTML du workspace dans une iframe
//  isolée (sans same-origin : aucun accès à la session Supabase).
// ============================================================

import { vfs, normalizePath, mimeOf } from './vfs.js';

const SANDBOX = 'allow-scripts allow-modals allow-forms allow-popups';

export function bytesToBase64(bytes) {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
}

const isExternal = (url) => /^(?:[a-z]+:)?\/\/|^data:|^#|^mailto:|^javascript:/i.test(url);

/** Chemins candidats : relatif au dossier du HTML ; un chemin "/x" est essayé depuis ce dossier (build Vite : dist/) puis depuis la racine. */
function candidates(baseDir, rel) {
    const clean = rel.split(/[?#]/)[0];
    const list = clean.startsWith('/')
        ? [baseDir ? `${baseDir}${clean}` : clean, clean]
        : [baseDir ? `${baseDir}/${clean}` : clean];
    return list.map(c => { try { return normalizePath(c); } catch { return null; } }).filter(Boolean);
}

export class PreviewError extends Error {}

/**
 * Un index.html de projet Vite/React/Vue non compilé ne peut pas s'exécuter tel quel
 * dans le navigateur (JSX, TypeScript, imports "react"…) : page blanche garantie.
 */
function needsBundler(html) {
    for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
        if (/\.(jsx|tsx|ts|vue|svelte)(\?|$)/i.test(m[1])) return `le script ${m[1]}`;
    }
    for (const m of html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        if (/\bimport\b[^'"]*['"](?![./]|https?:)[^'"]+['"]/.test(m[1])) return 'un import de paquet npm';
    }
    return null;
}

/** Construit un document autonome : CSS, JS et images locaux sont intégrés. */
export async function buildPreviewDocument(ws, path, { probeId = null } = {}) {
    const p = normalizePath(path);
    const html = await vfs.readText(ws, p);
    if (html === null) throw new PreviewError(`Fichier introuvable dans /workspace : ${p}. Vérifie avec list_files (les fichiers > 512 Ko restent sur la machine).`);
    const baseDir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';

    const bundler = needsBundler(html);
    if (bundler) {
        throw new PreviewError(
            `${p} ne peut pas s'afficher tel quel : ${bundler} doit être compilé par un bundler (Vite). `
            + "Solutions : (1) bash background \"npm run dev -- --host 0.0.0.0\" puis open_port(5173) ; "
            + "ou (2) bash \"npm run build\" puis render_preview sur dist/index.html ; "
            + "ou (3) pour une page simple, un HTML autonome (Tailwind et bibliothèques via CDN, pas de JSX).");
    }

    const readLocal = async (ref) => {
        if (isExternal(ref)) return null;
        for (const c of candidates(baseDir, ref)) {
            const rec = await vfs.read(ws, c).catch(() => null);
            if (rec) return rec;
        }
        return null;
    };
    const missing = [];

    let out = html;

    // <link rel="stylesheet" href="local.css">
    for (const m of [...html.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]) {
        if (!/stylesheet/i.test(m[0])) continue;
        const rec = await readLocal(m[1]);
        if (!rec) { if (!isExternal(m[1])) missing.push(m[1]); continue; }
        const css = typeof rec.data === 'string' ? rec.data : new TextDecoder().decode(rec.data);
        out = out.replace(m[0], `<style>/* ${m[1]} */\n${css}\n</style>`);
    }

    // <script src="local.js"></script>
    for (const m of [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi)]) {
        const rec = await readLocal(m[2]);
        if (!rec) { if (!isExternal(m[2])) missing.push(m[2]); continue; }
        const js =(typeof rec.data === 'string' ? rec.data : new TextDecoder().decode(rec.data)).replace(/<\/script/gi, '<\\/script');
        out = out.replace(m[0], `<script${m[1]}${m[3]}>/* ${m[2]} */\n${js}\n</script>`);
    }

    // Images / médias locaux → data URI
    for (const m of [...out.matchAll(/\b(src|href)=["']([^"']+\.(?:png|jpe?g|gif|webp|svg|mp3|wav|ogg|mp4|webm))["']/gi)]) {
        const rec = await readLocal(m[2]);
        if (!rec) continue;
        const bytes = typeof rec.data === 'string' ? new TextEncoder().encode(rec.data) : rec.data;
        out = out.replace(m[0], `${m[1]}="data:${mimeOf(rec.path)};base64,${bytesToBase64(bytes)}"`);
    }

    // <link rel="modulepreload"> vers des fichiers déjà intégrés : inutile, et source d'erreurs 404
    out = out.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '');

    if (probeId) out = injectProbe(out, probeId, missing);
    return out;
}

/**
 * Sonde injectée en tout début de document : remonte au parent les erreurs JS,
 * les ressources introuvables et un diagnostic "page blanche" après chargement.
 */
function injectProbe(html, id, missing) {
    const probe = `<script>(function(){var I=${JSON.stringify(id)};
function s(k,m){try{parent.postMessage({__pzPreview:1,id:I,kind:k,msg:String(m).slice(0,400)},'*')}catch(e){}}
${missing.map(m => `s('missing',${JSON.stringify(m)});`).join('')}
window.addEventListener('error',function(e){var t=e.target;if(t&&t!==window&&(t.src||t.href)){s('missing',t.src||t.href)}else{s('error',(e.message||'Erreur')+(e.lineno?' (ligne '+e.lineno+')':''))}},true);
window.addEventListener('unhandledrejection',function(e){var r=e.reason;s('error','Promesse rejetée : '+(r&&r.message||r))});
var ce=console.error;console.error=function(){s('console',Array.prototype.map.call(arguments,function(a){return a&&a.message||a}).join(' '));return ce.apply(console,arguments)};
window.addEventListener('load',function(){setTimeout(function(){var b=document.body;s('stats',JSON.stringify({text:b?(b.innerText||'').trim().length:0,nodes:b?b.getElementsByTagName('*').length:0,title:document.title}))},1500)});
})();</script>`;
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (h) => h + probe);
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (h) => h + probe);
    return probe + html;
}

/**
 * Attend le verdict de la sonde d'un aperçu.
 * @returns {Promise<{errors: string[], missing: string[], stats: object|null}>}
 */
export function probePreview(id, timeoutMs = 4500) {
    return new Promise((resolve) => {
        const report = { errors: [], missing: [], stats: null };
        const onMsg = (e) => {
            const d = e.data;
            if (!d || d.__pzPreview !== 1 || d.id !== id) return;
            if (d.kind === 'stats') { try { report.stats = JSON.parse(d.msg); } catch { /* ignoré */ } finish(); }
            else if (d.kind === 'missing') { if (!report.missing.includes(d.msg)) report.missing.push(d.msg); }
            else if (report.errors.length < 10) report.errors.push(d.msg);
        };
        const timer = setTimeout(finish, timeoutMs);
        function finish() {
            clearTimeout(timer);
            window.removeEventListener('message', onMsg);
            resolve(report);
        }
        window.addEventListener('message', onMsg);
    });
}

/**
 * Affiche un aperçu dans `container`.
 * @returns {HTMLElement} la carte créée
 */
export function mountPreview(container, srcdoc, { title = 'Aperçu', onReload } = {}) {
    const card = document.createElement('div');
    card.className = 'pz-preview';
    card.innerHTML = `
        <div class="pz-preview-bar">
            <span class="pz-preview-dots"><i></i><i></i><i></i></span>
            <span class="pz-preview-title"></span>
            <button type="button" class="pz-icon-btn" data-act="reload" title="Recharger">↻</button>
            <button type="button" class="pz-icon-btn" data-act="expand" title="Agrandir">⤢</button>
        </div>`;
    card.querySelector('.pz-preview-title').textContent = title;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', SANDBOX);
    iframe.setAttribute('title', title);
    iframe.srcdoc = srcdoc;
    card.appendChild(iframe);

    card.querySelector('[data-act="reload"]').addEventListener('click', async () => {
        iframe.srcdoc = onReload ? await onReload().catch(() => srcdoc) : srcdoc;
    });
    card.querySelector('[data-act="expand"]').addEventListener('click', () => {
        card.classList.toggle('pz-preview-full');
        document.body.classList.toggle('pz-noscroll', card.classList.contains('pz-preview-full'));
    });

    container.appendChild(card);
    return card;
}

/** Document de console pour exécuter un extrait JavaScript isolé. */
export function jsConsoleDocument(code) {
    const safe = code.replace(/<\/script/gi, '<\\/script');
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
<style>body{font:13px/1.5 ui-monospace,monospace;background:#0b0e14;color:#dde2ee;margin:0;padding:14px}
.err{color:#ff6b6b}.warn{color:#f0c040}pre{margin:0;white-space:pre-wrap;word-break:break-word}</style></head>
<body><pre id="o"></pre><script>
const o=document.getElementById('o');
const fmt=a=>a.map(x=>typeof x==='object'?(()=>{try{return JSON.stringify(x,null,2)}catch{return String(x)}})():String(x)).join(' ');
const w=(c)=>(...a)=>{const s=document.createElement('span');if(c)s.className=c;s.textContent=fmt(a)+'\\n';o.appendChild(s);};
console.log=w();console.info=w();console.warn=w('warn');console.error=w('err');
window.onerror=(m,s,l)=>{w('err')('Erreur : '+m+(l?' (ligne '+l+')':''));};
</script><script>
${safe}
</script></body></html>`;
}
