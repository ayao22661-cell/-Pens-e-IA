// Données de démonstration réalistes (idempotent : n'insère que si la table est vide).
import { config } from '../config.js';
import { openDb } from './index.js';

const db = openDb(config.dbFile);
const { n } = db.prepare('SELECT COUNT(*) AS n FROM items').get();

if (n > 0) {
    console.log(`Base déjà remplie (${n} éléments) : rien à faire.`);
} else {
    const rows = [
        ['Abonnement fibre Plateau', 'Télécom', 'actif', 45000],
        ['Location bureau Cocody', 'Immobilier', 'actif', 850000],
        ['Maintenance climatisation', 'Services', 'en_attente', 120000],
        ['Licence logiciel comptable', 'Logiciel', 'actif', 210000],
        ['Flotte téléphones Orange', 'Télécom', 'actif', 380000],
        ['Assurance véhicules', 'Assurance', 'en_attente', 640000],
        ['Fournitures de bureau T3', 'Fournitures', 'archive', 95000],
        ['Hébergement serveurs', 'Logiciel', 'actif', 175000],
        ['Nettoyage locaux Marcory', 'Services', 'actif', 150000],
        ['Formation équipe commerciale', 'Formation', 'en_attente', 450000],
        ['Campagne radio Nostalgie', 'Marketing', 'archive', 300000],
        ['Groupe électrogène Yopougon', 'Équipement', 'actif', 1250000],
    ];
    const insert = db.prepare('INSERT INTO items (name, category, status, amount) VALUES (?, ?, ?, ?)');
    db.transaction(() => rows.forEach(r => insert.run(...r)))();
    console.log(`${rows.length} éléments insérés.`);
}
db.close();
