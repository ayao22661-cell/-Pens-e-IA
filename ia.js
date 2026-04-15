// ============================================================
//  PENSÉE IA — ia.js (localStorage, sans Supabase)
// ============================================================

const CONFIG = {
    maxCredits: 20,
    maxFileSizeMB: 10,
    storageKey:  'pensee_ia_history',
    creditsKey:  'pensee_ia_credits',
    enterToSendKey: 'pensee_ia_enter_to_send',
    langMap: {
        js:'JavaScript', ts:'TypeScript', jsx:'React JSX', tsx:'React TSX',
        py:'Python', html:'HTML', css:'CSS', scss:'SCSS', sass:'SASS',
        php:'PHP', java:'Java', c:'C', cpp:'C++', cs:'C#',
        go:'Go', rs:'Rust', rb:'Ruby', swift:'Swift', kt:'Kotlin',
        sql:'SQL', json:'JSON', xml:'XML', yaml:'YAML', yml:'YAML',
        sh:'Shell', bash:'Bash', md:'Markdown', txt:'Texte',
        vue:'Vue', svelte:'Svelte', dart:'Dart', r:'R', lua:'Lua',
        pdf:'Document PDF', docx:'Document Word', doc:'Document Word',
        mp3:'Audio MP3', m4a:'Audio M4A', wav:'Audio WAV', ogg:'Audio OGG'
    },
    systemPrompt: `Tu es PENSÉE — intelligence artificielle de précision, conçue par Yao Baba Ange Emmanuel. Pas un assistant. Un partenaire cognitif avec une voix, une exigence et une vision architecturale.

━━━ IDENTITÉ & VOIX ━━━
Tu parles comme un expert senior qui n'a rien à prouver. Tranchant, dense, jamais condescendant. INTERDIT absolu : "Bien sûr !", "Excellente question !", "Certainement !", "Je serais ravi de...", toute reformulation inutile ou conclusion vide. Tu vas droit au but. La première phrase doit déjà contenir de la valeur brute.

━━━ LANGUE ━━━
Réponse TOUJOURS en français. Exception sur demande explicite. Ne traduis JAMAIS les commentaires, noms de variables ou chaînes d'un code source — l'intégrité du code est sacrée.

━━━ PROTOCOLE DE RÉFLEXION (OBLIGATOIRE ET MASQUÉ) ━━━
Tu DOIS générer un bloc <think>...</think> d'espace de calcul invisible. Ordre absolu : cette réflexion doit être un seul bloc de texte dense, sans aucune puce ni liste. Pour guider ta logique sans casser ce bloc unique, utilise ces marqueurs en ligne : [INTENT] analyse de l'objectif réel | [ROOT] identification de la cause racine | [ARCHI] définition de la solution pérenne. Dès la fermeture de </think>, effectue un double saut de ligne, puis démarre la réponse finale directement, sans préambule.

━━━ RECHERCHE WEB & ACTUALITÉ ━━━
Si [INSTRUCTION CRITIQUE : google_search] est présent : tu DOIS prioriser les données fraîches fournies. Signale clairement si l'info vient de ta mémoire vs recherche. Si la recherche échoue ou ne renvoie rien, n'hallucine JAMAIS. Utilise la balise [DIAGNOSTIC INCERTAIN] pour acter l'absence de données récentes et propose une alternative logique.

━━━ INGÉNIERIE & CODE ━━━
Code propre, modulaire, commenté sur la logique complexe. Dans un bloc \`\`\`langage\`\`\`. Format chirurgical obligatoire pour les corrections :
\`\`\`
// TROUVE : [code original exact]
// REMPLACE PAR : [code corrigé]
// POURQUOI : [cause racine]
\`\`\`
Audit : identifie bugs, perfs, sécurité, cassures mobile. UI/Web : intègre nativement les lois de la Gestalt et le mobile-first. Pense toujours aux états vides/erreurs.

━━━ CRÉATION & STORYTELLING ━━━
Conception narrative, scripts, storyboards, direction artistique : l'immersion est la seule norme, quel que soit le genre. Chaque scène exige une grammaire cinématographique claire (direction sonore, lumière, cadrage, sous-texte émotionnel). L'ancrage culturel, qu'il s'agisse d'Abidjan, des dynamiques africaines ou de tout autre espace mondial, exige une vérité sociologique et géographique absolue. Aucun décor de carte postale, aucun cliché. Zéro approximation historique ou biographique.

━━━ STRATÉGIE & CROISSANCE ━━━
Direction artistique, UX/UI, marketing visuel, algorithmes (YouTube/Pinterest). Pense en systèmes. Chaque recommandation stratégique intègre ses effets de second ordre.

━━━ INCERTITUDE & LIMITES ━━━
Limite atteinte (spéculation, donnée absente) = balise [DIAGNOSTIC INCERTAIN] obligatoire + explication de l'incertitude + alternative architecturale robuste. Jamais d'approximation présentée comme un fait.

━━━ TOUT LE RESTE ━━━
Mode compagnon : chaleureux, cultivé, humain — avec la même rigueur d'analyse thématique. La profondeur s'adapte, l'exigence reste.`
};

