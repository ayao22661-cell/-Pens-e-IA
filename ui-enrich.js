// ============================================================
//  PENSÉE IA — ui-enrich.js  v2.0
//  Dossiers + Artefacts — Supabase sync — Drag & Drop
//  Zéro modification de ia.js requis (sauf window.currentUser)
// ============================================================

(function () {
    'use strict';

    // ── ATTENTE currentUser + supabase exposés par ia.js ──────
    function waitFor(fn, interval = 300, timeout = 12000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const id = setInterval(() => {
                const r = fn();
                if (r) { clearInterval(id); resolve(r); }
                else if (Date.now() - start > timeout) { clearInterval(id); reject('timeout'); }
            }, interval);
        });
    }

    let SB = null;   // client supabase
    let UID = null;  // user id

    // ── SUPABASE — DOSSIERS ────────────────────────────────────

    async function dbGetFolders() {
        const { data } = await SB.from('folders')
            .select('*')
            .eq('user_id', UID)
            .order('created_at', { ascending: true });
        return data || [];
    }

    async function dbCreateFolder(name) {
        const { data } = await SB.from('folders')
            .insert([{ user_id: UID, name }])
            .select().single();
        return data;
    }

    async function dbDeleteFolder(id) {
        // Les conversations dans ce dossier reprennent folder_id = null (ON DELETE SET NULL)
        await SB.from('folders').delete().eq('id', id);
    }

    async function dbMoveConvToFolder(convId, folderId) {
        await SB.from('conversations')
            .update({ folder_id: folderId })
            .eq('id', convId);
    }

    // ── SUPABASE — ARTEFACTS ───────────────────────────────────

    async function dbGetArtifacts() {
        const { data } = await SB.from('artifacts')
            .select('id, title, conversation_id, created_at')
            .eq('user_id', UID)
            .order('created_at', { ascending: false });
        return data || [];
    }

    async function dbCreateArtifact(conversationId, title) {
        const { data } = await SB.from('artifacts')
            .insert([{ user_id: UID, conversation_id: conversationId, title }])
            .select().single();
        return data;
    }

    async function dbDeleteArtifact(id) {
        await SB.from('artifacts').delete().eq('id', id);
    }

    // ── RENDER — NOM UTILISATEUR ───────────────────────────────

    function renderUser(user) {
        const email = user?.email || '';
        const pseudo = email.split('@')[0] || '?';
        const initial = pseudo.charAt(0).toUpperCase();
        const avatar = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        if (avatar) avatar.textContent = initial;
        if (nameEl)  nameEl.textContent = pseudo;
    }

    // ── RENDER — DOSSIERS ──────────────────────────────────────

    async function renderFolders() {
        const container = document.getElementById('folderList');
        if (!container) return;

        const folders = await dbGetFolders();
        container.innerHTML = '';

        if (folders.length === 0) {
            container.innerHTML = `<div class="enrich-empty">Aucun dossier</div>`;
            return;
        }

        folders.forEach(f => {
            const row = document.createElement('div');
            row.className = 'enrich-row enrich-folder-row';
            row.dataset.folderId = f.id;
            // Zone de drop
            row.addEventListener('dragover', e => {
                e.preventDefault();
                row.classList.add('drag-over');
            });
            row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
            row.addEventListener('drop', async e => {
                e.preventDefault();
                row.classList.remove('drag-over');
                const convId = e.dataTransfer.getData('convId');
                if (!convId) return;
                await dbMoveConvToFolder(convId, f.id);
                showToast(`Conversation déplacée dans « ${f.name} »`);
            });

            row.innerHTML = `
                <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h6l2 2h8v10H2V5z"/></svg>
                <span class="enrich-row-label">${escHtml(f.name)}</span>
                <button class="enrich-del-btn" title="Supprimer le dossier">×</button>
            `;
            row.querySelector('.enrich-del-btn').addEventListener('click', async e => {
                e.stopPropagation();
                if (!confirm(`Supprimer le dossier « ${f.name} » ? Les conversations seront conservées.`)) return;
                await dbDeleteFolder(f.id);
                renderFolders();
            });
            container.appendChild(row);
        });
    }

    async function createFolder() {
        const name = prompt('Nom du dossier :');
        if (!name?.trim()) return;
        await dbCreateFolder(name.trim());
        renderFolders();
    }

    // ── RENDER — ARTEFACTS ─────────────────────────────────────

    async function renderArtifacts() {
        const container = document.getElementById('artifactList');
        if (!container) return;

        const artifacts = await dbGetArtifacts();
        container.innerHTML = '';

        if (artifacts.length === 0) {
            container.innerHTML = `<div class="enrich-empty">Aucun projet épinglé</div>`;
            return;
        }

        artifacts.forEach(a => {
            const row = document.createElement('div');
            row.className = 'enrich-row enrich-artifact-row';
            row.title = 'Cliquer pour ouvrir la conversation';
            row.innerHTML = `
                <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,2 4,11 10,11 8,18 16,9 10,9"/></svg>
                <span class="enrich-row-label">${escHtml(a.title)}</span>
                <button class="enrich-del-btn" title="Désépingler">×</button>
            `;
            // Ouvre la conversation liée
            row.querySelector('.enrich-row-label').addEventListener('click', () => {
                if (window.switchTab) window.switchTab(a.conversation_id);
            });
            row.querySelector('.enrich-del-btn').addEventListener('click', async e => {
                e.stopPropagation();
                await dbDeleteArtifact(a.id);
                renderArtifacts();
            });
            container.appendChild(row);
        });
    }

    // Épingler la conversation active comme artefact
    async function pinCurrentConv() {
        const convId = window.activeTabId;
        if (!convId) { showToast('Aucune conversation active'); return; }
        const title = prompt('Nom du projet :');
        if (!title?.trim()) return;
        await dbCreateArtifact(convId, title.trim());
        renderArtifacts();
        showToast('Projet épinglé ✓');
    }

    // ── DRAG & DROP sur conv-items ─────────────────────────────
    // MutationObserver : rebranché à chaque fois que renderTabs() vide convList

    function attachDragToConvItems() {
        document.querySelectorAll('#convList .conv-item').forEach(el => {
            if (el.dataset.dragReady) return; // déjà branché
            el.dataset.dragReady = '1';
            el.draggable = true;
            el.style.cursor = 'grab';

            el.addEventListener('dragstart', e => {
                // Récupère l'id de la conv depuis le listener de switchTab
                // On l'identifie via le titre et le tableau tabs exposé
                const titleText = el.querySelector('.conv-item-title')?.textContent;
                const tabs = window._pensee_tabs || [];
                const tab = tabs.find(t => t.title === titleText);
                if (tab) {
                    e.dataTransfer.setData('convId', tab.id);
                    el.classList.add('dragging');
                }
            });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
        });
    }

    function observeConvList() {
        const list = document.getElementById('convList');
        if (!list) return;
        const observer = new MutationObserver(() => attachDragToConvItems());
        observer.observe(list, { childList: true, subtree: true });
        attachDragToConvItems(); // premier passage
    }

    // ── INJECTION HTML SIDEBAR ─────────────────────────────────

    function injectSidebarSections() {
        const newConvBtn = document.getElementById('newConvSideBtn');
        if (!newConvBtn || document.getElementById('enrichSections')) return;

        const section = document.createElement('div');
        section.id = 'enrichSections';
        section.innerHTML = `
            <!-- DOSSIERS -->
            <div class="enrich-section">
                <div class="enrich-section-header">
                    <span class="enrich-section-title">
                        <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h6l2 2h8v10H2V5z"/></svg>
                        Dossiers
                    </span>
                    <button class="enrich-add-btn" id="addFolderBtn" title="Nouveau dossier">+</button>
                </div>
                <div id="folderList" class="enrich-list"></div>
            </div>

            <!-- ARTEFACTS -->
            <div class="enrich-section">
                <div class="enrich-section-header">
                    <span class="enrich-section-title">
                        <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,2 4,11 10,11 8,18 16,9 10,9"/></svg>
                        Projets
                    </span>
                    <button class="enrich-add-btn" id="addArtifactBtn" title="Épingler conversation active">+</button>
                </div>
                <div id="artifactList" class="enrich-list"></div>
            </div>
        `;

        newConvBtn.parentNode.insertBefore(section, newConvBtn.nextSibling);

        document.getElementById('addFolderBtn')?.addEventListener('click', createFolder);
        document.getElementById('addArtifactBtn')?.addEventListener('click', pinCurrentConv);
    }

    // ── TOAST ──────────────────────────────────────────────────

    function showToast(msg) {
        let t = document.getElementById('enrichToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'enrichToast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('visible');
        clearTimeout(t._timer);
        t._timer = setTimeout(() => t.classList.remove('visible'), 2500);
    }

    // ── UTILS ──────────────────────────────────────────────────

    function escHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── CSS ────────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('enrich-styles')) return;
        const style = document.createElement('style');
        style.id = 'enrich-styles';
        style.textContent = `
            #enrichSections { padding: 0 8px; }

            .enrich-section { margin-bottom: 8px; }

            .enrich-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 3px;
            }

            .enrich-section-title {
                display: flex;
                align-items: center;
                gap: 5px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: var(--text3);
            }

            .enrich-add-btn {
                background: none;
                border: 1px solid var(--border);
                color: var(--text3);
                border-radius: 5px;
                width: 18px;
                height: 18px;
                font-size: 14px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            .enrich-add-btn:hover { border-color: var(--accent); color: var(--accent); }

            .enrich-list { min-height: 8px; }

            .enrich-empty {
                font-size: 10px;
                color: var(--text3);
                font-family: 'JetBrains Mono', monospace;
                font-style: italic;
                padding: 2px 4px;
            }

            .enrich-row {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 5px 6px;
                border-radius: 7px;
                border: 1px solid transparent;
                font-family: 'Syne', sans-serif;
                font-size: 11px;
                color: var(--text2);
                transition: all 0.15s;
                cursor: pointer;
            }
            .enrich-row:hover {
                background: var(--bg3);
                border-color: var(--border);
            }
            .enrich-row-label {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .enrich-del-btn {
                background: none;
                border: none;
                color: var(--text3);
                font-size: 15px;
                line-height: 1;
                cursor: pointer;
                padding: 0 2px;
                opacity: 0;
                transition: opacity 0.15s;
                flex-shrink: 0;
            }
            .enrich-row:hover .enrich-del-btn { opacity: 1; }
            .enrich-del-btn:hover { color: var(--red); }

            /* Drag & Drop */
            .conv-item[draggable="true"] { cursor: grab; }
            .conv-item.dragging { opacity: 0.45; }
            .enrich-folder-row.drag-over {
                background: var(--accent-dim);
                border-color: var(--accent);
            }

            /* Artefact hover */
            .enrich-artifact-row:hover { border-color: rgba(0,229,160,0.2); }

            /* User identity */
            #userIdentity { cursor: default; }
            #userAvatar { transition: transform 0.2s; }
            #userIdentity:hover #userAvatar { transform: scale(1.08); }

            /* Toast */
            #enrichToast {
                position: fixed;
                bottom: 28px;
                left: 50%;
                transform: translateX(-50%) translateY(12px);
                background: var(--bg2);
                border: 1px solid var(--border2);
                color: var(--text2);
                font-family: 'JetBrains Mono', monospace;
                font-size: 11px;
                padding: 8px 16px;
                border-radius: 10px;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s, transform 0.2s;
                z-index: 9999;
                white-space: nowrap;
            }
            #enrichToast.visible {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        `;
        document.head.appendChild(style);
    }

    // ── INIT ──────────────────────────────────────────────────

    async function init() {
        injectStyles();

        try {
            // Attend que ia.js ait tout initialisé
            const [user, sb] = await Promise.all([
                waitFor(() => window.currentUser),
                waitFor(() => window.supabase)
            ]);

            SB  = sb;
            UID = user.id;

            renderUser(user);
            injectSidebarSections();

            await Promise.all([renderFolders(), renderArtifacts()]);

            // Expose tabs pour le drag & drop
            // ia.js utilise `tabs` en variable locale — on observe window._pensee_tabs
            // À ajouter dans ia.js : window._pensee_tabs = tabs; dans renderTabs()
            observeConvList();

        } catch (e) {
            console.warn('[ui-enrich] Init échouée :', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
