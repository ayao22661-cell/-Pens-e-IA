// Tests d'intégration de l'API (base SQLite en mémoire, aucune dépendance externe).
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db/index.js';
import { createApp } from '../src/app.js';

let app;
beforeEach(() => {
    app = createApp({ db: openDb(':memory:'), logger: false });
});

const create = (body) => request(app).post('/api/items').send(body);

describe('API items', () => {
    it('répond sur /api/health', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('crée un élément (201) avec valeurs par défaut', async () => {
        const res = await create({ name: 'Licence', category: 'Logiciel' });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ id: 1, name: 'Licence', status: 'actif', amount: 0 });
    });

    it('refuse une entrée invalide (400) avec le détail des champs', async () => {
        const res = await create({ name: '', category: 'X', amount: -5 });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('validation_error');
        expect(res.body.error.details.map(d => d.field)).toEqual(expect.arrayContaining(['name', 'amount']));
    });

    it('refuse un doublon nom + catégorie (409)', async () => {
        await create({ name: 'A', category: 'B' });
        const res = await create({ name: 'A', category: 'B' });
        expect(res.status).toBe(409);
    });

    it('liste avec recherche, filtre, tri et pagination', async () => {
        for (const [name, amount, status] of [['Alpha', 10, 'actif'], ['Beta', 30, 'archive'], ['Gamma', 20, 'actif']]) {
            await create({ name, category: 'Test', amount, status });
        }
        const res = await request(app).get('/api/items?status=actif&sort=amount&order=desc&limit=1');
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(2);
        expect(res.body.pages).toBe(2);
        expect(res.body.data[0].name).toBe('Gamma');

        const search = await request(app).get('/api/items?q=bet');
        expect(search.body.data.map(i => i.name)).toEqual(['Beta']);
    });

    it('met à jour partiellement et renvoie 404 sur un id inconnu', async () => {
        await create({ name: 'A', category: 'B', amount: 5 });
        const ok = await request(app).patch('/api/items/1').send({ amount: 99 });
        expect(ok.status).toBe(200);
        expect(ok.body).toMatchObject({ name: 'A', amount: 99 });
        expect((await request(app).patch('/api/items/42').send({ amount: 1 })).status).toBe(404);
    });

    it('supprime (204) puis renvoie 404', async () => {
        await create({ name: 'A', category: 'B' });
        expect((await request(app).delete('/api/items/1')).status).toBe(204);
        expect((await request(app).get('/api/items/1')).status).toBe(404);
    });

    it('calcule les statistiques', async () => {
        await create({ name: 'A', category: 'X', amount: 100 });
        await create({ name: 'B', category: 'Y', amount: 50, status: 'archive' });
        const res = await request(app).get('/api/items/stats');
        expect(res.body).toMatchObject({ count: 2, amount: 150, byStatus: { actif: 1, archive: 1 }, categories: ['X', 'Y'] });
    });

    it('renvoie un JSON d\'erreur sur route inconnue et JSON invalide', async () => {
        expect((await request(app).get('/api/nope')).status).toBe(404);
        const bad = await request(app).post('/api/items').set('Content-Type', 'application/json').send('{oops');
        expect(bad.status).toBe(400);
        expect(bad.body.error.code).toBe('invalid_json');
    });
});
