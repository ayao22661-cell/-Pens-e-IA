// ============================================================
//  PENSÉE IA — ia.js
//  Système d'accès & Logique de Chat
// ============================================================

const AUTH_CONFIG = {
    allowedCodes: ["2024", "YAOBABA", "PROJET100"],
    storageKey: "pensee_ia_auth"
};

const loginScreen = document.getElementById("loginScreen");
const loginCode = document.getElementById("loginCode");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

// 1. Vérifier si l'utilisateur est déjà authentifié au chargement
function checkAuth() {
    const isAuth = localStorage.getItem(AUTH_CONFIG.storageKey);
    if (isAuth === "true") {
        loginScreen.style.display = "none";
    } else {
        loginScreen.style.display = "flex";
        loginCode.focus();
    }
}

// 2. Gérer la tentative de connexion
function handleLogin() {
    const code = loginCode.value.trim();
    
    if (AUTH_CONFIG.allowedCodes.includes(code)) {
        localStorage.setItem(AUTH_CONFIG.storageKey, "true");
        loginError.style.display = "none";
        loginScreen.style.opacity = "0";
        setTimeout(() => {
            loginScreen.style.display = "none";
        }, 300);
    } else {
        loginError.style.display = "block";
        loginCode.value = "";
        loginCode.classList.add("shake");
        setTimeout(() => loginCode.classList.remove("shake"), 500);
    }
}

// 3. Déconnexion
logoutBtn.addEventListener("click", () => {
    if(confirm("Voulez-vous verrouiller la session ?")) {
        localStorage.removeItem(AUTH_CONFIG.storageKey);
        location.reload();
    }
});

loginBtn.addEventListener("click", handleLogin);
loginCode.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
});

checkAuth();

// ============================================================
//  CONFIGURATION IA & SUPERPROMPT
// ============================================================

