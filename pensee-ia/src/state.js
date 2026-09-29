// ============================================================
//  PENSÉE IA — src/state.js
//  État partagé de l'application. Les propriétés lues par les
//  scripts classiques (ui-enrich.js, audio.js) sont reflétées sur window.
// ============================================================

import { CONFIG } from './config.js';

export const state = {
    currentUser: null,
    activeTabId: null,
    tabs: [],
    history: [],          // [{ role: 'user'|'assistant', content: string }]
    attachedFiles: [],
    creditsLeft: CONFIG.maxCredits,
    activeAgentId: null,  // null = auto-détection
    abortController: null,
    busy: false,
};

export function setCurrentUser(user) {
    state.currentUser = user;
    window.currentUser = user;
}

export function setActiveTabId(id) {
    state.activeTabId = id;
    window.activeTabId = id;
}

/** Identifiant du workspace /workspace : un par conversation. */
export function workspaceId() {
    return state.activeTabId || 'local';
}

Object.defineProperty(window, 'activeAgentId', {
    get: () => state.activeAgentId,
    set: (v) => { state.activeAgentId = v; },
    configurable: true,
});
