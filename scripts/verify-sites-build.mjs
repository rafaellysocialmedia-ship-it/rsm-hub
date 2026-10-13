import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const directory = resolve('dist/server');
const config = JSON.parse(await readFile(join(directory, 'wrangler.json'), 'utf8'));
await access(resolve(directory, config.main));
await access(resolve(directory, config.assets.directory));
assert.ok(config.compatibility_flags.includes('nodejs_compat'));
assert.ok(config.compatibility_date >= '2025-04-01');
const forbidden = ['INSTAGRAM_APP_SECRET', 'INSTAGRAM_TOKEN_ENCRYPTION_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'exchangeInstagramCode'];
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) await scan(target);
    else if (/\.(js|mjs|map)$/.test(entry.name)) {
      const source = await readFile(target, 'utf8');
      for (const marker of forbidden) assert.ok(!source.includes(marker), `Server-only code leaked into ${entry.name}`);
    }
  }
}
await scan(resolve('dist/client'));
console.log('PASS: Worker entrypoint, assets, Node compatibility, server-only bundle isolation');
