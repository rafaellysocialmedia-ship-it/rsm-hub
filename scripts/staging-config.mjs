// Pure configuration validation. Never accepts production identifiers or server secrets.
export const STAGING_WORKER = 'rsm-hub-instagram-staging';
export function stagingConfig(env, productionRef) {
  const required = name => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const accountId = required('RSM_STAGING_CF_ACCOUNT_ID');
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error('Invalid staging Cloudflare account ID');
  const db = new URL(required('RSM_STAGING_SUPABASE_URL'));
  const match = /^([a-z]{20})\.supabase\.co$/.exec(db.hostname);
  if (db.protocol !== 'https:' || !match || db.username || db.password || db.search || db.hash || db.pathname !== '/')
    throw new Error('Invalid isolated Supabase project URL');
  if (match[1] === productionRef) throw new Error('Refusing production Supabase project');
  const publicKey = required('RSM_STAGING_SUPABASE_PUBLISHABLE_KEY');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey)) throw new Error('Use a staging publishable key, never a secret/service-role key');
  const site = new URL(required('RSM_STAGING_ORIGIN'));
  if (site.protocol !== 'https:' || !new RegExp(`^${STAGING_WORKER}\\.[a-z0-9-]+\\.workers\\.dev$`).test(site.hostname)
      || site.username || site.password || site.search || site.hash || site.pathname !== '/')
    throw new Error('Expected a dedicated staging Worker origin on workers.dev');
  return { accountId, projectRef: match[1], supabaseUrl: db.origin, publicKey, origin: site.origin };
}
export function workerConfig(base, config) {
  // Explicit allowlist: do not inherit production routes, databases, cron or service bindings.
  return {
    name: STAGING_WORKER, account_id: config.accountId, main: 'index.js',
    compatibility_date: base.compatibility_date,
    compatibility_flags: base.compatibility_flags,
    no_bundle: true, rules: base.rules,
    assets: { binding: 'ASSETS', directory: '../client' },
    workers_dev: true, preview_urls: false, routes: [], keep_vars: true,
    observability: { enabled: false },
    vars: {
      RSM_ENVIRONMENT: 'staging', SUPABASE_URL: config.supabaseUrl,
      SUPABASE_PUBLISHABLE_KEY: config.publicKey,
      INSTAGRAM_REDIRECT_URI: `${config.origin}/api/integrations/instagram/callback`,
      INSTAGRAM_OAUTH_ENABLED: 'false',
    },
  };
}