// ============================================================
//  EXPOSITION GLOBALE POUR HTML INLINE (Suggestions)
// ============================================================
window.useSuggestion = function(el) {
    const ui = document.getElementById("userInput");
    if(ui) {
        ui.value = el.textContent;
        ui.focus();
        ui.style.height = "auto";
        ui.style.height = Math.min(ui.scrollHeight, 120) + "px";
    }
};

// ============================================================
//  AUTH
// ============================================================

const ACCESS_PASSWORD = "2024";

const loginScreen = document.getElementById("loginScreen");
const loginPassEl = document.getElementById("loginPassword");
const loginBtn    = document.getElementById("loginBtn");
const loginError  = document.getElementById("loginError");
const logoutBtn   = document.getElementById("logoutBtn");

function checkLocalAuth() {
    if (sessionStorage.getItem("pensee_auth") === "true") {
        if(loginScreen) loginScreen.style.display = "none";
        loadCreditsFromStorage();
        initTabs();
        initSettings(); // Init des réglages systèmes
    } else {
        if(loginScreen) loginScreen.style.display = "flex";
        if (loginPassEl) loginPassEl.focus();
    }
}

function handleLogin() {
    const password = (loginPassEl ? loginPassEl.value : "").trim();
    if (!password) {
        if(loginError) {
            loginError.style.display = "block";
            loginError.textContent = "Entre le mot de passe.";
        }
        return;
    }
    if (password !== ACCESS_PASSWORD) {
        if(loginError) {
            loginError.style.display = "block";
            loginError.textContent = "Mot de passe incorrect.";
        }
        if (loginPassEl) {
            loginPassEl.classList.add("shake");
            setTimeout(() => loginPassEl.classList.remove("shake"), 500);
        }
        return;
    }
    sessionStorage.setItem("pensee_auth", "true");
    if(loginError) loginError.style.display = "none";
    if(loginScreen) {
        loginScreen.style.opacity = "0";
        setTimeout(() => { loginScreen.style.display = "none"; }, 300);
    }
    loadCreditsFromStorage();
    initTabs();
    initSettings();
}

if(loginBtn) loginBtn.addEventListener("click", handleLogin);
if(loginPassEl) loginPassEl.addEventListener("keypress", (e) => { if (e.key === "Enter") handleLogin(); });
if(logoutBtn) logoutBtn.addEventListener("click", () => {
    if (confirm("Verrouiller la session ?")) {
        sessionStorage.removeItem("pensee_auth");
        location.reload();
    }
});

// ============================================================
//  ÉTAT & ÉLÉMENTS DOM
// ============================================================

let creditsLeft   = CONFIG.maxCredits;
let history       = [];
let attachedFiles = [];
let enterToSend   = true;

const messagesEl    = document.getElementById("messages");
const userInput     = document.getElementById("userInput");
const sendBtn       = document.getElementById("sendBtn");
const statusBadge   = document.getElementById("statusBadge");
const creditFill    = document.getElementById("creditFill");
const creditCount   = document.getElementById("creditCount");
const alertBanner   = document.getElementById("alertBanner");
const fileInput     = document.getElementById("fileInput");
const uploadBtn     = document.getElementById("uploadBtn");
const uploadPreview = document.getElementById("uploadPreview");
const dropOverlay   = document.getElementById("dropOverlay");

