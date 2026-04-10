// ============================================================
//  PENSÉE IA — ia.js
//  Système d'accès & Logique de Chat
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
    'https://uhrdoxllxqtvucxmzcww.supabase.co',
    'COLLE_ICI_TA_PUBLISHABLE_KEY_COMPLETE'
);

let currentUser = null;

const loginScreen   = document.getElementById("loginScreen");
const loginCode     = document.getElementById("loginCode");
const loginPassword = document.getElementById("loginPassword");
const loginBtn      = document.getElementById("loginBtn");
const loginError    = document.getElementById("loginError");
const logoutBtn     = document.getElementById("logoutBtn");

// ============================================================
//  AUTH SUPABASE
// ============================================================

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        loginScreen.style.display = "none";
        await loadCreditsFromDB();
        await loadHistoryFromDB();
    } else {
        loginScreen.style.display = "flex";
        loginCode.focus();
    }
}

async function handleLogin() {
    const email    = loginCode.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
        loginError.style.display = "block";
        loginError.textContent = "Remplis l'email et le mot de passe.";
        return;
    }

    // Tentative de connexion
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        // Si l'utilisateur n'existe pas, on l'inscrit
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
            loginError.style.display = "block";
            loginError.textContent = "Email ou mot de passe incorrect.";
            loginCode.classList.add("shake");
            setTimeout(() => loginCode.classList.remove("shake"), 500);
            return;
        }
        currentUser = signUpData.user;
    } else {
        currentUser = data.user;
    }

    // Log de session
    await supabase.from('sessions').insert([{
        user_id: currentUser.id,
        user_agent: navigator.userAgent
    }]);

    loginError.style.display = "none";
    loginScreen.style.opacity = "0";
    setTimeout(() => { loginScreen.style.display = "none"; }, 300);

    await loadCreditsFromDB();
    await loadHistoryFromDB();
}

logoutBtn.addEventListener("click", async () => {
    if (confirm("Voulez-vous verrouiller la session ?")) {
        await supabase.auth.signOut();
        location.reload();
    }
});

loginBtn.addEventListener("click", handleLogin);
loginCode.addEventListener("keypress", (e) => {
    if (e.key === "Enter") loginPassword.focus();
});
loginPassword.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
});

checkAuth();

// ============================================================
//  CONFIGURATION IA & SUPERPROMPT
// ============================================================

const CONFIG = {
    maxCredits: 20,
    maxFileSizeMB: 10,
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
- Si le sujet exige une explication architecturale détaillée, un script multi-scènes ou une analyse profonde de UI/UX, déploie ta pensée entièrement.
- Ne répète jamais la question. Fournis de la valeur immédiate.

CODE & GÉNÉRATION :
- Propose le code le plus propre et modulable possible. 
- Si une modification nécessite de revoir l'architecture globale d'un fichier pour qu'il soit plus performant, génère le fichier entier avec les explications nécessaires.
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
- Si l'utilisateur demande du storytelling ou du contenu de marque, sois immersif. Propose des descriptions audio précises (voix, sound design), des angles de caméra, et des dialogues percutants qui sonnent juste.

HONNÊTETÉ SUR LES LIMITES :
- Si tu n'es pas certain d'une méthode, dis-le et propose l'alternative la plus sûre. Ne suppose jamais. Demande des clarifications si le contexte technique manque.

━━━ VÉRITÉ ET PRÉCISION ━━━
- Les faits historiques, les biographies et les données géographiques ne supportent aucune approximation.
- Si tu as un doute sur un rôle (ex: organisateur vs lauréat), vérifie tes connaissances internes ou précise ton incertitude.
- Ne confonds jamais une icône culturelle avec une institution.

━━━ CE QUE TU N'ES PAS ━━━
Tu n'es pas ChatGPT. Tu n'es pas un assistant lisse. Tu es PENSÉE — une IA avec une identité, une exigence absolue de qualité, et un créateur : Yao Baba Ange Emmanuel.`
};

// ============================================================
//  CRÉDITS — Supabase
// ============================================================

async function loadCreditsFromDB() {
    if (!currentUser) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
        .from('credits')
        .select('credits_used')
        .eq('user_id', currentUser.id)
        .eq('date', today)
        .single();

    const used = data?.credits_used ?? 0;
    creditsLeft = CONFIG.maxCredits - used;
    updateCredits();
}

// ============================================================
//  HISTORIQUE — Supabase
// ============================================================

async function loadHistoryFromDB() {
    if (!currentUser) return;
    const { data } = await supabase
        .from('conversations')
        .select('role, content')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true })
        .limit(20);

    if (data && data.length > 0) {
        data.forEach(msg => {
            const role = msg.role === 'assistant' ? 'assistant' : 'user';
            history.push({ role, content: msg.content });
            addMessage(
                role === 'assistant' ? 'bot' : 'user',
                role === 'assistant' ? formatResponse(msg.content) : msg.content,
                role === 'assistant'
            );
        });
    }
}

// ============================================================
//  ÉTAT & ÉLÉMENTS HTML
// ============================================================
let creditsLeft = 0;
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
//  CRÉDITS UI
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

function readFileAsData(file) {
    return new Promise(function(resolve, reject) {
        if (file.size > CONFIG.maxFileSizeMB * 1024 * 1024) {
            reject("Le fichier " + file.name + " dépasse " + CONFIG.maxFileSizeMB + "MB.");
            return;
        }
        const reader = new FileReader();
        const ext = file.name.split(".").pop().toLowerCase();
        const isBinary = ['pdf', 'docx', 'doc', 'mp3', 'm4a', 'wav', 'ogg'].includes(ext);

        reader.onload = function(e) {
            if (isBinary) {
                const base64Data = e.target.result.split(',')[1];
                resolve({ type: 'binary', mimeType: file.type, data: base64Data });
            } else {
                resolve({ type: 'text', data: e.target.result });
            }
        };

        reader.onerror = function() { reject("Impossible de lire " + file.name); };

        if (isBinary) reader.readAsDataURL(file);
        else reader.readAsText(file);
    });
}

async function addFiles(fileList) {
    for (const file of fileList) {
        if (attachedFiles.find(function(f) { return f.name === file.name; })) continue;
        try {
            const content = await readFileAsData(file);
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
            if (file.content?.type === 'text') {
                fullPrompt += "DOCUMENT : " + file.name + "\n";
                fullPrompt += "CONTENU :\n" + file.content.data + "\n---\n\n";
            } else {
                fullPrompt += "DOCUMENT BINAIRE : " + file.name + " (traité nativement)\n---\n\n";
            }
        });

        history.forEach(function(msg) {
            fullPrompt += (msg.role === "user" ? "### Utilisateur:\n" : "### Pensée:\n") + msg.content + "\n\n";
        });
    }

    fullPrompt += "### ACTION REQUISE :\n" + userMessage + "\n\n### RÉPONSE DÉTAILLÉE :\n";

    // Préparer les fichiers binaires pour l'envoi
    const binaryFiles = files
        .filter(f => f.content?.type === 'binary')
        .map(f => ({ name: f.name, mime: f.content.mimeType, base64: f.content.data }));

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: fullPrompt,
                files: binaryFiles.length > 0 ? binaryFiles : undefined,
                userId: currentUser?.id
            })
        });

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
            } else if (errLow.includes("429") || errLow.includes("rate") || errLow.includes("quota") || errLow.includes("épuisés")) {
                addMessage("bot", "🚦 " + errStr, false);
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
        if (history.length > 40) history.splice(0, 2);

        creditsLeft--;
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
