// ============================================================
//  PENSÉE IA — src/conversations.js
//  Conversations (onglets), historique Supabase, export .md.
// ============================================================

import { state, setActiveTabId } from './state.js';
import { supabase } from './supabase.js';
import { loadCredits } from './credits.js';
import { els, escapeHtml, highlightIn, fileChipHtml } from './ui/dom.js';
import { formatResponse } from './ui/format.js';
import { renderSources, renderToolTrace } from './ui/chips.js';
import { ICONS } from './ui/icons.js';

const NEW_TITLE = 'Nouvelle conv.';
const ACTIVE_KEY = 'pensee_ia_active_tab';

// ── Chargement / création / suppression ─────────────────────
async function loadTabs() {
    if (!state.currentUser) return [];
    const { data, error } = await supabase.from('conversations').select('*').order('created_at', { ascending: false });
    if (error) console.error('Erreur chargement conversations :', error);
    return data || [];
}

export async function createTab(switchTo = true) {
    if (!state.currentUser) return null;
    const { data, error } = await supabase
        .from('conversations')
        .insert([{ user_id: state.currentUser.id, title: NEW_TITLE }])
        .select()
        .single();
    if (error) { console.error('Erreur création conversation :', error); return null; }
    state.tabs.unshift(data);
    if (switchTo) switchTab(data.id);
    else renderTabs();
    return data.id;
}

async function deleteTab(id) {
    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) { console.error('Erreur suppression :', error); return; }
    const idx = state.tabs.findIndex(t => t.id === id);
    state.tabs = state.tabs.filter(t => t.id !== id);
    if (!state.tabs.length) await createTab(true);
    else if (state.activeTabId === id) switchTab(state.tabs[Math.min(idx, state.tabs.length - 1)].id);
    else renderTabs();
}

export function switchTab(id) {
    state.abortController?.abort(); // un flux en cours n'écrit pas dans la nouvelle conversation
    setActiveTabId(id);
    sessionStorage.setItem(ACTIVE_KEY, id);
    state.history = [];
    loadHistory();
    loadCredits();
    renderTabs();
    window.dispatchEvent(new CustomEvent('pensee:tab', { detail: { id } }));
}
window.switchTab = switchTab;

export async function updateTabTitle(id, firstUserMsg) {
    const tab = state.tabs.find(t => t.id === id);
    if (!tab || tab.title !== NEW_TITLE) return;
    const title = firstUserMsg.slice(0, 28) + (firstUserMsg.length > 28 ? '…' : '');
    const { error } = await supabase.from('conversations').update({ title }).eq('id', id);
    if (error) return;
    tab.title = title;
    renderTabs();
}

let _initialized = false;
export async function initTabs() {
    if (_initialized) return;
    _initialized = true;
    state.tabs = await loadTabs();

    if (state.tabs.length) {
        const last = sessionStorage.getItem(ACTIVE_KEY);
        setActiveTabId(state.tabs.some(t => t.id === last) ? last : state.tabs[0].id);
    } else {
        const id = await createTab(false);
        if (id) setActiveTabId(id);
    }
    if (state.activeTabId) sessionStorage.setItem(ACTIVE_KEY, state.activeTabId);
    renderTabs();
    loadHistory();
    window.dispatchEvent(new CustomEvent('pensee:tab', { detail: { id: state.activeTabId } }));
}

// ── Barre latérale ───────────────────────────────────────────
function convItem(tab) {
    const el = document.createElement('div');
    el.className = 'conv-item' + (tab.id === state.activeTabId ? ' active' : '');
    el.dataset.id = tab.id;

    const title = document.createElement('span');
    title.className = 'conv-item-title';
    title.textContent = tab.title;
    title.addEventListener('click', () => {
        if (tab.id !== state.activeTabId) switchTab(tab.id);
        closeSidebarMobile();
    });

    const del = document.createElement('button');
    del.className = 'conv-item-del';
    del.title = 'Supprimer';
    del.innerHTML = ICONS.trash;
    del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.tabs.length === 1 || confirm('Supprimer cette conversation ?')) deleteTab(tab.id);
    });

    el.append(title, del);
    return el;
}

