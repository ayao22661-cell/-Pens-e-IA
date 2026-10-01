// Valide req.body / req.query / req.params avec un schéma zod et remplace la valeur par la version nettoyée.
import { HttpError } from '../lib/errors.js';

export const validate = (schemas) => (req, _res, next) => {
    for (const [key, schema] of Object.entries(schemas)) {
        const result = schema.safeParse(req[key] ?? {});
        if (!result.success) {
            const details = result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
            return next(new HttpError(400, 'validation_error', 'Données invalides.', details));
        }
        // req.query est en lecture seule dans Express 5 : on range la version validée à part
        if (key === 'query') req.validQuery = result.data;
        else req[key] = result.data;
    }
    next();
};
