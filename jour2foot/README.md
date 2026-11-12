# jour2foot

Application React indépendante pour consulter le calendrier mondial de football du jour, toutes compétitions confondues.

## Démarrer l'application

```bash
npm install
npm run dev
```

Jour2Foot utilise le port `5180` pour ne pas ouvrir l'ancien simulateur Odds qui utilise le port `5173`. Ouvre `http://localhost:5180`.

## Charger le calendrier

Ajoute ta clé RapidAPI dans le fichier `.env` :

```env
RAPIDAPI_KEY=ta_nouvelle_cle_rapidapi
```

Au premier chargement du jour, l'application récupère le calendrier mondial FootAPI (dont les compétitions nationales et internationales) si le JSON du jour n'existe pas encore. Les matchs sont enregistrés dans `data/matches.json` et une copie datée dans `data/footapi-matches-AAAA-MM-JJ.json`. Tu peux aussi lancer `npm run footapi:today` manuellement.