export function renderTabs() {
    window._pensee_tabs = state.tabs;
    const list = document.getElementById('convList');
    if (!list) return;
    list.innerHTML = '';

    const todayStart = new Date().setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart - 86400000;
    const groups = [
        { label: "Aujourd'hui", items: [] },
        { label: 'Hier', items: [] },
        { label: 'Plus ancien', items: [] },
    ];
    for (const tab of state.tabs) {
        const ts = new Date(tab.created_at).getTime();
        groups[ts >= todayStart ? 0 : ts >= yesterdayStart ? 1 : 2].items.push(tab);
    }
    for (const g of groups) {
        if (!g.items.length) continue;
        const label = document.createElement('div');
        label.className = 'conv-section-label';
        label.textContent = g.label;
        list.appendChild(label);
        g.items.forEach(tab => list.appendChild(convItem(tab)));
    }

    const active = state.tabs.find(t => t.id === state.activeTabId);
    const titleEl = document.getElementById('activeConvTitle');
    if (titleEl && active) titleEl.textContent = active.title;
}

// Filtre par dossier (appelé par ui-enrich.js)
window._pensee_filterTabs = function (filtered) {
    const list = document.getElementById('convList');
    if (!list) return;
    list.innerHTML = '';
    if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'conv-section-label';
        empty.style.fontStyle = 'italic';
        empty.textContent = 'Aucune conversation dans ce dossier';
        list.appendChild(empty);
        return;
    }
    filtered.forEach(tab => {
        const el = convItem(tab);
        el.dataset.dragReady = '';
        list.appendChild(el);
    });
};
window._pensee_restoreAllTabs = () => renderTabs();

export function closeSidebarMobile() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('visible');
}

export function initSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        sb.classList.toggle('open');
        ov.classList.toggle('visible');
    });
    ov?.addEventListener('click', closeSidebarMobile);
    document.getElementById('newConvSideBtn')?.addEventListener('click', () => {
        createTab(true);
        closeSidebarMobile();
    });
    document.getElementById('clearBtn')?.addEventListener('click', () => createTab(true));
    document.getElementById('exportBtn')?.addEventListener('click', exportConversation);
}

// ── Historique ───────────────────────────────────────────────
function showWelcome() {
    els.messages.innerHTML = '';
    const sug = document.getElementById('suggestions');
    if (sug) sug.style.display = 'flex';
}

function parseJsonMarker(content, name) {
    const m = content.match(new RegExp(`\\[${name}:(\\[[\\s\\S]*?\\])\\]`));
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch { return null; }
}

async function resolveSecureFiles(content) {
    const regex = /\[SECURE_FILE:([^\]]+)\]\(([^)]+)\)/g;
    let out = content;
    for (const [whole, name, path] of [...content.matchAll(regex)]) {
        const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 3600);
        out = out.replace(whole, !error && data ? `[${name}](${data.signedUrl})` : '[Fichier expiré ou inaccessible]');
    }
    return out;
}

