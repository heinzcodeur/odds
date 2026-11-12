# OddsBoost Pro Engine

Simulateur de cotes et de cashout en React. L'interface est découpée en composants dans `src/components`, le minuteur dans `src/hooks` et les calculs dans `src/utils`.

## Démarrer

Prérequis : Node.js 18 ou supérieur et une base MySQL 8.0.17+ contenant les données OddsBoost.
Si nécessaire, importez d’abord les données en suivant la section « Export vers MySQL ».

Copiez `.env.example` vers `.env` et renseignez le compte MySQL utilisé par le simulateur.
Par défaut, la connexion utilise la base `odds` via le socket local `/tmp/mysql.sock`.
Pour une connexion TCP, renseignez `MYSQL_HOST=127.0.0.1` et, si nécessaire, `MYSQL_PORT`.
Le compte doit disposer des droits SELECT, INSERT, UPDATE et DELETE sur la base OddsBoost.

```bash
npm install
npm run dev
```

Ouvrir l'adresse locale affichée par Vite. Pour une version de production : `npm run build`, puis `npm start`.

## Données sauvegardées

Le serveur conserve les noms d’équipes, les paramètres du match, le capital, les positions ouvertes et l’historique dans MySQL. Les modifications sont enregistrées automatiquement après le chargement de la base.

Le fichier HTML d'origine reste disponible à côté du projet comme référence.

## Import quotidien FootAPI

Le script `footapi-daily.js` récupère les matchs de sept pays (Angleterre, France, Allemagne, Italie, Pays-Bas, Espagne et Portugal), puis écrit le JSON complet dans `data/footapi-matches-AAAA-MM-JJ.json`. Les identifiants de catégories sont découverts une fois et mis en cache dans `data/footapi-category-ids.json`.

```bash
RAPIDAPI_KEY="ta_cle_rapidapi" npm run footapi:today
```

Une première exécution fait un appel pour découvrir les catégories, puis sept appels calendrier. Les exécutions suivantes font sept appels calendrier.

## Export vers MySQL

Depuis la racine du simulateur, Python 3 peut générer un fichier SQL à
partir de `data/odds.sqlite` (schéma SQLite version 7). L’export ouvre
SQLite en lecture seule. Utilisez un nom de fichier de sortie libre.

```bash
python3 migrations/export-mysql.py odds-mysql.sql
mysql -h HOTE -u UTILISATEUR -p BASE_VIDE < odds-mysql.sql
```

L’import nécessite une base vide sous MySQL 8.0.17 ou supérieur. Il crée
les tables puis charge les données dans une transaction. Les cotes sont
stockées dans `match_markets`, une ligne par marché et par match.
Un marché présent uniquement dans l’historique a un ordre d’affichage
et des cotes à `NULL`. Les libellés et résultats enregistrés restent
associés aux positions. L’export est indépendant du serveur HTTP.

### Catalogue des marchés

`markets` contient les définitions réutilisables. `match_markets` associe
chaque définition à un match et contient les cotes, l’ordre d’affichage
et, si nécessaire, un libellé propre au match. Modifier le libellé d’un
marché dans le simulateur ne modifie que celui du match affiché.

Pour mettre à niveau une base importée avant l’ajout du catalogue,
arrêtez le simulateur et appliquez une seule fois
`migrations/002-market-catalog.sql` à cette base.
Les nouveaux exports incluent déjà le catalogue.
# odds
