import fs from 'fs';

// read .env.local manually
const envLocal = fs.readFileSync('.env.local', 'utf8');
envLocal.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const parts = line.split('=');
    process.env[parts[0]] = parts.slice(1).join('=');
  }
});

// Since the project might not be using pure TS without compilation (vitest handles it), I might have to compile first, but let's just see what happens if I try to use ts-node.
// Wait, the project doesn't have ts-node, but it has typescript.
