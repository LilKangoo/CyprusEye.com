// LOCAL ONLY. Real PostgREST / PostgreSQL, no Stripe/network service calls.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { JWT_SECRET, TOKENS, USER_IDS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

const database='hotels_functional_lifecycle_20260907_v2';
const base='http://127.0.0.1:53079';
const binary=process.env.HOTELS_CONNECT_TEST_PSQL;
assert.ok(binary?.startsWith('/private/tmp/') && binary.endsWith('/bin/psql'));
function sql(query) {
  const r=spawnSync(binary,['-X','-qAt','-h','127.0.0.1','-p','55479','-U','postgres',
    '-d',database,'-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);return r.stdout.trim();
}
assert.equal(sql('select current_database()'),database);
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const header=encode({alg:'HS256',typ:'JWT'});
const payload=encode({role:'service_role',exp:Math.floor(Date.now()/1000)+600});
const serviceToken=`${header}.${payload}.${crypto.createHmac('sha256',JWT_SECRET).update(`${header}.${payload}`).digest('base64url')}`;
async function rpc(name,args,token=TOKENS.admin) {
  const r=await fetch(`${base}/rpc/${name}`,{method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});
  return {status:r.status,data:await r.json()};
}
const setter='hotel_v2_admin_set_partner_stripe_onboarding_authorization';
const getter='hotel_v2_admin_get_partner_stripe_onboarding_authorization';
const partner='20000000-0000-4000-8000-000000000001';
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const reason='Explicit synthetic Admin authorization, never a production request.';
const args=(enabled,version)=>({p_partner_id:partner,p_enabled:enabled,p_expected_version:version,
  p_request_id:crypto.randomUUID(),p_reason:reason});
const scope=(actor=USER_IDS.owner,hotel_id=hotel)=>rpc('hotel_v2_stripe_connect_service',
  {p_action:'scope',p_request:{actor,partner_id:partner,hotel_id}},serviceToken);
const protectedQuery=`select md5(jsonb_build_array(
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_room_rates r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_rate_plans r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_pricing_schedules r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_commission_policies r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_payment_policies r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_payment_policy_terms r),
 (select jsonb_agg(to_jsonb(r) order by assignment_id) from public.hotel_partner_hotel_permissions r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.hotel_admin_availability_foundation_evolution_receipts r),
 (select jsonb_agg(to_jsonb(r) order by id) from public.site_settings r))::text)`;
const before=sql(protectedQuery);
assert.equal(sql('select count(*) from hotel_stripe_connect_private.onboarding_authorizations'),'0');
sql(`insert into auth.users(id) values('${USER_IDS.admin}') on conflict do nothing`);
let negatives=0;
async function denied(result,statuses=[400,401,403,409]) {
  assert.ok(statuses.includes(result.status),`unexpected denial status ${result.status}`);negatives++;
}
assert.equal((await rpc(getter,{p_partner_id:partner})).data.enabled,false);
for(const token of [TOKENS.anon,TOKENS.owner,TOKENS.scopedStaff,serviceToken]) {
  await denied(await rpc(setter,args(true,0),token),[401,403]);
}
await denied(await scope(),[403]);
const proposal=args(true,0);
for(const patch of [{p_enabled:null},{p_expected_version:-1},{p_reason:'short'},
  {p_request_id:'not-a-uuid'},{p_partner_id:'00000000-0000-4000-8000-000000000000'}]) {
  await denied(await rpc(setter,{...proposal,...patch}));
}

// Two explicit competing decisions for the same expected version: one winner.
const competing=args(true,0);
const results=await Promise.all([rpc(setter,proposal),rpc(setter,competing)]);
assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
const winner=results[0].status===200?proposal:competing;
assert.equal(sql('select count(*) from hotel_stripe_connect_private.onboarding_authorizations'),'1');
assert.equal((await rpc(setter,winner)).data.replayed,true);
await denied(await rpc(setter,{...winner,p_reason:reason+' Different.'}),[409]);
await denied(await rpc(setter,args(false,0)),[409]);
await denied(await rpc(setter,args(true,1)),[409]);
assert.equal((await scope()).data.enabled,false,'grant must not enable the platform');
assert.equal(sql(protectedQuery),before,'grant must not alter historical Hotel permissions or business data');
assert.equal(sql('select public.hotel_v2_external_calendar_provider_evolution_is_safe()'),'t');

try {
  // The fixture deliberately exercises only the new capability boundary here.
  // This does NOT claim the legacy topology accepts a global enabled lifecycle.
  sql('update public.site_settings set hotel_stripe_connect_enabled=true where id=1');
  assert.deepEqual((await scope()).data,{authorized:true,enabled:true});
  assert.equal((await scope(USER_IDS.coOwnerA)).data.enabled,true);
  assert.equal((await scope(USER_IDS.owner,'c1000000-0000-4000-8000-000000000001')).data.enabled,true);
  await denied(await scope(USER_IDS.scopedStaff),[403]);
  await denied(await scope(USER_IDS.secondOwner),[403]);
  await denied(await scope(USER_IDS.owner,crypto.randomUUID()),[403]);
  assert.equal(sql('select count(*) from hotel_stripe_connect_private.accounts'),'0',
    'platform/Partner permission must not require or create a connected account');
  const revoke=args(false,1);
  const revoked=await rpc(setter,revoke);
  assert.equal(revoked.status,200);assert.equal(revoked.data.current_enabled,false);
  await denied(await scope(),[403]);
  const oldReplay=await rpc(setter,winner);
  assert.equal(oldReplay.status,200);assert.equal(oldReplay.data.replayed,true);
  assert.equal(oldReplay.data.current_enabled,false,'old grant replay must not undo revocation');
  assert.equal(sql('select count(*) from hotel_stripe_connect_private.onboarding_authorizations'),'2');
} finally {
  sql('update public.site_settings set hotel_stripe_connect_enabled=false where id=1');
}

// Raw tables/helper access and all receipt mutation forms remain blocked.
for(const role of ['anon','authenticated','service_role']) {
  assert.equal(sql(`select has_table_privilege('${role}',
    'hotel_stripe_connect_private.onboarding_authorizations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')`),'f');
  assert.equal(sql(`select has_function_privilege('${role}',
    'hotel_stripe_connect_private.authorization_state(uuid)','EXECUTE')`),'f');
}
for(const statement of [
  'update hotel_stripe_connect_private.onboarding_authorizations set enabled=not enabled',
  'delete from hotel_stripe_connect_private.onboarding_authorizations',
  'truncate hotel_stripe_connect_private.onboarding_authorizations',
]) {
  const r=spawnSync(binary,['-X','-qAt','-h','127.0.0.1','-p','55479','-U','postgres',
    '-d',database,'-v','ON_ERROR_STOP=1','-c',`begin; ${statement}; rollback;`],{encoding:'utf8'});
  assert.notEqual(r.status,0);assert.match(r.stderr,/hotel_stripe_authorization_receipt_immutable/);negatives++;
}
assert.equal(sql(protectedQuery),before);
assert.equal(sql('select public.hotel_v2_external_calendar_provider_evolution_is_safe()'),'t');
assert.equal(sql('select count(*) from hotel_stripe_connect_private.accounts'),'0');
assert.equal(sql('select count(*) from hotel_stripe_connect_private.oauth_states'),'0');
assert.equal(sql('select count(*) from hotel_stripe_connect_private.events'),'0');
console.log(JSON.stringify({sentinel:'STRIPE_PARTNER_AUTHORIZATION_POSTGREST_PASS',negatives,
  concurrent_winners:1,receipts:2,final_authorized:false,historical_permissions_unchanged:true,
  business_unchanged:true,platform_flag:false,account_creation:0,live_stripe_calls:0,
  global_lifecycle_remediation:'NOT_IMPLEMENTED'}));
