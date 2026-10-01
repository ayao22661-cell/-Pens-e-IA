// Client HTTP de l'API : toutes les requêtes du front passent par ici.
export class ApiError extends Error {
    constructor(status, payload) {
        super(payload?.error?.message || `Erreur ${status}`);
        this.status = status;
        this.code = payload?.error?.code;
        this.details = payload?.error?.details || [];
    }
}

async function request(path, { method = 'GET', body } = {}) {
    const res = await fetch(`/api${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
}

export const api = {
    listItems: (params) => request(`/items?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))}`),
    stats: () => request('/items/stats'),
    createItem: (body) => request('/items', { method: 'POST', body }),
    updateItem: (id, body) => request(`/items/${id}`, { method: 'PATCH', body }),
    deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),
};

export const formatAmount = (n) => `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
export const formatDate = (iso) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
