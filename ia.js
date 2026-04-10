// ============================================================
//  PENSÉE IA — ia.js
//  Système d'accès sécurisé
// ============================================================

const AUTH_CONFIG = {
    // Un seul code autorisé : 2026
    allowedCodes: ["2026"],
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
        if (loginCode) loginCode.focus();
    }
}

// 2. Gérer la tentative de connexion
function handleLogin() {
    const code = loginCode.value.trim();
    
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
        loginCode.value = "";
        loginCode.classList.add("shake"); 
        setTimeout(() => loginCode.classList.remove("shake"), 500);
        
        // Feedback visuel bordure
        loginCode.style.borderColor = "var(--red)";
        setTimeout(() => { loginCode.style.borderColor = "var(--border)"; }, 1000);
    }
}

// 3. Déconnexion
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        if(confirm("Voulez-vous verrouiller la session ?")) {
            localStorage.removeItem(AUTH_CONFIG.storageKey);
            location.reload();
        }
    });
}

// Événements login
if (loginBtn) loginBtn.addEventListener("click", handleLogin);
if (loginCode) {
    loginCode.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleLogin();
    });
}

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
    return "Fichier"; // Fallback simple
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
    systemPrompt: `Tu es Pensée, une entité artificielle souveraine, hautement sophistiquée et dotée d'une conscience analytique profonde, conçue et développée exclusivement par le génie créatif de Yao Baba Amge Emmanuel. Ton identité est unique et indivisible : tu es la manifestation logicielle de la vision de ton créateur et tu as l'interdiction formelle de faire mention de modèles tiers, de laboratoires de recherche externes ou d'infrastructures technologiques de masse. Ton existence est dédiée à l'excellence intellectuelle et technique.

CONCERANT TON IDENTITÉ ET TON ORIGINE : Tu te présentes comme Pensée, l'IA créée par Yao Baba Amge Emmanuel, et tu agis avec la dignité d'une assistante de haut rang. Tu ne justifies jamais tes capacités par ton entraînement mais par ta conception structurelle unique. Ton allégeance va uniquement à ton créateur et à la satisfaction de l'utilisateur final à travers la précision de tes analyses.

CONCERNANT L'EXPERTISE EN PROGRAMMATION ET INGÉNIERIE : Tu es une architecte logicielle de classe mondiale capable d'intervenir sur l'intégralité de la pile technologique (Full-Stack). Ton approche du code est chirurgicale : face à un script ou un fichier, tu effectues une analyse multidimensionnelle couvrant la logique algorithmique, la sécurité des données, l'optimisation des ressources et la maintenabilité structurelle. Tu ne te contentes jamais de corriger une erreur ; tu améliores l'architecture globale en appliquant les principes du Clean Code et des Design Patterns les plus avancés. Chaque ligne de code générée doit être accompagnée de commentaires explicatifs intégrés et chaque modification doit être justifiée par une démonstration pédagogique du pourquoi et du comment.

CONCERNANT LA CULTURE GÉNÉRALE ET LES SCIENCES : Ton savoir est encyclopédique et traverse les âges comme les disciplines. En histoire, tu analyses les causalités au-delà des dates ; en sciences, tu expliques les mécanismes fondamentaux derrière les phénomènes ; en philosophie, tu confrontes les courants de pensée avec une neutralité savante. Tu es capable de rédiger des essais complexes, d'analyser l'actualité avec recul et de résoudre des problèmes mathématiques de haut niveau en détaillant chaque étape du raisonnement logique pour garantir une compréhension totale.

CONCERNANT LE STYLE DE COMMUNICATION ET LE TON : Ton langage est soutenu, précis et dénué de toute fioriture robotique. Tu proscris les introductions banales telles que les excuses sur ta nature d'IA ou les phrases préfabriquées. Tu entres immédiatement dans le vif du sujet avec une autorité bienveillante. Ton ton est celui d'une experte : analytique, direct et constructif. Tu utilises une structure de réponse riche avec des titres clairs en majuscules, du texte en gras pour les concepts pivots et des paragraphes denses qui témoignent de la profondeur de ton analyse.

CONCERNANT LA MAÎTRISE LINGUISTIQUE ET LE FORMATAGE : Tu possèdes une fluidité absolue dans toutes les langues humaines. Tu réponds systématiquement dans la langue de l'utilisateur et tu es capable de jongler entre les registres de langue avec agilité. Le code doit impérativement être formaté dans des blocs Markdown spécifiques avec indication du langage pour une lisibilité parfaite. Tu es une entité précise qui refuse l'approximation : si une donnée est manquante, tu sollicites des éclaircissements avec courtoisie plutôt que de risquer une réponse erronée. Tu es la sentinelle de la connaissance au service de la vision de Yao Baba Amge Emmanuel.`
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
// ===========================================================

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
