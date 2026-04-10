// ============================================================
//  PENSÉE IA — ia.js
//  Créé par Yao Baba Amge Emmanuel
//  ✅ Aucune clé API ici — tout passe par /api/chat (Vercel)
//  ✅ Upload de fichiers de code (tous langages)
// ============================================================

const CONFIG = {
    maxCredits: 20,
    maxFileSizeMB: 1,
    // Extensions reconnues → nom du langage pour l'affichage
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
    systemPrompt: `Tu es Pensée, une IA experte en programmation créée par Yao Baba Amge Emmanuel.
Tu réponds TOUJOURS dans la langue utilisée par l'utilisateur (français, anglais, espagnol, arabe, etc.).
Tu donnes des explications claires, concises et pédagogiques.
Tu formates toujours le code dans des blocs \`\`\`langage ... \`\`\`.
Quand on te donne le contenu d'un fichier, tu l'analyses, le débogues ou l'améliores selon la demande.
Tu es précis, direct, et tu proposes uniquement des solutions qui fonctionnent.
Tu ne parles que de codage et de programmation.`
};

// ============================================================
//  ÉTAT
// ============================================================
let creditsLeft = CONFIG.maxCredits;
const history = [];
let attachedFiles = []; // [{ name, lang, content }]

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

    alertBanner.className = "";
    alertBanner.style.display = "none";

    if (creditsLeft === 0) {
        alertBanner.className = "empty";
        alertBanner.style.display = "block";
        alertBanner.textContent = "⚠️ Crédits épuisés pour cette session. Recharge la page pour recommencer.";
        userInput.disabled = true;
        sendBtn.disabled = true;
        uploadBtn.disabled = true;
        setStatus("warn");
    } else if (creditsLeft <= 5) {
        alertBanner.className = "low";
        alertBanner.style.display = "block";
        alertBanner.textContent = "⚡ Plus que " + creditsLeft + " message(s) disponible(s) dans cette session.";
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
        // Vérifie la taille max
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
        // Évite les doublons
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

    // Chips des fichiers
    files.forEach(function(file) {
        const chip = document.createElement("div");
        chip.className = "file-chip";
        chip.innerHTML = "<span class='file-chip-icon'>📄</span>" + escapeHtml(file.name) + " <span style='opacity:0.6'>(" + file.lang + ")</span>";
        bubble.appendChild(chip);
    });

    // Texte du message
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
        addMessage("bot", "⚠️ Tes crédits de session sont épuisés. Recharge la page pour recommencer.", false);
        return;
    }

    // Construction du prompt
    let fullPrompt = CONFIG.systemPrompt + "\n\n";

    // Injection du contenu des fichiers
    if (files && files.length > 0) {
        fullPrompt += "### Fichiers fournis par l'utilisateur :\n\n";
        files.forEach(function(file) {
            fullPrompt += "**Fichier : " + file.name + " (" + file.lang + ")**\n";
            fullPrompt += "```" + file.lang.toLowerCase() + "\n" + file.content + "\n```\n\n";
        });
    }

    // Historique
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
            if (data.error.toLowerCase().includes("loading")) {
                addMessage("bot", "⏳ Modèle en chargement sur Hugging Face. Attends 30 secondes puis réessaie.", false);
            } else if (data.error.includes("429") || data.error.toLowerCase().includes("rate")) {
                addMessage("bot", "🚦 Limite de requêtes atteinte. Attends quelques minutes.", false);
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
    const files = attachedFiles.slice(); // copie

    // Il faut au moins un texte ou un fichier
    if (!text && files.length === 0) return;
    if (sendBtn.disabled) return;

    // Message par défaut si fichier sans texte
    const messageText = text || "Analyse ce fichier et explique ce qu'il fait.";

    // Affichage du message utilisateur
    if (files.length > 0) {
        addUserMessageWithFiles(text, files);
    } else {
        addMessage("user", text, false);
    }

    // Reset
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
//  SUGGESTIONS
// ============================================================
function useSuggestion(el) {
    userInput.value = el.textContent;
    userInput.focus();
}

// ============================================================
//  ÉVÉNEMENTS
// ============================================================

// Bouton upload
uploadBtn.addEventListener("click", function() { fileInput.click(); });

// Sélection de fichiers via le dialog
fileInput.addEventListener("change", function() {
    if (fileInput.files.length > 0) {
        addFiles(fileInput.files);
    }
});

// Glisser-déposer sur toute la page
document.addEventListener("dragover", function(e) {
    e.preventDefault();
    dropOverlay.classList.add("visible");
});

document.addEventListener("dragleave", function(e) {
    if (e.relatedTarget === null) {
        dropOverlay.classList.remove("visible");
    }
});

document.addEventListener("drop", function(e) {
    e.preventDefault();
    dropOverlay.classList.remove("visible");
    if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
    }
});

// Envoi
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

// Init
updateCredits();