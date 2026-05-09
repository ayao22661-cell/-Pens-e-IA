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
    let activeFolderId = null; // dossier actuellement sélectionné (null = tous)
    let currentFolders = [];

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

    async function dbGetConvsInFolder(folderId) {
        const { data } = await SB.from('conversations')
            .select('*')
            .eq('user_id', UID)
            .eq('folder_id', folderId)
            .order('created_at', { ascending: false });
        return data || [];
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
        currentFolders = folders;
        container.innerHTML = '';

        if (folders.length === 0) {
            container.innerHTML = `<div class="enrich-empty">Aucun dossier</div>`;
            return;
        }

        folders.forEach(f => {
            const row = document.createElement('div');
            row.className = 'enrich-row enrich-folder-row' + (activeFolderId === f.id ? ' folder-active' : '');
            row.dataset.folderId = f.id;

            // Clic sur le dossier → filtrer les conversations
            row.addEventListener('click', async (e) => {
                if (e.target.classList.contains('enrich-del-btn')) return;
                if (activeFolderId === f.id) {
                    // Deuxième clic = désélectionner → afficher toutes les convs
                    activeFolderId = null;
                    renderFolders();
                    if (window._pensee_restoreAllTabs) window._pensee_restoreAllTabs();
                } else {
                    activeFolderId = f.id;
                    renderFolders();
                    const convs = await dbGetConvsInFolder(f.id);
                    if (window._pensee_filterTabs) window._pensee_filterTabs(convs);
                    else showToast(`${convs.length} conversation(s) dans « ${f.name} »`);
                }
            });

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
                // Si ce dossier est actif, rafraîchir la liste filtrée
                if (activeFolderId === f.id) {
                    const convs = await dbGetConvsInFolder(f.id);
                    if (window._pensee_filterTabs) window._pensee_filterTabs(convs);
                }
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
        if (el.dataset.dragReady) return;
        el.dataset.dragReady = '1';
        el.draggable = true;
        el.style.cursor = 'grab';

        el.addEventListener('dragstart', e => {
            const convId = el.dataset.id; // direct, fiable
            if (convId) {
                e.dataTransfer.setData('convId', convId);
                el.classList.add('dragging');
            }
        });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));
    });
}
// ── MENU DE DÉPLACEMENT MOBILE ─────────────────────────────
    function showMoveMenu(anchor, convId) {
        // Ferme les autres menus ouverts
        document.querySelectorAll('.move-menu').forEach(m => m.remove());

        const menu = document.createElement('div');
        menu.className = 'move-menu';
        menu.style.cssText = `
            position: absolute; right: 0; top: 30px;
            background: var(--bg2); border: 1px solid var(--border);
            border-radius: 8px; padding: 6px; z-index: 9999;
            box-shadow: 0 8px 16px rgba(0,0,0,0.5);
            display: flex; flex-direction: column; min-width: 140px;
        `;

        const title = document.createElement('div');
        title.innerText = 'Déplacer vers :';
        title.style.cssText = 'font-size:10px; color:var(--text3); padding:4px 8px; margin-bottom:4px; border-bottom:1px solid var(--border);';
        menu.appendChild(title);

        // Option "Général" (Retirer du dossier)
        const rootOpt = document.createElement('div');
        rootOpt.innerText = '🏠 Menu Principal';
        rootOpt.style.cssText = 'padding:8px; font-size:11px; cursor:pointer; border-radius:4px; transition:background 0.2s;';
        rootOpt.onmouseover = () => rootOpt.style.background = 'rgba(255,255,255,0.05)';
        rootOpt.onmouseout = () => rootOpt.style.background = 'transparent';
        rootOpt.onclick = async (e) => {
            e.stopPropagation();
            await dbMoveConversation(convId, null);
            menu.remove();
            renderFolders();
            showToast('Déplacé vers le Menu Principal');
        };
        menu.appendChild(rootOpt);

        // Liste des dossiers créés
        currentFolders.forEach(f => {
            const opt = document.createElement('div');
            opt.innerText = '📁 ' + f.name;
            opt.style.cssText = 'padding:8px; font-size:11px; cursor:pointer; border-radius:4px; transition:background 0.2s;';
            opt.onmouseover = () => opt.style.background = 'rgba(0,229,160,0.1)';
            opt.onmouseout = () => opt.style.background = 'transparent';
            opt.onclick = async (e) => {
                e.stopPropagation();
                await dbMoveConversation(convId, f.id);
                menu.remove();
                renderFolders();
                showToast(`Déplacé vers ${f.name}`);
            };
            menu.appendChild(opt);
        });

        anchor.appendChild(menu);

        // Fermer le menu si on clique ailleurs
        setTimeout(() => {
            const closer = (ev) => {
                if (!menu.contains(ev.target)) {
                    menu.remove();
                    document.removeEventListener('click', closer);
                }
            };
            document.addEventListener('click', closer);
        }, 10);
    }
    // ── MENU DE DÉPLACEMENT (RÉSOLUTION DU BUG DE MASQUAGE) ─────
    async function showMoveMenu(anchor, convId) {
        // Nettoie les anciens menus
        document.querySelectorAll('.move-menu').forEach(m => m.remove());

        const menu = document.createElement('div');
        menu.className = 'move-menu';
        
        // 1. On calcule la position exacte du bouton à l'écran
        const rect = anchor.getBoundingClientRect();
        
        // 2. On utilise 'fixed' pour s'affranchir de la barre latérale
        menu.style.cssText = `
            position: fixed; 
            background: var(--bg2); border: 1px solid var(--border);
            border-radius: 6px; padding: 4px; z-index: 99999;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            display: flex; flex-direction: column; min-width: 140px;
        `;

        // 3. Positionnement intelligent (vers le haut si on est en bas de l'écran)
        if (rect.bottom + 150 > window.innerHeight) {
            menu.style.top = (rect.top - 5) + 'px';
            menu.style.transform = 'translateY(-100%)'; // Ouvre vers le haut
        } else {
            menu.style.top = (rect.bottom + 5) + 'px';  // Ouvre vers le bas
        }
        
        // On aligne le menu sur la droite du bouton
        menu.style.left = (rect.right - 140) + 'px';

        const createOption = (label, action) => {
            const opt = document.createElement('div');
            opt.innerText = label;
            opt.style.cssText = `
                padding: 6px 10px; font-size: 11px; cursor: pointer; 
                border-radius: 4px; transition: background 0.2s, color 0.2s;
                color: var(--text2);
            `;
            opt.onmouseover = () => { opt.style.background = 'rgba(255,255,255,0.05)'; opt.style.color = 'var(--text)'; };
            opt.onmouseout = () => { opt.style.background = 'transparent'; opt.style.color = 'var(--text2)'; };
            opt.onclick = async (e) => {
                e.stopPropagation();
                await action();
                menu.remove();
            };
            return opt;
        };

        // Option: Menu principal
        menu.appendChild(createOption('🏠 Menu Principal', async () => {
            await dbMoveConvToFolder(convId, null);
            showToast('Déplacé vers le Menu Principal');
            if (activeFolderId === null && window._pensee_restoreAllTabs) {
                window._pensee_restoreAllTabs();
            }
            renderFolders();
        }));

        // Options: Dossiers
        const folders = await dbGetFolders();
        folders.forEach(f => {
            menu.appendChild(createOption(`📁 ${f.name}`, async () => {
                await dbMoveConvToFolder(convId, f.id);
                showToast(`Conversation déplacée dans « ${f.name} »`);
                
                if (activeFolderId === f.id) {
                    const convs = await dbGetConvsInFolder(f.id);
                    if (window._pensee_filterTabs) window._pensee_filterTabs(convs);
                }
                renderFolders();
            }));
        });

        // TRÈS IMPORTANT: On attache le menu au "body", pas au bouton !
        document.body.appendChild(menu);

        // Fermeture au clic à côté
        setTimeout(() => {
            const closer = (ev) => {
                if (!menu.contains(ev.target)) {
                    menu.remove();
                    document.removeEventListener('click', closer);
                }
            };
            document.addEventListener('click', closer);
        }, 10);
    }

    // ── BOUTONS DISCRETS "⋮" ────────────────────────────────────
    function addMobileMoveButtons() {
        document.querySelectorAll('.conv-item').forEach(item => {
            if (item.dataset.id && !item.querySelector('.mobile-move-btn')) {
                const btn = document.createElement('div');
                btn.className = 'mobile-move-btn';
                btn.innerText = '⋮'; 
                btn.style.cssText = `
                    position: absolute; right: 28px; top: 50%; transform: translateY(-50%);
                    width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
                    font-size: 16px; font-weight: bold; color: var(--text3); cursor: pointer;
                    border-radius: 4px; transition: background 0.2s, color 0.2s;
                `;
                
                btn.onmouseover = () => { btn.style.background = 'rgba(255,255,255,0.05)'; btn.style.color = 'var(--text)'; };
                btn.onmouseout  = () => { btn.style.background = 'transparent'; btn.style.color = 'var(--text3)'; };

                btn.onclick = (e) => {
                    e.stopPropagation();
                    showMoveMenu(btn, item.dataset.id);
                };
                item.appendChild(btn);
            }
        });
    }

    // ── OBSERVATEUR ─────────────────────────────────────────────
    function observeConvList() {
        const list = document.getElementById('convList');
        if (!list) return;
        const observer = new MutationObserver(() => {
            attachDragToConvItems();
            addMobileMoveButtons(); 
        });
        observer.observe(list, { childList: true, subtree: true });
        attachDragToConvItems();
        addMobileMoveButtons();
    }

    // ── INJECTION HTML SIDEBAR ─────────────────────────────────

    function injectSidebarSections() {
        const newConvBtn = document.getElementById('newConvSideBtn');
        if (!newConvBtn || document.getElementById('enrichSections')) return;

        const section = document.createElement('div');
        section.id = 'enrichSections';
        section.innerHTML = `
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
        `;

        newConvBtn.parentNode.insertBefore(section, newConvBtn.nextSibling);

        document.getElementById('addFolderBtn')?.addEventListener('click', createFolder);
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
            .enrich-folder-row.folder-active {
                background: var(--bg3);
                border-color: var(--accent);
                color: var(--accent);
            }
            .enrich-folder-row.folder-active .enrich-section-title,
            .enrich-folder-row.folder-active svg { color: var(--accent); stroke: var(--accent); }

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

            /* Bloc think collapsible */
            .think-block {
                margin: 4px 0;
                border: 1px solid var(--border);
                border-radius: 10px;
                overflow: hidden;
                background: var(--bg2);
            }
            .think-toggle {
                display: flex;
                align-items: center;
                gap: 6px;
                width: 100%;
                background: none;
                border: none;
                padding: 8px 12px;
                cursor: pointer;
                font-family: 'JetBrains Mono', monospace;
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: var(--text3);
                text-align: left;
                transition: color 0.2s;
            }
            .think-toggle:hover { color: var(--text2); }
            .think-toggle .think-chevron {
                margin-left: auto;
                transition: transform 0.2s;
                stroke: var(--text3);
            }
            .think-open .think-chevron { transform: rotate(180deg); }
            .think-content {
                display: none;
                padding: 10px 14px 12px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 11px;
                color: var(--text2);
                line-height: 1.7;
                border-top: 1px solid var(--border);
                white-space: pre-wrap;
            }
            .think-open .think-content { display: block; }

            /* Welcome sub */
            #welcomeSub { opacity: 0.6; }
        `;
        document.head.appendChild(style);
    }

    // ── ÉCRAN D'ACCUEIL DYNAMIQUE ──────────────────────────────

    const WELCOME_SUGGESTIONS = [
        // Code
        "Crée une API REST en Node.js", "Explique les closures en JS", "Optimise ce code Python",
        "Génère des tests unitaires", "Débogue mon composant React",
        // Stratégie
        "Analyse les forces et faiblesses de mon projet", "Plan d'action sur 30 jours",
        "Quels sont les risques à anticiper ?", "Aide-moi à pitcher mon idée",
        // Créatif
        "Écris une intro percutante", "Développe ce personnage", "Réécris ce texte avec plus d'impact",
        // Recherche
        "Quelles sont les dernières tendances en IA ?", "Explique-moi le fonctionnement de X",
        "Compare ces deux approches", "Synthèse des points clés sur ce sujet",
        // Général
        "Aide-moi à structurer mes idées", "Résume ce concept en 5 points",
        "Qu'est-ce que tu sais faire ?", "Génère un PDF de ce rapport"
    ];

    function getGreeting(user) {
        const h = new Date().getHours();
        const pseudo = (user?.email || '').split('@')[0] || '';
        const name = pseudo.charAt(0).toUpperCase() + pseudo.slice(1);
        let moment;
        if (h >= 5  && h < 12) moment = 'matin';
        else if (h >= 12 && h < 18) moment = 'après-midi';
        else if (h >= 18 && h < 22) moment = 'soir';
        else moment = 'nuit';
        const greetings = [
            `Bonjour, <em>${name}</em>.`,
            `Bonsoir, <em>${name}</em>.`,
            `Rebonjour, <em>${name}</em>.`,
            `Que travaille-t-on ce ${moment}, <em>${name}</em> ?`,
            `Prêt à réfléchir, <em>${name}</em>.`,
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    function getRandomSuggestions(n = 4) {
        const shuffled = [...WELCOME_SUGGESTIONS].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
    }

    function initWelcomeScreen(user) {
        const greetingEl = document.getElementById('welcomeGreeting');
        const subEl      = document.getElementById('welcomeSub');
        const sugDiv     = document.getElementById('suggestions');

        if (greetingEl) greetingEl.innerHTML = getGreeting(user);

        if (subEl) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            subEl.textContent = dateStr;
        }

        if (sugDiv) {
            sugDiv.innerHTML = '';
            getRandomSuggestions(4).forEach(text => {
                const span = document.createElement('span');
                span.className = 'suggestion';
                span.textContent = text;
                span.addEventListener('click', () => {
                    const input = document.getElementById('userInput');
                    if (input) { input.value = text; input.focus(); input.dispatchEvent(new Event('input')); }
                });
                sugDiv.appendChild(span);
            });
        }
    }

    // ── BLOC <think> COLLAPSIBLE ───────────────────────────────

    function wrapThinkBlocks(root) {
        // Cherche les spans "Analyse brute extraite" injectés par formatResponse
        root.querySelectorAll('span').forEach(span => {
            if (span.dataset.thinkWrapped) return;
            if (!span.textContent.includes('[Analyse brute extraite]')) return;
            span.dataset.thinkWrapped = '1';

            const parent = span.parentElement;
            const content = parent.innerHTML
                .replace(/<span[^>]*>\[Analyse brute extraite\]<\/span><br><br>/, '')
                .trim();

            const wrapper = document.createElement('div');
            wrapper.className = 'think-block';
            wrapper.innerHTML = `
                <button class="think-toggle" aria-expanded="false">
                    <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2a6 6 0 0 1 6 6c0 2.5-1.5 4.7-3.7 5.6L12 16H8l-.3-2.4C5.5 12.7 4 10.5 4 8a6 6 0 0 1 6-6z"/><line x1="8" y1="18" x2="12" y2="18"/></svg>
                    Analyse interne
                    <svg class="think-chevron" viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="5,8 10,13 15,8"/></svg>
                </button>
                <div class="think-content">${content}</div>
            `;

            wrapper.querySelector('.think-toggle').addEventListener('click', function() {
                const expanded = this.getAttribute('aria-expanded') === 'true';
                this.setAttribute('aria-expanded', String(!expanded));
                wrapper.classList.toggle('think-open', !expanded);
            });

            parent.innerHTML = '';
            parent.appendChild(wrapper);
        });
    }

    function observeThinkBlocks() {
        const messages = document.getElementById('messages');
        if (!messages) return;
        const obs = new MutationObserver(() => {
            messages.querySelectorAll('.bubble').forEach(b => wrapThinkBlocks(b));
        });
        obs.observe(messages, { childList: true, subtree: true });
    }

    // ── RECHERCHE SIDEBAR ──────────────────────────────────────

    function injectSearchBar() {
        const newConvBtn = document.getElementById('newConvSideBtn');
        if (!newConvBtn || document.getElementById('sidebarSearch')) return;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'padding: 0 8px 6px; position: relative;';

        const input = document.createElement('input');
        input.id = 'sidebarSearch';
        input.type = 'text';
        input.placeholder = 'Rechercher…';
        input.style.cssText = `
            width: 100%;
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text2);
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            padding: 6px 10px 6px 28px;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
        `;
        input.addEventListener('focus', () => input.style.borderColor = 'var(--accent)');
        input.addEventListener('blur',  () => input.style.borderColor = 'var(--border)');

        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            const allTabs = window._pensee_tabs || [];
            if (!q) {
                if (window._pensee_restoreAllTabs) window._pensee_restoreAllTabs();
                return;
            }
            const filtered = allTabs.filter(t => t.title.toLowerCase().includes(q));
            if (window._pensee_filterTabs) window._pensee_filterTabs(filtered);
        });

        // Icône loupe
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 20 20');
        icon.setAttribute('width', '11');
        icon.setAttribute('height', '11');
        icon.style.cssText = 'position:absolute;left:18px;top:50%;transform:translateY(-50%);stroke:var(--text3);fill:none;stroke-width:1.6;stroke-linecap:round;pointer-events:none;';
        icon.innerHTML = '<circle cx="9" cy="9" r="5"/><line x1="13" y1="13" x2="17" y2="17"/>';

        wrapper.appendChild(icon);
        wrapper.appendChild(input);
        newConvBtn.parentNode.insertBefore(wrapper, newConvBtn.nextSibling);
    }

    // ── INIT ──────────────────────────────────────────────────

    async function init() {
        injectStyles();

        try {
            const [user, sb] = await Promise.all([
                waitFor(() => window.currentUser),
                waitFor(() => window.supabase)
            ]);

            SB  = sb;
            UID = user.id;

            renderUser(user);
            injectSidebarSections();
            injectSearchBar();

            await renderFolders();

            observeConvList();

            // ── Écran d'accueil dynamique
            initWelcomeScreen(user);

            // ── Bloc think collapsible
            observeThinkBlocks();

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
