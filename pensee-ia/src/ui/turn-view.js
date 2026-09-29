// ============================================================
//  PENSÉE IA — src/ui/turn-view.js
//  Rendu d'une réponse de l'agent : texte, réflexion et cartes
//  d'outils s'enchaînent dans l'ordre où ils arrivent.
// ============================================================

import { AGENTS_CONFIG } from '../agents.js';
import { createBotMessage, highlightIn, scrollToBottom, escapeHtml } from './dom.js';
import { formatResponse } from './format.js';
import { createToolCard } from './tool-card.js';
import { renderSources } from './chips.js';
import { ICONS } from './icons.js';

const SUGGESTIONS = {
    code: ['Explique ligne par ligne', 'Optimise les performances', 'Génère les tests unitaires'],
    creatif: ['Développe la scène suivante', 'Réécris en style plus dense', 'Ajoute un retournement dramatique'],
    strategie: ['Donne-moi les indicateurs clés', 'Quels sont les risques ?', "Plan d'action sur 30 jours"],
    audit: ['Propose les corrections', 'Synthèse exécutive', "Relancer l'audit après correction"],
    recherche: ["Creuse l'angle opposé", 'Sources primaires', "Impact en Afrique de l'Ouest ?"],
    visionnaire: ['Effets de troisième ordre ?', 'Analogie dans un autre domaine', "L'insight contre-intuitif ?"],
    default: ['Résume en 3 points', 'Approfondis ce point', 'Explique différemment'],
};

export class TurnView {
    constructor(agentId) {
        const agent = agentId && AGENTS_CONFIG[agentId];
        const { msgDiv, label, bubble } = createBotMessage('Pensée');
        if (agent) label.innerHTML = `Pensée · ${agent.icon} ${escapeHtml(agent.label)}`;
        bubble.remove();

        this.agentId = agentId;
        this.msgDiv = msgDiv;
        this.flow = document.createElement('div');
        this.flow.className = 'pz-flow';
        msgDiv.appendChild(this.flow);

        this.segments = [];
        this.cur = null;
        this.think = null;
        this.cards = new Map();
        this.emotionDone = false;
        this.renderQueued = false;

        this.waiting = document.createElement('div');
        this.waiting.className = 'typing-bubble';
        this.waiting.innerHTML = '<span></span><span></span><span></span>';
        this.flow.appendChild(this.waiting);
    }

    _stopWaiting() {
        this.waiting?.remove();
        this.waiting = null;
    }

    emotion(v) {
        if (this.emotionDone) return;
        this.emotionDone = true;
        try { window._penseeThinkingUI?.onEmotion?.(JSON.stringify(v), this.msgDiv); } catch (_) { /* hook optionnel */ }
    }

    // ── Réflexion ────────────────────────────────────────────
    thinking(s) {
        this._stopWaiting();
        if (!this.think) {
            this._endSegment();
            const el = document.createElement('div');
            el.className = 'pz-think live';
            if (localStorage.getItem('pensee_show_thinking') !== 'false') el.classList.add('open');
            el.innerHTML = `<button type="button" class="pz-think-head">${ICONS.brain}<span class="pz-think-title">Réflexion en cours</span><span class="pz-think-time">0s</span>${ICONS.chevron}</button><div class="pz-think-body"></div>`;
            el.querySelector('.pz-think-head').addEventListener('click', () => el.classList.toggle('open'));
            this.flow.appendChild(el);
            const start = Date.now();
            const timeEl = el.querySelector('.pz-think-time');
            this.think = {
                el, start, text: '',
                body: el.querySelector('.pz-think-body'),
                timer: setInterval(() => { timeEl.textContent = Math.floor((Date.now() - start) / 1000) + 's'; }, 1000),
            };
        }
        this.think.text += s;
        this.think.body.textContent = this.think.text;
        this.think.body.scrollTop = this.think.body.scrollHeight;
        scrollToBottom();
    }

    _closeThinking() {
        if (!this.think) return;
        clearInterval(this.think.timer);
        const secs = Math.max(1, Math.round((Date.now() - this.think.start) / 1000));
        this.think.el.classList.remove('live', 'open');
        this.think.el.querySelector('.pz-think-title').textContent = 'Réflexion';
        this.think.el.querySelector('.pz-think-time').textContent = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
        this.think = null;
    }

    // ── Texte ────────────────────────────────────────────────
    text(s) {
        this._stopWaiting();
        this._closeThinking();
        if (!this.cur) {
            const el = document.createElement('div');
            el.className = 'bubble pz-seg';
            this.flow.appendChild(el);
            this.cur = { el, text: '' };
            this.segments.push(this.cur);
        }
        this.cur.text += s;
        this._queueRender();
    }

    _queueRender() {
        if (this.renderQueued) return;
        this.renderQueued = true;
        requestAnimationFrame(() => {
            this.renderQueued = false;
            if (!this.cur || document.hidden) return;
            this.cur.el.innerHTML = formatResponse(this.cur.text);
            scrollToBottom();
        });
    }

