// Complete metadata from checked-in DDL, not from the generated 114489 output.
// This deliberately supports only the exact, simple PG16 declarations below.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mask} from './hotels-v2-114488-read-compiler.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const root=new URL('../../',import.meta.url);
export function pgSettings(config){
 return (config||[]).map(c=>{
  assert.match(c,/^search_path=[a-z_, ]+$/,'unsupported definition setting');
  return ' SET search_path TO '+c.slice(12).split(',').map(s=>"'"+s.trim()+"'").join(', ');
 }).join('\n');
}
export function pgDefinition(p){
 assert.ok(['s','i'].includes(p.vol));
 assert.equal(p.meta[7],false);assert.equal(p.meta[8],false);assert.equal(p.meta[9],false);
 assert.equal(p.parallel??'u','u');assert.equal(p.kind??'f','f');
 assert.ok(!p.src.includes('$function$'),'definition delimiter needs explicit support');
 return `CREATE OR REPLACE FUNCTION ${p.name}(${p.args})\n RETURNS ${p.ret}\n LANGUAGE ${p.lang}\n ${p.vol==='s'?'STABLE':'IMMUTABLE'}${p.meta[6]?' SECURITY DEFINER':''}\n${pgSettings(p.meta[4])}\nAS $function$${p.src}$function$\n`;
}
const declarations=[
 ['20260811441500_hotels_v2_seven_arches_reviewed_pricing_evolution.sql','b0596fe74a2b3fde08380bcdb5622176a871fcc270bbc37aa6b96388009ed22b',[
  'public.hotel_v2_7a_reviewed_pricing_partner_access_is_current',
  'public.hotel_v2_admin_get_seven_arches_reviewed_pricing']],
 ['20260811448800_hotels_v2_partner_reviewed_pricing_read_once.sql','8eef89a256a008224b4e0a46ee52364a6d4e7422584472dfe9dd7ccc3801f86f',[
  'hotels_partner_read_once_private.metadata',
  'hotels_partner_read_once_private.assert_exact',
  'public.hotel_v2_partner_get_seven_arches_reviewed_pricing_114488']],
];
function texts(sql){
 const out=new Set();
 function scan(s){
  if(out.has(s))return;out.add(s);
  for(const m of s.matchAll(/--[^\n]*|\/\*[\s\S]*?\*\/|\$(\w*)\$([\s\S]*?)\$\1\$|'((?:''|[^'])*)'/g))
   if(m[2]!==undefined||m[3]!==undefined)scan(m[2]??m[3].replaceAll("''","'"));
 }
 scan(sql);return [...out];
}
export function completeRepoDeclarations(evidence){
 const catalog=evidence.catalog.map(p=>{
  const q={...p,meta:[...p.meta],def:pgSettings(p.meta[4])};
  // 114488 deliberately omitted definition hashes for its newly generated
  // helpers. Render their checked-in declaration in PG16 catalog format.
  if(q.meta[1]===null){q.def=pgDefinition(q);q.meta[1]=sha(q.def);}
  return q;
 });
 for(const [file,pin,names] of declarations){
  const sql=readFileSync(new URL('supabase/migrations/'+file,root),'utf8');
  assert.equal(sha(sql),pin,'frozen declaration/security source drift: '+file);
  const candidates=texts(sql);
  for(const name of names){
   assert.ok(!catalog.some(p=>p.name===name),'declaration must not override recovered source: '+name);
   const found=new Map();
   for(const text of candidates){
    const code=mask(text),re=new RegExp('create function '+name.replaceAll('.','\\.')+'\\s*\\(','ig');
    for(const m of code.matchAll(re)){
     const end=code.indexOf(';',m.index);assert.ok(end>=0);
     const declaration=text.slice(m.index,end),masked=code.slice(m.index,end);
     const as=/\bas\b/i.exec(masked);assert.ok(as);
     const header=declaration.slice(0,as.index),literal=declaration.slice(as.index+2).trim();
     const single=/^'((?:''|[^'])*)'$/.exec(literal),dollar=/^(\$\w*\$)([\s\S]*)\1$/.exec(literal);
     assert.ok(single||dollar,'exact source literal');
     const src=single?single[1].replaceAll("''","'"):dollar[2];
     const h=/^create function [\w.]+\s*\(([^)]*)\)\s*returns (\w+)\s+language (sql|plpgsql)\s+stable security definer\s+set search_path\s*=\s*([\w, ]+)\s*$/i.exec(header);
     assert.ok(h,'unsupported declaration: '+name);
     const args=h[1].trim().split(',').filter(Boolean).map(s=>s.trim().replace(/\s+/g,' ')).join(', ');
     const types=args.split(', ').filter(Boolean).map(s=>{assert.match(s,/^\w+ \w+$/);return s.split(' ')[1];}).join(', ');
     const signature=name+'('+types.replace(/\s/g,'')+')';
     const security=candidates.join('\n').replace(/\s+/g,' ').toLowerCase();
     assert.ok(security.includes(('alter function '+signature+' owner to postgres').toLowerCase())||security.replace(/, /g,',').includes(('alter function '+signature+' owner to postgres').toLowerCase()),'owner evidence: '+name);
     const revoke=[...security.matchAll(/revoke all on function ([^;]*?) from public,anon,authenticated,service_role/g)].some(m=>m[1].replace(/\s/g,'').includes(signature));
     assert.ok(revoke,'revocation evidence: '+name);
     const authenticated=[...security.matchAll(/grant execute on function ([^;]*?) to authenticated/g)].some(m=>m[1].replace(/\s/g,'').includes(signature));
     const meta=[sha(src),null,'postgres',authenticated?'{authenticated=X/postgres,postgres=X/postgres}':'{postgres=X/postgres}',['search_path='+h[4].split(',').map(s=>s.trim()).join(', ')],'s',true,false,false,false,h[3].toLowerCase()];
     const p={name,types,args,ret:h[2].toLowerCase(),src,vol:'s',lang:meta[10],meta,parallel:'u',kind:'f'};
     p.def=pgDefinition(p);p.meta[1]=sha(p.def);found.set(JSON.stringify(p),p);
    }
   }
   assert.equal(found.size,1,'exact repo declaration: '+name);
   catalog.push([...found.values()][0]);
  }
 }
 // PostgreSQL catalogQuery orders by fully qualified name / identity args.
 catalog.sort((a,b)=>a.name.localeCompare(b.name)||a.types.localeCompare(b.types));
 return {...evidence,catalog};
}
