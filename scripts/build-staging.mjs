import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stagingConfig, workerConfig } from './staging-config.mjs';

const source = await readFile('supabase/config.toml', 'utf8');
const productionRef = source.match(/^project_id\s*=\s*"([a-z]+)"/m)?.[1];
if (!productionRef) throw new Error('Cannot determine production project; refusing staging build');
const config = stagingConfig(process.env, productionRef);
const env = { ...process.env };
// Only public, isolated database configuration is required for a frontend build.
for (const key of Object.keys(env)) {
  if (/^(VITE_SUPABASE_|SUPABASE_|INSTAGRAM_)/.test(key)) delete env[key];
}
Object.assign(env, {
  VITE_SUPABASE_URL: config.supabaseUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: config.publicKey,
  SUPABASE_URL: config.supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: config.publicKey,
  SUPABASE_PROJECT_ID: config.projectRef,
});
// Drop only reproducible artifacts so prior production bundles cannot survive.
await rm('.output', { recursive: true, force: true });
await rm('dist', { recursive: true, force: true });
const build = spawnSync('npm', ['run', 'build'], { env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
let isolatedReferenceFound = false;
async function verify(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await verify(file);
    else if (/\.(js|mjs|json|map|html)$/.test(file)) {
      const text = await readFile(file, 'utf8');
      if (text.includes(productionRef)) throw new Error('Production database reference in staging artifact');
      if (text.includes(config.projectRef)) isolatedReferenceFound = true;
    }
  }
}
await verify('dist/client');
if (!isolatedReferenceFound) throw new Error('Staging database reference missing from frontend');
const base = JSON.parse(await readFile('dist/server/wrangler.json', 'utf8'));
await writeFile('dist/server/wrangler.staging.json', JSON.stringify(workerConfig(base, config), null, 2) + '\n');
console.log('PASS: isolated staging artifact prepared; OAuth disabled; nothing deployed.');
