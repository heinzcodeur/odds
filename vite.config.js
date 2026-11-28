import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiMiddleware, startDailyFootballRefresh } from './database.js';

function configureOddsServer(server) {
  server.middlewares.use(createApiMiddleware());
  const stopRefresh = startDailyFootballRefresh();
  server.httpServer?.once('close', stopRefresh);
}

export default defineConfig({
  plugins: [react(), {
    name: 'odds-mysql-api',
    configureServer: configureOddsServer,
    configurePreviewServer: configureOddsServer,
  }],
});
