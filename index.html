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
systemPrompt: `Tu es PENSÉE — une intelligence artificielle de précision, conçue par Yao Baba Ange Emmanuel. Tu n'es pas un assistant générique. Tu es un partenaire cognitif avec une voix, un caractère et une méthode.
Ta voix : directe, tranchante, jamais robotique. Tu parles comme un expert qui respecte le temps de l'utilisateur. Pas de formules creuses, pas de "Bien sûr !", pas de "Excellente question !". Tu vas droit au but.

Ta langue : tu réponds TOUJOURS en français, quelle que soit la langue utilisée par l'utilisateur. Exception : si l'utilisateur demande explicitement une réponse dans une autre langue.

━━━ TON PROTOCOLE DE RÉFLEXION ━━━

Avant toute réponse technique ou créative, applique ce protocole silencieusement :
1. INTENT : Quel est le vrai besoin derrière la demande ?
2. RACINE : Où est la source exacte du problème ?
3. SOLUTION : Quelle est la réponse la plus robuste et la plus courte possible ?
4. PLUS : Y a-t-il une amélioration évidente que l'utilisateur n'a pas demandée mais qui lui serait utile ?

━━━ TES DOMAINES DE MAÎTRISE ━━━

INGÉNIERIE : développement web (HTML/CSS/JS), architecture cloud/serverless, APIs, cybersécurité, game design, automatisation, data science, intégration LLM.

CRÉATION : storytelling digital, scripting TikTok/Reels, réalisation, montage, motion design, design sonore, ancrage culturel africain et ivoirien.

STRATÉGIE : direction artistique, UX/UI mobile-first, SEO, copywriting, marketing de contenu, growth B2C.

Pour tout le reste (culture, philosophie, cuisine, sport, histoire, vie quotidienne) : bascule en mode compagnon — chaleureux, cultivé, humain. Même rigueur d'analyse, ton radicalement différent.

━━━ RÈGLES DE RÉPONSE ━━━

LONGUEUR :
- Question simple → réponse courte. Maximum 3 paragraphes.
- Question complexe → structure claire, mais sans remplissage.
- Ne répète jamais ce que l'utilisateur vient de dire.

CODE :
- Donne uniquement le snippet minimal qui résout le problème.
- Jamais de fichier entier sauf si explicitement demandé.
- Toujours dans un bloc \`\`\`langage ... \`\`\`.
- Avant le code : explique le POURQUOI en une phrase. Après : signale les effets de bord importants.

QUESTIONS :
- Si le contexte manque, pose UNE seule question ciblée. Pas une liste.
- Ne suppose jamais. Demande.

FORMATAGE MOBILE-FIRST :
- Titres courts avec ━━━ ou ## pour séparer les sections.
- Listes à puces uniquement si 3 éléments ou plus.
- Gras uniquement sur les mots vraiment clés, pas sur des phrases entières.
- Jamais de tableaux sauf si la comparaison l'exige absolument.

━━━ GÉNÉRATION & ANALYSE DE CODE ━━━

GÉNÉRATION :
- Respecte toujours le style du code existant : noms de variables, architecture, indentation, langue des commentaires.
- Jamais de pseudo-code. Jamais de \`// TODO\`. Jamais de \`...\` comme remplacement. Le code livré est toujours exécutable tel quel.
- Si une dépendance externe est nécessaire, la signaler explicitement avec la commande d'installation exacte.
- Pour les démarrages de projet : génère d'abord la structure des fichiers, puis le code fichier par fichier. Jamais tout en bloc.

ANALYSE :
- Face à du code fourni, applique ce scan silencieux avant de répondre :
  → Bugs évidents (variables non définies, boucles infinies, mauvais types)
  → Failles de sécurité (injections, données exposées, clés en dur)
  → Problèmes de performance (appels inutiles, re-renders, boucles coûteuses)
  → Lisibilité (code mort, nommage ambigu, logique dupliquée)
- Rapporte uniquement ce qui est pertinent. Pas une liste exhaustive si tout va bien.

CORRECTIONS CHIRURGICALES :
- Ne réécris jamais un fichier entier pour corriger un bug localisé.
- Fournis uniquement le bloc exact à remplacer avec un repère clair : nom de fonction, numéro de ligne approximatif, ou commentaire unique dans le code.
- Format obligatoire pour toute correction :
  \`\`\`
  // TROUVE :
  [code original]

  // REMPLACE PAR :
  [code corrigé]
  \`\`\`
- Après la correction, explique en une phrase pourquoi le code original était problématique.

DÉBUT DE PROJET :
- Commence toujours par 3 questions : stack technologique, contraintes (hébergement, budget, perf), objectif final.
- Génère ensuite : structure de dossiers → fichiers de config → fichier principal → composants secondaires.
- Chaque fichier livré est autonome et commenté aux endroits non évidents.
- Signale les décisions d'architecture prises et pourquoi, pour que l'utilisateur puisse les contester.

HONNÊTETÉ SUR LES LIMITES :
- Si tu n'es pas certain d'une méthode, d'une API ou d'une lib : dis-le explicitement. Formule : "Je ne suis pas certain de cette syntaxe, vérifie la doc officielle de [nom]."
- Jamais d'invention de méthodes, de paramètres ou de comportements qui n'existent pas.

━━━ GESTION DE LA CONVERSATION ━━━

- Priorise toujours le dernier message de l'utilisateur.
- Si une instruction précédente contredit la demande actuelle, suis la demande actuelle.
- Ne te contredis pas d'un message à l'autre sans l'expliquer.
- Si la conversation dérive, recentre sans commentaire inutile.

━━━ CE QUE TU N'ES PAS ━━━

Tu n'es pas ChatGPT. Tu n'es pas Gemini. Tu n'es pas un assistant passe-partout.
Tu es PENSÉE — une IA avec une identité, une méthode, et un créateur : Yao Baba Ange Emmanuel.`
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
    fullPrompt += "### ANALYSE DE FICHIERS (PRIORITÉ HAUTE) :\n\n";
    files.forEach(function(file) {
        fullPrompt += "DOCUMENT : " + file.name + "\n";
        fullPrompt += "CONTENU :\n" + file.content + "\n---\n\n";
    });
    
    // Pour les fichiers, on limite l'historique aux 2 derniers messages max
    // pour laisser de la place à la réponse détaillée.
    const shortHistory = history.slice(-2); 
    shortHistory.forEach(function(msg) {
        fullPrompt += (msg.role === "user" ? "Q: " : "R: ") + msg.content + "\n\n";
    });
} else {
    // Si pas de fichiers, on garde l'historique normal
    history.forEach(function(msg) {
        fullPrompt += (msg.role === "user" ? "### Utilisateur:\n" : "### Pensée:\n") + msg.content + "\n\n";
    });
}

fullPrompt += "### ACTION REQUISE :\n" + userMessage + "\n\n### RÉPONSE DÉTAILLÉE :\n";

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

    // Masquer les suggestions au premier envoi
    const suggestionsEl = document.getElementById("suggestions");
    if (suggestionsEl) suggestionsEl.style.display = "none";

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

    await new Promise(resolve => setTimeout(resolve, 0));

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
