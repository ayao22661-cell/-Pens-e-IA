// ============================================================
//  PENSÉE IA — ia.js (localStorage, sans Supabase)
// ============================================================

const CONFIG = {
    maxCredits: 20,
    maxFileSizeMB: 10,
    storageKey:  'pensee_ia_history',
    creditsKey:  'pensee_ia_credits',
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
//  SUPABASE & AUTH (Login / Sign Up)
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ⚠️ À REMPLACER PAR TES CLÉS RÉELLES
const supabaseUrl = 'https://uhrdoxllxqtvucxmzcww.supabase.co';
const supabaseKey = 'sb_publishable_8EA5WSsRgDTcKbtpULEEFQ_Du2qoRIb';
const supabase = createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let isSignUpMode = false;

// Éléments DOM
const loginScreen       = document.getElementById("loginScreen");
const loginEmailEl      = document.getElementById("loginEmail");
const loginPassEl       = document.getElementById("loginPassword");
const loginBtn          = document.getElementById("loginBtn");
const loginError        = document.getElementById("loginError");
const loginSuccess      = document.getElementById("loginSuccess");
const toggleAuthModeBtn = document.getElementById("toggleAuthMode");
const logoutBtn         = document.getElementById("logoutBtn");

// Basculer entre Connexion et Inscription
if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener("click", () => {
        isSignUpMode = !isSignUpMode;
        loginBtn.textContent = isSignUpMode ? "Créer mon compte ›" : "Se connecter ›";
        toggleAuthModeBtn.textContent = isSignUpMode ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S'inscrire";
        loginError.style.display = "none";
        if(loginSuccess) loginSuccess.style.display = "none";
    });
}

// Vérification de la session au chargement
async function checkLocalAuth() {
    // 1. Écouter les changements d'état (connexion, déconnexion, clic email)
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            currentUser = session.user;
            loginScreen.style.display = "none";
            
            // Nettoyage de l'URL (enlève le #access_token...)
            if (window.location.hash) {
                window.history.replaceState(null, null, window.location.pathname);
            }

            loadCreditsFromDB();
            initTabs();
        } else {
            loginScreen.style.display = "flex";
            if (loginEmailEl) loginEmailEl.focus();
        }
    });

    // 2. Vérification immédiate au chargement
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        loginScreen.style.display = "none";
    }
}

// Fonction unique pour gérer l'Auth
async function handleAuth() {
    const email = (loginEmailEl ? loginEmailEl.value : "").trim();
    const password = (loginPassEl ? loginPassEl.value : "").trim();

    if (!email || !password) {
        loginError.style.display = "block";
        loginError.textContent = "Email et mot de passe requis.";
        return;
    }

    loginBtn.textContent = "Traitement...";
    loginBtn.disabled = true;
    loginError.style.display = "none";
    if(loginSuccess) loginSuccess.style.display = "none";

    try {
        if (isSignUpMode) {
            // --- SIGN UP ---
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            
            if(loginSuccess) {
                loginSuccess.style.display = "block";
                loginSuccess.innerHTML = "✅ Compte créé !<br>Vérifie tes emails pour confirmer.";
            }
        } else {
            // --- LOGIN ---
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            currentUser = data.user;
            loginScreen.style.opacity = "0";
            setTimeout(() => { loginScreen.style.display = "none"; }, 300);
            
            loadCreditsFromStorage();
            initTabs();
        }
    } catch (error) {
        loginError.style.display = "block";
        loginError.textContent = error.message;
        loginPassEl.classList.add("shake");
        setTimeout(() => loginPassEl.classList.remove("shake"), 500);
    } finally {
        loginBtn.textContent = isSignUpMode ? "Créer mon compte ›" : "Se connecter ›";
        loginBtn.disabled = false;
    }
}

// Événements
loginBtn.addEventListener("click", handleAuth);
loginPassEl?.addEventListener("keypress", (e) => { if (e.key === "Enter") handleAuth(); });
loginEmailEl?.addEventListener("keypress", (e) => { if (e.key === "Enter") loginPassEl.focus(); });

