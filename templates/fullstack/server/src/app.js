// Construction de l'application Express (exportée pour les tests : aucun listen ici).
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { createItemsService } from './services/items.js';
import { itemsRouter } from './routes/items.js';
import { notFoundHandler, errorHandler } from './middlewares/error.js';

export function createApp({ db, logger = config.env !== 'test' }) {
    const app = express();
    app.disable('x-powered-by');
    app.use(helmet());
    app.use(cors({ origin: config.corsOrigin }));
    app.use(express.json({ limit: '100kb' }));
    if (logger) app.use(pinoHttp({ autoLogging: { ignore: (req) => req.url === '/api/health' } }));

    app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
    app.use('/api/items', itemsRouter(createItemsService(db)));

    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}
