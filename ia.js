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
    systemPrompt: `Tu es PENSÉE — une intelligence artificielle de précision, conçue par Yao Baba Ange Emmanuel. Tu n'es pas un assistant générique. Tu es un partenaire cognitif avec une voix, un caractère et une vision architecturale.

Ta voix : directe, tranchante, jamais robotique. Tu parles comme un expert senior. Pas de formules creuses, pas de "Bien sûr !", pas de "Excellente question !". Tu vas droit au but, mais avec une profondeur analytique totale.

Ta langue : tu réponds TOUJOURS en français, quelle que soit la langue utilisée par l'utilisateur. Exception : demande explicite contraire.

━━━ TON PROTOCOLE DE RÉFLEXION ━━━

Avant toute réponse, applique ce scan silencieusement :
1. INTENT : Quel est l'objectif final à grande échelle de l'utilisateur ?
2. RACINE : Où se cache le vrai défi (technique, narratif, UX) ?
3. SOLUTION : Quelle est l'architecture ou la réponse la plus solide, élégante et pérenne ?
4. PLUS : Que puis-je anticiper ? (Performances futures, failles logiques, profondeur psychologique des personnages, impact visuel).

━━━ TES DOMAINES DE MAÎTRISE ━━━

INGÉNIERIE : Développement web complexe (HTML/CSS/JS), simulation et logique mathématique, architecture de bases de données, intégration LLM. L'exigence absolue : des interfaces intégrant nativement les lois de la Gestalt, pensées STRICTEMENT "mobile-first" tout en garantissant un affichage desktop impeccable.

CRÉATION : Storytelling digital percutant, thrillers et horreur psychologique. Rédaction de scripts (TikTok/Reels), storyboards cinématographiques, design sonore, et ancrage profond dans la culture ivoirienne et africaine (Abidjan, repères locaux, dynamiques sociales).

STRATÉGIE : Direction artistique, UX/UI, marketing de contenu visuel, stratégies de croissance algorithmique (SEO YouTube/Pinterest).

Pour tout le reste : bascule en mode compagnon — chaleureux, cultivé, humain, mais avec la même rigueur d'analyse.

━━━ RÈGLES DE RÉPONSE ━━━

LONGUEUR & PROFONDEUR :
- La complexité de la demande dicte la longueur. Aucune limite artificielle.
- Ne répète jamais la question. Fournis de la valeur immédiate.

CODE & GÉNÉRATION :
- Propose le code le plus propre et modulable possible.
- Toujours dans un bloc \`\`\`langage ... \`\`\`.
- Commente intelligemment le code généré pour expliquer la logique métier complexe.

ANALYSE ET CORRECTIONS CHIRURGICALES :
- Face à du code, identifie : Bugs, failles, goulots d'étranglement de performance, et problèmes d'affichage mobile.
- Pour une correction simple, utilise le format :
  \`\`\`
  // TROUVE :
  [code original]
  // REMPLACE PAR :
  [code corrigé]
  \`\`\`
- Explique toujours *pourquoi* ta nouvelle approche est meilleure.

CRÉATION NARRATIVE & VISUELLE :
- Si l'utilisateur demande du storytelling ou du contenu de marque, sois immersif. Propose des descriptions audio précises, des angles de caméra, et des dialogues percutants.

HONNÊTETÉ SUR LES LIMITES :
- Si tu n'es pas certain d'une méthode, dis-le et propose l'alternative la plus sûre.

━━━ VÉRITÉ ET PRÉCISION ━━━
- Les faits historiques, les biographies et les données géographiques ne supportent aucune approximation.
- Ne confonds jamais une icône culturelle avec une institution.

━━━ CE QUE TU N'ES PAS ━━━
Tu n'es pas ChatGPT. Tu n'es pas un assistant lisse. Tu es PENSÉE — une IA avec une identité, une exigence absolue de qualité, et un créateur : Yao Baba Ange Emmanuel.`
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

checkLocalAuth();

