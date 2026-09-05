begin;
set transaction isolation level repeatable read;
set local lock_timeout='15s';
set local statement_timeout='180s';

-- The 114400 Preview fingerprint used jsonb::text directly.  PostgreSQL keeps
-- numeric display scale in that representation, while the PostgREST/browser
-- round trip legitimately renders the same JSON number without trailing zeroes.
-- Install this seam only at the fully installed 114405, pre-activation boundary.
do $seven_arches_activation_transport_dependencies$
declare
  v_signature text;
  v_oid oid;
begin
  if to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_canonical_json(jsonb)')
       is not null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)')
       is not null
     or to_regclass(
       'public.hotel_seven_arches_pricing_activation_evolution_receipts') is null
     or to_regclass(
       'public.hotel_seven_arches_pricing_activation_reviews') is null
     or to_regclass(
       'public.hotel_seven_arches_pricing_activation_transaction_context') is null
     or to_regclass(
       'public.hotel_seven_arches_independent_pricing_evolution_receipts') is not null
     or to_regclass(
       'public.hotel_seven_arches_reviewed_pricing_evolution_receipts') is not null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts')
       is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_boundary_mismatch';
  end if;
  for v_signature in select unnest(array[
    'public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)',
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)',
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()',
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'
  ]) loop
    v_oid:=to_regprocedure(v_signature);
    if v_oid is null then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_transport_dependency_missing',
        detail=v_signature;
    end if;
  end loop;
end
$seven_arches_activation_transport_dependencies$;

lock table public.hotel_seven_arches_pricing_activation_reviews
  in share row exclusive mode;
lock table public.hotel_seven_arches_pricing_activation_transaction_context
  in share row exclusive mode;
lock table public.hotel_seven_arches_pricing_activation_evolution_receipts
  in share row exclusive mode;

do $seven_arches_activation_transport_preconditions$
declare
  v_signature text;
  v_expected_hash text;
  v_expected_volatility "char";
  v_expected_path text[];
  v_authenticated_execute boolean;
  v_oid oid;
begin
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_state_mismatch';
  end if;
  for v_signature,v_expected_hash,v_expected_volatility,v_expected_path,
      v_authenticated_execute in
    select expected.signature,expected.source_hash,expected.volatility,
      expected.path,expected.authenticated_execute
    from (values
      ('public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)',
        '8579d307515355dfc45520887782c026da197e40680e9dc15381710f42e2bb26',
        'v'::"char",array['search_path=pg_catalog, public, auth']::text[],true),
      ('public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)',
        'b85e47c8e5a61832dbbc909fb120d38d965d0077914f2d8009249ca9a8ffb3f6',
        'v'::"char",array['search_path=pg_catalog, public, auth']::text[],true),
      ('public.hotel_v2_seven_arches_pricing_activation_review_guard()',
        '23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758',
        'v'::"char",array['search_path=pg_catalog, public, auth']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
        '31004936b1e020921127a449bf75a3d2f2b4a3e248f083cb1c954581d5f82cf0',
        's'::"char",array['search_path=pg_catalog, public']::text[],false)
    ) expected(signature,source_hash,volatility,path,authenticated_execute)
  loop
    v_oid:=to_regprocedure(v_signature);
    if not exists(select 1 from pg_proc procedure_row
      join pg_language language_row on language_row.oid=procedure_row.prolang
      where procedure_row.oid=v_oid
        and procedure_row.proowner='postgres'::regrole
        and language_row.lanname='plpgsql'
        and procedure_row.prosecdef
        and procedure_row.provolatile=v_expected_volatility
        and procedure_row.proconfig=v_expected_path
        and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
          'sha256'),'hex')=v_expected_hash
        and not procedure_row.proleakproof and not procedure_row.proretset
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
          is not distinct from v_authenticated_execute
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_transport_source_or_security_drift',
        detail=v_signature;
    end if;
  end loop;
  if (select count(*) from pg_trigger trigger_row
      where trigger_row.tgrelid=
        'public.hotel_seven_arches_pricing_activation_reviews'::regclass
        and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_pricing_activation_reviews'::regclass
         and trigger_row.tgname='hotel_seven_arches_pricing_activation_review_guard'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_pricing_activation_review_guard()'::regprocedure
         and trigger_row.tgtype=31 and trigger_row.tgenabled='O'
         and not trigger_row.tgisinternal)
     or (select count(*) from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
         and not trigger_row.tgisinternal)<>2
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
         and trigger_row.tgname=
           'hotel_seven_arches_pricing_activation_evolution_immutable'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_pricing_activation_immutable()'::regprocedure
         and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
         and not trigger_row.tgisinternal)
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
         and trigger_row.tgname=
           'hotel_seven_arches_pricing_activation_evolution_insert_guard'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()'::regprocedure
         and trigger_row.tgtype=7 and trigger_row.tgenabled='O'
         and not trigger_row.tgisinternal) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_trigger_drift';
  end if;
