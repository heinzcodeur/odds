import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fetchAndSaveToday } from './footapi-daily.js';

function dailyMatchesApi() {
  return {
    name: 'daily-matches-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/api/matches/today') return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const payload = await fetchAndSaveToday();
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
