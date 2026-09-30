// ============================================================
//  PENSÉE IA — api/_lib/gemini.js
//  Appel streaming à l'API Gemini + découpage du flux en
//  événements typés (text / thinking / emotion / functionCall).
// ============================================================

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── Cascades — optimisées quotas août 2026 ──────────────────
// Priorité aux modèles à fort quota RPD : Flash Lite (500) > Flash premium (20) > Gemma 4 (14 400, sans outils)
const CASCADES = {
    code: [
        'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash',
        'gemma-4-31b-it', 'gemma-4-26b-a4b-it',
    ],
    creatif: [
        'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite',
        'gemma-4-31b-it', 'gemma-4-26b-a4b-it',
    ],
    default: [
        'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash',
        'gemini-3.5-flash', 'gemini-3-flash', 'gemma-4-31b-it', 'gemma-4-26b-a4b-it',
    ],
};
CASCADES.audit = CASCADES.code;

// Tâches lourdes (code, projets, débogage) : les modèles Flash complets d'abord —
// plus lents et à quota réduit, mais qui raisonnent vraiment. Lite en secours.
const HEAVY_CASCADE = [
    'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash',
    'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemma-4-31b-it', 'gemma-4-26b-a4b-it',
];

export function modelCascade(agentId, preferred, heavy = false) {
    const list = [...(heavy ? HEAVY_CASCADE : (CASCADES[agentId] || CASCADES.default))];
    // Le client ne peut que RÉORDONNER la cascade (continuité d'un tour d'outils),
    // jamais y introduire un modèle arbitraire.
    if (preferred && list.includes(preferred)) {
        list.splice(list.indexOf(preferred), 1);
        list.unshift(preferred);
    }
    return list;
}

export const isGemma = (model) => model.startsWith('gemma');

/**
 * Les thoughtSignature sont propres au modèle qui les a produites. Si la cascade
 * bascule sur un autre modèle en plein tour d'outils (quota épuisé), on les
 * remplace par la valeur neutre documentée par Google pour les historiques transférés.
 */
export function neutralizeSignatures(contents) {
    return contents.map(c => ({
        role: c.role,
        parts: c.parts.map(p => (p.thoughtSignature ? { ...p, thoughtSignature: 'skip_thought_signature_validator' } : p)),
    }));
}

// Niveaux de réflexion essayés dans l'ordre ; on descend d'un cran si le modèle refuse le paramètre.
export const THINKING_VARIANTS = {
    heavy: ['high', 'dynamic', 'basic', 'off'],
    normal: ['basic', 'off'],
};

export function thinkingConfig(variant) {
    switch (variant) {
        case 'high': return { includeThoughts: true, thinkingLevel: 'high' };
        case 'dynamic': return { includeThoughts: true, thinkingBudget: -1 };
        case 'basic': return { includeThoughts: true };
        default: return null;
    }
}

