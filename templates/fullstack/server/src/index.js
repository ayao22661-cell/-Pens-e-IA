// Point d'entrée : ouvre la base, lance le serveur, arrêt propre.
import { config } from './config.js';
import { openDb } from './db/index.js';
import { createApp } from './app.js';

const db = openDb(config.dbFile);
const server = createApp({ db }).listen(config.port, config.host, () => {
    console.log(`API prête sur http://${config.host}:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
