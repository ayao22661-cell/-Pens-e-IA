// Gestionnaire d'erreurs central : format unique { error: { code, message, details } },
// jamais de stack trace envoyée au client.
import { HttpError } from '../lib/errors.js';

export function notFoundHandler(req, _res, next) {
    next(new HttpError(404, 'route_not_found', `Route introuvable : ${req.method} ${req.path}`));
}

export function errorHandler(err, req, res, _next) {
    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({ error: { code: 'invalid_json', message: 'Corps JSON invalide.' } });
    }
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    req.log?.error({ err }, 'Erreur non gérée');
    res.status(500).json({ error: { code: 'internal_error', message: 'Erreur interne du serveur.' } });
}
