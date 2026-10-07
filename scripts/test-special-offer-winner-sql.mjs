// Isolated PostgreSQL execution. Usage: node scripts/test-special-offer-winner-sql.mjs /absolute/path/to/pglite/dist/index.js
// No production connection, credentials or participant data are used.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const db = new PGlite();
const source = readFileSync('supabase/manual/special_offer_manual_winner_stage1.sql', 'utf8');
const repair = readFileSync('supabase/manual/special_offer_winner_actions_ambiguity_fix.sql', 'utf8');
const functionSql = (name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('\n$$;', start) + 4);
};
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${id(1)}');
    create function auth.uid() returns uuid language sql as $$ select '${id(1)}'::uuid $$;
    create function public.is_current_user_admin() returns boolean language sql as $$ select coalesce(current_setting('test.is_admin', true), 'true')::boolean $$;
    create table public.special_offers(id uuid primary key, public_winner_display boolean default false);
    create table public.special_offer_entries(id uuid primary key, offer_id uuid, status text, unique(id, offer_id));
    create table public.special_offer_audit_log(offer_id uuid, actor_id uuid, action text, entity_type text, entity_id uuid, old_value jsonb, new_value jsonb, metadata jsonb);
    create function public.special_offer_winner_score_snapshot(uuid, uuid) returns jsonb language sql as $$ select '{"total_points":2}'::jsonb $$;
  `);
  for (const ddl of source.matchAll(/create table if not exists public\.special_offer_winner_[\s\S]*?\n\);/g)) await db.exec(ddl[0]);
  for (const ddl of source.matchAll(/create unique index if not exists idx_special_offer_winner_[\s\S]*?;/g)) await db.exec(ddl[0]);
  for (const name of ['special_offer_winner_guard_admin', 'special_offer_winner_audit', 'admin_set_special_offer_primary_candidate', 'admin_set_special_offer_backup_candidate', 'admin_promote_special_offer_backup', 'admin_start_special_offer_winner_contact', 'admin_record_special_offer_winner_response', 'admin_confirm_special_offer_winner', 'admin_publish_special_offer_winner']) await db.exec(functionSql(name));
  await db.exec(`
    insert into special_offers(id) values ('${id(2)}');
    insert into special_offer_entries values ('${id(3)}', '${id(2)}', 'approved'), ('${id(4)}', '${id(2)}', 'approved');
    insert into special_offer_winner_workflows(id,offer_id,status,started_at) values ('${id(5)}','${id(2)}','shortlisting',now());
    insert into special_offer_winner_shortlist(id,workflow_id,offer_id,entry_id,entry_status_snapshot) values
      ('${id(6)}','${id(5)}','${id(2)}','${id(3)}','approved'), ('${id(7)}','${id(5)}','${id(2)}','${id(4)}','approved');
  `);
  // Reproduce the original ambiguity in the same function before applying the migration.
  const ambiguous = functionSql('admin_set_special_offer_primary_candidate')
    .replaceAll(' as target\n', '\n').replaceAll('target.', '');
  await db.exec(ambiguous);
  await assert.rejects(db.query(`select * from admin_set_special_offer_primary_candidate('${id(6)}','Test decision')`), (error) => error.code === '42702');
  assert.equal((await db.query('select count(*)::integer n from special_offer_audit_log')).rows[0].n, 0);
  console.log('PASS: original primary candidate action reproduces 42702 without partial writes');
  await db.exec(repair);
  await db.exec(repair); // Safe to reapply.
  await db.exec("set test.is_admin = 'false'");
  await assert.rejects(db.query(`select * from admin_set_special_offer_primary_candidate('${id(6)}','Test')`), /admin_required/);
  await db.exec("set test.is_admin = 'true'");
  await assert.rejects(db.query(`select * from admin_set_special_offer_primary_candidate('${id(6)}','')`), /candidate_reason_required/);
  await db.query(`select * from admin_set_special_offer_primary_candidate('${id(6)}','Test decision')`);
  await db.query(`select * from admin_set_special_offer_backup_candidate('${id(7)}',1,'Test backup')`);
  const contact = (await db.query(`select * from admin_start_special_offer_winner_contact('${id(6)}',now()+interval '72 hours','Test contact')`)).rows[0];
  await assert.rejects(db.query(`select * from admin_set_special_offer_primary_candidate('${id(7)}','Cannot change during contact')`), /winner_workflow_not_editable/);
  await db.query(`select * from admin_record_special_offer_winner_response('${contact.contact_event_id}','declined',null)`);
  await db.query(`select * from admin_promote_special_offer_backup('${id(7)}','Test replacement')`);
  const replacement = (await db.query(`select * from admin_start_special_offer_winner_contact('${id(7)}',now()+interval '72 hours',null)`)).rows[0];
  await assert.rejects(db.query(`select * from admin_confirm_special_offer_winner('${replacement.contact_event_id}','Test')`), /accepted_contact_required/);
  await db.query(`select * from admin_record_special_offer_winner_response('${replacement.contact_event_id}','accepted',null)`);
  await db.query(`select * from admin_confirm_special_offer_winner('${replacement.contact_event_id}','Accepted prize')`);
  assert.equal((await db.query('select status from special_offer_winner_workflows')).rows[0].status, 'winner_confirmed');
  assert.equal((await db.query('select count(*)::integer n from special_offer_entries')).rows[0].n, 2);
  assert.equal((await db.query("select count(*)::integer n from special_offer_winner_shortlist where role='primary'")).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::integer n from special_offer_winner_publications')).rows[0].n, 0);
  await assert.rejects(db.query(`select * from admin_publish_special_offer_winner('${id(5)}','Test Winner',true,'Test publication')`), /public_winner_display_disabled/);
  await db.exec(`update special_offers set public_winner_display=true where id='${id(2)}'`);
  await assert.rejects(db.query(`select * from admin_publish_special_offer_winner('${id(5)}','Test Winner',false,'Test publication')`), /publication_consent_required/);
  await db.query(`select * from admin_publish_special_offer_winner('${id(5)}','Test Winner',true,'Test publication')`);
  assert.equal((await db.query('select status from special_offer_winner_workflows')).rows[0].status, 'published');
  console.log('PASS: publication blocked for private campaigns; explicit public setting and consent required');
  console.log('PASS: primary, backup, contact, decline, promotion, acceptance and confirmation; original entries preserved; confirmation is separate from publication');
} finally { await db.close(); }
