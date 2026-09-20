// E4C: exactly fifteen unavailable source bodies, extracted from the accepted
// catalog after matching the repository's predecessor pins. Never an override.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const overlayPath=new URL('./fixtures/hotels-v2-114489-accepted-source-overlay.json',import.meta.url);
export const overlayPins=[
  {
    "signature": "public.hotel_v2_external_calendar_provider_sources_are_attributable()",
    "source_sha256": "78cef0753a71a5bf7304f0a627fdf687b12998b80e84626d59d41884dc522d68",
    "row_sha256": "921f3fc1f9e431e9a9adb733a7217db4f61f8019ec181dca9921b722f41d4c21"
  },
  {
    "signature": "hotels_lineage_private.catalog_fingerprint()",
    "source_sha256": "9798b885198ee02fc8b7154ce67d2caba98b885268ae29a8f486894032657084",
    "row_sha256": "ace92fc8cd3e214b6392a21748723459514087ed2dc37934d6f7ff6d1f887fff"
  },
  {
    "signature": "public.hotel_v2_7a_pricing_activation_transaction_is_preserved()",
    "source_sha256": "1e74c1b709abb1fb29de0283d37d03325fd0ed7d5f6a01567a73174f8c6e983e",
    "row_sha256": "78597816ca5f006ffcd2977534a96eee21b85967e8a982b3e900dc6216c2030d"
  },
  {
    "signature": "public.hotel_v2_seven_arches_independent_pricing_activation_lineage()",
    "source_sha256": "2c40bc68f2d7dd54bb50654d0ca3e5a528509964377fc57e460718e7baa82fd9",
    "row_sha256": "b18a957748386e5e6342a35e20b47666396a40be7ad6e0c42eb31bbd3dbc92d9"
  },
  {
    "signature": "public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()",
    "source_sha256": "ca914b81c1b0d22ad186669010b27b13c946949e73bfc84ce8065bea037e5424",
    "row_sha256": "4cda19ab871327dc45c09b4de1693376767021398ac31086b6e596859ca9e672"
  },
  {
    "signature": "public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()",
    "source_sha256": "9c891fee2fa897b4bb10940269d73d107b2e0d718247db0e61d9dc99a4b2b6bd",
    "row_sha256": "aa680c7f8038629732aee96db6a6209da7c01f67a6993fff2518b29ad4a9c4c4"
  },
  {
    "signature": "public.hotel_v2_external_calendar_protected_fingerprints()",
    "source_sha256": "f432744ec7753928726b3a4d4c999183d6f1f394217aa35182f594cd05b39d49",
    "row_sha256": "26b7832070753b9699de7290211dbcc8ebc656048dea719cc07472c44537e7a6"
  },
  {
    "signature": "public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()",
    "source_sha256": "6e53ef01e748a54cb1dbbae5d35010a343aa4331a0c5450a4d2fc967a1e253fd",
    "row_sha256": "47a494c869218dbd77989fbb9445c92dd58fcb05f05a8123138e13a1d9984ee7"
  },
  {
    "signature": "public.hotel_v2_admin_d_current_foundation_snapshot()",
    "source_sha256": "677c8fba8970df369b356bf76fb42e07f3884fdcc058407151ea9d67f847bd62",
    "row_sha256": "a8b74039fd1078499d8cd0ed6c62a84f4fa56e014ef4ca07ebd9aa86818e3470"
  },
  {
    "signature": "public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()",
    "source_sha256": "17b801fefd47c93859f1e7868b606d3d56288dd590f931aa4c385148a72d85cc",
    "row_sha256": "a1c3d36914f60a5fb23f23d025d1913c5e13106feae2e5d946707be7b4ccfa03"
  },
  {
    "signature": "public.hotel_v2_admin_d_snapshot_external_base(uuid,date,date,boolean)",
    "source_sha256": "0d8e57d5bb06811f3ad39f6d4a638783d4517bf6c0b660a64a551790059e625c",
    "row_sha256": "e568510f5be04b63045d2be45422d0b067e5d99d20807db18659afe5df0c4fce"
  },
  {
    "signature": "public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)",
    "source_sha256": "7f665d523ae4cd0ecd9183645e50b2898426e1e62fd1bd74b652b87a227c1e7b",
    "row_sha256": "c27e06071a14c7b145d5c7ac92e6608fc60f90050427ada629eccf6b41488eab"
  },
  {
    "signature": "public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)",
    "source_sha256": "2b5702a60866205e56c6ecb7492581cf1b262098f5142b39559de5c6feb012cf",
    "row_sha256": "fbcad59d66f9a775e2c7a6c357da356a0e81d651ecb02fb9ed12b40d7b65bc7f"
  },
  {
    "signature": "public.hotel_v2_h3_2b_flags_off()",
    "source_sha256": "c4866c37cc2a4c5569e9efee957db4f13cc641290e2b2ea4b96f6265e9a2691f",
    "row_sha256": "b0f97a6f0fb7015be1d2975cf9630f565611c9b6c50cd9c4d7edc85f9d923e48"
  },
  {
    "signature": "public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)",
    "source_sha256": "ae51c6ed5516fe7c37b684ac843572af0d2b23b08ca28759b58c926c97df9798",
    "row_sha256": "287a09da25be7701da9bfdcddf8dd7209a547c108fae7091638222149fc5bc7f"
  }
];
const sha=s=>createHash('sha256').update(s).digest('hex');
export const signature=p=>p.name+'('+p.types.replace(/\s/g,'')+')';
export const stableJSON=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
export function fillSourceOverlay(evidence,{path=overlayPath,overlay}={}){
 const data=overlay??JSON.parse(readFileSync(path,'utf8'));
 assert.deepEqual(Object.keys(data).sort(),['catalog_sha256','contract_version','rows']);
 assert.equal(data.contract_version,'hotels_114489_exact_missing_source_overlay_v1');
 assert.equal(data.catalog_sha256,'583bdd402c723853ac9415a6ccc27b360e82542852bb15ae8023f646ba85e358');
 assert.equal(data.rows.length,15,'overlay must contain exactly 15 rows');
 const expected=new Map(overlayPins.map(p=>[p.signature,p]));
 const found=new Map();
 for(const row of data.rows){
  const key=signature(row),pin=expected.get(key);
  assert.ok(pin,'unexpected overlay signature: '+key);
  assert.ok(!found.has(key),'duplicate overlay signature: '+key);
  assert.equal(sha(row.src),pin.source_sha256,'overlay source drift: '+key);
  assert.equal(row.meta[0],pin.source_sha256,'overlay source metadata drift: '+key);
  assert.equal(sha(stableJSON(row)),pin.row_sha256,'overlay exact metadata drift: '+key);
  assert.ok(!evidence.catalog.some(p=>signature(p)===key),'overlay cannot override repo source: '+key);
  const record=[...evidence.records].find(([sig])=>sig.replace(/\s/g,'')===key)?.[1];
  assert.ok(record,'overlay requires repository pin: '+key);
  assert.deepEqual(row.meta,record.meta.slice(0,11),'overlay conflicts with repository metadata: '+key);
  assert.equal(row.args,record.meta[11]??record.args,'overlay argument metadata conflict: '+key);
  assert.equal(row.types,record.meta[12]??record.types,'overlay type metadata conflict: '+key);
  assert.equal(row.ret,record.meta[13]??record.ret,'overlay return metadata conflict: '+key);
  assert.equal(row.parallel??'u',record.meta[14]??'u','overlay parallel metadata conflict: '+key);
  assert.equal(row.kind??'f',record.meta[15]??'f','overlay kind metadata conflict: '+key);
  assert.ok(!evidence.bodies.has(pin.source_sha256),'overlay cannot override recovered body: '+key);
  found.set(key,row);
 }
 assert.deepEqual([...found.keys()].sort(),[...expected.keys()].sort(),'overlay missing required rows');
 assert.deepEqual(evidence.missing.map(s=>s.replace(/\s/g,'')).sort(),[...expected.keys()].sort(),'missing set drift');
 return {...evidence,catalog:[...evidence.catalog,...[...found.values()].sort((a,b)=>signature(a).localeCompare(signature(b)))],missing:[]};
}