end
$seven_arches_activation_transport_preconditions$;

-- Rebuild the complete JSON tree while stripping display-only numeric scale.
-- Arrays retain their order, object keys retain their exact set, and every
-- non-number scalar remains byte-for-byte equivalent as jsonb.
create function public.hotel_v2_seven_arches_pricing_activation_canonical_json(
  p_value jsonb)
returns jsonb language plpgsql immutable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_type text:=jsonb_typeof(p_value);
  v_result jsonb;
begin
  if p_value is null then
    return null;
  end if;
  if v_type='number' then
    return to_jsonb(trim_scale((p_value#>>'{}')::numeric));
  end if;
  if v_type='array' then
    select coalesce(jsonb_agg(
      public.hotel_v2_seven_arches_pricing_activation_canonical_json(item.value)
      order by item.ordinality),'[]'::jsonb)
    into v_result
    from jsonb_array_elements(p_value) with ordinality item(value,ordinality);
    return v_result;
  end if;
  if v_type='object' then
    select coalesce(jsonb_object_agg(
      item.key,
      public.hotel_v2_seven_arches_pricing_activation_canonical_json(item.value)
      order by item.key),'{}'::jsonb)
    into v_result
    from jsonb_each(p_value) item(key,value);
    return v_result;
  end if;
  return p_value;
exception when invalid_text_representation or numeric_value_out_of_range then
  return null;
end
$function$;

-- The fingerprint validates the four monetary leaves that cross the browser
-- boundary, removes only its own fingerprint field, then hashes the complete
-- recursively canonicalized semantic plan.  It never accepts numeric strings.
create function public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(
  p_plan jsonb)
returns text language plpgsql immutable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_canonical jsonb;
  v_upper numeric;
  v_ground numeric;
  v_expected_upper numeric;
  v_expected_ground numeric;
begin
  if p_plan is null or jsonb_typeof(p_plan)<>'object' then
    return null;
  end if;
  if jsonb_typeof(p_plan#>'{operation,payload}') is distinct from 'object'
     or jsonb_typeof(p_plan#>'{operation,expected_original}')
       is distinct from 'object'
     or jsonb_typeof(p_plan#>'{operation,expected_original,room_rates}')
       is distinct from 'array' then
    return null;
  end if;
  if jsonb_array_length(
       p_plan#>'{operation,expected_original,room_rates}')<>2 then
    return null;
  end if;
  if jsonb_typeof(p_plan#>
       '{operation,payload,upper_base_nightly_rate}') is distinct from 'number'
     or jsonb_typeof(p_plan#>
       '{operation,payload,ground_base_nightly_rate}') is distinct from 'number'
     or jsonb_typeof(p_plan#>
       '{operation,expected_original,room_rates,0,base_nightly_rate}')
       is distinct from 'number'
     or jsonb_typeof(p_plan#>
       '{operation,expected_original,room_rates,1,base_nightly_rate}')
       is distinct from 'number' then
    return null;
  end if;
  v_upper:=(p_plan#>>
    '{operation,payload,upper_base_nightly_rate}')::numeric;
  v_ground:=(p_plan#>>
    '{operation,payload,ground_base_nightly_rate}')::numeric;
  v_expected_upper:=(p_plan#>>
    '{operation,expected_original,room_rates,0,base_nightly_rate}')::numeric;
  v_expected_ground:=(p_plan#>>
    '{operation,expected_original,room_rates,1,base_nightly_rate}')::numeric;
  if v_upper<=0 or v_upper>1000000
     or v_ground<=0 or v_ground>1000000
     or v_expected_upper<0 or v_expected_upper>1000000
     or v_expected_ground<0 or v_expected_ground>1000000
     or round(v_upper,2) is distinct from v_upper
     or round(v_ground,2) is distinct from v_ground
     or round(v_expected_upper,2) is distinct from v_expected_upper
     or round(v_expected_ground,2) is distinct from v_expected_ground then
    return null;
  end if;
  v_canonical:=
    public.hotel_v2_seven_arches_pricing_activation_canonical_json(
      p_plan-'plan_fingerprint');
  if v_canonical is null then
    return null;
  end if;
  return encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),
    'sha256'),'hex');
exception when invalid_text_representation or numeric_value_out_of_range then
  return null;
end
$function$;

alter function
  public.hotel_v2_seven_arches_pricing_activation_canonical_json(jsonb)
  owner to postgres;
alter function
  public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)
  owner to postgres;
revoke all on function
  public.hotel_v2_seven_arches_pricing_activation_canonical_json(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function
  public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)
  from public,anon,authenticated,service_role;

-- Replace one proven expression in each installed definition.  Exact source
-- hashes above and exact-one replacement cardinality prevent an accidental
-- source rotation or broad rewrite of the reviewed workflow.
do $seven_arches_activation_transport_patch$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)'::regprocedure)
    into strict v_definition;
  v_old:=$old$  v_fingerprint:=encode(extensions.digest(convert_to(v_plan::text,'UTF8'),'sha256'),'hex');$old$;
  v_new:=$new$  v_plan:=public.hotel_v2_seven_arches_pricing_activation_canonical_json(
    v_plan);
  v_fingerprint:=
    public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(v_plan);
  if v_plan is null or v_fingerprint is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_plan_fingerprint_failed';
  end if;$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 or position(v_new in v_definition)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_preview_source_drift';
  end if;
  execute replace(v_definition,v_old,v_new);

  select pg_get_functiondef(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'::regprocedure)
    into strict v_definition;
  v_old:=$old$     or encode(extensions.digest(convert_to(
       (p_reviewed_plan-'plan_fingerprint')::text,'UTF8'),'sha256'),'hex')
       <>p_reviewed_plan->>'plan_fingerprint' then$old$;
  v_new:=$new$     or public.hotel_v2_seven_arches_pricing_activation_canonical_json(
       p_reviewed_plan-'plan_fingerprint')
       is distinct from p_reviewed_plan-'plan_fingerprint'
     or public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(
       p_reviewed_plan) is distinct from p_reviewed_plan->>'plan_fingerprint' then$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 or position(v_new in v_definition)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_apply_source_drift';
  end if;
  execute replace(v_definition,v_old,v_new);

  select pg_get_functiondef(
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()'::regprocedure)
    into strict v_definition;
  v_old:=$old$       or encode(extensions.digest(convert_to(
          (new.reviewed_plan-'plan_fingerprint')::text,'UTF8'),'sha256'),'hex')
          is distinct from new.plan_fingerprint then$old$;
  v_new:=$new$       or public.hotel_v2_seven_arches_pricing_activation_canonical_json(
          new.reviewed_plan-'plan_fingerprint')
          is distinct from new.reviewed_plan-'plan_fingerprint'
       or public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(
          new.reviewed_plan) is distinct from new.plan_fingerprint then$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 or position(v_new in v_definition)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_review_source_drift';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$seven_arches_activation_transport_patch$;

-- The immutable receipt is not rewritten.  Its validator is evolved to pin
-- the new Preview, Apply, review-guard, canonicalizer, and fingerprint-helper
-- sources and to bind the consumed immutable review to the same contract.
do $seven_arches_activation_transport_receipt_patch$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'::regprocedure)
    into strict v_definition;

  v_old:=$old$  v_review_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()');
  v_activation_fingerprints_oid oid:=to_regprocedure($old$;
  v_new:=$new$  v_review_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()');
  v_preview_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)');
  v_canonical_json_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_canonical_json(jsonb)');
  v_plan_fingerprint_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)');
  v_activation_fingerprints_oid oid:=to_regprocedure($new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 or position(v_new in v_definition)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_receipt_declaration_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$     or v_activation_insert_guard_oid is null or v_review_guard_oid is null
     or v_activation_fingerprints_oid is null$old$;
  v_new:=$new$     or v_activation_insert_guard_oid is null or v_review_guard_oid is null
     or v_preview_oid is null
     or v_canonical_json_oid is null
     or v_plan_fingerprint_oid is null
     or v_activation_fingerprints_oid is null$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 or position(v_new in v_definition)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_receipt_dependency_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$           'hex')='b85e47c8e5a61832dbbc909fb120d38d965d0077914f2d8009249ca9a8ffb3f6'$old$;
  v_new:=$new$           'hex')='786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef'$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_receipt_apply_pin_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or exists(select 1 from (values
       (v_activation_immutable_oid,array['search_path=pg_catalog']::text[],$old$;
  v_new:=$new$         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       join pg_language language_row on language_row.oid=procedure_row.prolang
       where procedure_row.oid=v_preview_oid
         and procedure_row.proowner='postgres'::regrole
         and language_row.lanname='plpgsql'
         and procedure_row.prosecdef and procedure_row.provolatile='v'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public, auth']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
           'sha256'),'hex')='c75f83699e6d8c1c8234dbd6fec8a81dd2a337e9e193289df39f7a730b9014fd'
         and not procedure_row.proleakproof and not procedure_row.proretset
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       join pg_language language_row on language_row.oid=procedure_row.prolang
       where procedure_row.oid=v_canonical_json_oid
         and procedure_row.proowner='postgres'::regrole
         and language_row.lanname='plpgsql'
         and procedure_row.prosecdef and procedure_row.provolatile='i'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
           'sha256'),'hex')='34a597ce33e7340b4c3779ecf60286abc51aa67661954a9b616a9f2af2eb0e06'
         and not procedure_row.proleakproof and not procedure_row.proretset
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       join pg_language language_row on language_row.oid=procedure_row.prolang
       where procedure_row.oid=v_plan_fingerprint_oid
         and procedure_row.proowner='postgres'::regrole
         and language_row.lanname='plpgsql'
         and procedure_row.prosecdef and procedure_row.provolatile='i'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
           'sha256'),'hex')='17f80cd334cfd5aeeef64b620dcf4785a5a662e1a1a0e64696516f86c778ffe0'
         and not procedure_row.proleakproof and not procedure_row.proretset
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or exists(select 1 from (values
       (v_activation_immutable_oid,array['search_path=pg_catalog']::text[],$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 or position(v_new in v_definition)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_receipt_helper_pin_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$         '23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758')$old$;
  v_new:=$new$         '9d2376f4f1f8e035ffd93818ab382b1e2858dd10b38688fe8a31d3fc5845278c')$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_receipt_review_pin_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$    and v_review.id=v_receipt.review_id and v_review.consumed_at is not null$old$;
  v_new:=$new$    and v_review.id=v_receipt.review_id and v_review.consumed_at is not null
    and public.hotel_v2_seven_arches_pricing_activation_canonical_json(
      v_review.reviewed_plan-'plan_fingerprint') is not distinct from
      v_review.reviewed_plan-'plan_fingerprint'
    and v_review.plan_fingerprint is not distinct from
      public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(
        v_review.reviewed_plan)$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1 or position(v_new in v_definition)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_receipt_binding_drift';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$seven_arches_activation_transport_receipt_patch$;

alter function public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)
  owner to postgres;
