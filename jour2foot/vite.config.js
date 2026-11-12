import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchAndSaveToday } from './footapi-daily.js';

const matchesPath = join(process.cwd(), 'data', 'matches.json');
let refreshInFlight;

function parisDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dailyMatchesApi() {
  return {
    name: 'daily-matches-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/api/matches/today') return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const today = parisDate();
          let payload;
          try {
            payload = JSON.parse(await readFile(matchesPath, 'utf8'));
          } catch { /* Le calendrier sera récupéré depuis FootAPI. */ }

          if (payload?.date !== today || !Array.isArray(payload.events)) {
            refreshInFlight ??= fetchAndSaveToday().finally(() => { refreshInFlight = undefined; });
            payload = await refreshInFlight;
          }

          response.statusCode = 200;
          response.end(JSON.stringify(payload));
        } catch (error) {
          server.config.logger.error(`Chargement des matchs du jour impossible : ${error.message}`);
          response.statusCode = 502;
          response.end(JSON.stringify({ error: 'Impossible de récupérer les matchs du jour.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), dailyMatchesApi()],
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
});