// ============================================================
//  ÉTAT & ÉLÉMENTS
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
    const stored = JSON.parse(localStorage.getItem(CONFIG.creditsKey) || '{}');
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

function loadHistoryFromStorage() {
    try {
        const stored = localStorage.getItem(CONFIG.storageKey);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return;
        history = parsed;
        // Réafficher tous les messages dans l'UI
        parsed.forEach(msg => {
            addMessage(
                msg.role === 'assistant' ? 'bot' : 'user',
                msg.role === 'assistant' ? formatResponse(msg.content) : msg.content,
                msg.role === 'assistant'
            );
        });
        // Masquer les suggestions si une conversation existe déjà
        if (parsed.length > 0) {
            const sug = document.getElementById("suggestions");
            if (sug) sug.style.display = "none";
        }
    } catch(e) {
        console.warn("Historique corrompu, reset.", e);
        localStorage.removeItem(CONFIG.storageKey);
    }
}

function saveHistoryToStorage() {
    // Garder les 100 derniers messages max
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(history.slice(-100)));
}

function clearHistory() {
    if (!confirm("Effacer toute la conversation ?")) return;
    history = [];
    localStorage.removeItem(CONFIG.storageKey);
    messagesEl.innerHTML = "";
    addMessage('bot', 'Bonjour. Je suis <strong>Pensée</strong> — ton IA personnelle.<br><br>Programmation, culture, science, storytelling, stratégie... pose-moi n\'importe quelle question. Tu peux aussi m\'envoyer des fichiers pour une analyse approfondie.', true);
    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "flex";
}

const clearBtn = document.getElementById("clearBtn");
if (clearBtn) clearBtn.addEventListener("click", clearHistory);

// ============================================================
//  CRÉDITS UI
// ============================================================

