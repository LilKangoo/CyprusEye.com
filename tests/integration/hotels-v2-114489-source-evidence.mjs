// Offline evidence extraction only. A source hash is never replaced with a
// catalog hash, and an unavailable body is never synthesized from a pin.
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fillSourceOverlay} from './hotels-v2-114489-source-overlay.mjs';
import {completeRepoDeclarations} from './hotels-v2-114489-repo-declarations.mjs';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const sha=s=>createHash('sha256').update(s).digest('hex');
export function extractMigrationEvidence(){
 const bodies=new Map(), records=new Map(),seen=new Set(),patchSets=[],literalPatches=[],targetedSets=[];
 const literal="(?:E)?'(?:''|[^'])*'";
 const decode=s=>{const escaped=s[0]==='E';let v=s.slice(escaped?2:1,-1).replaceAll("''", "'");return escaped?v.replace(/\\n/g,'\n').replace(/\\r/g,'\r').replace(/\\t/g,'\t').replace(/\\\\/g,'\\'):v;};
 function json(value){
  if(Array.isArray(value)){value.forEach(json);return;}
  if(!value||typeof value!=='object')return;
  if(value.before && value.after && Array.isArray(value.patches))patchSets.push(value);
  if(typeof value.signature==='string'&&Array.isArray(value.meta)){
   const prior=records.get(value.signature);
   if(value.meta.length>=16||!prior)records.set(value.signature,value);
  }
  Object.values(value).forEach(v=>{if(typeof v==='string')scan(v,1);else json(v);});
 }
 function scan(s,depth=0){
  if(seen.has(s)||depth>5)return;seen.add(s);bodies.set(sha(s),s);
  if((s.startsWith('[')||s.startsWith('{'))){try{json(JSON.parse(s));}catch{}}
  for(const m of s.matchAll(new RegExp('replace\\(\\s*[a-zA-Z_.]+\\s*,\\s*('+literal+')\\s*,\\s*('+literal+')\\s*\\)','g')))
   literalPatches.push([decode(m[1]),decode(m[2])]);
  for(const m of s.matchAll(new RegExp('\\(\\s*\'(?:public|hotels_[a-z_]+)\\.[^\']+\\([^\']*\\)\'\\s*,\\s*('+literal+')\\s*,\\s*('+literal+')\\s*\\)','g')))
   literalPatches.push([decode(m[1]),decode(m[2])]);
  const tokens=s.matchAll(/--[^\n]*|\/\*[\s\S]*?\*\/|\$(\w*)\$([\s\S]*?)\$\1\$|'((?:''|[^'])*)'/g);
  for(const m of tokens)if(m[2]!==undefined||m[3]!==undefined)scan(m[2]??m[3].replaceAll("''","'"),depth+1);
 }
 for(const file of readdirSync(root+'supabase/migrations').filter(f=>f.endsWith('.sql')&&f<'20260811448900').sort()){
  const text=readFileSync(root+'supabase/migrations/'+file,'utf8');scan(text);
  const groups=new Map();
  for(const m of text.matchAll(new RegExp("\\(\\s*'((?:public|hotels_[a-z_]+)\\.[^']+\\([^']*\\))'\\s*,\\s*("+literal+")\\s*,\\s*("+literal+")\\s*\\)",'g'))){
   const a=decode(m[2]),b=decode(m[3]);if(a.length<20||/^[0-9a-f]{64}$/.test(a))continue;
   const group=groups.get(m[1])||[];group.push([a,b]);groups.set(m[1],group);
  }
  targetedSets.push(...groups.values());
 }
 for(const patches of targetedSets){
  for(const initial of [...bodies.values()].filter(s=>s.length>100&&s.length<150000)){
   let s=initial,changed=false;
   for(const [a,b] of patches){if(s.includes(a)){s=s.split(a).join(b);changed=true;}}
   if(changed)bodies.set(sha(s),s);
  }
 }
 // Source reconstruction is accepted ONLY on an existing SHA pin. Literal
 // replacements come from the historical migration SQL, never from fixtures.
 const pairs=[...new Map(literalPatches.filter(([a,b])=>a.length>20&&a!==b).map(p=>[JSON.stringify(p),p])).values()];
 const candidates=new Map([...bodies].filter(([,s])=>s.length>100&&s.length<150000&&!s.startsWith('[')));
 for(let round=0;round<6;round++){
  let added=0;
  for(const [,initial] of [...candidates]){
   let src=initial;
   for(const [a,b] of pairs){
    if(!src.includes(a))continue;
    src=src.split(a).join(b);const h=sha(src);
    if(!candidates.has(h)){candidates.set(h,src);bodies.set(h,src);added++;}
   }
  }
  if(!added||candidates.size>15000)break;
 }
 // Replay only checked-in, hash-bound source-span evidence. Never use a
 // fixture catalog hash as a body hash or accept an unverified reconstruction.
 for(let round=0;round<20;round++){
  let added=0;
  for(const p of patchSets){
   if(bodies.has(p.after)||!bodies.has(p.before))continue;
   let src=bodies.get(p.before),valid=true;
   for(const patch of p.patches){
    if(typeof patch.needle!=='string'||typeof patch.replacement!=='string'){valid=false;break;}
    if(src.split(patch.needle).length-1!==patch.count){valid=false;break;}
    src=src.split(patch.needle).join(patch.replacement);
   }
   if(valid&&sha(src)===p.after){bodies.set(p.after,src);added++;}
  }
  if(!added)break;
 }
 const missing=[],catalog=[];
 for(const [signature,b] of records){
  const src=bodies.get(b.meta[0]);if(!src){missing.push(signature);continue;}
  const name=signature.slice(0,signature.indexOf('('));
  const types=b.meta[12]??b.types;const args=b.meta[11]??b.args;
  const ret=b.meta[13]??b.ret;
  if(types===undefined||args===undefined||!ret){missing.push(signature);continue;}
  catalog.push({id:catalog.length+1,name,types,args,ret,src,meta:b.meta.slice(0,11),
   vol:b.meta[5],lang:b.meta[10],parallel:b.meta[14]??'u',kind:b.meta[15]??'f',
   def:(b.meta[4]||[]).map(c=>' SET '+c.replace('=',' = ')).join('\n')});
 }
 return {catalog,missing,records,bodies};
}
export function extractEvidence(options){
 return completeRepoDeclarations(fillSourceOverlay(extractMigrationEvidence(),options));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const e=extractEvidence();console.log(JSON.stringify({catalog:e.catalog.length,missing:e.missing},null,2));
}