async function renderStoredMessage(msg) {
    let content = msg.content || '';
    if (content.includes('[SECURE_FILE:')) content = await resolveSecureFiles(content);

    const wrap = (labelText) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'msg ' + (msg.role === 'assistant' ? 'bot' : 'user');
        const lbl = document.createElement('span');
        lbl.className = 'msg-label';
        lbl.textContent = labelText;
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        msgDiv.append(lbl, bubble);
        els.messages.appendChild(msgDiv);
        return { msgDiv, bubble };
    };

    // Image générée : [IMAGE_URL:url|prompt|storagePath]
    const img = content.match(/^\[IMAGE_URL:([^|]*)\|([^|]*)(?:\|([^\]]*))?\]$/);
    if (img || /^\[IMAGE_B64:/.test(content)) {
        const { bubble } = wrap('Pensée · Image générée');
        if (!img) {
            bubble.innerHTML = '<em class="pz-muted">Image générée (ancien format, non récupérable). Régénère-la si besoin.</em>';
            return;
        }
        const alt = img[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        bubble.innerHTML = `<img src="${escapeHtml(img[1])}" alt="${escapeHtml(alt)}" class="pz-gen-image" loading="lazy">`
            + `<a href="${escapeHtml(img[1])}" target="_blank" rel="noopener" class="pz-dl-link">${ICONS.download} Télécharger</a>`;
        bubble.querySelector('img').addEventListener('error', function () {
            this.replaceWith(Object.assign(document.createElement('em'), { className: 'pz-error', textContent: 'Image expirée ou indisponible.' }));
        });
        return;
    }

    // Fichier généré : [FILE_URL:url|label|storagePath]
    const file = content.match(/^\[FILE_URL:([^|]*)\|([^|]*)\|([^\]]*)\]$/);
    if (file) {
        const { bubble } = wrap('Pensée · Fichier généré');
        let url = file[1];
        if (file[3]) {
            const { data } = await supabase.storage.from('attachments').createSignedUrl(file[3], 60 * 60 * 24 * 30).catch(() => ({}));
            if (data?.signedUrl) url = data.signedUrl;
        }
        bubble.innerHTML = fileChipHtml(url, file[2], { expires: true });
        return;
    }

    const { msgDiv, bubble } = wrap(msg.role === 'assistant' ? 'Pensée' : 'Toi');
    const trace = msg.role === 'assistant' ? parseJsonMarker(content, 'TOOL_TRACE') : null;
    if (trace?.length) msgDiv.insertBefore(renderToolTrace(trace), bubble);
    bubble.innerHTML = formatResponse(content);
    highlightIn(bubble);
    const sources = parseJsonMarker(content, 'WEB_SOURCES');
    if (sources?.length) msgDiv.appendChild(renderSources(sources));
}

export async function loadHistory() {
    const tabId = state.activeTabId;
    els.messages.innerHTML = '';
    state.history = [];
    if (!tabId || !state.currentUser) return showWelcome();

    const { data, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', tabId)
        .order('created_at', { ascending: true });

    if (tabId !== state.activeTabId) return; // l'utilisateur a changé d'onglet entre-temps
    if (error || !data?.length) return showWelcome();

    state.history = data;
    for (const msg of data) {
        await renderStoredMessage(msg);
        if (tabId !== state.activeTabId) return;
    }
    els.messages.scrollTop = els.messages.scrollHeight;
    const sug = document.getElementById('suggestions');
    if (sug) sug.style.display = 'none';
}

export async function saveMessage(role, content, tabId = state.activeTabId) {
    if (!tabId || !state.currentUser) return;
    const { error } = await supabase.from('messages').insert([{
        conversation_id: tabId, user_id: state.currentUser.id, role, content,
    }]);
    if (error) console.error('Erreur de sauvegarde du message :', error);
    pruneMessages(tabId).catch(e => console.warn('Purge silencieuse :', e.message));
}

// Garde les 200 derniers messages par conversation (arrière-plan)
async function pruneMessages(conversationId, max = 200) {
    const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
    if (error || !data || data.length <= max) return;
    const ids = data.slice(max).map(m => m.id);
    const { error: delErr } = await supabase.from('messages').delete().in('id', ids);
    if (delErr) console.warn('Erreur purge messages :', delErr.message);
}

// ── Export Markdown ──────────────────────────────────────────
export function exportConversation() {
    if (!state.history.length) { alert('Aucun message à exporter dans cette conversation.'); return; }
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    const title = tab ? tab.title : 'conversation';
    let md = `# ${title}\n_Exporté depuis Pensée IA — ${new Date().toLocaleDateString('fr-FR')}_\n\n---\n\n`;
    for (const msg of state.history) {
        const body = String(msg.content)
            .replace(/\n?\[WEB_SOURCES:\[[\s\S]*?\]\]/g, '')
            .replace(/\n?\[TOOL_TRACE:\[[\s\S]*?\]\]/g, '');
        md += `${msg.role === 'user' ? '**Toi**' : '**Pensée**'}\n\n${body}\n\n---\n\n`;
    }
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pensee-${title.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
