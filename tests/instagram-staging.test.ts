import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stagingConfig, workerConfig } from '../scripts/staging-config.mjs';
const production = 'zttgcamgixlkbkbdvrtb';
const fixture = {
  RSM_STAGING_CF_ACCOUNT_ID: 'a'.repeat(32),
  RSM_STAGING_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  RSM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  RSM_STAGING_ORIGIN: 'https://rsm-hub-instagram-staging.fixture.workers.dev',
};
test('staging config accepts only isolated project and dedicated Worker', () => {
  const config = stagingConfig(fixture, production);
  assert.equal(config.projectRef, 'abcdefghijklmnopqrst');
  const output = workerConfig({compatibility_date:'2026-10-10',compatibility_flags:['nodejs_compat'],rules:[],routes:['production.example/*'],d1_databases:[{}],triggers:{crons:['* * * * *']}},config);
  assert.equal(output.name,'rsm-hub-instagram-staging');
  assert.deepEqual(output.routes,[]);
  assert.equal(Object.hasOwn(output.vars,'INSTAGRAM_OAUTH_ENABLED'),false);
  assert.equal(output.keep_vars,true);
  assert.equal(output.d1_databases,undefined);
  assert.deepEqual(output.triggers,{crons:['* * * * *']});
  assert.equal(Object.hasOwn(output.vars,'RSM_PUBLISH_ENABLED'),false);
  assert.equal(Object.hasOwn(output.vars,'RSM_PRIMARY_PUBLISH_ENABLED'),false);
  assert.equal(output.vars.SUPABASE_SERVICE_ROLE_KEY,undefined);
});
for (const [name, value] of [
  ['RSM_STAGING_SUPABASE_URL',`https://${production}.supabase.co`],
  ['RSM_STAGING_SUPABASE_URL','https://abcdefghijklmnopqrst.supabase.co.attacker.example'],
  ['RSM_STAGING_SUPABASE_PUBLISHABLE_KEY','sb_secret_forbidden'],
  ['RSM_STAGING_ORIGIN','https://app.rsmmarketing.com.br'],
  ['RSM_STAGING_ORIGIN','https://production.fixture.workers.dev'],
  ['RSM_STAGING_ORIGIN','http://rsm-hub-instagram-staging.fixture.workers.dev'],
  ['RSM_STAGING_CF_ACCOUNT_ID',''],
]) test(`staging rejects unsafe ${name}: ${value.includes('secret')?'secret key':value}`, () => {
  assert.throws(()=>stagingConfig({...fixture,[name]:value},production));
});
