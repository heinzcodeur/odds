# jour2foot

Application React indépendante pour consulter le calendrier mondial de football du jour, toutes compétitions confondues.

## Démarrer l'application

```bash
npm install
npm run dev
```

Jour2Foot utilise le port `5180` pour ne pas ouvrir l'ancien simulateur Odds qui utilise le port `5173`. Ouvre `http://localhost:5180`.

## Charger le calendrier

Par défaut, Jour2Foot lit le tableau public de football d’ESPN, sans clé. Deux pages datées couvrent les matchs de minuit à minuit à Paris. Le calendrier correspond aux compétitions publiées par ESPN. Le sélecteur de matchs d’Odds utilise le même chargement.

Le calendrier est mis en cache pour la journée. En local, le serveur écrit les matchs dans `data/matches.json` et dans `data/footapi-matches-AAAA-MM-JJ.json`. L’interface filtre ensuite par équipe ou compétition. La commande `npm run footapi:today` permet aussi de charger le calendrier.

Pour changer de fournisseur, définis dans `.env` :

- `JOUR2FOOT_PROVIDER=api-football` avec `API_FOOTBALL_KEY` pour appeler `/fixtures` une seule fois avec la date et le fuseau Europe/Paris.
- `JOUR2FOOT_PROVIDER=footapi7` avec `RAPIDAPI_KEY` et `FOOTAPI_ENABLED=true` pour charger le calendrier par compétition. Le plafond `FOOTAPI_MAX_CALLS` vaut 10 par défaut.
