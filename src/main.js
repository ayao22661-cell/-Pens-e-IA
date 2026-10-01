// ============================================================
//  PENSÉE IA — src/main.js
//  Point d'entrée : initialisation et envoi des messages.
// ============================================================

import { state } from './state.js';
import { initAuth } from './auth.js';
import { loadCredits, renderCredits, setCredits, setQuota, isBlocked, initUsageMenu } from './credits.js';
import { initTabs, initSidebar, saveMessage, updateTabTitle } from './conversations.js';
import { initMemoryPanel, searchMemory, memorizeText } from './memory.js';
import { initFileInputs, clearAttachments, uploadAttachments } from './files.js';
import { AGENTS_CONFIG, detectAgent, initAgentSelector, setActiveAgent, handleAgentCommand, updateAgentBadge } from './agents.js';
import { generateImage } from './generators.js';
import { getAccessToken } from './supabase.js';
import { runAgentTurn } from './agent/loop.js';
import { initCodeRunner } from './sandbox/code-runner.js';
import { initTerminal, terminal } from './ui/terminal.js';
import { initVoiceInput } from './ui/voice-input.js';
import { TurnView } from './ui/turn-view.js';
import { mountBrand } from './ui/brand.js';
import { els, escapeHtml, addMessage, addUserMessageWithFiles, showTyping, removeTyping, setStatus } from './ui/dom.js';
import { ICONS } from './ui/icons.js';

// ── Zone de saisie ───────────────────────────────────────────
function refreshSendButton() {
    const hasContent = els.userInput.value.trim().length > 0 || state.attachedFiles.length > 0;
    els.sendBtn.classList.toggle('hidden-action', !state.busy && !hasContent);
    els.sendBtn.disabled = !state.busy && isBlocked();
}

function setBusy(busy) {
    state.busy = busy;
    els.sendBtn.innerHTML = busy ? ICONS.stop : ICONS.send;
    els.sendBtn.title = busy ? 'Arrêter la génération' : 'Envoyer';
    els.sendBtn.classList.toggle('pz-stop', busy);
    refreshSendButton();
}

function clearInput() {
    els.userInput.value = '';
    els.userInput.style.height = 'auto';
    refreshSendButton();
}

// ── Commandes ────────────────────────────────────────────────
async function handleCommand(text) {
    if (text === '/profil reset') {
        localStorage.removeItem('pensee_user_profile');
        addMessage('user', text);
        addMessage('bot', '· Profil effacé. Pensée repartira sans contexte utilisateur.');
        return true;
    }
    if (text.startsWith('/profil ')) {
        const profile = text.slice(8).trim();
        if (profile) {
            localStorage.setItem('pensee_user_profile', profile);
            addMessage('user', text);
            addMessage('bot', `<strong>Profil enregistré.</strong> Pensée adaptera désormais chaque réponse à ce contexte :<blockquote>${escapeHtml(profile)}</blockquote>Tape <code>/profil reset</code> pour effacer.`, true);
        }
        return true;
    }
    if (text.startsWith('/memo ')) {
        const raw = text.slice(6).trim();
        const isGlobal = raw.startsWith('global ');
        const content = isGlobal ? raw.slice(7).trim() : raw;
        if (!content) return true;
        addMessage('user', text);
        showTyping();
        const ok = await memorizeText(content, isGlobal);
        removeTyping();
        addMessage('bot', !ok ? '· Mémorisation impossible pour le moment.'
            : isGlobal ? '· <strong>Mémoire GLOBALE sauvegardée.</strong> Accessible dans toutes tes conversations.'
            : '· <strong>Mémoire locale sauvegardée.</strong> Disponible dans cette conversation.', true);
        return true;
    }
    if (/^\/(fichiers|terminal)\b/.test(text)) {
        terminal.open(text.startsWith('/fichiers') ? 'files' : 'log');
        return true;
    }
    if (text.startsWith('/image ')) {
        const prompt = text.slice(7).trim();
        if (!prompt) return true;
        addMessage('user', text);
        await saveMessage('user', text);
        state.history.push({ role: 'user', content: text });
        const view = new TurnView(null);
        try {
            const { element, url } = await generateImage(prompt);
            view.append(element);
            state.history.push({ role: 'assistant', content: `[IMAGE_URL:${url}|${prompt}|]` });
        } catch (e) {
            view.fail('Génération échouée : ' + e.message);
        }
        view.finalize();
        return true;
    }
    return handleAgentCommand(text);
}

// ── Agent du message ─────────────────────────────────────────
function resolveAgent(text) {
    if (state.activeAgentId) return state.activeAgentId;
    const detected = detectAgent(text);
    if (detected) {
        // Verrouillé pour la suite de la conversation, comme avant
        setActiveAgent(detected);
        addMessage('bot', `<span class="pz-muted" style="font-size:11px"><em>Pensée a auto-détecté le contexte et verrouillé l'agent <strong>${AGENTS_CONFIG[detected].label}</strong>.</em></span>`, true);
    }
    return detected;
}