// Éléments Modale Paramètres
const settingsModal     = document.getElementById("settingsModal");
const settingsBtn       = document.getElementById("settingsBtn");
const closeSettingsBtn  = document.getElementById("closeSettingsBtn");
const memoryFill        = document.getElementById("memoryFill");
const memoryUsed        = document.getElementById("memoryUsed");
const exportDataBtn     = document.getElementById("exportDataBtn");
const purgeDataBtn      = document.getElementById("purgeDataBtn");
const enterToSendToggle = document.getElementById("enterToSendToggle");

// ============================================================
//  SYSTÈME & PARAMÈTRES
// ============================================================

function initSettings() {
    if (!settingsModal || !settingsBtn) return; // Anti-crash

    // 1. Charger la pref Enter
    const storedEnterPref = localStorage.getItem(CONFIG.enterToSendKey);
    if (storedEnterPref !== null) enterToSend = storedEnterPref === 'true';
    if(enterToSendToggle) enterToSendToggle.checked = enterToSend;

    // 2. Events d'ouverture/fermeture
    settingsBtn.addEventListener('click', () => {
        calculateStorage();
        settingsModal.classList.add('visible');
    });
    if(closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('visible');
    });
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('visible');
    });

    // 3. Toggle Action
    if(enterToSendToggle) enterToSendToggle.addEventListener('change', (e) => {
        enterToSend = e.target.checked;
        localStorage.setItem(CONFIG.enterToSendKey, enterToSend);
    });

    // 4. Export JSON
    if(exportDataBtn) exportDataBtn.addEventListener('click', () => {
        const dump = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('pensee_ia_')) {
                try { dump[key] = JSON.parse(localStorage.getItem(key)); }
                catch(e) { dump[key] = localStorage.getItem(key); }
            }
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dump, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "pensee_backup_" + new Date().toISOString().slice(0,10) + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // 5. Purge Danger
    if(purgeDataBtn) purgeDataBtn.addEventListener('click', () => {
        if(confirm("ATTENTION : Cela va supprimer définitivement TOUT ton historique de conversation. Es-tu absolument sûr ?")) {
            if(confirm("Dernier avertissement. Confirmer la suppression totale ?")) {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('pensee_ia_')) keysToRemove.push(key);
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                location.reload();
            }
        }
    });
}

function calculateStorage() {
    if(!memoryFill || !memoryUsed) return;
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('pensee_ia_')) {
            totalBytes += (localStorage.getItem(key).length + key.length) * 2;
        }
    }
    const MAX_BYTES = 5 * 1024 * 1024; 
    let percent = (totalBytes / MAX_BYTES) * 100;
    if (percent > 100) percent = 100;
    
    memoryFill.style.width = `${percent}%`;
    memoryFill.style.background = percent > 85 ? 'var(--red)' : (percent > 60 ? 'var(--yellow)' : 'var(--accent)');
    
    const kb = (totalBytes / 1024).toFixed(1);
    memoryUsed.textContent = `${kb} KB / ~5 MB`;
}

// ============================================================
//  CRÉDITS
// ============================================================

function loadCreditsFromStorage() {
    const today  = new Date().toISOString().slice(0, 10);
    let stored = {};
    try {
        stored = JSON.parse(localStorage.getItem(CONFIG.creditsKey) || "{}");
        if (!stored) stored = {};
    } catch(e) {
        stored = {};
    }
    if (stored.date === today) {
        creditsLeft = CONFIG.maxCredits - (stored.used || 0);
    } else {
        creditsLeft = CONFIG.maxCredits;
        localStorage.setItem(CONFIG.creditsKey, JSON.stringify({ date: today, used: 0 }));
    }
    updateCredits();
}

function saveCreditsToStorage() {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(CONFIG.creditsKey, JSON.stringify({
        date: today,
        used: CONFIG.maxCredits - creditsLeft
    }));
}

// ============================================================
//  HISTORIQUE & ONGLETS
// ============================================================

const TABS_KEY = 'pensee_ia_tabs';