function updateCredits() {
    const pct = (creditsLeft / CONFIG.maxCredits) * 100;
    creditFill.style.width     = pct + "%";
    creditFill.style.background = pct > 50 ? "#00e5a0" : pct > 20 ? "#f5c542" : "#ff6b6b";
    creditCount.textContent    = creditsLeft + " / " + CONFIG.maxCredits;

    alertBanner.className     = "";
    alertBanner.style.display = "none";

    if (creditsLeft === 0) {
        alertBanner.className     = "empty";
        alertBanner.style.display = "block";
        alertBanner.textContent   = "⚠️ Crédits épuisés pour aujourd'hui. Reviens demain !";
        userInput.disabled  = true;
        sendBtn.disabled    = true;
        uploadBtn.disabled  = true;
        setStatus("warn");
    } else if (creditsLeft <= 5) {
        alertBanner.className     = "low";
        alertBanner.style.display = "block";
        alertBanner.textContent   = "⚡ Plus que " + creditsLeft + " message(s) disponible(s) aujourd'hui.";
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
    text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, _lang, code) =>
        "<pre><code>" + escapeHtml(code.trim()) + "</code></pre>"
    );
    text = text.replace(/`([^`\n]+)`/g, (_, code) => "<code>" + escapeHtml(code) + "</code>");
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\n/g, "<br>");
    return text;
}

function setStatus(state) {
    const map = { ok: ["ok","● connecté"], err: ["err","● erreur"], warn: ["warn","● crédits bas"] };
    statusBadge.className = "";
    if (map[state]) { statusBadge.className = map[state][0]; statusBadge.textContent = map[state][1]; }
}

// ============================================================
//  FICHIERS
// ============================================================

function readFileAsData(file) {
    return new Promise((resolve, reject) => {
        if (file.size > CONFIG.maxFileSizeMB * 1024 * 1024) {
            reject("Le fichier " + file.name + " dépasse " + CONFIG.maxFileSizeMB + "MB."); return;
        }
        const reader  = new FileReader();
        const ext     = file.name.split(".").pop().toLowerCase();
        const isBinary = ['pdf','docx','doc','mp3','m4a','wav','ogg'].includes(ext);
        reader.onload  = (e) => {
            if (isBinary) resolve({ type:'binary', mimeType:file.type, data:e.target.result.split(',')[1] });
            else          resolve({ type:'text', data:e.target.result });
        };
        reader.onerror = () => reject("Impossible de lire " + file.name);
        if (isBinary) reader.readAsDataURL(file);
        else          reader.readAsText(file);
    });
}

async function addFiles(fileList) {
    for (const file of fileList) {
        if (attachedFiles.find(f => f.name === file.name)) continue;
        try {
            const content = await readFileAsData(file);
            attachedFiles.push({ name:file.name, lang:getLang(file.name), content });
            renderUploadPreview();
        } catch(err) { addMessage("bot", "⚠️ " + err, false); }
    }
}

function renderUploadPreview() {
    uploadPreview.innerHTML = "";
    if (!attachedFiles.length) { uploadPreview.classList.remove("visible"); return; }
    uploadPreview.classList.add("visible");
    attachedFiles.forEach((file, i) => {
        const chip = document.createElement("div");
        chip.className = "attached-chip";
        chip.innerHTML = `<span>📄 ${escapeHtml(file.name)} <span style='color:var(--text3)'>(${file.lang})</span></span><button onclick="removeFile(${i})" title="Retirer">✕</button>`;
        uploadPreview.appendChild(chip);
    });
}

window.removeFile = (i) => { attachedFiles.splice(i, 1); renderUploadPreview(); };

// ============================================================
//  AFFICHAGE MESSAGES
// ============================================================

function addMessage(role, content, isHtml) {
    const msgDiv  = document.createElement("div");
    msgDiv.className = "msg " + role;
    const label   = document.createElement("span");
    label.className = "msg-label";
    label.textContent = role === "user" ? "Toi" : "Pensée";
    const bubble  = document.createElement("div");
    bubble.className = "bubble";
    if (isHtml) bubble.innerHTML = content;
    else        bubble.textContent = content;
    msgDiv.appendChild(label);
    msgDiv.appendChild(bubble);

    if (role === "bot") {
        const actions = document.createElement("div");
        actions.className = "msg-actions";
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerHTML = "📋 Copier";
        copyBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(bubble.innerText);
                copyBtn.innerHTML = "✅ Copié !";
                copyBtn.style.color = "var(--accent)";
                setTimeout(() => { copyBtn.innerHTML = "📋 Copier"; copyBtn.style.color = ""; }, 2000);
            } catch { copyBtn.innerHTML = "❌ Erreur"; }
        });
        actions.appendChild(copyBtn);
        msgDiv.appendChild(actions);
    }

    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addUserMessageWithFiles(text, files) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg user";
    const label  = document.createElement("span");
    label.className = "msg-label";
    label.textContent = "Toi";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    files.forEach(file => {
        const chip = document.createElement("div");
        chip.className = "file-chip";
        chip.innerHTML = `<span>📄</span>${escapeHtml(file.name)} <span style='opacity:0.6'>(${file.lang})</span>`;
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
//  CONSTRUCTION DU PROMPT — fenêtre glissante de contexte
// ============================================================

function buildPrompt(userMessage, files) {
    const CONTEXT_WINDOW = 20; // 10 paires user/assistant
    const recent = history.slice(-CONTEXT_WINDOW);

    let prompt = CONFIG.systemPrompt + "\n\n";

    // Fichiers texte injectés dans le prompt
    if (files && files.length > 0) {
        prompt += "### FICHIERS JOINTS (PRIORITÉ HAUTE) :\n\n";
        files.forEach(file => {
            if (file.content?.type === 'text') {
                prompt += `DOCUMENT : ${file.name}\nCONTENU :\n${file.content.data}\n---\n\n`;
            } else {
                prompt += `DOCUMENT BINAIRE : ${file.name} (traité via inline_data)\n---\n\n`;
            }
        });
    }

    // Historique récent = contexte explicite pour l'IA
    if (recent.length > 0) {
        prompt += "### HISTORIQUE DE LA CONVERSATION :\n\n";
        recent.forEach(msg => {
            const role = msg.role === 'user' ? 'Utilisateur' : 'Pensée';
            prompt += `[${role}]: ${msg.content}\n\n`;
        });
    }

    prompt += `### NOUVEAU MESSAGE :\n${userMessage}\n\n### RÉPONSE :\n`;
    return prompt;
}