logoutBtn.addEventListener("click", async () => {
    if (confirm("Se déconnecter de Pensée ?")) {
        await supabase.auth.signOut();
        location.reload();
    }
});

// ============================================================
//  ÉTAT & ÉLÉMENTS DOM
//  ⚠️  Déclarés AVANT tout appel qui les utilise
// ============================================================

let creditsLeft   = CONFIG.maxCredits;
let history       = [];
let attachedFiles = [];

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

// ============================================================
//  CRÉDITS — localStorage, reset quotidien automatique
// ============================================================

async function loadCreditsFromDB() {
    if (!currentUser) return;
    const today = new Date().toISOString().slice(0, 10);
    
    // Récupération du profil depuis Supabase
    let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error || !profile) return;

    // Reset journalier si la date stockée est différente d'aujourd'hui
    if (profile.last_reset_date !== today) {
        await supabase
            .from('profiles')
            .update({ credits_used: 0, last_reset_date: today })
            .eq('id', currentUser.id);
        creditsLeft = CONFIG.maxCredits;
    } else {
        creditsLeft = CONFIG.maxCredits - (profile.credits_used || 0);
    }
    updateCredits();
}

async function useCreditInDB() {
    if (!currentUser) return;
    // Calcul du nouveau nombre de crédits utilisés
    const used = CONFIG.maxCredits - (creditsLeft - 1);
    await supabase
        .from('profiles')
        .update({ credits_used: used })
        .eq('id', currentUser.id);
}

// ============================================================
//  HISTORIQUE — localStorage, persistant entre rechargements
// ============================================================

// ── Gestionnaire d'onglets (Supabase) ──────────────────────────────────
let tabs = [];
let activeTabId = null;

function getHistoryKey(tabId) { return 'pensee_ia_history__' + tabId; }

async function loadTabs() {
    if (!currentUser) return [];
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) console.error("Erreur chargement tabs:", error);
    return data || [];
}

async function createTab(switchTo) {
    if (!currentUser) return null;
    const { data, error } = await supabase
        .from('conversations')
        .insert([{ user_id: currentUser.id, title: 'Nouvelle conv.' }])
        .select()
        .single();

    if (error) {
        console.error("Erreur création tab:", error);
        return null;
    }

    tabs.unshift(data);
    if (switchTo !== false) switchTab(data.id);
    else renderTabs();
    return data.id;
}

async function deleteTab(id) {
    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) { console.error("Erreur suppression:", error); return; }

    const idx = tabs.findIndex(t => t.id === id);
    tabs = tabs.filter(t => t.id !== id);
    
    if (tabs.length === 0) {
        await createTab(true);
    } else if (activeTabId === id) {
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
    loadHistoryFromDB();
    renderTabs();
}

