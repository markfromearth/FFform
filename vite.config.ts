import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import * as path from 'path';

function vercelApiPlugin(): Plugin {
  return {
    name: 'vercel-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }
        
        try {
          const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
          const routeName = parsedUrl.pathname.replace('/api/', '').split('?')[0];
          
          // Construct req.query like Vercel does
          (req as any).query = Object.fromEntries(parsedUrl.searchParams);
          
          // We need to buffer the body for Vercel functions as they expect req.body or similar, 
          // or they might use get-raw-body or read the stream.
          // Vercel Next.js api routes expect req.body to be parsed if it's JSON.
          // Let's parse JSON body.
          if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
            const buffers: any[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const bodyData = Buffer.concat(buffers).toString();
            try {
              (req as any).body = JSON.parse(bodyData);
            } catch (e) {
              (req as any).body = bodyData;
            }
          }

          // Mock Vercel response helpers
          (res as any).status = function (statusCode: number) {
            res.statusCode = statusCode;
            return res;
          };
          (res as any).json = function (obj: any) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
          };
          (res as any).send = function (data: any) {
            res.end(data);
          };

          const filePath = `/api/${routeName}.ts`;
          const { default: handler } = await server.ssrLoadModule(filePath);
          
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
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'docs/**', '.vercel_build_output/**', '.vercel/**']
  },
} as any);