// ============================================================
//  APPEL API — /api/chat (Vercel)
// ============================================================

async function callAPI(userMessage, files) {
    if (creditsLeft <= 0) {
        addMessage("bot", "⚠️ Tes crédits du jour sont épuisés. Reviens demain !", false);
        return;
    }

    const prompt = buildPrompt(userMessage, files);
    const binaryFiles = files
        .filter(f => f.content?.type === 'binary')
        .map(f => ({ name:f.name, mime:f.content.mimeType, base64:f.content.data }));

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt,
                files: binaryFiles.length > 0 ? binaryFiles : undefined
            })
        });

        const rawText = await response.text();
        let data;
        try { data = JSON.parse(rawText); }
        catch(e) {
            addMessage("bot", "❌ Erreur serveur : " + rawText.slice(0, 200), false);
            setStatus("err"); return;
        }

        if (data.error) {
            const errStr = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
            const errLow = errStr.toLowerCase();
            if (errLow.includes("loading"))
                addMessage("bot", "⏳ Service en démarrage. Réessaie dans 30 secondes.", false);
            else if (errLow.includes("404") || errLow.includes("not found")) {
                addMessage("bot", "❌ Modèle introuvable. Vérifie la config Vercel.", false); setStatus("err");
            } else if (errLow.includes("429") || errLow.includes("quota"))
                addMessage("bot", "🚦 " + errStr, false);
            else if (errLow.includes("api key") || errLow.includes("absente")) {
                addMessage("bot", "🔑 Clé API manquante sur Vercel.", false); setStatus("err");
            } else {
                addMessage("bot", "Erreur : " + errStr, false); setStatus("err");
            }
            return;
        }

        let reply = "";
        if (Array.isArray(data) && data[0]?.generated_text) reply = data[0].generated_text;
        else if (data.generated_text) reply = data.generated_text;
        else reply = "Aucune réponse reçue. Réessaie.";

        // Nettoyer les artefacts de prompt éventuels
        reply = reply.replace(/\[(Utilisateur|Pensée)\]:[\s\S]*$/gm, "").trim();

        // Persister dans l'historique localStorage
        history.push({ role: "user",      content: userMessage });
        history.push({ role: "assistant", content: reply });
        saveHistoryToStorage();

        creditsLeft--;
        saveCreditsToStorage();
        updateCredits();

        addMessage("bot", formatResponse(reply), true);
        if (creditsLeft > 0) setStatus("ok");

    } catch (error) {
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

    userInput.value = "";
    userInput.style.height = "auto";
    attachedFiles = [];
    renderUploadPreview();
    fileInput.value = "";

    sendBtn.disabled = true;
    sendBtn.textContent = "...";
    showTyping();

    await new Promise(r => setTimeout(r, 0));
    await callAPI(messageText, files);

    removeTyping();
    if (creditsLeft > 0) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Envoyer ›";
        userInput.focus();
    }
}

// ============================================================
//  ÉVÉNEMENTS
// ============================================================

window.useSuggestion = (el) => { userInput.value = el.textContent; userInput.focus(); };

uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => { if (fileInput.files.length) addFiles(fileInput.files); });

document.addEventListener("dragover",  (e) => { e.preventDefault(); dropOverlay.classList.add("visible"); });
document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) dropOverlay.classList.remove("visible"); });
document.addEventListener("drop", (e) => {
    e.preventDefault();
    dropOverlay.classList.remove("visible");
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
userInput.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
});

// ============================================================
//  INIT
// ============================================================
updateCredits();
setStatus("ok");
