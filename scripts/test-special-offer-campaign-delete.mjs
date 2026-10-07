// Isolated PostgreSQL test using production FK definitions (no participant data).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const relationships = JSON.parse(readFileSync('tests/fixtures/special-offer-relations.json', 'utf8'));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tables = new Map();
const columns = name => { if (!tables.has(name)) tables.set(name, new Set(['id'])); return tables.get(name); };
for (const row of relationships) {
  const match = row.definition.match(/FOREIGN KEY \(([^)]+)\) REFERENCES [^(]+\(([^)]+)\)/);
  for (const c of match[1].split(', ')) columns(row.child).add(c);
  for (const c of match[2].split(', ')) columns(row.parent).add(c);
}
try {
  await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function is_current_user_admin() returns boolean language sql as $$ select coalesce(current_setting('test.admin',true),'false')::boolean $$;`);
  for (const [name, cols] of tables) {
    await db.exec(`create table ${name} (${[...cols].map(c=>`${c} uuid${c==='id'?' primary key':''}`).join(',')}${cols.has('offer_id')?',unique(id,offer_id)':''}${name==='special_offers'?',slug text':''});`);
    const owned = name.startsWith('special_offer');
    for (const n of owned ? [1,2] : [3]) {
      await db.exec(`insert into ${name} (${[...cols].join(',')}${name==='special_offers'?',slug':''}) values (${[...cols].map(c=>`'${id(c==='id'||c==='offer_id'||c==='entry_id'||c==='workflow_id'||c==='shortlist_id'||c==='field_id'||c==='prize_id'||c==='link_id'||c==='official_post_id'||c==='confirmed_entry_id'?n:3)}'`).join(',')}${name==='special_offers'?`, 'campaign-${n}'`:''});`);
    }
  }
  for (const row of relationships) await db.exec(`alter table ${row.child} add ${row.definition}`);
  await db.exec(readFileSync('supabase/manual/special_offer_campaign_delete.sql','utf8'));
  const call = (confirmation='DELETE',slug='campaign-1') => db.query(`select admin_delete_special_offer_campaign($1,$2,$3)`,[id(1),slug,confirmation]);
  await assert.rejects(call(),/login_required/);
  await db.exec(`set test.uid='${id(3)}'; set test.admin='false'`);
  await assert.rejects(call(),/admin_required/);
  await db.exec("set test.admin='true'");
  for (const bad of ['', 'delete', ' DELETE', 'DELETE ', null]) await assert.rejects(call(bad),/delete_confirmation_required/);
  await assert.rejects(call('DELETE','wrong-campaign'),/campaign_slug_mismatch/);
  // An unexpected dependent record must roll back every earlier deletion.
  await db.exec(`create table deletion_blocker(offer_id uuid references special_offers(id)); insert into deletion_blocker values ('${id(1)}')`);
  await assert.rejects(call(),/foreign key/);
  for (const name of tables.keys()) if (name.startsWith('special_offer')) assert.equal((await db.query(`select count(*)::int n from ${name}`)).rows[0].n,2,name+' rollback');
  await db.exec('drop table deletion_blocker');
  await call();
  for (const name of tables.keys()) {
    const rows = (await db.query(`select id from ${name}`)).rows;
    assert.equal(rows.length,1,name);
    assert.equal(rows[0].id,id(name.startsWith('special_offer')?2:3),name+' isolation');
  }
  await assert.rejects(call(),/campaign_not_found/);
  console.log('PASS: login/admin guard, exact DELETE, slug binding, full rollback, all campaign data removed, other campaign/users/partners preserved.');
} finally { await db.close(); }