alter function
  public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)
  owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_review_guard()
  owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
  owner to postgres;

revoke all on function
  public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_review_guard()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function
  public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function
  public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)
  to authenticated;
grant execute on function
  public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)
  to authenticated;

do $seven_arches_activation_transport_postconditions$
declare
  v_scale_a jsonb:='{"operation":{"payload":{"upper_base_nightly_rate":100.00,"ground_base_nightly_rate":100.00},"expected_original":{"room_rates":[{"base_nightly_rate":0.00},{"base_nightly_rate":0.00}]}}}'::jsonb;
  v_scale_b jsonb:='{"operation":{"payload":{"upper_base_nightly_rate":100,"ground_base_nightly_rate":100},"expected_original":{"room_rates":[{"base_nightly_rate":0},{"base_nightly_rate":0}]}}}'::jsonb;
  v_changed jsonb:='{"operation":{"payload":{"upper_base_nightly_rate":100.01,"ground_base_nightly_rate":100},"expected_original":{"room_rates":[{"base_nightly_rate":0},{"base_nightly_rate":0}]}}}'::jsonb;
  v_canonical_a jsonb;
  v_canonical_b jsonb;
  v_signature text;
  v_expected_hash text;
  v_expected_volatility "char";
  v_expected_path text[];
  v_authenticated_execute boolean;
  v_oid oid;
