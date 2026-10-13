import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stagingMigrationPlan, STAGING_PROJECT_REF } from '../scripts/staging-migration-plan.mjs';

test('migration plan refuses every project except confirmed staging', async () => {
  await assert.rejects(stagingMigrationPlan('zttgcamgixlkbkbdvrtb'), /Only/);
  await assert.rejects(stagingMigrationPlan('noatdwvbqesjbratduqv'), /Only/);
  await assert.rejects(stagingMigrationPlan(''), /Only/);
});
test('fresh staging plan restores dependencies before churn and includes OAuth in order', async () => {
  const plan = await stagingMigrationPlan(STAGING_PROJECT_REF);
  const bootstrap = plan.findIndex(p => p.name === 'staging_finance_bootstrap_dependencies');
  assert.ok(plan[bootstrap + 1].name.startsWith('source_20261003205105_'));
  assert.ok(plan.findIndex(p => p.name.includes('20261013000100')) < plan.findIndex(p => p.name.includes('20261013042803')));
  assert.equal(new Set(plan.map(p => p.name)).size, plan.length);
  for (const migration of plan.filter(p => /cron\.schedule/i.test(p.query)))
    assert.ok(migration.query.endsWith('SELECT cron.alter_job(jobid, active := false) FROM cron.job;'));
});
