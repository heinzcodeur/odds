import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiMiddleware } from './database.js';

export default defineConfig({
  plugins: [react(), {
    name: 'odds-mysql-api',
    configureServer(server) { server.middlewares.use(createApiMiddleware()); },
    configurePreviewServer(server) { server.middlewares.use(createApiMiddleware()); },
  }],
});
