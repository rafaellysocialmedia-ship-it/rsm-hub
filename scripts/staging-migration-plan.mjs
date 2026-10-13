import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const STAGING_PROJECT_REF = 'dtladsjhmnzdxcmgivne';
export async function stagingMigrationPlan(projectRef) {
  if (projectRef !== STAGING_PROJECT_REF) throw new Error('Only the confirmed RSM Homologação project is allowed');
  const root = new URL('../supabase/', import.meta.url);
  const files = (await readdir(new URL('migrations/', root))).filter(f => f.endsWith('.sql')).sort();
  const plan = [];
  for (const file of files) {
    if (file.startsWith('20261003205105_')) {
      plan.push({ name: 'staging_finance_bootstrap_dependencies', source: 'staging/20261013122217_restore_finance_bootstrap_dependencies.sql',
        query: await readFile(new URL('staging/20261013122217_restore_finance_bootstrap_dependencies.sql', root), 'utf8') });
    }
    let query = await readFile(new URL(`migrations/${file}`, root), 'utf8');
    if (/cron\.schedule/i.test(query)) query += '\n-- Staging only: disable scheduled jobs in the same transaction.\nSELECT cron.alter_job(jobid, active := false) FROM cron.job;';
    plan.push({ name: `source_${file.replace('.sql', '').replaceAll('-', '_')}`, source: `migrations/${file}`, query });
  }
  plan.push({ name: 'staging_lock_event_trigger_entrypoint', source: 'staging-only hardening',
    query: 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated;' });
  return plan;
}

// Read-only manifest. It does not connect to or modify any database.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plan = await stagingMigrationPlan(process.argv[2]);
  console.log(JSON.stringify(plan.map(({ name, source, query }) => ({ name, source,
    sha256: createHash('sha256').update(query).digest('hex') })), null, 2));
}