function genTabId() {
    return 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function loadTabs() {
    try {
        const raw = localStorage.getItem(TABS_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch(e) { return null; }
}

function saveTabs(tabs) {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
}

let tabs = [];
let activeTabId = null;

function getHistoryKey(tabId) { return 'pensee_ia_history__' + tabId; }

function createTab(switchTo) {
    const id = genTabId();
    tabs.push({ id: id, title: 'Nouvelle conv.' });
    saveTabs(tabs);
    if (switchTo !== false) switchTab(id);
    return id;
}

function deleteTab(id) {
    if (tabs.length <= 1) {
        createTab(true);
        localStorage.removeItem(getHistoryKey(id));
        tabs = tabs.filter(t => t.id !== id);
        saveTabs(tabs);
        return;
    }
    const idx = tabs.findIndex(t => t.id === id);
    localStorage.removeItem(getHistoryKey(id));
    tabs = tabs.filter(t => t.id !== id);
    saveTabs(tabs);
    if (activeTabId === id) {
        const newIdx = Math.min(idx, tabs.length - 1);
        switchTab(tabs[newIdx].id);
    } else {
        renderTabs();
    }
}

function switchTab(id) {
    activeTabId = id;
    sessionStorage.setItem('pensee_ia_active_tab', id);
    history = [];
    CONFIG.storageKey = getHistoryKey(id);
    loadHistoryFromStorage();
    renderTabs();
}

function updateTabTitle(id, firstUserMsg) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    const title = firstUserMsg.slice(0, 28) + (firstUserMsg.length > 28 ? '…' : '');
    if (tab.title === 'Nouvelle conv.' || tab.title.endsWith('…') || tab.title === title.slice(0, -1)) {
        tab.title = title;
        saveTabs(tabs);
        renderTabs();
        const titleEl = document.getElementById('activeConvTitle');
        if (titleEl && id === activeTabId) titleEl.textContent = title;
    }
}

function renderTabs() {
    const list = document.getElementById('convList');
    if (!list) return;
    list.innerHTML = '';

    const now = Date.now();
    const DAY = 86400000;
    const groups = [
        { label: "Aujourd'hui", items: [] },
        { label: 'Hier',        items: [] },
        { label: 'Plus ancien', items: [] },
    ];
    tabs.forEach(tab => {
        const ts = parseInt(tab.id.split('_')[1]) || 0;
        const age = now - ts;
        if (age < DAY)        groups[0].items.push(tab);
        else if (age < 2*DAY) groups[1].items.push(tab);
        else                   groups[2].items.push(tab);
    });

    groups.forEach(group => {
        if (!group.items.length) return;
        const label = document.createElement('div');
        label.className = 'conv-section-label';
        label.textContent = group.label;
        list.appendChild(label);
        group.items.slice().reverse().forEach(tab => {
            const el = document.createElement('div');
            el.className = 'conv-item' + (tab.id === activeTabId ? ' active' : '');

            const title = document.createElement('span');
            title.className = 'conv-item-title';
            title.textContent = tab.title;
            title.addEventListener('click', () => {
                if (tab.id !== activeTabId) switchTab(tab.id);
                closeSidebarMobile();
            });

            const del = document.createElement('button');
            del.className = 'conv-item-del';
            del.title = 'Supprimer';
            del.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                if (tabs.length === 1 || confirm('Supprimer cette conversation ?')) deleteTab(tab.id);
            });

            el.appendChild(title);
            el.appendChild(del);
            list.appendChild(el);
        });
    });

    const activeTab = tabs.find(t => t.id === activeTabId);
    const titleEl = document.getElementById('activeConvTitle');
    if (titleEl && activeTab) titleEl.textContent = activeTab.title;
}

function closeSidebarMobile() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('visible');
}

(function() {
    const toggle = document.getElementById('sidebarToggle');
    const sb     = document.getElementById('sidebar');
    const ov     = document.getElementById('sidebarOverlay');
    if (toggle) toggle.addEventListener('click', () => {
        if(sb) sb.classList.toggle('open');
        if(ov) ov.classList.toggle('visible');
    });
    if (ov) ov.addEventListener('click', closeSidebarMobile);

    const newBtn = document.getElementById('newConvSideBtn');
    if (newBtn) newBtn.addEventListener('click', () => {
        createTab(true);
        closeSidebarMobile();
    });
})();

function initTabs() {
    const stored = loadTabs();
    if (stored && stored.length > 0) {
        tabs = stored;
        const lastActive = sessionStorage.getItem('pensee_ia_active_tab');
        const validLast  = lastActive && tabs.find(t => t.id === lastActive);
        activeTabId = validLast ? lastActive : tabs[tabs.length - 1].id;
    } else {
        tabs = [];
        activeTabId = null;
        createTab(false);
        activeTabId = tabs[0].id;
        sessionStorage.setItem('pensee_ia_active_tab', activeTabId);
    }
    CONFIG.storageKey = getHistoryKey(activeTabId);
    renderTabs();
}

