import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true } });
try {
  await server.ssrLoadModule('/api/submit-application.ts');
  console.log("Loaded successfully!");
} catch (e) {
  console.error("FAILED TO LOAD:");
  console.error(e);
}
await server.close();
