// ============================================================
//  PENSÉE IA — src/ui/dom.js
//  Références DOM et primitives d'affichage des messages.
// ============================================================

import { ICONS } from './icons.js';
import { dotMark } from './brand.js';

const $ = (id) => document.getElementById(id);

export const els = {
    messages:      $('messages'),
    userInput:     $('userInput'),
    sendBtn:       $('sendBtn'),
    statusBadge:   $('statusBadge'),
    alertBanner:   $('alertBanner'),
    fileInput:     $('fileInput'),
    uploadBtn:     $('uploadBtn'),
    uploadPreview: $('uploadPreview'),
    dropOverlay:   $('dropOverlay'),
};

export function escapeHtml(t) {
    return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Défile en bas sauf si l'utilisateur est remonté lire plus haut. */
export function scrollToBottom(force = false) {
    const m = els.messages;
    if (force || m.scrollHeight - m.scrollTop - m.clientHeight < 160) m.scrollTop = m.scrollHeight;
}

function messageShell(role, labelText) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg ' + role;
    const label = document.createElement('span');
    label.className = 'msg-label';
    if (role === 'user') label.textContent = labelText ?? 'Toi';
    else label.innerHTML = `<span class="pz-avatar">${dotMark({ size: 20 })}</span><span class="pz-name"></span>`;
    if (role !== 'user') label.querySelector('.pz-name').textContent = labelText ?? 'Pensée';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    msgDiv.append(label, bubble);
    return { msgDiv, label, bubble };
}

export function addMessage(role, content, isHtml = false, labelText) {
    const { msgDiv, bubble } = messageShell(role, labelText);
    if (isHtml) bubble.innerHTML = content;
    else bubble.textContent = content;
    els.messages.appendChild(msgDiv);
    scrollToBottom(true);
    return { msgDiv, bubble };
}

export function createBotMessage(labelText = 'Pensée') {
    const shell = messageShell('bot', labelText);
    els.messages.appendChild(shell.msgDiv);
    scrollToBottom(true);
    return shell;
}

export function fileChipHtml(url, label, { download = false, expires = false } = {}) {
    const target = download ? `download="${escapeHtml(label)}"` : 'target="_blank" rel="noopener"';
    return `<a href="${escapeHtml(url)}" ${target} class="file-chip pz-file-chip">${ICONS.file} ${escapeHtml(label)} ${ICONS.download}</a>`
        + (expires ? '<div class="pz-file-note">Disponible pendant 30 jours</div>' : '');
}

export function addUserMessageWithFiles(text, files) {
    const { msgDiv, bubble } = messageShell('user');
    for (const file of files) {
        const chip = document.createElement('a');
        chip.className = 'file-chip';
        chip.download = file.name;
        chip.title = 'Télécharger ' + file.name;
        chip.target = '_blank';
        chip.style.textDecoration = 'none';
        chip.href = URL.createObjectURL(file.blob);
        chip.innerHTML = `${ICONS.file} ${escapeHtml(file.name)} <span style="opacity:0.6">(${escapeHtml(file.lang)})</span> ${ICONS.download}`;
        bubble.appendChild(chip);
    }
    if (text) {
        const p = document.createElement('div');
        p.textContent = text;
        p.style.marginTop = files.length ? '8px' : '0';
        bubble.appendChild(p);
    }
    els.messages.appendChild(msgDiv);
    scrollToBottom(true);
}

export function showTyping() {
    removeTyping();
    const { msgDiv, bubble } = messageShell('bot');
    msgDiv.id = 'typing-indicator';
    msgDiv.classList.add('is-thinking');
    bubble.className = 'pz-pending';
    bubble.textContent = 'Pensée réfléchit…';
    els.messages.appendChild(msgDiv);
    scrollToBottom(true);
}

export function removeTyping() {
    document.getElementById('typing-indicator')?.remove();
}

export function setStatus(kind) {
    const badge = els.statusBadge;
    if (!badge) return;
    const map = { ok: ['ok', '● connecté'], err: ['err', '● erreur'], warn: ['warn', '● crédits bas'] };
    if (!map[kind]) return;
    badge.className = map[kind][0];
    badge.textContent = map[kind][1];
}

export function highlightIn(root) {
    if (typeof hljs === 'undefined') return;
    root.querySelectorAll('pre code:not(.hljs)').forEach(block => hljs.highlightElement(block));
}
