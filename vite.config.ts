import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import * as url from 'url';
import * as path from 'path';
import fs from 'fs';

// Simple Vite plugin to serve the Vercel functions in local dev
function vercelApiPlugin(): Plugin {
  return {
    name: 'vercel-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/companies-house', async (req, res, next) => {
        try {
          const handlerPath = path.resolve(__dirname, './api/companies-house.ts');
          // For a quick local mock without complex TS compilation, we can just read the file or 
          // use a dynamic import if it's compiled, but `vite-node` or `ts-node` is better.
          // Since it's a dev server, we can use Vite's ssrLoadModule!
          const { default: handler } = await server.ssrLoadModule('/api/companies-house.ts');
          
          // Construct req.query
          const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
          (req as any).query = Object.fromEntries(parsedUrl.searchParams);
          
          await handler(req, res);
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), vercelApiPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
} as any);
