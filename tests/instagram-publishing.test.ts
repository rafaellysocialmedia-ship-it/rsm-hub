import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Instagram scheduling queue stays private, validates posts and prevents duplicates", async t => {
  const db = new PGlite();
  const client = "10000000-0000-4000-8000-000000000001";
  const post = "20000000-0000-4000-8000-000000000001";
  const connected = "30000000-0000-4000-8000-000000000001";
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.clients(id uuid primary key,status text,churned boolean default false);
    create type public.post_status as enum ('idea','review','approved','scheduled','published');
    create table public.posts(
      id uuid primary key,client_id uuid references clients(id),social_network text,
      social_networks text[] not null default '{}',status public.post_status not null,
      scheduled_date date,scheduled_time time,caption text,format text,
      content_revision integer not null default 1,updated_at timestamptz default now(),
      publication_source text,publication_confirmed_at timestamptz
    );
    create table public.post_files(
      id uuid primary key default gen_random_uuid(),post_id uuid references posts(id),
      storage_path text not null,mime_type text,sort_order integer default 0);
    create table public.post_approvals(post_id uuid references posts(id),
      decision text,reviewed_revision integer);
    create table public.instagram_connections(
      id uuid primary key,client_id uuid references clients(id),
      token_expires_at timestamptz,instagram_user_id text,encrypted_access_token text);
    insert into public.clients(id,status) values ('${client}','active');
    insert into public.instagram_connections(id,client_id,token_expires_at,instagram_user_id,encrypted_access_token)
      values ('${connected}','${client}',now()+interval '2 years','1234567890','fixture-encrypted');
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/20261014010000_instagram_publish_queue.sql",import.meta.url),"utf8"));
  const row = async () => (await db.query<{status:string;reason_code:string|null;attempts:number;content_revision:number}>(`select status,reason_code,attempts,content_revision from public.instagram_publish_jobs where post_id='${post}'`)).rows[0];
  await t.test("schedule without JPEG is blocked and not falsely published", async () => {
    await db.exec(`insert into public.posts(id,client_id,social_network,status,scheduled_date,scheduled_time,format,caption)
      values ('${post}','${client}','Instagram','scheduled','2027-11-20','11:00','Feed','Teste')`);
    assert.equal((await row()).status,"blocked");
    assert.equal((await row()).reason_code,"single_jpeg_required");
  });
  await t.test("single JPEG and one account creates a real queued job", async () => {
    await db.exec(`insert into public.post_files(post_id,storage_path,mime_type) values
      ('${post}','sample/image.jpg','image/jpeg');
      update public.posts set caption='Legenda válida' where id='${post}';`);
    assert.equal((await row()).status,"queued");
    assert.equal((await row()).reason_code,null);
  });
  await t.test("approval pending blocks post, approved revision resumes queue", async () => {
    await db.exec(`insert into public.post_approvals(post_id,decision,reviewed_revision) values ('${post}','pending',null);
      update public.posts set caption='Nova' where id='${post}';`);
    assert.equal((await row()).reason_code,"awaiting_approval");
    await db.exec(`update public.post_approvals set decision='approved',reviewed_revision=1;
      update public.posts set caption='Nova' where id='${post}';`);
    assert.equal((await row()).status,"queued");
  });
  await t.test("editorial change cancels queued job", async () => {
    await db.exec(`update public.posts set status='review' where id='${post}';`);
    assert.equal((await row()).status,"cancelled");
    await db.exec(`update public.posts set status='scheduled' where id='${post}';`);
    assert.equal((await row()).status,"queued");
  });
  await t.test("authenticated users cannot read/claim queue", async () => {
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from instagram_publish_jobs"),/permission denied/);
    await assert.rejects(db.query("select * from public.claim_due_instagram_publish_job()"),/permission denied/);
    await db.exec("reset role");
  });
  await t.test("transactional worker claim leases a due job once", async () => {
    await db.exec(`update instagram_publish_jobs set scheduled_for=now()-interval '5 seconds' where post_id='${post}';`);
    const first = await db.query<{job_id:string;phase:string}>(`select job_id,phase from public.claim_due_instagram_publish_job()`);
    assert.equal(first.rows.length,1);assert.equal(first.rows[0].phase,"create");
    const second = await db.query(`select job_id from public.claim_due_instagram_publish_job()`);
    assert.equal(second.rows.length,0);
    assert.equal((await row()).status,"processing");
    assert.equal((await row()).attempts,1);
    await assert.rejects(db.exec(`update public.posts set caption='Mutation while sending' where id='${post}';`),/sendo enviada/);
  });
  await t.test("stale publishing is uncertain, never duplicated", async () => {
    await db.exec(`update instagram_publish_jobs set status='publishing',lease_at=now()-interval '6 minutes' where post_id='${post}';`);
    const out = await db.query(`select job_id from claim_due_instagram_publish_job()`);
    assert.equal(out.rows.length,0);
    assert.equal((await row()).status,"uncertain");
  });
  await db.close();
});