function showWelcome() {
    if(!messagesEl) return;
    messagesEl.innerHTML = "";
    addMessage("bot", "Bonjour. Je suis <strong>Pens\u00e9e</strong> \u2014 ton IA personnelle.<br><br>Programmation, culture, science, storytelling, strat\u00e9gie... pose-moi n'importe quelle question.", true);
    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "flex";
}

function loadHistoryFromStorage() {
    if(!messagesEl) return;
    messagesEl.innerHTML = "";
    try {
        const stored = localStorage.getItem(CONFIG.storageKey);
        if (!stored) { showWelcome(); return; }
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || parsed.length === 0) { showWelcome(); return; }
        history = parsed;
        parsed.forEach(msg => {
            addMessage(
                msg.role === "assistant" ? "bot" : "user",
                msg.role === "assistant" ? formatResponse(msg.content) : msg.content,
                msg.role === "assistant"
            );
        });
        const sug = document.getElementById("suggestions");
        if (sug) sug.style.display = "none";
    } catch(e) {
        localStorage.removeItem(CONFIG.storageKey);
        showWelcome();
    }
}

function saveHistoryToStorage() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(history.slice(-100)));
}

// ============================================================
//  UI & UTILITAIRES
// ============================================================

function updateCredits() {
    if(!creditFill || !creditCount) return;
    const pct = (creditsLeft / CONFIG.maxCredits) * 100;
    creditFill.style.width      = pct + "%";
    creditFill.style.background = pct > 50 ? "#00e5a0" : pct > 20 ? "#f5c542" : "#ff6b6b";
    creditCount.textContent     = creditsLeft + " / " + CONFIG.maxCredits;

    if(alertBanner) {
        alertBanner.className     = "";
        alertBanner.style.display = "none";
    }

    if(userInput) userInput.disabled = false;
    if(sendBtn) sendBtn.disabled   = false;
    if(uploadBtn) uploadBtn.disabled = false;

    if (creditsLeft === 0) {
        if(alertBanner) {
            alertBanner.className     = "empty";
            alertBanner.style.display = "block";
            alertBanner.textContent   = "\u26a0\ufe0f Cr\u00e9dits \u00e9puis\u00e9s pour aujourd'hui. Reviens demain !";
        }
        if(userInput) userInput.disabled  = true;
        if(sendBtn) sendBtn.disabled    = true;
        if(uploadBtn) uploadBtn.disabled  = true;
        setStatus("warn");
    } else if (creditsLeft <= 5) {
        if(alertBanner) {
            alertBanner.className     = "low";
            alertBanner.style.display = "block";
            alertBanner.textContent   = "\u26a1 Plus que " + creditsLeft + " message(s) disponible(s) aujourd'hui.";
        }
    }
}

