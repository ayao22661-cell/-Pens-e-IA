// ============================================================
//  PENSÉE IA — src/memory.js
//  Mémoire vectorielle (RAG) par conversation + mémoire globale.
// ============================================================

import { state } from './state.js';
import { supabase } from './supabase.js';
import { escapeHtml } from './ui/dom.js';

const CACHE_TTL = 30000;
const _cache = new Map(); // `${userId}_${tabId}` → { data, ts }

async function getEmbedding(text) {
    const res = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Embed API ${res.status} : ${err.error || 'inconnue'}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.embedding)) throw new Error('Embed API : vecteur absent');
    return data.embedding;
}

/** @returns {Promise<string>} les souvenirs pertinents, concaténés */
export async function searchMemory(query) {
    if (!state.currentUser || !state.activeTabId) return '';
    const key = `${state.currentUser.id}_${state.activeTabId}`;
    const cached = _cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

    try {
        const vector = await getEmbedding(query);
        const { data, error } = await supabase.rpc('match_memories', {
            query_embedding: `[${vector.join(',')}]`,
            match_threshold: 0.5,
            match_count: 3,
            p_user_id: state.currentUser.id,
            p_workspace_id: state.activeTabId,
        });
        if (error) throw error;
        const text = (data || []).map(m => m.content).join('\n\n');
        _cache.set(key, { data: text, ts: Date.now() });
        return text;
    } catch (e) {
        console.warn('[RAG] searchMemory échoué :', e.message);
        return '';
    }
}

export async function memorizeText(content, isGlobal = false) {
    if (!state.currentUser || !state.activeTabId) return false;
    try {
        const vector = await getEmbedding(content);
        const record = {
            user_id: state.currentUser.id,
            content,
            embedding: `[${vector.join(',')}]`,
            is_global: isGlobal,
        };
        if (!isGlobal) record.workspace_id = state.activeTabId;
        const { error } = await supabase.from('memories').insert([record]);
        if (error) throw error;
        _cache.delete(`${state.currentUser.id}_${state.activeTabId}`);
        return true;
    } catch (e) {
        console.error('Mémorisation impossible :', e.message);
        return false;
    }
}

// ── Panneau mémoire (audit & suppression) ────────────────────
async function renderMemoryTab(tab) {
    document.querySelectorAll('.mem-tab').forEach((b, i) => {
        b.classList.toggle('active', (i === 0 && tab === 'local') || (i === 1 && tab === 'global'));
    });
    const content = document.getElementById('memTabContent');
    if (!content) return;
    content.innerHTML = '<em class="pz-muted">Chargement...</em>';

    let query = supabase
        .from('memories')
        .select('id, content, created_at, is_global')
        .eq('user_id', state.currentUser.id)
        .order('created_at', { ascending: false });
    query = tab === 'local'
        ? query.eq('workspace_id', state.activeTabId).eq('is_global', false)
        : query.eq('is_global', true);

    const { data, error } = await query;
    if (error || !data?.length) {
        const hint = tab === 'local' ? '<code>/memo [info]</code>' : '<code>/memo global [info]</code>';
        content.innerHTML = `<em class="pz-muted">Aucune mémoire ici.<br>Utilise ${hint}</em>`;
        return;
    }
    content.innerHTML = '';
    for (const mem of data) {
        const item = document.createElement('div');
        item.className = 'pz-mem-item';
        const preview = escapeHtml(mem.content.slice(0, 120)) + (mem.content.length > 120 ? '…' : '');
        item.innerHTML = `<span>${preview}</span><button title="Supprimer" class="pz-icon-btn">✕</button>`;
        item.querySelector('button').addEventListener('click', async () => {
            await supabase.from('memories').delete().eq('id', mem.id);
            _cache.clear();
            renderMemoryTab(tab);
        });
        content.appendChild(item);
    }
}
window.renderMemoryTab = renderMemoryTab;

async function loadMemoryPanel() {
    if (!state.currentUser || !state.activeTabId) return;
    const list = document.getElementById('memoryList');
    if (!list) return;
    list.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button class="mem-tab active" data-tab="local">Cette conv.</button>
            <button class="mem-tab" data-tab="global">Globale</button>
        </div>
        <div id="memTabContent"></div>`;
    list.querySelectorAll('.mem-tab').forEach(b => b.addEventListener('click', () => renderMemoryTab(b.dataset.tab)));
    renderMemoryTab('local');
}

export function initMemoryPanel() {
    document.getElementById('memoryBtn')?.addEventListener('click', async () => {
        const panel = document.getElementById('memoryPanel');
        if (!panel) return;
        const visible = panel.style.display !== 'none';
        panel.style.display = visible ? 'none' : 'block';
        document.getElementById('morePanel').style.display = 'none';
        if (!visible) await loadMemoryPanel();
    });
}
