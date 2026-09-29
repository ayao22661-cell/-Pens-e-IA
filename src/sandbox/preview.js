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

function resolveFrom(baseDir, rel) {
    const clean = rel.split(/[?#]/)[0];
    return normalizePath(clean.startsWith('/') ? clean : (baseDir ? `${baseDir}/${clean}` : clean));
}

/** Construit un document autonome : CSS, JS et images locaux sont intégrés. */
export async function buildPreviewDocument(ws, path) {
    const p = normalizePath(path);
    const html = await vfs.readText(ws, p);
    if (html === null) throw new Error(`Fichier introuvable : ${p}`);
    const baseDir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';

    const readLocal = async (ref) => {
        if (isExternal(ref)) return null;
        try { return await vfs.read(ws, resolveFrom(baseDir, ref)); } catch { return null; }
    };

    let out = html;

    // <link rel="stylesheet" href="local.css">
    for (const m of [...html.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]) {
        if (!/stylesheet/i.test(m[0])) continue;
        const rec = await readLocal(m[1]);
        if (!rec) continue;
        const css = typeof rec.data === 'string' ? rec.data : new TextDecoder().decode(rec.data);
        out = out.replace(m[0], `<style>/* ${m[1]} */\n${css}\n</style>`);
    }

    // <script src="local.js"></script>
    for (const m of [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi)]) {
        const rec = await readLocal(m[2]);
        if (!rec) continue;
        const js = (typeof rec.data === 'string' ? rec.data : new TextDecoder().decode(rec.data)).replace(/<\/script/gi, '<\\/script');
        out = out.replace(m[0], `<script${m[1]}${m[3]}>/* ${m[2]} */\n${js}\n</script>`);
    }

    // Images / médias locaux → data URI
    for (const m of [...out.matchAll(/\b(src|href)=["']([^"']+\.(?:png|jpe?g|gif|webp|svg|mp3|wav|ogg|mp4|webm))["']/gi)]) {
        const rec = await readLocal(m[2]);
        if (!rec) continue;
        const bytes = typeof rec.data === 'string' ? new TextEncoder().encode(rec.data) : rec.data;
        out = out.replace(m[0], `${m[1]}="data:${mimeOf(rec.path)};base64,${bytesToBase64(bytes)}"`);
    }

    return out;
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