    _endSegment() {
        if (!this.cur) return;
        this.cur.el.innerHTML = formatResponse(this.cur.text);
        highlightIn(this.cur.el);
        this.cur = null;
    }

    // ── Outils ───────────────────────────────────────────────
    toolStart(ev) {
        this._stopWaiting();
        this._closeThinking();
        this._endSegment();
        const card = createToolCard(ev);
        this.flow.appendChild(card.el);
        this.cards.set(ev.id, card);
        scrollToBottom();
        return card;
    }

    toolEnd(id, res) {
        this.cards.get(id)?.finish(res);
    }

    /** Élément libre (livrable, avertissement) ajouté au fil de la réponse. */
    append(node) {
        this._endSegment();
        this.flow.appendChild(node);
        scrollToBottom();
    }

    note(text, kind = 'info') {
        const div = document.createElement('div');
        div.className = `pz-note pz-note-${kind}`;
        div.textContent = text;
        this.append(div);
    }

    fullText() {
        return this.segments.map(s => s.text.trim()).filter(Boolean).join('\n\n');
    }

    /** Remplace le texte d'un segment (ex. suppression d'un marqueur hérité). */
    rewriteSegments(fn) {
        for (const seg of this.segments) {
            seg.text = fn(seg.text);
            seg.el.innerHTML = formatResponse(seg.text);
            highlightIn(seg.el);
        }
    }

    // ── Fin de tour ──────────────────────────────────────────
    finalize({ sources = [], onAudit, onSuggestion } = {}) {
        this._stopWaiting();
        this._closeThinking();
        this._endSegment();
        this.segments.forEach(s => { if (!s.text.trim()) s.el.remove(); });

        const text = this.fullText();
        if (!text && !this.cards.size && !this.flow.querySelector('.pz-deliverable')) {
            this.note('Réponse vide. Reformule ou renvoie ton message.', 'warn');
        }

        if (sources.length) this.msgDiv.appendChild(renderSources(sources));

        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        actions.appendChild(this._copyButton(text));
        if ('speechSynthesis' in window && text) actions.appendChild(this._ttsButton());
        if (onAudit && (this.agentId === 'code' || this.agentId === 'strategie')) {
            const b = document.createElement('button');
            b.className = 'copy-btn';
            b.innerHTML = `${ICONS.shield}Auditer`;
            b.title = 'Lancer un audit strict (avec preuve par exécution) sur cette réponse';
            b.addEventListener('click', () => { b.disabled = true; onAudit(text); });
            actions.appendChild(b);
        }
        this.msgDiv.appendChild(actions);

        if (onSuggestion) {
            const pills = document.createElement('div');
            pills.className = 'pz-pills';
            for (const s of SUGGESTIONS[this.agentId] || SUGGESTIONS.default) {
                const pill = document.createElement('button');
                pill.className = 'pz-pill';
                pill.textContent = s;
                pill.addEventListener('click', () => { pills.remove(); onSuggestion(s); });
                pills.appendChild(pill);
            }
            this.msgDiv.appendChild(pills);
        }
        scrollToBottom();
    }

    fail(message) {
        this._stopWaiting();
        this._closeThinking();
        this._endSegment();
        this.note('· ' + message, 'error');
    }

    _copyButton(text) {
        const b = document.createElement('button');
        b.className = 'copy-btn';
        b.innerHTML = ICONS.copy + 'Copier';
        b.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(text);
                b.innerHTML = ICONS.check + 'Copié !';
                setTimeout(() => { b.innerHTML = ICONS.copy + 'Copier'; }, 2000);
            } catch { b.textContent = 'Erreur'; }
        });
        return b;
    }

    _ttsButton() {
        const b = document.createElement('button');
        b.className = 'copy-btn';
        b.innerHTML = ICONS.sound + 'Écouter';
        b.title = 'Lire la réponse à voix haute';
        let speaking = false;
        const reset = () => { b.innerHTML = ICONS.sound + 'Écouter'; speaking = false; };
        b.addEventListener('click', () => {
            if (speaking) { speechSynthesis.cancel(); reset(); return; }
            const raw = this.segments.map(s => s.el.innerText).join('. ')
                .replace(/#{1,6}\s/g, '').replace(/[*_`~]/g, '').replace(/\n{2,}/g, '. ').trim();
            const u = new SpeechSynthesisUtterance(raw);
            u.lang = 'fr-FR';
            u.rate = 0.95;
            const fr = speechSynthesis.getVoices().find(v => v.lang.startsWith('fr'));
            if (fr) u.voice = fr;
            u.onend = reset;
            u.onerror = reset;
            speechSynthesis.speak(u);
            b.textContent = '⏹ Arrêter';
            speaking = true;
        });
        return b;
    }
}