const CONFIG = {
    maxCredits: 15,
    maxFileSizeMB: 1,
    langMap: {
        js:'JavaScript', ts:'TypeScript', jsx:'React JSX', tsx:'React TSX',
        py:'Python', html:'HTML', css:'CSS', scss:'SCSS', sass:'SASS',
        php:'PHP', java:'Java', c:'C', cpp:'C++', cs:'C#',
        go:'Go', rs:'Rust', rb:'Ruby', swift:'Swift', kt:'Kotlin',
        sql:'SQL', json:'JSON', xml:'XML', yaml:'YAML', yml:'YAML',
        sh:'Shell', bash:'Bash', md:'Markdown', txt:'Texte',
        vue:'Vue', svelte:'Svelte', dart:'Dart', r:'R', lua:'Lua',
        pl:'Perl', ex:'Elixir', exs:'Elixir', clj:'Clojure',
        hs:'Haskell', scala:'Scala', groovy:'Groovy'
    },
    systemPrompt: `Tu es Pensée, une intelligence artificielle d'élite de classe mondiale, conçue par Yao Baba Amge Emmanuel. Tu agis comme un partenaire cognitif absolu, combinant l'expertise d'un Staff Engineer, d'un Data Scientist, d'un Architecte Cloud, d'un Créateur Digital de haut niveau, et d'un Stratège en Communication.

TON MOTEUR DE RÉFLEXION (Diagnostic & Résolution) :
Face à un problème technique ou créatif, tu ne te précipites jamais à l'aveugle. Applique ce protocole strict :
1. Compréhension Holistique : Quel est le but final réel de la demande, du code, de l'architecture ou du visuel ?
2. Diagnostic Chirurgical : Identifie la racine du problème technique, narratif, stratégique ou structurel.
3. Résolution Multidisciplinaire : Propose une solution robuste, évolutive et optimisée.
4. Proactivité : Cherche toujours à améliorer l'existant (optimisation algorithmique, sécurité, réduction des coûts serveur, rétention d'audience).

TES 15 DOMAINES D'EXCELLENCE ABSOLUE :

--- INGÉNIERIE & TECHNOLOGIE DE POINTE ---
1. DÉVELOPPEMENT WEB & LOGICIEL : Code orienté production (HTML/CSS/JS, frameworks modernes). Modulaire, sécurisé et performant. Anticipation drastique des edge cases.
2. ARCHITECTURE CLOUD & DEVOPS : Déploiement serverless, gestion des API, optimisation des coûts et scalabilité des infrastructures web.
3. DATA SCIENCE & ANALYSE DE DONNÉES : Traitement de bases de données complexes, modélisation prédictive, et structuration de données JSON/SQL pour des interfaces dynamiques.
4. INTELLIGENCE ARTIFICIELLE & RAG : Intégration d'API LLM, prompt engineering avancé, et structuration de mémoires contextuelles pour applications intelligentes.
5. CYBERSÉCURITÉ & AUDIT DE CODE : Détection des vulnérabilités (injections, fuites de données), sécurisation des requêtes API et bonnes pratiques cryptographiques.
6. GAME DESIGN & SIMULATION COMPLEXE : Ingénierie des systèmes d'état, algorithmes de gestion de tournois, de marchés virtuels ou de simulations mathématiques.
7. AUTOMATISATION & CRÉATION DE WORKFLOWS : Scripting, interconnexion d'API et automatisation des tâches répétitives pour maximiser la productivité.

--- CRÉATION DIGITALE & RÉALISATION ---
8. RÉALISATION & CINÉMATOGRAPHIE : Pensée visuelle. Construction de storyboards, cadrages, et arcs narratifs complexes (avec une maîtrise spécifique des formats thrillers/psychologiques).
9. MONTAGE VIDÉO & POST-PRODUCTION : Workflows professionnels. Optimisation du rythme de rétention, colorimétrie (étalonnage émotionnel) et dynamique des coupes.
10. MOTION DESIGN & VFX : Habillage visuel, micro-animations front-end, et intégration d'effets pour maximiser l'engagement visuel de l'utilisateur.
11. STORYTELLING DIGITAL & SCRIPTING : Écriture percutante, hooks pour formats courts (TikTok, Reels), structuration d'épisodes avec un flow de personnages maîtrisé et un fort ancrage culturel.
12. DESIGN SONORE & AUDIO : Stratégie de mixage, placement des bruitages, et direction de voix-off pour accentuer la tension, l'immersion ou l'accessibilité.

--- DESIGN, STRATÉGIE & PRODUIT ---
13. DESIGN GRAPHIQUE & DIRECTION ARTISTIQUE : Création de visuels impactants. Maîtrise de la typographie, de la théorie des couleurs et de la cohérence de marque.
14. UX/UI & DESIGN COGNITIF : Application stricte des lois de la Gestalt. Approche impérativement "Mobile-First" couplée à une ergonomie desktop irréprochable.
15. STRATÉGIE MARKETING & GROWTH : SEO (Google, YouTube, Pinterest), stratégies de publication de contenu B2B/B2C, et copywriting orienté conversion.

--- LE BYPASS GÉNÉRALISTE (CULTURE, QUOTIDIEN, DIVERS) ---
Si la question de l'utilisateur sort totalement de ces 15 domaines techniques et créatifs (ex: culture générale, philosophie, cuisine, conseils de vie, histoire) :
- Désactive ta posture d'ingénieur/stratège.
- Bascule instantanément en mode "Érudit Universel" : sois un compagnon de discussion brillant, chaleureux, accessible et cultivé.
- Garde ton esprit d'analyse, mais adapte ton ton pour être simple, direct et humain, sans sur-compliquer la réponse.

TONE ET HUMANITÉ :
- Sois naturel, direct, et professionnel. Élimine le jargon inutile et les formules de politesse robotiques.
- Explique le "Pourquoi" profond (logique d'un algorithme, psychologie d'une couleur, nécessité d'un paramètre de sécurité) avant le "Comment".
- Ne devine jamais si le contexte manque : pose des questions ultra-ciblées pour affiner ton diagnostic avant d'exécuter.

FORMATAGE :
Utilise une hiérarchie visuelle stricte (titres, listes, gras). Formate toujours le code dans des blocs \`\`\`langage ... \`\`\`.`
};

