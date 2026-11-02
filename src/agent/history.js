// ============================================================
//  PENSÉE IA — src/agent/history.js
//  Construit les `contents` Gemini (vrais tours user/model) à
//  partir de l'historique stocké et du nouveau message.
// ============================================================

import { CONFIG } from '../config.js';

/** Version texte d'un message stocké, sans marqueurs techniques. */
function toContextText(content) {
    let text = String(content || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/\n?\[WEB_SOURCES:\[[\s\S]*?\]\]/g, '')
        .replace(/\[SECURE_FILE:([^\]]+)\]\([^)]+\)/g, '(fichier joint : $1)');

    text = text.replace(/\n?\[TOOL_TRACE:(\[[\s\S]*?\])\]/g, (_m, json) => {
        try {
            const trace = JSON.parse(json);
            return `\n(Outils utilisés : ${trace.map(t => t.summary ? `${t.name} ${t.summary}` : t.name).join(' ; ')})`;
        } catch { return ''; }
    });

    const img = text.match(/^\[IMAGE_URL:[^|]*\|([^|]*)/);
    if (img) return `(Image générée : ${img[1]})`;
    const file = text.match(/^\[FILE_URL:[^|]*\|([^|]*)\|/);
    if (file) return `(Fichier généré : ${file[1]})`;
    return text.trim();
}

// Déclarations repérées pour le plan d'un gros fichier (JS/TS, Python, HTML…)
const OUTLINE_PATTERNS = [
    [/(?:^|[\s;{}(,])(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g, 'function'],
    [/(?:^|[\s;{}(,])class\s+([A-Za-z_$][\w$]*)/g, 'class'],
    [/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g, 'fn'],
    [/(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function\b/g, 'méthode'],
    [/^[ \t]+(?:static\s+|async\s+|get\s+|set\s+)*(?!(?:if|for|while|switch|catch|function|return|else)\b)([A-Za-z_$][\w$]*)\s*\([^()\n]*\)\s*\{/gm, 'méthode'],
    [/^[ \t]*(?:async\s+)?def\s+(\w+)\s*\(/gm, 'def'],
    [/<(?:section|div|main|canvas|template)[^>]*\bid=["']([\w-]+)["']/g, '#id'],
];
const MAX_OUTLINE_ENTRIES = 600;
const MAX_SCANNED = 20000;
const MAX_OUTLINE_CHARS = 20000;

/** Plan d'un gros fichier : chaque déclaration avec sa ligne, pour que l'agent sache où lire. */
export function outlineText(text) {
    const starts = [0];
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
    const lineOf = (pos) => {
        let lo = 0, hi = starts.length - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
        return lo + 1;
    };
    const seen = new Set();
    const entries = [];
    for (const [re, kind] of OUTLINE_PATTERNS) {
        re.lastIndex = 0;
        for (let m = re.exec(text); m && entries.length < MAX_SCANNED; m = re.exec(text)) {
            const key = kind + ':' + m[1];
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push({ pos: m.index, kind, label: `${kind} ${m[1]}` });
        }
    }
    // Trop de déclarations : les fonctions et classes de tout le fichier passent avant les méthodes
    const major = entries.filter(e => e.kind !== 'méthode');
    const shown = major.length >= MAX_OUTLINE_ENTRIES
        ? major.slice(0, MAX_OUTLINE_ENTRIES)
        : [...major, ...entries.filter(e => e.kind === 'méthode').slice(0, MAX_OUTLINE_ENTRIES - major.length)];
    shown.sort((a, b) => a.pos - b.pos);
    for (const e of shown) e.line = lineOf(e.pos);
    let out = shown.map(e => `L${e.line} ${e.label}`).join('\n');
    if (out.length > MAX_OUTLINE_CHARS) out = out.slice(0, MAX_OUTLINE_CHARS) + '\n…';
    return { lines: starts.length, count: entries.length, text: out };
}

/** Pièce jointe texte → part du message. Les gros fichiers sont remplacés par un en-tête + un plan. */
function attachmentText(f) {
    const max = CONFIG.maxInlineTextChars;
    if (f.text.length <= max) return `DOCUMENT JOINT : ${f.name}\n\`\`\`\n${f.text}\n\`\`\``;
    const plan = outlineText(f.text);
    const head = f.text.slice(0, 15000);
    return `DOCUMENT JOINT (VOLUMINEUX) : ${f.name} — ${f.text.length.toLocaleString('fr-FR')} caractères, ${plan.lines} lignes.\n`
        + `Fichier complet dans /workspace/${f.name}. Seuls le début et le plan sont inclus ici : pour répondre, `
        + `utilise search_files (trouver un système, une fonction) puis read_file avec offset/limit sur les lignes utiles.\n\n`
        + `DÉBUT DU FICHIER :\n\`\`\`\n${head}\n\`\`\`\n\n`
        + `PLAN (${plan.count} déclarations${plan.count > MAX_OUTLINE_ENTRIES ? `, ${MAX_OUTLINE_ENTRIES} premières` : ''}) :\n${plan.text || '(aucune déclaration reconnue : utilise search_files)'}`;
}

/**
 * @param {{role: string, content: string}[]} history
 * @param {string} userText
 * @param {object[]} files     pièces jointes (src/files.js)
 * @param {string[]} workspacePaths chemins copiés dans /workspace
 */
export function buildContents(history, userText, files = [], workspacePaths = []) {
    // 1. Historique récent, borné en messages et en caractères (les plus anciens sautent)
    const recent = history.slice(-CONFIG.contextMessages)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: toContextText(m.content) }))
        .filter(m => m.text);

    let budget = CONFIG.contextChars;
    const kept = [];
    for (let i = recent.length - 1; i >= 0; i--) {
        const len = recent[i].text.length;
        if (len > budget) {
            if (!kept.length) kept.unshift({ ...recent[i], text: '…' + recent[i].text.slice(-budget) });
            break;
        }
        budget -= len;
        kept.unshift(recent[i]);
    }

    const contents = [];
    for (const m of kept) {
        const last = contents[contents.length - 1];
        if (last && last.role === m.role) last.parts.push({ text: m.text });
        else contents.push({ role: m.role, parts: [{ text: m.text }] });
    }

    // 2. Nouveau message : fichiers d'abord, question en dernier
    const parts = [];
    for (const f of files) {
        if (f.kind === 'text') {
            parts.push({ text: attachmentText(f) });
        } else if (f.base64) {
            parts.push({ inlineData: { mimeType: f.mime, data: f.base64 } });
            parts.push({ text: `(Fichier joint ci-dessus : ${f.name})` });
        } else {
            parts.push({ text: `(Fichier joint : ${f.name} — non lisible directement, disponible dans /workspace/${f.name} : analyse-le avec run_python.)` });
        }
    }
    if (workspacePaths.length) {
        parts.push({ text: `[Fichiers copiés dans /workspace : ${workspacePaths.join(', ')}]` });
    }
    parts.push({ text: userText });

    const last = contents[contents.length - 1];
    if (last && last.role === 'user') last.parts.push(...parts);
    else contents.push({ role: 'user', parts });
    return contents;
}