export function streamGenerate(model, body, apiKey, signal) {
    return fetch(`${API_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    });
}

// ============================================================
//  FILTRE DE BALISES EN STREAMING
//  Extrait <EM>{json}</EM>, <think>…</think> et le format Gemma 4
//  <|channel>thought…<channel|> même quand une balise est coupée
//  entre deux chunks SSE.
// ============================================================
const TAGS = [
    { open: '<EM>', close: '</EM>', kind: 'emotion' },
    { open: '<think>', close: '</think>', kind: 'thinking' },
    { open: '<|channel>thought', close: '<channel|>', kind: 'thinking' },
];
const MAX_EMOTION_CHARS = 300;

function partialSuffixLen(buf, tag) {
    for (let k = Math.min(tag.length - 1, buf.length); k > 0; k--) {
        if (tag.startsWith(buf.slice(-k))) return k;
    }
    return 0;
}

export class TagFilter {
    /** @param {(kind: 'text'|'thinking'|'emotion', value: any) => void} emit */
    constructor(emit) {
        this.emit = emit;
        this.buf = '';
        this.tag = null;
        this.emBuf = '';
        this.trimNextText = true; // supprime les sauts de ligne en tête de réponse / après une balise
    }

    push(s) { this.buf += s; this.drain(false); }
    end()   { this.drain(true); }

    drain(final) {
        while (this.buf) {
            if (this.tag) {
                const idx = this.buf.indexOf(this.tag.close);
                if (idx === -1) {
                    const keep = final ? 0 : partialSuffixLen(this.buf, this.tag.close);
                    this.inside(this.buf.slice(0, this.buf.length - keep));
                    this.buf = this.buf.slice(this.buf.length - keep);
                    if (final) this.closeTag();
                    return;
                }
                this.inside(this.buf.slice(0, idx));
                this.buf = this.buf.slice(idx + this.tag.close.length);
                this.closeTag();
                continue;
            }
            let best = null;
            for (const t of TAGS) {
                const i = this.buf.indexOf(t.open);
                if (i !== -1 && (!best || i < best.i)) best = { i, t };
            }
            if (best) {
                this.text(this.buf.slice(0, best.i));
                this.buf = this.buf.slice(best.i + best.t.open.length);
                this.tag = best.t;
                continue;
            }
            const keep = final ? 0 : Math.max(...TAGS.map(t => partialSuffixLen(this.buf, t.open)));
            this.text(this.buf.slice(0, this.buf.length - keep));
            this.buf = this.buf.slice(this.buf.length - keep);
            return;
        }
        if (final && this.tag) this.closeTag();
    }

    inside(s) {
        if (!s) return;
        if (this.tag.kind !== 'emotion') { this.emit('thinking', s); return; }
        this.emBuf += s;
        // <EM> jamais refermé : ce n'était pas une balise, on rend le texte
        if (this.emBuf.length > MAX_EMOTION_CHARS) {
            const raw = this.emBuf;
            this.emBuf = '';
            this.tag = null;
            this.text(raw);
        }
    }

    closeTag() {
        if (this.tag?.kind === 'emotion') {
            try { this.emit('emotion', JSON.parse(this.emBuf.trim())); } catch (_) { /* signal illisible : ignoré */ }
            this.emBuf = '';
        }
        this.tag = null;
        this.trimNextText = true;
    }

    text(s) {
        if (!s) return;
        if (this.trimNextText) {
            s = s.replace(/^\s*\n/, '');
            if (!s) return;
            this.trimNextText = false;
        }
        this.emit('text', s);
    }
}

// ============================================================
//  LECTURE D'UNE RÉPONSE SSE
//  Retourne le contenu "model" à réinjecter dans l'historique
//  (texte nettoyé + functionCall avec leurs thoughtSignature).
// ============================================================
export async function consumeStream(response, { onText, onThinking, onEmotion }) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parts = [];
    const calls = [];
    let curText = null;
    let sseBuf = '';
    let finishReason = null;
    let blockReason = null;
    let usage = null;

    const filter = new TagFilter((kind, v) => {
        if (kind === 'text') {
            if (!curText) { curText = { text: '' }; parts.push(curText); }
            curText.text += v;
            onText(v);
        } else if (kind === 'thinking') { tagThinking += v; onThinking(v); }
        else if (kind === 'emotion') onEmotion(v);
    });
    let tagThinking = ''; // texte placé par le modèle dans <think>…</think> (et non dans les "thought" natifs)

    const handlePart = (p) => {
        if (p.thought) {
            if (typeof p.text === 'string' && p.text) onThinking(p.text);
            return;
        }
        if (p.functionCall) {
            filter.end();
            curText = null;
            const part = { functionCall: p.functionCall };
            if (p.thoughtSignature) part.thoughtSignature = p.thoughtSignature;
            parts.push(part);
            calls.push(part.functionCall);
            return;
        }
        if (typeof p.text === 'string') {
            if (p.text) filter.push(p.text);
            if (p.thoughtSignature) {
                if (curText) curText.thoughtSignature = p.thoughtSignature;
                else parts.push({ text: '', thoughtSignature: p.thoughtSignature });
            }
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        const lines = sseBuf.split('\n');
        sseBuf = lines.pop() || '';
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            let obj;
            try { obj = JSON.parse(data); } catch { continue; }
            if (obj.promptFeedback?.blockReason) blockReason = obj.promptFeedback.blockReason;
            if (obj.usageMetadata) usage = obj.usageMetadata;
            const cand = obj.candidates?.[0];
            if (cand?.finishReason) finishReason = cand.finishReason;
            for (const p of cand?.content?.parts || []) handlePart(p);
        }
    }
    filter.end();

    // Réponse entière écrite dans une balise <think> jamais refermée : on la rend visible
    // plutôt que de renvoyer une réponse vide.
    if (!calls.length && !parts.some(p => p.text && p.text.trim()) && tagThinking.trim().length > 40) {
        const text = tagThinking.trim();
        parts.push({ text });
        onText(text);
    }

    return {
        content: {
            role: 'model',
            parts: parts.filter(p => p.functionCall || p.thoughtSignature || (p.text && p.text.trim())),
        },
        calls,
        finishReason,
        blockReason,
        usage,
    };
}

// ============================================================
//  CONVERSIONS
// ============================================================

/** Gemma ne gère ni functionCall/functionResponse ni systemInstruction : tout en texte. */
export function toPlainContents(contents, systemInstruction) {
    const out = contents.map(c => ({
        role: c.role,
        parts: c.parts.map(p => {
            if (p.functionCall) return { text: `[Outil appelé : ${p.functionCall.name}(${JSON.stringify(p.functionCall.args || {}).slice(0, 2000)})]` };
            if (p.functionResponse) return { text: `[Résultat ${p.functionResponse.name} : ${JSON.stringify(p.functionResponse.response || {}).slice(0, 6000)}]` };
            if (p.text !== undefined) return { text: p.text };
            return p.inlineData ? { inlineData: p.inlineData } : p.fileData ? { fileData: p.fileData } : { text: '' };
        }).filter(p => p.inlineData || p.fileData || p.text),
    })).filter(c => c.parts.length);

    // Instructions système injectées dans le premier message utilisateur
    const first = out.find(c => c.role === 'user');
    if (first && systemInstruction) {
        first.parts.unshift({ text: `[INSTRUCTIONS SYSTÈME]\n${systemInstruction}\n\n[MESSAGE UTILISATEUR]\n` });
    }
    return out;
}