// ── Un tour complet : sauvegarde, boucle d'agent, rendu final ──
async function runTurn({ text, dbText = text, files = [], agentId }) {
    const tabId = state.activeTabId;
    const controller = new AbortController();
    state.abortController = controller;
    setBusy(true);
    updateAgentBadge(agentId);

    const view = new TurnView(agentId);
    let result = null;

    try {
        const links = files.length ? await uploadAttachments(files) : [];
        const storedUserText = links.length ? `**Fichiers joints :** ${links.join(' | ')}\n\n${dbText}` : dbText;
        const [, memory] = await Promise.all([saveMessage('user', storedUserText, tabId), searchMemory(text)]);

        result = await runAgentTurn({ userText: text, files, agentId, memory, view, signal: controller.signal });

        view.finalize({
            sources: result.sources,
            onAudit: () => {
                if (state.busy) return;
                const label = 'Lance un audit strict sur ta dernière proposition.';
                addMessage('user', label);
                runTurn({
                    agentId: 'audit',
                    dbText: label,
                    text: "Audite ta dernière proposition par rapport à ma demande initiale : bugs, sécurité, logique, performance, cohérence. "
                        + "Prouve tes conclusions en exécutant du code (run_python) quand c'est pertinent. "
                        + "Réponds par [VALIDE] si c'est prêt pour la production, sinon [À CORRIGER] avec un rapport chirurgical.",
                }).finally(() => updateAgentBadge(state.activeAgentId));
            },
            onSuggestion: (s) => { els.userInput.value = s; els.userInput.focus(); refreshSendButton(); },
        });

        await persistAssistant(tabId, storedUserText, result);
        saveKnowledge(text, result.text, agentId);
        setStatus(isBlocked() ? 'warn' : 'ok');
    } catch (e) {
        if (e.name === 'AbortError') {
            view.note('Génération arrêtée.', 'warn');
            const partial = view.fullText();
            if (partial && state.activeTabId === tabId) {
                await persistAssistant(tabId, dbText, { text: partial + '\n\n*[Génération interrompue]*', sources: [], trace: [] });
            }
        } else {
            view.fail(e.message || 'Erreur réseau.');
            if (e.status === 429 && e.data?.quota) setQuota(e.data.quota);
            else if (e.status === 403) setCredits(0);
            setStatus('err');
        }
    } finally {
        if (state.abortController === controller) state.abortController = null;
        setBusy(false);
    }
}

async function persistAssistant(tabId, userContent, { text, sources = [], trace = [] }) {
    let content = text || '';
    if (trace.length) content += `\n[TOOL_TRACE:${JSON.stringify(trace)}]`;
    if (sources.length) content += `\n[WEB_SOURCES:${JSON.stringify(sources.map(s => ({ n: s.n, title: s.title || '', url: s.url })))}]`;
    if (state.activeTabId === tabId) {
        state.history.push({ role: 'user', content: userContent });
        if (content.trim()) state.history.push({ role: 'assistant', content });
    }
    if (content.trim()) await saveMessage('assistant', content, tabId);
}

// Exemple few-shot + profil appris (fire-and-forget)
async function saveKnowledge(prompt, response, agentId) {
    if (!response || response.length < 80) return;
    try {
        const token = await getAccessToken();
        if (!token) return;
        const complexity = Math.min(5, 1 + (prompt.length > 500) + (prompt.length > 2000)
            + [/architectur|refactoris|optimis/i, /système|application|projet/i, /compare|analyse|audit/i, /algorithme|performance/i]
                .filter(p => p.test(prompt)).length);
        await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                action: 'save', prompt, response: response.slice(0, 2000),
                agentId: agentId || 'default', complexity, domain: agentId || 'default',
            }),
        });
    } catch (_) { /* jamais bloquant */ }
}

// ── Envoi ────────────────────────────────────────────────────
async function sendMessage() {
    if (state.busy) {                        // le bouton sert alors de "Stop"
        state.abortController?.abort();
        return;
    }
    const text = els.userInput.value.trim();
    const files = state.attachedFiles.slice();
    if (!text && !files.length) return;

    if (!files.length && text.startsWith('/')) {
        clearInput();
        if (await handleCommand(text)) return;
    }
    if (isBlocked()) {
        addMessage('bot', state.quota ? '· Limite de ta fenêtre atteinte : regarde le bandeau pour l’heure de réinitialisation.' : '· Crédits épuisés. Reviens demain !');
        return;
    }

    const sug = document.getElementById('suggestions');
    if (sug) sug.style.display = 'none';

    const messageText = text || 'Analyse ce fichier et explique ce qu\'il fait.';
    if (files.length) addUserMessageWithFiles(text, files);
    else addMessage('user', text);

    if (text && state.activeTabId) updateTabTitle(state.activeTabId, text);
    clearInput();
    clearAttachments();

    await runTurn({ text: messageText, files, agentId: resolveAgent(messageText) });
    els.userInput.focus();
}

// ── Initialisation ───────────────────────────────────────────
function init() {
    mountBrand();
    initAgentSelector();
    initSidebar();
    initFileInputs();
    initVoiceInput();
    initCodeRunner();
    initTerminal();
    initMemoryPanel();
    initUsageMenu();
    renderCredits();
    setStatus('ok');

    els.sendBtn.addEventListener('click', sendMessage);
    els.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    els.userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        refreshSendButton();
    });
    window.addEventListener('pensee:input', refreshSendButton);
    window.useSuggestion = (el) => { els.userInput.value = el.textContent; els.userInput.focus(); refreshSendButton(); };

    initAuth(async () => {
        await loadCredits();
        refreshSendButton();
        initTabs();
    });
}

init();
