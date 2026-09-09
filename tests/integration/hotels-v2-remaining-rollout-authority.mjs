// Committed predecessor provenance, NOT a production-catalog hash override.
// Used only while constructing a fresh disposable fixture, before receipts.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const hash=s=>createHash('sha256').update(s).digest('hex');
export const adminSecurityAuthorities={
 'supabase/migrations/153_security_stage4_function_search_path_hardening.sql':'6a4347db2baa42e9fbf11f6c176a9014bdc9cdb9962825cee67b64c8f70ce160',
 'supabase/migrations/164_security_stage13_revoke_public_execute_default.sql':'c7af836f4355f5b4c43df9d21180811396a068882742670837fc60eb559a410a',
 'supabase/migrations/165_security_stage14_remove_anon_from_non_public_definer_functions.sql':'2897cd6ac4f73b8a074636870cc7c2d88f2c5f1959374d2e2c44b9dc31e9de00',
 'supabase/migrations/166_security_stage15_remove_authenticated_from_internal_definer_functions.sql':'6f71b3aacfa7db130bbd21b95c051382074c52a7266944d5ea738a362c1e4ccd'
};
export const authorities={
 admin:{file:'supabase/migrations/042_partner_service_fulfillments.sql',file_sha:'534b8ceed6d2bea18b1cd6cf19cca96b7a887fd31eaac8f89cae50c50183efcc',name:'is_current_user_admin',delimiter:'$$',source_sha:'581f1801056e5aee65c0144151b41dea41910d2c8e22639873ff659487e8a255'},
 booking:{file:'supabase/migrations/20260811180000_hotels_v2_h1a_booking_security_lockdown.sql',file_sha:'f0af29a53d034a0818892f09c37b3930377810c2213054864c656373e1fd5397',name:'hotel_bookings_assign_authenticated_owner',delimiter:'$$',source_sha:'4bf9032e832df802166f0919ee447099193aad32b1d407e9f75460e31471ab8e'},
 apply:{file:'supabase/migrations/20260811370000_hotels_v2_pgcrypto_digest_schema_hotfix.sql',file_sha:'2339ee37962250962af96a0e93e0777f94f402a8f330a5810a76acef8eac8535',name:'hotel_v2_admin_apply_pricing_control_plan',delimiter:'$function$',source_sha:'f279e2690bce3f935fe5f2831a525ed8af5004ec1a0e05fa1f1c6b2943149afb',after_114350:'775dcbb181fd52e8eba2e5a741beff28ed9c06c5d72cc209ee7bbfb5f74f0752'}
};
export function definition(key){
 if(key==='admin')for(const[file,sha]of Object.entries(adminSecurityAuthorities)){const text=readFileSync(new URL(file,root),'utf8');assert.equal(hash(text),sha,file);assert.match(text,/is_current_user_admin/);}
 const a=authorities[key],text=readFileSync(new URL(a.file,root),'utf8');assert.equal(hash(text),a.file_sha,a.file);
 const start=text.toLowerCase().indexOf('create or replace function public.'+a.name+'(');assert.ok(start>=0);
 const first=text.indexOf(a.delimiter,start),end=text.indexOf(a.delimiter+';',first+a.delimiter.length);assert.ok(first>start&&end>first);
 const body=text.slice(first+a.delimiter.length,end);assert.equal(hash(body),a.source_sha,a.name);
 if(a.after_114350)assert.equal(hash(body.replaceAll('hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false')),a.after_114350);
 return text.slice(start,end+a.delimiter.length+1);
}
export function authoritativeFixtureSource(path,source){
 if(path.endsWith('/hotels-v2-h2a-base.sql')){
  // 153 pins public search_path; 164/165/166 remove PUBLIC and retain
  // anon/authenticated/service_role execution of this explicit policy helper.
  // No fixtures are permission authority. Extract the real 042 body verbatim.
  source+='\n'+definition('admin')+'\nALTER FUNCTION public.is_current_user_admin() OWNER TO postgres;\nREVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;\nGRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon,authenticated,service_role;\n';
  // 111800 is an actual BEFORE INSERT booking-security trigger, not an
  // unrelated extra public function. Preserve both its body and topology.
  const text=readFileSync(new URL(authorities.booking.file,root),'utf8');
  source+=definition('booking')+'\n'+text.slice(text.indexOf('drop trigger if exists trg_hotel_bookings_assign_authenticated_owner'),text.indexOf('alter table public.hotel_bookings enable row level security;'))+'\n';
 }
 if(path.endsWith('/20260811350000_hotels_v2_admin_c_pricing_control.sql'))source+='\n'+definition('apply')+'\n';
 return source;
}