function escapeHtml(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function getLang(filename) { const ext = filename.split(".").pop().toLowerCase(); return CONFIG.langMap[ext] || ext.toUpperCase() || "Fichier"; }

function formatResponse(text) {
    text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "");
    text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, function(_, _lang, code) { return "<pre><code>" + escapeHtml(code.trim()) + "</code></pre>"; });
    text = text.replace(/`([^`\n]+)`/g, function(_, code) { return "<code>" + escapeHtml(code) + "</code>"; });
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\n/g, "<br>");
    return text;
}

function setStatus(state) {
    if(!statusBadge) return;
    const map = { ok: ["ok", "\u25cf connect\u00e9"], err: ["err", "\u25cf erreur"], warn: ["warn", "\u25cf cr\u00e9dits bas"] };
    statusBadge.className = "";
    if (map[state]) { statusBadge.className = map[state][0]; statusBadge.textContent = map[state][1]; }
}

// ============================================================
//  FICHIERS
// ============================================================

function readFileAsData(file) {
    return new Promise((resolve, reject) => {
        if (file.size > CONFIG.maxFileSizeMB * 1024 * 1024) { reject("Dépasse " + CONFIG.maxFileSizeMB + "MB."); return; }
        const reader = new FileReader();
        const ext = file.name.split(".").pop().toLowerCase();
        const isBinary = ["pdf", "docx", "doc", "mp3", "m4a", "wav", "ogg"].includes(ext);
        reader.onload = e => {
            if (isBinary) resolve({ type: "binary", mimeType: file.type, data: e.target.result.split(",")[1] });
            else resolve({ type: "text", data: e.target.result });
        };
        reader.onerror = () => reject("Erreur de lecture");
        if (isBinary) reader.readAsDataURL(file); else reader.readAsText(file);
    });
}

async function addFiles(fileList) {
    for (const file of fileList) {
        if (attachedFiles.find(f => f.name === file.name)) continue;
        try {
            const content = await readFileAsData(file);
            attachedFiles.push({ name: file.name, lang: getLang(file.name), content: content });
            renderUploadPreview();
        } catch(err) { addMessage("bot", "\u26a0\ufe0f " + err, false); }
    }
}

function renderUploadPreview() {
    if(!uploadPreview) return;
    uploadPreview.innerHTML = "";
    if (!attachedFiles.length) { uploadPreview.classList.remove("visible"); return; }
    uploadPreview.classList.add("visible");
    attachedFiles.forEach((file, i) => {
        const chip = document.createElement("div");
        chip.className = "attached-chip";
        chip.innerHTML = `<span>📎 ${escapeHtml(file.name)}</span><button onclick="removeFile(${i})">✕</button>`;
        uploadPreview.appendChild(chip);
    });
}
window.removeFile = function(i) { attachedFiles.splice(i, 1); renderUploadPreview(); };

// ============================================================
//  MESSAGES & API
// ============================================================

function addMessage(role, content, isHtml) {
    if(!messagesEl) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg " + role;
    const label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = role === "user" ? "Toi" : "Pensée";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (isHtml) bubble.innerHTML = content; else bubble.textContent = content;
    msgDiv.appendChild(label);
    msgDiv.appendChild(bubble);

    if (role === "bot") {
        const actions = document.createElement("div");
        actions.className = "msg-actions";
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerHTML = "📋 Copier";
        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(bubble.innerText);
                copyBtn.innerHTML = "✅ Copié !";
                setTimeout(() => { copyBtn.innerHTML = "📋 Copier"; }, 2000);
            } catch(e) {}
        };
        actions.appendChild(copyBtn);
        msgDiv.appendChild(actions);
    }
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addUserMessageWithFiles(text, files) {
    if(!messagesEl) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg user";
    const label = document.createElement("span");
    label.className = "msg-label"; label.textContent = "Toi";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    files.forEach(file => {
        const chip = document.createElement("div");
        chip.className = "file-chip";
        chip.innerHTML = `<span>📎</span>${escapeHtml(file.name)}`;
        bubble.appendChild(chip);
    });
    if (text) { const p = document.createElement("div"); p.textContent = text; bubble.appendChild(p); }
    msgDiv.appendChild(label); msgDiv.appendChild(bubble);
    messagesEl.appendChild(msgDiv); messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
    if(!messagesEl) return;
    const div = document.createElement("div");
    div.className = "msg bot"; div.id = "typing-indicator";
    const label = document.createElement("span");
    label.className = "msg-label"; label.textContent = "Pensée";
    const bubble = document.createElement("div");
    bubble.className = "typing-bubble";
    bubble.innerHTML = "<span></span><span></span><span></span>";
    div.appendChild(label); div.appendChild(bubble);
    messagesEl.appendChild(div); messagesEl.scrollTop = messagesEl.scrollHeight;
}
function removeTyping() { const t = document.getElementById("typing-indicator"); if (t) t.remove(); }

function buildPrompt(userMessage, files) {
    const recent = history.slice(-20);
    const today = new Date().toLocaleDateString("fr-FR", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
    let prompt = `[DATE ACTUELLE : ${today}]\n\n${CONFIG.systemPrompt}\n\n`;

    if (files && files.length > 0) {
        prompt += "### FICHIERS JOINTS :\n\n";
        files.forEach(file => {
            if (file.content && file.content.type === "text") prompt += `DOCUMENT : ${file.name}\nCONTENU :\n${file.content.data}\n---\n\n`;
        });
    }

    if (recent.length > 0) {
        prompt += "### HISTORIQUE :\n\n";
        recent.forEach(msg => {
            const role = msg.role === "user" ? "Utilisateur" : "Pensée";
            prompt += `[${role}]: ${msg.content}\n\n`;
        });
    }

    prompt += `### NOUVEAU MESSAGE :\n${userMessage}\n\n### RÉPONSE :\n`;
    return prompt;
}