async function updateTabTitle(id, firstUserMsg) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    
    const title = firstUserMsg.slice(0, 28) + (firstUserMsg.length > 28 ? '…' : '');
    if (tab.title === 'Nouvelle conv.' || tab.title.endsWith('…') || tab.title === title.slice(0, -1)) {
        const { error } = await supabase.from('conversations').update({ title: title }).eq('id', id);
        if (!error) {
            tab.title = title;
            renderTabs();
            const titleEl = document.getElementById('activeConvTitle');
            if (titleEl && id === activeTabId) titleEl.textContent = title;
        }
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
        // Utilise la date de Supabase au lieu de l'ID généré localement
        const ts = new Date(tab.created_at).getTime();
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
        
        // Supabase trie déjà, pas besoin de reverse()
        group.items.forEach(tab => {
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

// Mobile sidebar toggle
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
    if (toggle) toggle.addEventListener('click', function() {
        sb.classList.toggle('open');
        ov.classList.toggle('visible');
    });
    if (ov) ov.addEventListener('click', closeSidebarMobile);

    // Bouton "+ Nouveau" sidebar
    const newBtn = document.getElementById('newConvSideBtn');
    if (newBtn) newBtn.addEventListener('click', function() {
        createTab(true);
        closeSidebarMobile();
    });
})();

// ── Initialisation des onglets ─────────────────────────────────────────────
async function initTabs() {
    tabs = await loadTabs();
    
    if (tabs && tabs.length > 0) {
        const lastActive = sessionStorage.getItem('pensee_ia_active_tab');
        const validLast = lastActive && tabs.find(t => t.id === lastActive);
        activeTabId = validLast ? lastActive : tabs[0].id;
    } else {
        activeTabId = null;
        tabs = [];
        const newId = await createTab(false);
        if (newId) activeTabId = newId;
    }
    
    if (activeTabId) {
        sessionStorage.setItem('pensee_ia_active_tab', activeTabId);
        CONFIG.storageKey = getHistoryKey(activeTabId);
    }
    
    renderTabs();
    loadHistoryFromDB(); 
}

function showWelcome() {
    messagesEl.innerHTML = "";
    addMessage("bot", "Bonjour. Je suis <strong>Pens\u00e9e</strong> \u2014 ton IA personnelle.<br><br>Programmation, culture, science, storytelling, strat\u00e9gie... pose-moi n'importe quelle question. Tu peux aussi m'envoyer des fichiers pour une analyse approfondie.", true);
    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "flex";
}

async function loadHistoryFromDB() {
    messagesEl.innerHTML = "";
    history = []; // On réinitialise l'historique local du contexte

    if (!activeTabId || !currentUser) {
        showWelcome();
        return;
    }

    const { data, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', activeTabId)
        .order('created_at', { ascending: true }); // Du plus ancien au plus récent

    if (error || !data || data.length === 0) {
        showWelcome();
        return;
    }

    history = data; // On charge le contexte pour la fenêtre de l'IA
    
    data.forEach(msg => {
        addMessage(
            msg.role === "assistant" ? "bot" : "user",
            msg.role === "assistant" ? formatResponse(msg.content) : msg.content,
            msg.role === "assistant"
        );
    });

    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "none";
}

async function saveMessageToDB(role, content) {
    if (!activeTabId || !currentUser) return;
    
    const { error } = await supabase
        .from('messages')
        .insert([{
            conversation_id: activeTabId,
            user_id: currentUser.id,
            role: role,
            content: content
        }]);
        
    if (error) console.error("Erreur de sauvegarde du message :", error);
}

function saveHistoryToStorage() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(history.slice(-100)));
}

function clearHistory() {
    // Crée un nouvel onglet sans confirmation (le bouton s'appelle déjà "+ Nouveau")
    createTab(true);
}

const clearBtn = document.getElementById("clearBtn");
if (clearBtn) clearBtn.addEventListener("click", clearHistory);

// ============================================================
//  CRÉDITS UI
// ============================================================

function updateCredits() {
    const pct = (creditsLeft / CONFIG.maxCredits) * 100;
    creditFill.style.width      = pct + "%";
    creditFill.style.background = pct > 50 ? "#00e5a0" : pct > 20 ? "#f5c542" : "#ff6b6b";
    creditCount.textContent     = creditsLeft + " / " + CONFIG.maxCredits;

    alertBanner.className     = "";
    alertBanner.style.display = "none";

    // Réinitialiser les contrôles avant de les bloquer conditionnellement
    userInput.disabled = false;
    sendBtn.disabled   = false;
    uploadBtn.disabled = false;

    if (creditsLeft === 0) {
        alertBanner.className     = "empty";
        alertBanner.style.display = "block";
        alertBanner.textContent   = "\u26a0\ufe0f Cr\u00e9dits \u00e9puis\u00e9s pour aujourd'hui. Reviens demain !";
        userInput.disabled  = true;
        sendBtn.disabled    = true;
        uploadBtn.disabled  = true;
        setStatus("warn");
    } else if (creditsLeft <= 5) {
        alertBanner.className     = "low";
        alertBanner.style.display = "block";
        alertBanner.textContent   = "\u26a1 Plus que " + creditsLeft + " message(s) disponible(s) aujourd'hui.";
    }
}

