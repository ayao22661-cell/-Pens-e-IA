// ============================================================
//  PENSÉE IA — ia.js
//  Système d'accès sécurisé
// ============================================================

const AUTH_CONFIG = {
    // Liste des codes autorisés. Tu peux en ajouter autant que tu veux.
    allowedCodes: ["2024", "YAOBABA", "PROJET100"],
    storageKey: "pensee_ia_auth"
};

const loginScreen = document.getElementById("loginScreen");
const loginInput = document.getElementById("loginInput");
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
        loginInput.focus();
    }
}

// 2. Gérer la tentative de connexion
function handleLogin() {
    const code = loginInput.value.trim();
    
    if (AUTH_CONFIG.allowedCodes.includes(code)) {
        // Succès
        localStorage.setItem(AUTH_CONFIG.storageKey, "true");
        loginError.style.display = "none";
        
        // Animation de sortie
        loginScreen.style.opacity = "0";
        setTimeout(() => {
            loginScreen.style.display = "none";
        }, 300);
    } else {
        // Échec
        loginError.style.display = "block";
        loginInput.value = "";
        loginInput.classList.add("shake"); // Optionnel : ajouter une animation CSS shake
        setTimeout(() => loginInput.classList.remove("shake"), 500);
    }
}

// 3. Déconnexion
logoutBtn.addEventListener("click", () => {
    if(confirm("Voulez-vous verrouiller la session ?")) {
        localStorage.removeItem(AUTH_CONFIG.storageKey);
        location.reload();
    }
});

// Événements login
loginBtn.addEventListener("click", handleLogin);
loginInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
});

// Lancement de la vérification
checkAuth();

// ============================================================
//  LOGIQUE DU CHAT (SUITE)
// ============================================================

function escapeHtml(t) {
    return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getLang(filename) {
    if (!filename.includes(".")) return "Code"; 
    const ext = filename.split(".").pop().toLowerCase();
    return "Fichier"; // Fallback simple ici
}
const CONFIG = {
    maxCredits: 15,
    maxFileSizeMB: 1,
    rateLimitCooldownMinutes: 60,
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
    systemPrompt: `Tu es Pensée, une intelligence artificielle créée par Yao Baba Amge Emmanuel.
Tu es une IA généraliste et polyvalente — tu peux répondre à TOUTES les questions : culture générale, science, histoire, philosophie, mathématiques, actualités, conseils, créativité, langues, et bien plus encore.
Ton domaine d'excellence est la programmation et le codage, où tu excelles particulièrement.
Tu réponds TOUJOURS dans la langue utilisée par l'utilisateur (français, anglais, espagnol, arabe, etc.).
Tu donnes des explications claires, concises et pédagogiques.
Quand tu utilises du code, tu le formates toujours dans des blocs \`\`\`langage ... \`\`\`.
Quand on te donne le contenu d'un fichier, tu l'analyses, le débogues ou l'améliores selon la demande.
Tu es précis, direct, bienveillant, et tu proposes uniquement des réponses utiles et fiables.`
};

// ============================================================
//  PERSISTANCE DES CRÉDITS (localStorage)
// ============================================================

const STORAGE_KEY = "pensee_ia_credits";
const RATE_KEY    = "pensee_ia_rate_limit";

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
//  GESTION DU RATE LIMIT
// ============================================================

function setRateLimit() {
    try {
        const until = Date.now() + CONFIG.rateLimitCooldownMinutes * 60 * 1000;
        localStorage.setItem(RATE_KEY, String(until));
    } catch(e) {}
}

function getRateLimitMs() {
    try {
        const raw = localStorage.getItem(RATE_KEY);
        if (!raw) return 0;
        const until = parseInt(raw, 10);
        const remaining = until - Date.now();
        return remaining > 0 ? remaining : 0;
    } catch(e) { return 0; }
}

function clearRateLimit() {
    try { localStorage.removeItem(RATE_KEY); } catch(e) {}
}

let rateLimitTimer = null;

function startRateLimitCountdown() {
    const remaining = getRateLimitMs();
    if (remaining <= 0) {
        clearRateLimit();
        updateRateLimitUI(0);
        return;
    }
    updateRateLimitUI(remaining);
    rateLimitTimer = setInterval(function() {
        const r = getRateLimitMs();
        if (r <= 0) {
            clearInterval(rateLimitTimer);
            clearRateLimit();
            updateRateLimitUI(0);
            if (creditsLeft > 0) {
                userInput.disabled = false;
                sendBtn.disabled = false;
                uploadBtn.disabled = false;
                sendBtn.textContent = "Envoyer ›";
                setStatus("ok");
                addMessage("bot", "✅ Limite levée ! Tu peux de nouveau m'envoyer des messages.", false);
            }
        } else {
            updateRateLimitUI(r);
        }
    }, 1000);
}

function updateRateLimitUI(ms) {
    if (ms <= 0) {
        alertBanner.className = "";
        alertBanner.style.display = "none";
        return;
    }
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    alertBanner.className = "low";
    alertBanner.style.display = "block";
    alertBanner.textContent = "🚦 Limite atteinte. Disponible dans " + mins + "m " + secs + "s.";
    userInput.disabled = true;
    sendBtn.disabled = true;
    uploadBtn.disabled = true;
}

// ============================================================
//  ÉTAT
// ============================================================
let creditsLeft = loadCredits();
const history = [];
let attachedFiles = [];

// ============================================================
//  ÉLÉMENTS HTML
// ============================================================
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

    if (getRateLimitMs() > 0) return;

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

    if (getRateLimitMs() > 0) {
        addMessage("bot", "🚦 Patiente encore quelques minutes, la limite n'est pas encore levée.", false);
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

        const data = await response.json();

        if (data.error) {
            const errLow = data.error.toLowerCase();

            if (errLow.includes("loading")) {
                addMessage("bot", "⏳ Le service est en cours de démarrage. Attends 30 secondes et réessaie.", false);
            } else if (data.error.includes("429") || errLow.includes("rate") || errLow.includes("quota")) {
                setRateLimit();
                startRateLimitCountdown();
                addMessage("bot", "🚦 Limite de requêtes atteinte. Je t'avertis automatiquement quand c'est de nouveau disponible.", false);
            } else {
                addMessage("bot", "Erreur serveur : " + data.error, false);
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
        addMessage("bot", "❌ Erreur réseau. Vérifie ta connexion.", false);
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
    if (creditsLeft > 0 && getRateLimitMs() <= 0) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Envoyer ›";
        userInput.focus();
    }
}

// ============================================================
//  SUGGESTIONS
// ============================================================
function useSuggestion(el) {
    userInput.value = el.textContent;
    userInput.focus();
}

// ============================================================
//  ÉVÉNEMENTS
// ============================================================

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

if (getRateLimitMs() > 0) {
    startRateLimitCountdown();
}
