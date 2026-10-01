// Erreur HTTP métier : levée par les services, transformée en réponse par middlewares/error.js.
export class HttpError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export const notFound = (what = 'Ressource') => new HttpError(404, 'not_found', `${what} introuvable.`);
export const conflict = (message) => new HttpError(409, 'conflict', message);
