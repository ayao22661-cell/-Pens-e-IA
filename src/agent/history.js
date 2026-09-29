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
            const max = CONFIG.maxInlineTextChars;
            const body = f.text.length <= max
                ? f.text
                : f.text.slice(0, max / 2) + `\n\n[… ${f.text.length - max} caractères omis — fichier complet dans /workspace/${f.name}, utilise read_file ou run_python …]\n\n` + f.text.slice(-max / 2);
            parts.push({ text: `DOCUMENT JOINT : ${f.name}\n\`\`\`\n${body}\n\`\`\`` });
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