// ============================================================
//  UTILITAIRES
// ============================================================

function escapeHtml(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getLang(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    return CONFIG.langMap[ext] || ext.toUpperCase() || "Fichier";
}

function formatResponse(text) {
    // 1. Détecter si l'IA est en train de réfléchir (bloc non fermé)
    const isThinking = /<think>(?!.*<\/think>)/is.test(text);
    
    // 2. Suppression totale et silencieuse du bloc de réflexion
    let cleanText = isThinking
        ? text.replace(/<think>[\s\S]*$/i, "")
        : text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    
    // 3. GESTION BLINDÉE DES BULLES VIDES
    if (cleanText.trim() === "") {
        if (isThinking) {
            // L'IA est toujours en train de générer le bloc <think>
            return "<span style='color: var(--text2); font-style: italic; font-size: 12px; animation: pulse 1.5s infinite;'>🧠 Pensée en cours d'analyse...</span>";
        } else {
            // L'IA a fermé la balise, mais n'a RIEN écrit d'autre.
            // On vérifie si elle a caché sa réponse dans le bloc think.
            const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
            if (thinkMatch && thinkMatch[1].trim() !== "") {
                // On repêche la réponse brute
                cleanText = "<span style='color: var(--text3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;'>[Analyse brute extraite]</span><br><br>" + thinkMatch[1].trim();
            } else {
                // Transition (fraction de seconde) avant l'affichage du vrai texte
                return "<span style='color: var(--text2); font-style: italic; font-size: 12px;'>✍️ Rédaction en cours...</span>";
            }
        }
    }
    
    // 4. Formatage classique (Code, Markdown, Sauts de ligne)
    cleanText = cleanText.replace(/```(\w+)?\n?([\s\S]*?)```/g, function(_, _lang, code) {
        return "<pre><code>" + escapeHtml(code.trim()) + "</code></pre>";
    });
    cleanText = cleanText.replace(/`([^`\n]+)`/g, function(_, code) { return "<code>" + escapeHtml(code) + "</code>"; });
    cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    cleanText = cleanText.replace(/\n/g, "<br>");
    
    return cleanText;
}

// ============================================================
//  FICHIERS
// ============================================================

function readFileAsData(file) {
    return new Promise(function(resolve, reject) {
        if (file.size > CONFIG.maxFileSizeMB * 1024 * 1024) {
            reject("Le fichier " + file.name + " d\u00e9passe " + CONFIG.maxFileSizeMB + "MB."); return;
        }
        const reader   = new FileReader();
        const ext      = file.name.split(".").pop().toLowerCase();
        const isBinary = ["pdf", "docx", "doc", "mp3", "m4a", "wav", "ogg"].includes(ext);
        reader.onload  = function(e) {
            if (isBinary) resolve({ type: "binary", mimeType: file.type, data: e.target.result.split(",")[1] });
            else          resolve({ type: "text", data: e.target.result });
        };
        reader.onerror = function() { reject("Impossible de lire " + file.name); };
        if (isBinary) reader.readAsDataURL(file);
        else          reader.readAsText(file);
    });
}

async function addFiles(fileList) {
    for (const file of fileList) {
        if (attachedFiles.find(function(f) { return f.name === file.name; })) continue;
        try {
            const content = await readFileAsData(file);
            attachedFiles.push({ name: file.name, lang: getLang(file.name), content: content });
            renderUploadPreview();
        } catch(err) { addMessage("bot", "\u26a0\ufe0f " + err, false); }
    }
}

function renderUploadPreview() {
    uploadPreview.innerHTML = "";
    if (!attachedFiles.length) { uploadPreview.classList.remove("visible"); return; }
    uploadPreview.classList.add("visible");
    attachedFiles.forEach(function(file, i) {
        const chip = document.createElement("div");
        chip.className = "attached-chip";
        chip.innerHTML = "<span>\ud83d\udcc4 " + escapeHtml(file.name) + " <span style='color:var(--text3)'>(" + file.lang + ")</span></span><button onclick=\"removeFile(" + i + ")\" title=\"Retirer\">\u2715</button>";
        uploadPreview.appendChild(chip);
    });
}

window.removeFile = function(i) { attachedFiles.splice(i, 1); renderUploadPreview(); };

// ============================================================
//  AFFICHAGE MESSAGES
// ============================================================

function addMessage(role, content, isHtml) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg " + role;
    const label  = document.createElement("span");
    label.className   = "msg-label";
    label.textContent = role === "user" ? "Toi" : "Pens\u00e9e";
    const bubble = document.createElement("div");
    bubble.className  = "bubble";
    if (isHtml) bubble.innerHTML   = content;
    else        bubble.textContent = content;
    msgDiv.appendChild(label);
    msgDiv.appendChild(bubble);

    if (role === "bot") {
        const actions = document.createElement("div");
        actions.className = "msg-actions";
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerHTML = "\ud83d\udccb Copier";
        copyBtn.addEventListener("click", async function() {
            try {
                await navigator.clipboard.writeText(bubble.innerText);
                copyBtn.innerHTML  = "\u2705 Copi\u00e9 !";
                copyBtn.style.color = "var(--accent)";
                setTimeout(function() { copyBtn.innerHTML = "\ud83d\udccb Copier"; copyBtn.style.color = ""; }, 2000);
            } catch(e) { copyBtn.innerHTML = "\u274c Erreur"; }
        });
        actions.appendChild(copyBtn);
        msgDiv.appendChild(actions);
    }

    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addUserMessageWithFiles(text, files) {
    const msgDiv = document.createElement("div");
    msgDiv.className  = "msg user";
    const label  = document.createElement("span");
    label.className   = "msg-label";
    label.textContent = "Toi";
    const bubble = document.createElement("div");
    bubble.className  = "bubble";
    files.forEach(function(file) {
        const chip = document.createElement("div");
        chip.className = "file-chip";
        chip.innerHTML = "<span>\ud83d\udcc4</span>" + escapeHtml(file.name) + " <span style='opacity:0.6'>(" + file.lang + ")</span>";
        bubble.appendChild(chip);
    });
    if (text) { const p = document.createElement("div"); p.textContent = text; bubble.appendChild(p); }
    msgDiv.appendChild(label);
    msgDiv.appendChild(bubble);
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
    const div   = document.createElement("div");
    div.className = "msg bot";
    div.id        = "typing-indicator";
    const label   = document.createElement("span");
    label.className   = "msg-label";
    label.textContent = "Pens\u00e9e";
    const bubble  = document.createElement("div");
    bubble.className  = "typing-bubble";
    bubble.innerHTML  = "<span></span><span></span><span></span>";
    div.appendChild(label);
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
    const t = document.getElementById("typing-indicator");
    if (t) t.remove();
}

// ============================================================
//  CONSTRUCTION DU PROMPT — fenêtre glissante de contexte
// ============================================================

function buildPrompt(userMessage, files) {
    const CONTEXT_WINDOW = 20;
    const recent = history.slice(-CONTEXT_WINDOW);

    const today = new Date().toLocaleDateString("fr-FR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    const temporalKeywords = [
        "aujourd'hui", "ce mois", "cette semaine", "cette ann\u00e9e", "r\u00e9cent", "r\u00e9cente",
        "derni\u00e8re", "dernier", "maintenant", "actuellement", "actuel", "actuelle",
        "nouveau", "nouvelle", "nouveaux", "nouvelles", "2025", "2026", "vient de",
        "derni\u00e8res nouvelles", "quoi de neuf", "tendance", "tendances"
    ];
    const needsSearch = temporalKeywords.some(function(kw) { return userMessage.toLowerCase().includes(kw); });
    const searchInstruction = needsSearch
        ? "\n[INSTRUCTION CRITIQUE : Cette question concerne l'actualit\u00e9 r\u00e9cente. Tu DOIS utiliser google_search pour r\u00e9pondre. Ne r\u00e9ponds JAMAIS depuis ta m\u00e9moire d'entra\u00eenement sur ce sujet.]\n"
        : "";
    let prompt = "[DATE ACTUELLE : " + today + "]" + searchInstruction + "\n\n" + CONFIG.systemPrompt + "\n\n";

    if (files && files.length > 0) {
        prompt += "### FICHIERS JOINTS (PRIORIT\u00c9 HAUTE) :\n\n";
        files.forEach(function(file) {
            if (file.content && file.content.type === "text") {
                prompt += "DOCUMENT : " + file.name + "\nCONTENU :\n" + file.content.data + "\n---\n\n";
            } else {
                prompt += "DOCUMENT BINAIRE : " + file.name + " (trait\u00e9 via inline_data)\n---\n\n";
            }
        });
    }

    if (recent.length > 0) {
        prompt += "### HISTORIQUE DE LA CONVERSATION :\n\n";
        recent.forEach(function(msg) {
            const role = msg.role === "user" ? "Utilisateur" : "Pens\u00e9e";
            prompt += "[" + role + "]: " + msg.content + "\n\n";
        });
    }

    prompt += "### NOUVEAU MESSAGE :\n" + userMessage + "\n\n### R\u00c9PONSE :\n";
    return prompt;
}

//  APPEL API — /api/chat (Vercel Edge & Streaming)
// ============================================================

async function callAPI(userMessage, files) {
    if (creditsLeft <= 0) {
        addMessage("bot", "⚠️ Tes crédits du jour sont épuisés. Reviens demain !", false);
        return;
    }

    const prompt = buildPrompt(userMessage, files);
    const binaryFiles = files
        .filter(function(f) { return f.content && f.content.type === "binary"; })
        .map(function(f) { return { name: f.name, mime: f.content.mimeType, base64: f.content.data }; });

    try {
        const response = await fetch("/api/chat", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
                prompt: prompt,
                files:  binaryFiles.length > 0 ? binaryFiles : undefined
            })
        });

        if (!response.ok) {
            let errMsg = "Erreur HTTP " + response.status;
            try {
                const errData = await response.json();
                errMsg = errData.error || errMsg;
            } catch(e) {}
            
            addMessage("bot", "❌ Erreur : " + errMsg, false);
            setStatus("err");
            return;
        }

        removeTyping();
        
        // Création de l'interface de la bulle vide pour le flux
        const msgDiv = document.createElement("div");
        msgDiv.className = "msg bot";
        const label = document.createElement("span");
        label.className = "msg-label";
        label.textContent = "Pensée";
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        msgDiv.appendChild(label);
        msgDiv.appendChild(bubble);
        messagesEl.appendChild(msgDiv);

        // Lecture du flux binaire en direct
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            fullReply += decoder.decode(value, { stream: true });
            bubble.innerHTML = formatResponse(fullReply);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        // Nettoyage et finalisation du message
        // On coupe SEULEMENT si "[Utilisateur]:" apparaît après au moins 80 chars de contenu réel
        // (évite de vider la bulle quand le modèle cite la structure du prompt dans sa réponse)
        fullReply = fullReply.replace(/^\s*\[Pens[ée]{1,2}e?\s*(?:IA)?\s*\]:\s*/i, "");
        const cutIndex = fullReply.search(/\n\[Utilisateur\]:|\n###\s*NOUVEAU MESSAGE/i);
        if (cutIndex > 80) fullReply = fullReply.substring(0, cutIndex);
        fullReply = fullReply.trim();
        bubble.innerHTML = formatResponse(fullReply);

        const actions = document.createElement("div");
        actions.className = "msg-actions";
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerHTML = "📋 Copier";
        copyBtn.addEventListener("click", async function() {
            try {
                await navigator.clipboard.writeText(bubble.innerText);
                copyBtn.innerHTML  = "✅ Copié !";
                copyBtn.style.color = "var(--accent)";
                setTimeout(function() { copyBtn.innerHTML = "📋 Copier"; copyBtn.style.color = ""; }, 2000);
            } catch(e) { copyBtn.innerHTML = "❌ Erreur"; }
        });
        actions.appendChild(copyBtn);
        msgDiv.appendChild(actions);

        // Mise à jour du contexte local
        history.push({ role: "user",      content: userMessage });
        history.push({ role: "assistant", content: fullReply });
        
        // Sauvegarde de la réponse de l'IA (le message utilisateur est déjà sauvé)
        await saveMessageToDB("assistant", fullReply);

        // Déduction du crédit sur Supabase
        await useCreditInDB();
        
        creditsLeft--;
        updateCredits();
        if (creditsLeft > 0) setStatus("ok");

    } catch(error) {
        removeTyping();
        addMessage("bot", "❌ Erreur réseau : " + error.message, false);
        setStatus("err");
    }
}
// ============================================================
//  GESTION DU BADGE DE STATUT
// ============================================================
function setStatus(state) {
    if (!statusBadge) return; // Sécurité si l'élément HTML n'est pas chargé
    const map = { 
        ok: ["ok", "● connecté"], 
        err: ["err", "● erreur"], 
        warn: ["warn", "● crédits bas"] 
    };
    statusBadge.className = "";
    if (map[state]) { 
        statusBadge.className = map[state][0]; 
        statusBadge.textContent = map[state][1]; 
    }
}

// ============================================================
//  ENVOI
// ============================================================

// ============================================================
//  ENVOI ET GESTION DES MESSAGES
// ============================================================

async function sendMessage() {
    const text  = userInput.value.trim();
    const files = attachedFiles.slice();
    if (!text && !files.length) return;
    if (sendBtn.disabled) return;

    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "none";

    const messageText = text || "Analyse ce fichier et explique ce qu'il fait.";

    // 1. Affichage du message utilisateur
    if (files.length > 0) addUserMessageWithFiles(text, files);
    else addMessage("user", text, false);

    // 2. Mise à jour automatique du titre de l'onglet si nouvelle conversation
    if (text && activeTabId) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab && tab.title === 'Nouvelle conv.') {
            updateTabTitle(activeTabId, text);
        }
    }

    // 3. Nettoyage de l'interface
    userInput.value        = "";
    userInput.style.height = "auto";
    attachedFiles          = [];
    renderUploadPreview();
    fileInput.value = "";

    // 4. Verrouillage (Mode attente)
    sendBtn.disabled    = true;
    sendBtn.textContent = "...";
    showTyping();

    // SAUVEGARDE IMMÉDIATE DU MESSAGE UTILISATEUR
    // C'est cette ligne qui garantit que ton message s'affiche partout !
    await saveMessageToDB("user", messageText);

    // 5. Appel réseau vers ton API Vercel
    await new Promise(r => setTimeout(r, 0));
    await callAPI(messageText, files);

    // 6. Rétablissement de l'interface
    removeTyping();
    if (creditsLeft > 0) {
        sendBtn.disabled    = false;
        sendBtn.textContent = "Envoyer ›";
        userInput.focus();
    }
}

// ============================================================
//  ÉVÉNEMENTS GLOBAUX
// ============================================================

window.useSuggestion = function(el) { userInput.value = el.textContent; userInput.focus(); };

uploadBtn.addEventListener("click", function() { fileInput.click(); });
fileInput.addEventListener("change", function() { if (fileInput.files.length) addFiles(fileInput.files); });

document.addEventListener("dragover",  function(e) { e.preventDefault(); dropOverlay.classList.add("visible"); });
document.addEventListener("dragleave", function(e) { if (!e.relatedTarget) dropOverlay.classList.remove("visible"); });
document.addEventListener("drop", function(e) {
    e.preventDefault();
    dropOverlay.classList.remove("visible");
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

// Écouteurs de la zone de saisie
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
userInput.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
});

// ============================================================
//  INIT GLOBALE
// ============================================================
updateCredits();
setStatus("ok");
checkLocalAuth();
