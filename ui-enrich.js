// ============================================================
//  PENSÉE IA — ui-enrich.js
//  Enrichissements UI : nom utilisateur, dossiers, projets, artefacts
//  Zéro dépendance à ia.js — se branche sur les IDs existants
// ============================================================

(function () {
    'use strict';

    // ── ATTENTE QUE ia.js ait initialisé currentUser ──────────
    function waitFor(fn, interval = 300, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const id = setInterval(() => {
                const result = fn();
                if (result) { clearInterval(id); resolve(result); }
                else if (Date.now() - start > timeout) { clearInterval(id); reject(); }
            }, interval);
        });
    }

    // ── AFFICHAGE NOM UTILISATEUR ──────────────────────────────
    function renderUser(user) {
        const email = user?.email || '';
        const pseudo = email.split('@')[0] || '?';
        const initial = pseudo.charAt(0).toUpperCase();

        const avatar = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        if (avatar) avatar.textContent = initial;
        if (nameEl) nameEl.textContent = pseudo;
    }

    // ── SECTION DOSSIERS ──────────────────────────────────────
    // Stockage local simple — pas de Supabase pour ne pas alourdir
    const FOLDERS_KEY = 'pensee_folders';

    function getFolders() {
        try { return JSON.parse(localStorage.getItem(FOLDERS_KEY)) || []; }
        catch { return []; }
    }

    function saveFolders(folders) {
        localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    }

    function renderFolders() {
        const container = document.getElementById('folderList');
        if (!container) return;
        const folders = getFolders();
        container.innerHTML = '';

        if (folders.length === 0) {
            container.innerHTML = `<div style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace;padding:4px 2px;font-style:italic;">Aucun dossier</div>`;
            return;
        }

        folders.forEach((f, i) => {
            const row = document.createElement('div');
            row.className = 'enrich-folder-row';
            row.innerHTML = `
                <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h6l2 2h8v10H2V5z"/></svg>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>
                <button class="enrich-del-btn" data-i="${i}" title="Supprimer">×</button>
            `;
            row.querySelector('.enrich-del-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const folders = getFolders();
                folders.splice(i, 1);
                saveFolders(folders);
                renderFolders();
            });
            container.appendChild(row);
        });
    }

    function createFolder() {
        const name = prompt('Nom du dossier :');
        if (!name?.trim()) return;
        const folders = getFolders();
        folders.push({ name: name.trim(), created: Date.now() });
        saveFolders(folders);
        renderFolders();
    }

    // ── SECTION ARTEFACTS ─────────────────────────────────────
    // Sauvegarde manuelle de blocs de code depuis les réponses
    const ARTIFACTS_KEY = 'pensee_artifacts';

    function getArtifacts() {
        try { return JSON.parse(localStorage.getItem(ARTIFACTS_KEY)) || []; }
        catch { return []; }
    }

    function saveArtifact(name, code, lang) {
        const artifacts = getArtifacts();
        artifacts.unshift({ name, code, lang, saved: Date.now() });
        localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(artifacts.slice(0, 30))); // max 30
    }

    function renderArtifacts() {
        const container = document.getElementById('artifactList');
        if (!container) return;
        const artifacts = getArtifacts();
        container.innerHTML = '';

        if (artifacts.length === 0) {
            container.innerHTML = `<div style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace;padding:4px 2px;font-style:italic;">Aucun artefact</div>`;
            return;
        }

        artifacts.slice(0, 5).forEach((a) => {
            const row = document.createElement('div');
            row.className = 'enrich-artifact-row';
            row.title = a.code.slice(0, 120) + '...';
            row.innerHTML = `
                <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,7 2,10 6,13"/><polyline points="14,7 18,10 14,13"/><line x1="11" y1="4" x2="9" y2="16"/></svg>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;">${a.name}</span>
                <span style="font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace;">${a.lang}</span>
            `;
            row.addEventListener('click', () => {
                navigator.clipboard.writeText(a.code).then(() => {
                    row.style.borderColor = 'var(--accent)';
                    setTimeout(() => row.style.borderColor = '', 1000);
                });
            });
            container.appendChild(row);
        });
    }

    // Expose globalement pour que ia.js puisse appeler saveArtifact
    // depuis les blocs run-btn si tu veux l'intégrer plus tard
    window.PenseeArtifacts = { save: saveArtifact, get: getArtifacts };

    // ── INJECTION HTML DANS LA SIDEBAR ────────────────────────
    function injectSidebarSections() {
        const newConvBtn = document.getElementById('newConvSideBtn');
        if (!newConvBtn) return;

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
                        <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,7 2,10 6,13"/><polyline points="14,7 18,10 14,13"/><line x1="11" y1="4" x2="9" y2="16"/></svg>
                        Artefacts
                    </span>
                </div>
                <div id="artifactList" class="enrich-list"></div>
            </div>

            <!-- SÉPARATEUR CONVERSATIONS -->
            <div class="enrich-section-title" style="margin:12px 0 4px;padding:0 2px;">
                <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h16v10H2z"/><path d="M6 14v3l4-3"/></svg>
                Discussions
            </div>
        `;

        // Insère avant le bouton nouvelle conv
        newConvBtn.parentNode.insertBefore(section, newConvBtn.nextSibling);

        document.getElementById('addFolderBtn')?.addEventListener('click', createFolder);
    }

    // ── CSS ────────────────────────────────────────────────────
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .enrich-section {
                padding: 0 8px;
                margin-bottom: 4px;
            }
            .enrich-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 4px;
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
                padding: 0 2px;
            }
            .enrich-add-btn {
                background: none;
                border: 1px solid var(--border);
                color: var(--text3);
                border-radius: 5px;
                width: 18px;
                height: 18px;
                font-size: 13px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            .enrich-add-btn:hover {
                border-color: var(--accent);
                color: var(--accent);
            }
            .enrich-list {
                margin-bottom: 4px;
            }
            .enrich-folder-row,
            .enrich-artifact-row {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 5px 6px;
                border-radius: 7px;
                border: 1px solid transparent;
                cursor: pointer;
                font-family: 'Syne', sans-serif;
                font-size: 11px;
                color: var(--text2);
                transition: all 0.15s;
            }
            .enrich-folder-row:hover,
            .enrich-artifact-row:hover {
                background: var(--bg3);
                border-color: var(--border);
            }
            .enrich-artifact-row:hover {
                border-color: rgba(0,229,160,0.2);
            }
            .enrich-del-btn {
                background: none;
                border: none;
                color: var(--text3);
                font-size: 14px;
                line-height: 1;
                cursor: pointer;
                padding: 0 2px;
                opacity: 0;
                transition: opacity 0.15s;
            }
            .enrich-folder-row:hover .enrich-del-btn { opacity: 1; }
            .enrich-del-btn:hover { color: var(--red); }

            #userIdentity { cursor: default; }
            #userAvatar { transition: transform 0.2s; }
            #userIdentity:hover #userAvatar { transform: scale(1.08); }
        `;
        document.head.appendChild(style);
    }

    // ── INIT ──────────────────────────────────────────────────
    async function init() {
        injectStyles();
        injectSidebarSections();
        renderFolders();
        renderArtifacts();

        // Attend que ia.js expose currentUser
        try {
            const user = await waitFor(() => window.currentUser);
            renderUser(user);
        } catch {
            // Pas connecté ou timeout — silencieux
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