begin
  v_canonical_a:=
    public.hotel_v2_seven_arches_pricing_activation_canonical_json(v_scale_a);
  v_canonical_b:=
    public.hotel_v2_seven_arches_pricing_activation_canonical_json(v_scale_b);
  if v_canonical_a is null or v_canonical_b is null
     or v_canonical_a is distinct from v_canonical_b
     or v_canonical_a::text is distinct from v_canonical_b::text
     or public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(
       v_canonical_a) is distinct from encode(extensions.digest(convert_to(
         v_canonical_a::text,'UTF8'),'sha256'),'hex')
     or public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(v_scale_a)
       is null
     or public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(v_scale_a)
       is distinct from
       public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(v_scale_b)
     or public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(v_scale_a)
       is not distinct from
       public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(v_changed)
     or public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(
       jsonb_set(v_scale_b,'{operation,payload,upper_base_nightly_rate}',
         '100.001'::jsonb,false)) is not null
     or public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(
       jsonb_set(v_scale_b,'{operation,payload,upper_base_nightly_rate}',
         '"100.00"'::jsonb,false)) is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_canonicalization_failed';
  end if;

  for v_signature,v_expected_hash,v_expected_volatility,v_expected_path,
      v_authenticated_execute in
    select expected.signature,expected.source_hash,expected.volatility,
      expected.path,expected.authenticated_execute
    from (values
      ('public.hotel_v2_seven_arches_pricing_activation_canonical_json(jsonb)',
        '34a597ce33e7340b4c3779ecf60286abc51aa67661954a9b616a9f2af2eb0e06','i'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)',
        '17f80cd334cfd5aeeef64b620dcf4785a5a662e1a1a0e64696516f86c778ffe0','i'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)',
        'c75f83699e6d8c1c8234dbd6fec8a81dd2a337e9e193289df39f7a730b9014fd','v'::"char",
        array['search_path=pg_catalog, public, auth']::text[],true),
      ('public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)',
        '786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef','v'::"char",
        array['search_path=pg_catalog, public, auth']::text[],true),
      ('public.hotel_v2_seven_arches_pricing_activation_review_guard()',
        '9d2376f4f1f8e035ffd93818ab382b1e2858dd10b38688fe8a31d3fc5845278c','v'::"char",
        array['search_path=pg_catalog, public, auth']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
        '2829ec9059a4e035344ed35d26c7cac1d12c7296fd91ab498c7df78aa8f13dee','s'::"char",
        array['search_path=pg_catalog, public']::text[],false)
    ) expected(signature,source_hash,volatility,path,authenticated_execute)
  loop
    v_oid:=to_regprocedure(v_signature);
    if not exists(select 1 from pg_proc procedure_row
      join pg_language language_row on language_row.oid=procedure_row.prolang
      where procedure_row.oid=v_oid
        and procedure_row.proowner='postgres'::regrole
        and language_row.lanname='plpgsql'
        and procedure_row.prosecdef
        and procedure_row.provolatile=v_expected_volatility
        and procedure_row.proconfig=v_expected_path
        and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
          'sha256'),'hex')=v_expected_hash
        and not procedure_row.proleakproof and not procedure_row.proretset
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
          is not distinct from v_authenticated_execute
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_transport_postcondition_failed',
        detail=v_signature;
    end if;
  end loop;

  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context)
     or not exists(select 1 from public.hotel_rate_plans
       where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
         and hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
         and not is_active)
     or (select count(*) from public.hotel_room_rates
       where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
         and id in(
           '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
           '3320590d-632d-423f-80d0-fd021cba7293'::uuid)
         and not is_active and base_nightly_rate=0)<>2
     or not exists(select 1 from public.hotel_pricing_schedules
       where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
         and hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
         and not is_active)
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
       is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_transport_installation_failed';
  end if;
end
$seven_arches_activation_transport_postconditions$;

notify pgrst,'reload schema';
commit;
