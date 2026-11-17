import { defineConfig } from 'vite';
import { resolve } from 'node:path';
// @ts-ignore plain JS module shared with the standalone server
import { attachRelay } from './server/relay-core.mjs';

export default defineConfig({
  base: './',
  build: { rollupOptions: { input: { host: resolve(__dirname, 'index.html'), play: resolve(__dirname, 'play.html'), visuals: resolve(__dirname, 'visuals.html') } } },
  plugins: [{
    name: 'party-relay',
    configureServer(server) {
      if (server.httpServer) attachRelay(server.httpServer);
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split('?')[0].endsWith('/relay-info')) {
          res.setHeader('content-type', 'application/json'); res.end('{"relay":true}');
        } else next();
      });
    },
  }],
});