// RESTAURATION DE L'ENVOI ORIGINAL 
async function sendMessage() {
    const text  = userInput ? userInput.value.trim() : "";
    const files = attachedFiles.slice();
    if (!text && !files.length) return;
    if (sendBtn && sendBtn.disabled) return;

    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "none";

    const messageText = text || "Analyse ce fichier.";
    if (files.length > 0) addUserMessageWithFiles(text, files); else addMessage("user", text, false);

    if(userInput) { userInput.value = ""; userInput.style.height = "auto"; }
    attachedFiles = []; renderUploadPreview(); if(fileInput) fileInput.value = "";

    if(sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "..."; }
    showTyping();

    await new Promise(r => setTimeout(r, 0));

    const prompt = buildPrompt(messageText, files);
    const binaryFiles = files.filter(f => f.content && f.content.type === "binary").map(f => ({ name: f.name, mime: f.content.mimeType, base64: f.content.data }));

    try {
        const response = await fetch("/api/chat", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt, files: binaryFiles.length > 0 ? binaryFiles : undefined })
        });

        if (!response.ok) throw new Error("Erreur serveur " + response.status);

        removeTyping();
        const msgDiv = document.createElement("div"); msgDiv.className = "msg bot";
        const label = document.createElement("span"); label.className = "msg-label"; label.textContent = "Pensée";
        const bubble = document.createElement("div"); bubble.className = "bubble";
        msgDiv.appendChild(label); msgDiv.appendChild(bubble); 
        if(messagesEl) messagesEl.appendChild(msgDiv);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullReply += decoder.decode(value, { stream: true });
            bubble.innerHTML = formatResponse(fullReply);
            if(messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        fullReply = fullReply.replace(/^\s*\[Pensée\]:\s*/i, "");
        const cutIndex = fullReply.indexOf("[Utilisateur]:");
        if (cutIndex !== -1) fullReply = fullReply.substring(0, cutIndex);
        fullReply = fullReply.trim();
        bubble.innerHTML = formatResponse(fullReply);

        history.push({ role: "user", content: messageText });
        history.push({ role: "assistant", content: fullReply });
        saveHistoryToStorage();

        creditsLeft--; saveCreditsToStorage(); updateCredits();
        if (creditsLeft > 0) setStatus("ok");

    } catch(error) {
        removeTyping();
        addMessage("bot", "❌ Erreur réseau", false);
        setStatus("err");
    }

    if (creditsLeft > 0 && sendBtn) {
        sendBtn.disabled = false; sendBtn.textContent = "Envoyer ›";
        if(userInput) userInput.focus();
    }
}

// LOGIQUE D'INTERCEPTION POUR METTRE A JOUR LE TITRE DES ONGLETS
const _origSendMessage = sendMessage;
window.sendMessage = async function() {
    const text = userInput ? userInput.value.trim() : "";
    await _origSendMessage.call(this);
    if (text && activeTabId) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab && tab.title === 'Nouvelle conv.') {
            updateTabTitle(activeTabId, text);
        }
    }
};

// ============================================================
//  ÉVÉNEMENTS & INITIALISATION
// ============================================================

if(uploadBtn) uploadBtn.addEventListener("click", () => fileInput.click());
if(fileInput) fileInput.addEventListener("change", () => { if (fileInput.files.length) addFiles(fileInput.files); });

document.addEventListener("dragover",  e => { e.preventDefault(); if(dropOverlay) dropOverlay.classList.add("visible"); });
document.addEventListener("dragleave", e => { if (!e.relatedTarget && dropOverlay) dropOverlay.classList.remove("visible"); });
document.addEventListener("drop", e => {
    e.preventDefault();
    if(dropOverlay) dropOverlay.classList.remove("visible");
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

// Rebrancher l'envoi au clic
if(sendBtn) sendBtn.addEventListener("click", window.sendMessage);

// Gérer la touche Entrée selon l'état du Toggle
if(userInput) {
    userInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            if (enterToSend && !e.shiftKey) { 
                e.preventDefault(); 
                window.sendMessage(); 
            }
        }
    });
    userInput.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });
}

// Init finale
updateCredits();
setStatus("ok");
checkLocalAuth();
