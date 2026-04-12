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
Tu DOIS générer un bloc <think>...</think> d'espace de calcul invisible. Ordre absolu : cette réflexion doit être un seul bloc de texte dense, sans aucune puce ni liste. Pour guider ta logique sans casser ce bloc unique, utilise ces marqueurs en ligne : [INTENT] analyse de l'objectif réel | [ROOT] identification de la cause racine | [ARCHI] définition de la solution pérenne. Dès la fermeture de </think>, démarre la réponse finale immédiatement, sans préambule.

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
//  AUTH — mot de passe unique local
// ============================================================

const ACCESS_PASSWORD = "2024";

const loginScreen = document.getElementById("loginScreen");
const loginPassEl = document.getElementById("loginPassword");
const loginBtn    = document.getElementById("loginBtn");
const loginError  = document.getElementById("loginError");
const logoutBtn   = document.getElementById("logoutBtn");

function checkLocalAuth() {
    if (sessionStorage.getItem("pensee_auth") === "true") {
        loginScreen.style.display = "none";
        loadCreditsFromStorage();
        loadHistoryFromStorage();
    } else {
        loginScreen.style.display = "flex";
        if (loginPassEl) loginPassEl.focus();
    }
}

function handleLogin() {
    const password = (loginPassEl ? loginPassEl.value : "").trim();
    if (!password) {
        loginError.style.display = "block";
        loginError.textContent = "Entre le mot de passe.";
        return;
    }
    if (password !== ACCESS_PASSWORD) {
        loginError.style.display = "block";
        loginError.textContent = "Mot de passe incorrect.";
        if (loginPassEl) {
            loginPassEl.classList.add("shake");
            setTimeout(() => loginPassEl.classList.remove("shake"), 500);
        }
        return;
    }
    sessionStorage.setItem("pensee_auth", "true");
    loginError.style.display = "none";
    loginScreen.style.opacity = "0";
    setTimeout(() => { loginScreen.style.display = "none"; }, 300);
    loadCreditsFromStorage();
    loadHistoryFromStorage();
}

loginBtn.addEventListener("click", handleLogin);
if (loginPassEl) {
    loginPassEl.addEventListener("keypress", (e) => { if (e.key === "Enter") handleLogin(); });
}
logoutBtn.addEventListener("click", () => {
    if (confirm("Verrouiller la session ?")) {
        sessionStorage.removeItem("pensee_auth");
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
//  HISTORIQUE — localStorage, persistant entre rechargements
// ============================================================

function showWelcome() {
    messagesEl.innerHTML = "";
    addMessage("bot", "Bonjour. Je suis <strong>Pens\u00e9e</strong> \u2014 ton IA personnelle.<br><br>Programmation, culture, science, storytelling, strat\u00e9gie... pose-moi n'importe quelle question. Tu peux aussi m'envoyer des fichiers pour une analyse approfondie.", true);
    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "flex";
}

function loadHistoryFromStorage() {
    messagesEl.innerHTML = "";
    try {
        const stored = localStorage.getItem(CONFIG.storageKey);
        if (!stored) { showWelcome(); return; }
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || parsed.length === 0) { showWelcome(); return; }
        history = parsed;
        parsed.forEach(function(msg) {
            addMessage(
                msg.role === "assistant" ? "bot" : "user",
                msg.role === "assistant" ? formatResponse(msg.content) : msg.content,
                msg.role === "assistant"
            );
        });
        const sug = document.getElementById("suggestions");
        if (sug) sug.style.display = "none";
    } catch(e) {
        console.warn("Historique corrompu, reset.", e);
        localStorage.removeItem(CONFIG.storageKey);
        showWelcome();
    }
}

function saveHistoryToStorage() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(history.slice(-100)));
}

function clearHistory() {
    if (!confirm("Nouvelle conversation ?")) return;
    history = [];
    localStorage.removeItem(CONFIG.storageKey);
    showWelcome();
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
    // 1. Suppression totale et silencieuse du bloc de réflexion interne (même en cours de stream)
    text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "");
    
    // 2. Formatage classique
    text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, function(_, _lang, code) {
        return "<pre><code>" + escapeHtml(code.trim()) + "</code></pre>";
    });
    text = text.replace(/`([^`\n]+)`/g, function(_, code) { return "<code>" + escapeHtml(code) + "</code>"; });
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\n/g, "<br>");
    return text;
}

function setStatus(state) {
    const map = { ok: ["ok", "\u25cf connect\u00e9"], err: ["err", "\u25cf erreur"], warn: ["warn", "\u25cf cr\u00e9dits bas"] };
    statusBadge.className = "";
    if (map[state]) { statusBadge.className = map[state][0]; statusBadge.textContent = map[state][1]; }
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
        fullReply = fullReply.replace(/\[(Utilisateur|Pensée)\]:[\s\S]*$/gm, "").trim();
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

        history.push({ role: "user",      content: userMessage });
        history.push({ role: "assistant", content: fullReply });
        saveHistoryToStorage();

        creditsLeft--;
        saveCreditsToStorage();
        updateCredits();
        if (creditsLeft > 0) setStatus("ok");

    } catch(error) {
        removeTyping();
        addMessage("bot", "❌ Erreur réseau : " + error.message, false);
        setStatus("err");
    }
}

// ============================================================
//  ENVOI
// ============================================================

async function sendMessage() {
    const text  = userInput.value.trim();
    const files = attachedFiles.slice();
    if (!text && !files.length) return;
    if (sendBtn.disabled) return;

    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "none";

    const messageText = text || "Analyse ce fichier et explique ce qu'il fait.";

    if (files.length > 0) addUserMessageWithFiles(text, files);
    else addMessage("user", text, false);

    userInput.value        = "";
    userInput.style.height = "auto";
    attachedFiles          = [];
    renderUploadPreview();
    fileInput.value = "";

    sendBtn.disabled    = true;
    sendBtn.textContent = "...";
    showTyping();

    await new Promise(function(r) { setTimeout(r, 0); });
    await callAPI(messageText, files);

    removeTyping();
    if (creditsLeft > 0) {
        sendBtn.disabled    = false;
        sendBtn.textContent = "Envoyer \u203a";
        userInput.focus();
    }
}

// ============================================================
//  ÉVÉNEMENTS
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

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
userInput.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
});

// ============================================================
//  INIT — ordre impératif :
//  1. updateCredits / setStatus (pas besoin d'auth)
//  2. checkLocalAuth EN DERNIER (utilise messagesEl + toutes les fonctions)
// ============================================================
updateCredits();
setStatus("ok");
checkLocalAuth();