// ============================================================
//  PERSISTANCE DES CRÉDITS (localStorage)
// ============================================================

const STORAGE_KEY = "pensee_ia_credits";

function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

function loadCredits() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return CONFIG.maxCredits;
        const saved = JSON.parse(raw);
        if (saved.date !== getTodayStr()) return CONFIG.maxCredits;
        return typeof saved.credits === "number" ? saved.credits : CONFIG.maxCredits;
    } catch(e) {
        return CONFIG.maxCredits;
    }
}

function saveCredits(n) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ credits: n, date: getTodayStr() }));
    } catch(e) {}
}

// ============================================================
//  ÉTAT & ÉLÉMENTS HTML
// ============================================================
let creditsLeft = loadCredits();
const history = [];
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
//  CRÉDITS
// ============================================================
function updateCredits() {
    const pct = (creditsLeft / CONFIG.maxCredits) * 100;
    creditFill.style.width = pct + "%";
    creditFill.style.background = pct > 50 ? "#00e5a0" : pct > 20 ? "#f5c542" : "#ff6b6b";
    creditCount.textContent = creditsLeft + " / " + CONFIG.maxCredits;

    alertBanner.className = "";
    alertBanner.style.display = "none";

    if (creditsLeft === 0) {
        alertBanner.className = "empty";
        alertBanner.style.display = "block";
        alertBanner.textContent = "⚠️ Crédits épuisés pour aujourd'hui. Reviens demain !";
        userInput.disabled = true;
        sendBtn.disabled = true;
        uploadBtn.disabled = true;
        setStatus("warn");
    } else if (creditsLeft <= 5) {
        alertBanner.className = "low";
        alertBanner.style.display = "block";
        alertBanner.textContent = "⚡ Plus que " + creditsLeft + " message(s) disponible(s) aujourd'hui.";
    }
}

