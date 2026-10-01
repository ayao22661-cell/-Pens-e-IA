// Routes HTTP des "items" : validation zod → service → réponse. Aucune requête SQL ici.
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';

const STATUSES = ['actif', 'en_attente', 'archive'];

const itemInput = z.object({
    name: z.string({ error: 'Nom requis' }).trim().min(1, 'Nom requis').max(120, '120 caractères maximum'),
    category: z.string({ error: 'Catégorie requise' }).trim().min(1, 'Catégorie requise').max(60, '60 caractères maximum'),
    status: z.enum(STATUSES).default('actif'),
    amount: z.coerce.number().int('Montant entier attendu').min(0, 'Montant positif attendu').default(0),
});

const listQuery = z.object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(STATUSES).optional(),
    category: z.string().trim().max(60).optional(),
    sort: z.enum(['name', 'amount', 'created_at', 'status', 'category']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const idParam = z.object({ id: z.coerce.number().int().positive('Identifiant invalide') });

export function itemsRouter(service) {
    const router = Router();

    router.get('/', validate({ query: listQuery }), (req, res) => res.json(service.list(req.validQuery)));
    router.get('/stats', (_req, res) => res.json(service.stats()));
    router.get('/:id', validate({ params: idParam }), (req, res) => res.json(service.get(req.params.id)));
    router.post('/', validate({ body: itemInput }), (req, res) => res.status(201).json(service.create(req.body)));
    router.patch('/:id', validate({ params: idParam, body: itemInput.partial() }), (req, res) =>
        res.json(service.update(req.params.id, req.body)));
    router.delete('/:id', validate({ params: idParam }), (req, res) => {
        service.remove(req.params.id);
        res.status(204).end();
    });

    return router;
}