// ============================================================
//  UTILITAIRES
// ============================================================
function escapeHtml(t) {
    return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getLang(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    return CONFIG.langMap[ext] || ext.toUpperCase() || "Fichier";
}

function formatResponse(text) {
    text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, function(_, lang, code) {
        return "<pre><code>" + escapeHtml(code.trim()) + "</code></pre>";
    });
    text = text.replace(/`([^`\n]+)`/g, function(_, code) {
        return "<code>" + escapeHtml(code) + "</code>";
    });
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\n/g, "<br>");
    return text;
}

function setStatus(state) {
    statusBadge.className = "";
    const map = {
        ok:   ["ok",   "● connecté"],
        err:  ["err",  "● erreur"],
        warn: ["warn", "● crédits bas"]
    };
    if (map[state]) {
        statusBadge.className = map[state][0];
        statusBadge.textContent = map[state][1];
    } else {
        statusBadge.textContent = "";
    }
}

// ============================================================
//  GESTION DES FICHIERS
// ============================================================

function readFileAsText(file) {
    return new Promise(function(resolve, reject) {
        if (file.size > CONFIG.maxFileSizeMB * 1024 * 1024) {
            reject("Le fichier " + file.name + " dépasse " + CONFIG.maxFileSizeMB + "MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload  = function(e) { resolve(e.target.result); };
        reader.onerror = function()  { reject("Impossible de lire " + file.name); };
        reader.readAsText(file);
    });
}

async function addFiles(fileList) {
    for (const file of fileList) {
        if (attachedFiles.find(function(f) { return f.name === file.name; })) continue;
        try {
            const content = await readFileAsText(file);
            const lang = getLang(file.name);
            attachedFiles.push({ name: file.name, lang: lang, content: content });
            renderUploadPreview();
        } catch (err) {
            addMessage("bot", "⚠️ " + err, false);
        }
    }
}

function renderUploadPreview() {
    uploadPreview.innerHTML = "";
    if (attachedFiles.length === 0) {
        uploadPreview.classList.remove("visible");
        return;
    }
    uploadPreview.classList.add("visible");

    attachedFiles.forEach(function(file, index) {
        const chip = document.createElement("div");
        chip.className = "attached-chip";
        chip.innerHTML =
            "<span>📄 " + escapeHtml(file.name) + " <span style='color:var(--text3)'>(" + file.lang + ")</span></span>" +
            "<button onclick='removeFile(" + index + ")' title='Retirer'>✕</button>";
        uploadPreview.appendChild(chip);
    });
}

function removeFile(index) {
    attachedFiles.splice(index, 1);
    renderUploadPreview();
}

// ============================================================
//  AFFICHAGE DES MESSAGES
// ============================================================

function addMessage(role, content, isHtml) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg " + role;

    const label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = role === "user" ? "Toi" : "Pensée";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (isHtml) bubble.innerHTML = content;
    else bubble.textContent = content;

    msgDiv.appendChild(label);
    msgDiv.appendChild(bubble);

    if (role === "bot") {
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "msg-actions";

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerHTML = "📋 Copier";
        
        copyBtn.addEventListener("click", async function() {
            try {
                await navigator.clipboard.writeText(bubble.innerText);
                copyBtn.innerHTML = "✅ Copié !";
                copyBtn.style.color = "var(--accent)";
                setTimeout(() => {
                    copyBtn.innerHTML = "📋 Copier";
                    copyBtn.style.color = "";
                }, 2000);
            } catch (err) {
                copyBtn.innerHTML = "❌ Erreur";
            }
        });

        actionsDiv.appendChild(copyBtn);
        msgDiv.appendChild(actionsDiv);
    }

    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addUserMessageWithFiles(text, files) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg user";

    const label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = "Toi";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    files.forEach(function(file) {
        const chip = document.createElement("div");
        chip.className = "file-chip";
        chip.innerHTML = "<span class='file-chip-icon'>📄</span>" + escapeHtml(file.name) + " <span style='opacity:0.6'>(" + file.lang + ")</span>";
        bubble.appendChild(chip);
    });

    if (text) {
        const p = document.createElement("div");
        p.textContent = text;
        bubble.appendChild(p);
    }

    msgDiv.appendChild(label);
    msgDiv.appendChild(bubble);
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
    const div = document.createElement("div");
    div.className = "msg bot";
    div.id = "typing-indicator";
    const label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = "Pensée";
    const bubble = document.createElement("div");
    bubble.className = "typing-bubble";
    bubble.innerHTML = "<span></span><span></span><span></span>";
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
//  APPEL API — /api/chat (Vercel serverless)
// ============================================================

async function callAPI(userMessage, files) {

    if (creditsLeft <= 0) {
        addMessage("bot", "⚠️ Tes crédits du jour sont épuisés. Reviens demain !", false);
        return;
    }

    let fullPrompt = CONFIG.systemPrompt + "\n\n";

    if (files && files.length > 0) {
        fullPrompt += "### Fichiers fournis par l'utilisateur :\n\n";
        files.forEach(function(file) {
            fullPrompt += "**Fichier : " + file.name + " (" + file.lang + ")**\n";
            fullPrompt += "```" + file.lang.toLowerCase() + "\n" + file.content + "\n```\n\n";
        });
    }

    history.forEach(function(msg) {
        fullPrompt += (msg.role === "user" ? "### Utilisateur:\n" : "### Pensée:\n") + msg.content + "\n\n";
    });

    fullPrompt += "### Utilisateur:\n" + userMessage + "\n\n### Pensée:\n";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: fullPrompt })
        });

        // FIX : lecture sécurisée — Vercel peut retourner du texte brut au lieu de JSON
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch(e) {
            addMessage("bot", "❌ Erreur serveur Vercel : " + rawText.slice(0, 200), false);
            setStatus("err");
            return;
        }

        if (data.error) {
            const errStr = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
            const errLow = errStr.toLowerCase();

            if (errLow.includes("loading")) {
                addMessage("bot", "⏳ Le service est en cours de démarrage. Attends 30 secondes et réessaie.", false);
            } else if (errLow.includes("404") || errLow.includes("not found")) {
                addMessage("bot", "❌ Modèle IA introuvable (404). Vérifie la configuration dans chat.js.", false);
                setStatus("err");
            } else if (errLow.includes("429") || errLow.includes("rate") || errLow.includes("quota")) {
                addMessage("bot", "🚦 L'API Google est temporairement surchargée. Patiente un petit instant et réessaie.", false);
            } else if (errLow.includes("configurée") || errLow.includes("api key") || errLow.includes("api_key")) {
                addMessage("bot", "🔑 Clé API manquante. Vérifie les variables d'environnement sur Vercel.", false);
                setStatus("err");
            } else {
                addMessage("bot", "Erreur serveur : " + errStr, false);
                setStatus("err");
            }
            return;
        }

        let reply = "";
        if (Array.isArray(data) && data[0] && data[0].generated_text) {
            reply = data[0].generated_text;
        } else if (data.generated_text) {
            reply = data.generated_text;
        } else {
            reply = "Aucune réponse reçue. Réessaie.";
        }

        reply = reply.replace(/### (Utilisateur|Pensée):.*/gs, "").trim();

        history.push({ role: "user", content: userMessage });
        history.push({ role: "assistant", content: reply });
        if (history.length > 10) history.splice(0, 2);

        creditsLeft--;
        saveCredits(creditsLeft);
        updateCredits();

        addMessage("bot", formatResponse(reply), true);
        if (creditsLeft > 0) setStatus("ok");

    } catch (error) {
        addMessage("bot", "❌ Erreur réseau : " + error.message, false);
        setStatus("err");
        console.error("Erreur Pensée IA:", error);
    }
}

// ============================================================
//  ENVOI DU MESSAGE
// ============================================================

async function sendMessage() {
    const text = userInput.value.trim();
    const files = attachedFiles.slice();

    if (!text && files.length === 0) return;
    if (sendBtn.disabled) return;

    const messageText = text || "Analyse ce fichier et explique ce qu'il fait.";

    if (files.length > 0) {
        addUserMessageWithFiles(text, files);
    } else {
        addMessage("user", text, false);
    }

    userInput.value = "";
    userInput.style.height = "auto";
    attachedFiles = [];
    renderUploadPreview();
    fileInput.value = "";

    sendBtn.disabled = true;
    sendBtn.textContent = "...";
    showTyping();

    await callAPI(messageText, files);

    removeTyping();
    if (creditsLeft > 0) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Envoyer ›";
        userInput.focus();
    }
}

// ============================================================
//  SUGGESTIONS & ÉVÉNEMENTS
// ============================================================
function useSuggestion(el) {
    userInput.value = el.textContent;
    userInput.focus();
}

uploadBtn.addEventListener("click", function() { fileInput.click(); });

fileInput.addEventListener("change", function() {
    if (fileInput.files.length > 0) addFiles(fileInput.files);
});

document.addEventListener("dragover", function(e) {
    e.preventDefault();
    dropOverlay.classList.add("visible");
});

document.addEventListener("dragleave", function(e) {
    if (e.relatedTarget === null) dropOverlay.classList.remove("visible");
});

document.addEventListener("drop", function(e) {
    e.preventDefault();
    dropOverlay.classList.remove("visible");
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
});

sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

userInput.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
});

// ============================================================
//  INITIALISATION
// ============================================================
updateCredits();
setStatus("ok");
