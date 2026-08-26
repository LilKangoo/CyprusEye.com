-- Forward lifecycle evolution after the deployed H3.2B and Stage 2 receipts.
begin;
set local lock_timeout='15s';
set local statement_timeout='180s';

do $proposal_review_prerequisites$
begin
  if to_regclass('public.hotel_partner_property_drafts') is null
     or to_regclass('public.hotel_partner_workspace_foundation_receipts') is null
     or to_regprocedure('public.hotel_v2_h3_2b_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_h3_2b_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_admin_get_content_control(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_c_json_uuid_fields_are_canonical(jsonb)') is null
     or to_regprocedure('public.hotel_v2_h2a_require_admin()') is null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_activation_function_fingerprints()') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_review_prerequisite_missing';
  end if;
  if to_regclass('public.hotel_partner_property_proposal_admin_reviews') is not null
     or to_regclass('public.hotel_partner_property_proposal_admin_transaction_context') is not null
     or to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_review_boundary_mismatch';
  end if;
  if (select count(*) from public.hotel_partner_workspace_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_partner_workspace_foundation_receipts foundation
       where foundation.id=1
         and foundation.protected_fingerprint=
           public.hotel_v2_h3_2b_hash(foundation.protected_fingerprints))
     or (public.hotel_v2_h3_2b_protected_fingerprints()-array[
          'hotel_partner_hotel_permissions','hotel_partner_action_receipts','site_settings',
          'non_h3_2b_activity','non_h3_2b_partner_receipts']::text[])
        is distinct from ((select foundation.protected_fingerprints
          from public.hotel_partner_workspace_foundation_receipts foundation where foundation.id=1)-array[
          'hotel_partner_hotel_permissions','hotel_partner_action_receipts','site_settings',
          'non_h3_2b_activity','non_h3_2b_partner_receipts']::text[])
     or not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'safe')::boolean,false) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_foundation_mismatch';
  end if;
end
$proposal_review_prerequisites$;

alter table public.hotel_partner_property_drafts
  drop constraint hotel_partner_property_drafts_assignment_id_key,
  drop constraint hotel_partner_property_drafts_assignment_tuple_key;
create unique index hotel_partner_property_drafts_one_pending_assignment_uidx
  on public.hotel_partner_property_drafts(assignment_id)
  where status='pending_admin_review';

create table public.hotel_partner_property_proposal_admin_reviews(
  id uuid primary key,
  actor_id uuid not null,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  proposal_id uuid not null references public.hotel_partner_property_drafts(id) on delete restrict,
  proposal_version bigint not null check(proposal_version>0),
  action text not null check(action in('accept','reject')),
  reason text not null check(reason=btrim(reason) and length(reason) between 3 and 500
    and reason!~'[[:cntrl:]]'),
  plan_fingerprint text not null check(plan_fingerprint~'^[0-9a-f]{64}$'),
  reviewed_plan jsonb not null check(jsonb_typeof(reviewed_plan)='object'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_correlation_id uuid,
  result jsonb check(result is null or jsonb_typeof(result)='object'),
  created_at timestamptz not null default clock_timestamp(),
  unique(actor_id,plan_fingerprint)
);
alter table public.hotel_partner_property_proposal_admin_reviews enable row level security;
revoke all on table public.hotel_partner_property_proposal_admin_reviews
  from public,anon,authenticated,service_role;

create function public.hotel_v2_seven_arches_property_proposal_review_guard()
returns trigger language plpgsql set search_path=pg_catalog
as $function$
begin
  if tg_op='DELETE' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_review_delete_forbidden';
  end if;
  if tg_op='INSERT' then
    if new.hotel_id<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
       or new.actor_id is distinct from auth.uid()
       or not public.is_current_user_admin()
       or not exists(select 1 from public.hotel_partner_property_drafts draft
         where draft.id=new.proposal_id and draft.hotel_id=new.hotel_id
           and draft.version=new.proposal_version and draft.status='pending_admin_review')
       or new.reviewed_plan->>'review_id' is distinct from new.id::text
       or new.reviewed_plan->>'hotel_id' is distinct from new.hotel_id::text
       or new.reviewed_plan->>'proposal_id' is distinct from new.proposal_id::text
       or new.reviewed_plan->>'proposal_version' is distinct from new.proposal_version::text
       or new.reviewed_plan->>'action' is distinct from new.action
       or new.reviewed_plan->>'reason' is distinct from new.reason
       or new.reviewed_plan->>'plan_fingerprint' is distinct from new.plan_fingerprint
       or new.plan_fingerprint is distinct from
         public.hotel_v2_h3_2b_hash(new.reviewed_plan-'plan_fingerprint')
       or new.consumed_at is not null or new.consumed_correlation_id is not null
       or new.result is not null
       or new.expires_at<=new.created_at
       or new.expires_at>new.created_at+interval '30 minutes 5 seconds' then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_property_proposal_review_insert_invalid';
    end if;
    return new;
  end if;
  if new.id is distinct from old.id or new.actor_id is distinct from old.actor_id
     or new.hotel_id is distinct from old.hotel_id
     or new.proposal_id is distinct from old.proposal_id
     or new.proposal_version is distinct from old.proposal_version
     or new.action is distinct from old.action or new.reason is distinct from old.reason
     or new.plan_fingerprint is distinct from old.plan_fingerprint
     or new.reviewed_plan is distinct from old.reviewed_plan
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at
     or old.consumed_at is not null or new.consumed_at is null
     or new.consumed_correlation_id is null or old.result is not null
     or new.result is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_review_transition_invalid';
  end if;
  return new;
end
$function$;
create trigger hotel_partner_property_proposal_admin_reviews_guard
before insert or update or delete on public.hotel_partner_property_proposal_admin_reviews
for each row execute function public.hotel_v2_seven_arches_property_proposal_review_guard();

create table public.hotel_partner_property_proposal_admin_transaction_context(
  backend_pid integer not null,
  transaction_id bigint not null,
  review_id uuid not null references public.hotel_partner_property_proposal_admin_reviews(id) on delete restrict,
  proposal_id uuid not null references public.hotel_partner_property_drafts(id) on delete restrict,
  actor_id uuid not null,
  action text not null check(action in('accept','reject')),
  admin_b_changed boolean,
  correlation_id uuid not null,
  check((action='accept' and admin_b_changed is not null)
    or (action='reject' and admin_b_changed is null)),
  primary key(backend_pid,transaction_id)
);
alter table public.hotel_partner_property_proposal_admin_transaction_context enable row level security;
revoke all on table public.hotel_partner_property_proposal_admin_transaction_context
  from public,anon,authenticated,service_role;

create or replace function public.hotel_v2_h3_2b_guard_property_draft()
returns trigger language plpgsql set search_path=pg_catalog,public
as $function$
begin
  if tg_op='DELETE' then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_property_draft_delete_forbidden';
  end if;
  if tg_op='INSERT' and (new.status<>'pending_admin_review' or new.version<>1
      or new.source_property_updated_at is distinct from
        (select hotel.updated_at from public.hotels hotel where hotel.id=new.hotel_id)) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_invalid_property_draft_insert';
  end if;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id or new.assignment_id is distinct from old.assignment_id
       or new.partner_id is distinct from old.partner_id or new.hotel_id is distinct from old.hotel_id
       or new.created_at is distinct from old.created_at or new.version<>old.version+1
       or new.updated_at<=old.updated_at then
      raise exception using errcode='55000',message='hotels_v2_h3_2b_invalid_property_draft_transition';
    end if;
    if old.status<>'pending_admin_review'
       or (new.status not in('pending_admin_review','accepted','rejected'))
       or (new.status in('accepted','rejected') and (
         new.assignment_id is distinct from old.assignment_id
         or new.partner_id is distinct from old.partner_id
         or new.hotel_id is distinct from old.hotel_id
         or new.content is distinct from old.content or new.photos is distinct from old.photos
         or new.actor_id is distinct from old.actor_id
         or new.correlation_id is distinct from old.correlation_id
         or (new.status='accepted' and new.source_property_updated_at is distinct from
           (select hotel.updated_at from public.hotels hotel where hotel.id=new.hotel_id))
         or (new.status='rejected' and new.source_property_updated_at is distinct from
           old.source_property_updated_at))) then
      raise exception using errcode='55000',message='hotels_v2_h3_2b_invalid_property_draft_lifecycle';
    end if;
    if new.status in('accepted','rejected') and not exists(select 1
      from public.hotel_partner_property_proposal_admin_transaction_context context_row
      join public.hotel_partner_property_proposal_admin_reviews review
        on review.id=context_row.review_id
      where context_row.backend_pid=pg_backend_pid()
        and context_row.transaction_id=txid_current()
        and context_row.proposal_id=old.id and context_row.actor_id=auth.uid()
        and context_row.action=case when new.status='accepted' then 'accept' else 'reject' end
        and review.actor_id=context_row.actor_id and review.proposal_id=old.id
        and review.proposal_version=old.version and review.action=context_row.action
        and review.consumed_at is null and review.result is null
        and (new.status='rejected'
          or (context_row.admin_b_changed and exists(select 1
            from public.hotel_activity_log activity
            where activity.source='hotels_v2_admin_b_property_control'
              and activity.correlation_id=context_row.correlation_id
              and activity.actor_id=context_row.actor_id and activity.actor_type='admin'
              and activity.entity_type='property' and activity.entity_id=old.hotel_id))
          or (not context_row.admin_b_changed
            and not exists(select 1 from public.hotel_activity_log activity
              where activity.source='hotels_v2_admin_b_property_control'
                and activity.correlation_id=context_row.correlation_id)
            and exists(select 1 from public.hotels hotel where hotel.id=old.hotel_id
              and not exists(select 1 from jsonb_each(old.content||old.photos) proposed(key,value)
                where to_jsonb(hotel)->proposed.key is distinct from
                  case when proposed.key in('check_in_from','check_out_until')
                    and proposed.value<>'null'::jsonb
                    then to_jsonb((proposed.value#>>'{}')::time)
                    else proposed.value end)
              and (not old.content?'title_i18n'
                or hotel.title=old.content->'title_i18n')
              and (not old.content?'description_i18n'
                or hotel.description=old.content->'description_i18n'))))) then
      raise exception using errcode='55000',
        message='hotels_v2_h3_2b_property_draft_terminal_review_context_required';
    end if;
  end if;
  if not exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.assignment_id=new.assignment_id and permission.partner_id=new.partner_id
        and permission.hotel_id=new.hotel_id) then
    raise exception using errcode='23514',message='hotels_v2_h3_2b_property_draft_assignment_mismatch';
  end if;
  return new;
end
$function$;

create or replace function public.hotel_v2_h3_2b_property_draft_projection(p_assignment_id uuid)
returns jsonb language sql security definer stable set search_path=pg_catalog,public
as $function$
  select coalesce((select jsonb_build_object('exists',true,'id',draft.id,'status',draft.status,
    'version',draft.version,'source_property_updated_at',draft.source_property_updated_at,
    'content',draft.content,'photos',draft.photos,'updated_at',draft.updated_at)
    from public.hotel_partner_property_drafts draft
    where draft.assignment_id=p_assignment_id and draft.status='pending_admin_review'),
    jsonb_build_object('exists',false,'id',null,'status',null,'version',0,
      'source_property_updated_at',null,'content','{}'::jsonb,'photos','{}'::jsonb,'updated_at',null))
$function$;

do $patch_partner_workspace_pending_projection$
declare v_oid oid; v_source text; v_needle text; v_expected_hash text;
begin
  v_oid:='public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure;
  v_source:=pg_get_functiondef(v_oid);
  if (select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_workspace_lineage_missing';
  end if;
  select receipt.compatibility_function_fingerprints->>
    'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'
    into v_expected_hash
  from hotels_v2_private.hotel_external_calendar_activation_receipts receipt where receipt.id=1;
  if v_expected_hash is null or v_expected_hash!~'^[0-9a-f]{64}$'
     or public.hotel_v2_external_calendar_worker_hash(to_jsonb(v_source))<>v_expected_hash then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_workspace_lineage_drift';
  end if;
  v_needle:='where draft.assignment_id=(v_access->>''assignment_id'')::uuid;';
  if (length(v_source)-length(replace(v_source,v_needle,'')))/length(v_needle)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_workspace_source_drift';
  end if;
  v_source:=replace(v_source,v_needle,
    'where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
      ||E'\n    and draft.status=''pending_admin_review'';');
  execute v_source;
end
$patch_partner_workspace_pending_projection$;

do $patch_partner_content_apply_pending_update$
declare v_oid oid; v_source text; v_needle text;
begin
  v_oid:='public.hotel_v2_partner_apply_content_plan(jsonb,uuid,uuid)'::regprocedure;
  v_source:=pg_get_functiondef(v_oid);
  v_needle:='updated_at=clock_timestamp() where assignment_id=v_assignment;';
  if (length(v_source)-length(replace(v_source,v_needle,'')))/length(v_needle)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_apply_source_drift';
  end if;
  v_source:=replace(v_source,v_needle,
    'updated_at=clock_timestamp() where assignment_id=v_assignment'
      ||E'\n        and status=''pending_admin_review'';');
  execute v_source;
end
$patch_partner_content_apply_pending_update$;

create function public.hotel_v2_admin_get_partner_property_proposals(p_hotel_id uuid)
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_hotel_id is distinct from '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
     or not exists(select 1 from public.hotels where id=p_hotel_id) then
    raise exception using errcode='PT404',
      message='hotels_v2_seven_arches_property_proposal_not_found';
  end if;
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposals_admin_v1',
    'hotel_id',p_hotel_id,
    'property_updated_at',(select hotel.updated_at from public.hotels hotel where hotel.id=p_hotel_id),
    'proposals',coalesce((select jsonb_agg(jsonb_build_object(
      'id',draft.id,'assignment_id',draft.assignment_id,'partner_id',draft.partner_id,
      'hotel_id',draft.hotel_id,'status',draft.status,'version',draft.version,
      'source_property_updated_at',draft.source_property_updated_at,
      'content',draft.content,'photos',draft.photos,'created_at',draft.created_at,
      'updated_at',draft.updated_at) order by draft.created_at,draft.id)
      from public.hotel_partner_property_drafts draft
      where draft.hotel_id=p_hotel_id and draft.status='pending_admin_review'),'[]'::jsonb),
    'public_change',false);
end
$function$;

create function public.hotel_v2_admin_preview_partner_property_proposal_plan(p_request jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_actor uuid:=auth.uid(); v_hotel uuid; v_proposal uuid; v_version bigint;
  v_action text; v_reason text; v_draft public.hotel_partner_property_drafts%rowtype;
  v_hotel_row public.hotels%rowtype; v_payload jsonb; v_original jsonb:='{}'::jsonb;
  v_property_plan jsonb; v_plan jsonb; v_review_id uuid:=gen_random_uuid();
  v_reviewed_at timestamptz:=clock_timestamp(); v_expires_at timestamptz; v_key text;
  v_profile_version bigint;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_request is null or jsonb_typeof(p_request)<>'object'
     or v_actor is null
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_request)
     or not public.hotel_v2_h2a_keys_allowed(p_request,array[
       'contract_version','hotel_id','proposal_id','proposal_version','action','reason'])
     or not (p_request?&array[
       'contract_version','hotel_id','proposal_id','proposal_version','action','reason'])
     or p_request->>'contract_version'<>'hotels_v2_seven_arches_property_proposal_review_request_v1'
     or p_request->>'action' not in('accept','reject')
     or jsonb_typeof(p_request->'reason')<>'string'
     or p_request->>'reason' is distinct from btrim(p_request->>'reason')
     or length(p_request->>'reason') not between 3 and 500
     or p_request->>'reason'~'[[:cntrl:]]'
     or p_request->>'proposal_version'!~'^[1-9][0-9]*$' then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_property_proposal_review_request_invalid';
  end if;
  begin
    v_hotel:=(p_request->>'hotel_id')::uuid;
    v_proposal:=(p_request->>'proposal_id')::uuid;
    v_version:=(p_request->>'proposal_version')::bigint;
  exception when others then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_property_proposal_review_request_invalid';
  end;
  if v_hotel<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
    raise exception using errcode='PT404',message='hotels_v2_seven_arches_property_proposal_not_found';
  end if;
  v_action:=p_request->>'action'; v_reason:=p_request->>'reason';
  select * into v_draft from public.hotel_partner_property_drafts
    where id=v_proposal and hotel_id=v_hotel and status='pending_admin_review';
  if not found then raise exception using errcode='PT404',message='hotels_v2_seven_arches_property_proposal_not_found'; end if;
  select * into strict v_hotel_row from public.hotels where id=v_hotel;
  if v_draft.version<>v_version
     or (v_action='accept' and
       v_draft.source_property_updated_at is distinct from v_hotel_row.updated_at) then
    raise exception using errcode='PT409',message='hotels_v2_seven_arches_property_proposal_stale';
  end if;
  v_expires_at:=v_reviewed_at+interval '30 minutes';
  if v_action='accept' then
    v_payload:=v_draft.content||v_draft.photos;
    if v_payload='{}'::jsonb then
      raise exception using errcode='23514',message='hotels_v2_seven_arches_property_proposal_empty';
    end if;
    for v_key in select key from jsonb_object_keys(v_payload) key loop
      v_original:=v_original||jsonb_build_object(v_key,
        case when v_key='title_i18n' and v_hotel_row.architecture_version='legacy' then v_hotel_row.title
             when v_key='description_i18n' and v_hotel_row.architecture_version='legacy' then v_hotel_row.description
             else to_jsonb(v_hotel_row)->v_key end);
    end loop;
    v_profile_version:=coalesce((public.hotel_v2_admin_get_content_control(v_hotel)
      #>>'{operational_profile,version}')::bigint,0);
    v_property_plan:=jsonb_build_object(
      'contract_version','hotels_v2_admin_b_property_control_v1','hotel_id',v_hotel,
      'expected_property_updated_at',v_hotel_row.updated_at,
      'expected_operational_profile_version',v_profile_version,
      'reviewed_at',v_reviewed_at,'expected_original',v_original,'payload',v_payload);
  end if;
  v_plan:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_admin_plan_v1',
    'review_id',v_review_id,'hotel_id',v_hotel,'proposal_id',v_proposal,
    'proposal_version',v_version,'action',v_action,'reason',v_reason,
    'expected_property_updated_at',v_hotel_row.updated_at,
    'reviewed_at',v_reviewed_at,'expires_at',v_expires_at,
    'expected_original',jsonb_build_object('status',v_draft.status,'version',v_draft.version,
      'source_property_updated_at',v_draft.source_property_updated_at,
      'content',v_draft.content,'photos',v_draft.photos,'updated_at',v_draft.updated_at),
    'property_plan',v_property_plan);
  v_plan:=v_plan||jsonb_build_object('plan_fingerprint',public.hotel_v2_h3_2b_hash(v_plan));
  insert into public.hotel_partner_property_proposal_admin_reviews(
    id,actor_id,hotel_id,proposal_id,proposal_version,action,reason,
    plan_fingerprint,reviewed_plan,expires_at)
  values(v_review_id,v_actor,v_hotel,v_proposal,v_version,v_action,v_reason,
    v_plan->>'plan_fingerprint',v_plan,v_expires_at);
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_admin_preview_v1',
    'hotel_id',v_hotel,'changed',true,'blocking_reasons','[]'::jsonb,
    'impact',jsonb_build_object('entity','property_proposal','action',v_action,'id',v_proposal,
      'changed',true,'before',v_plan->'expected_original',
      'after',case when v_action='accept' then v_payload else jsonb_build_object('status','rejected') end),
    'reviewed_plan',v_plan);
end
$function$;

create function public.hotel_v2_admin_apply_partner_property_proposal_plan(
  p_reviewed_plan jsonb,p_correlation_id uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_actor uuid:=auth.uid(); v_review_id uuid; v_review public.hotel_partner_property_proposal_admin_reviews%rowtype;
  v_draft public.hotel_partner_property_drafts%rowtype; v_hotel public.hotels%rowtype;
  v_action text; v_result jsonb; v_terminal_activity jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_reviewed_plan is null or jsonb_typeof(p_reviewed_plan)<>'object'
     or v_actor is null or p_correlation_id is null
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_reviewed_plan) then
    raise exception using errcode='22023',message='hotels_v2_seven_arches_property_proposal_plan_invalid';
  end if;
  begin v_review_id:=(p_reviewed_plan->>'review_id')::uuid;
  exception when others then raise exception using errcode='22023',message='hotels_v2_seven_arches_property_proposal_plan_invalid'; end;
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-7a-property-proposal:'||v_review_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-7a-property-proposal-correlation:'||p_correlation_id::text,0));
  select * into v_review from public.hotel_partner_property_proposal_admin_reviews
    where id=v_review_id for update;
  if not found or v_review.actor_id<>v_actor
     or v_review.reviewed_plan is distinct from p_reviewed_plan
     or v_review.plan_fingerprint is distinct from public.hotel_v2_h3_2b_hash(p_reviewed_plan-'plan_fingerprint') then
    raise exception using errcode='22023',message='hotels_v2_seven_arches_property_proposal_plan_invalid';
  end if;
  if v_review.consumed_at is not null then
    if v_review.consumed_correlation_id=p_correlation_id then
      return v_review.result||jsonb_build_object('replayed',true);
    end if;
    raise exception using errcode='PT409',message='hotels_v2_seven_arches_property_proposal_review_consumed';
  end if;
  if v_review.expires_at<=clock_timestamp() then
    raise exception using errcode='PT409',message='hotels_v2_seven_arches_property_proposal_review_expired';
  end if;
  select * into v_draft from public.hotel_partner_property_drafts
    where id=v_review.proposal_id for update;
  select * into strict v_hotel from public.hotels where id=v_review.hotel_id for update;
  v_action:=v_review.action;
  if v_draft.id is null or v_draft.status<>'pending_admin_review'
     or v_draft.version<>v_review.proposal_version
     or p_reviewed_plan->'expected_original' is distinct from jsonb_build_object(
       'status',v_draft.status,'version',v_draft.version,
       'source_property_updated_at',v_draft.source_property_updated_at,
       'content',v_draft.content,'photos',v_draft.photos,'updated_at',v_draft.updated_at) then
    raise exception using errcode='PT409',message='hotels_v2_seven_arches_property_proposal_stale';
  end if;
  if v_action='accept' and (
       v_draft.source_property_updated_at is distinct from v_hotel.updated_at
       or (p_reviewed_plan->>'expected_property_updated_at')::timestamptz
         is distinct from v_hotel.updated_at) then
    raise exception using errcode='PT409',message='hotels_v2_seven_arches_property_proposal_stale';
  end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_seven_arches_property_proposal_correlation_conflict';
  end if;
  if v_action='accept' then
    v_result:=public.hotel_v2_admin_apply_property_control_plan(
      p_reviewed_plan->'property_plan',p_correlation_id);
    select * into strict v_hotel from public.hotels where id=v_review.hotel_id;
  end if;
  insert into public.hotel_partner_property_proposal_admin_transaction_context(
    backend_pid,transaction_id,review_id,proposal_id,actor_id,action,admin_b_changed,correlation_id)
  values(pg_backend_pid(),txid_current(),v_review.id,v_draft.id,v_actor,v_action,
    case when v_action='accept' then (v_result->>'changed')::boolean else null end,p_correlation_id);
  update public.hotel_partner_property_drafts set
    status=case when v_action='accept' then 'accepted' else 'rejected' end,
    source_property_updated_at=case when v_action='accept' then v_hotel.updated_at
      else source_property_updated_at end,
    version=version+1,updated_at=clock_timestamp()
  where id=v_draft.id;
  insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,
    before_state,after_state,actor_type,actor_id,source,correlation_id)
  select v_review.hotel_id,'property',v_review.hotel_id,'update',
    jsonb_build_object('proposal_id',v_draft.id,'status',v_draft.status,'version',v_draft.version),
    jsonb_build_object('proposal_id',draft.id,'status',draft.status,'version',draft.version,
      'review_id',v_review.id,'reason',v_review.reason),
    'admin',v_actor,'hotels_v2_h3_2b_property_proposal_admin_review',p_correlation_id
  from public.hotel_partner_property_drafts draft where draft.id=v_draft.id
  returning to_jsonb(hotel_activity_log.*) into v_terminal_activity;
  v_result:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_admin_apply_v1',
    'hotel_id',v_review.hotel_id,'proposal_id',v_review.proposal_id,
    'action',v_action,'status',case when v_action='accept' then 'accepted' else 'rejected' end,
    'correlation_id',p_correlation_id,'replayed',false,
    'admin_b_result',v_result,'terminal_activity',v_terminal_activity,
    'control',public.hotel_v2_admin_get_partner_property_proposals(v_review.hotel_id));
  update public.hotel_partner_property_proposal_admin_reviews set
    consumed_at=clock_timestamp(),consumed_correlation_id=p_correlation_id,
    result=v_result where id=v_review.id;
  delete from public.hotel_partner_property_proposal_admin_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current() and context_row.review_id=v_review.id;
  if not found then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_context_cleanup_failed';
  end if;
  return v_result;
end
$function$;

create function public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
declare v_result jsonb:=public.hotel_v2_h3_2b_protected_fingerprints();
begin
  return v_result||jsonb_build_object(
    'hotels',md5(pg_catalog.query_to_xml($query$
      select case when hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
        (to_jsonb(hotel)-array['title','title_i18n','description','description_i18n','city',
          'address_line','district','postal_code','country','latitude','longitude',
          'google_maps_url','amenities','check_in_from','check_out_until',
          'cover_image_url','photos','updated_at'])::text
        else to_jsonb(hotel)::text end
      from public.hotels hotel order by hotel.id$query$,true,true,'')::text),
    'non_h3_2b_activity',md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from 'hotels_v2_h3_2b_partner_workspace'
        and activity.source is distinct from 'hotels_v2_h3_2b_property_proposal_admin_review'
        and not (activity.source='hotels_v2_admin_b_property_control' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action='accept' and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'')::text));
end
$function$;

create table public.hotel_partner_property_proposal_foundation_receipts(
  id smallint primary key check(id=1),
  original_h3_2b_foundation_fingerprint text not null check(original_h3_2b_foundation_fingerprint~'^[0-9a-f]{64}$'),
  proposal_fields_baseline jsonb not null check(jsonb_typeof(proposal_fields_baseline)='object'),
  protected_fingerprints jsonb not null check(jsonb_typeof(protected_fingerprints)='object'),
  protected_fingerprint text not null check(protected_fingerprint~'^[0-9a-f]{64}$'),
  stage2_compatibility_source_hash text not null
    check(stage2_compatibility_source_hash~'^[0-9a-f]{64}$'),
  partner_workspace_source_before_hash text not null
    check(partner_workspace_source_before_hash~'^[0-9a-f]{64}$'),
  partner_workspace_source_after_hash text not null
    check(partner_workspace_source_after_hash~'^[0-9a-f]{64}$'),
  partner_workspace_lineage_validator_source_hash text not null
    check(partner_workspace_lineage_validator_source_hash~'^[0-9a-f]{64}$'),
  provider_source_attribution_source_hash text not null
    check(provider_source_attribution_source_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.hotel_partner_property_proposal_foundation_receipts enable row level security;
revoke all on table public.hotel_partner_property_proposal_foundation_receipts
  from public,anon,authenticated,service_role;

-- H3.2D source rows are outside the Task2 mutation domain, but become a
-- legitimate downstream delta after the provider evolution is installed.
-- Attribute that delta only to the exact reviewed-control ledger chain.  The
-- provider receipt is deliberately discovered dynamically: before 114450 the
-- Stage2-compatible projection remains byte-strict, while after 114450 its
-- immutable source baseline is the only accepted normalization authority.
create function public.hotel_v2_external_calendar_provider_sources_are_attributable()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_activity public.hotel_activity_log%rowtype;
  v_review hotels_v2_private.hotel_external_calendar_plan_reviews%rowtype;
  v_correlation hotels_v2_private.hotel_external_calendar_correlations%rowtype;
  v_operation jsonb; v_activity_projection jsonb; v_baseline jsonb;
  v_count integer; v_provider_receipt_count integer;
  v_expected_request_hash text; v_manual_fingerprint text;
begin
  -- Every external-control activity must be the single terminal effect of one
  -- consumed review and correlation, with the exact actor-scoped receipt.
  for v_activity in select activity.* from public.hotel_activity_log activity
    where activity.source='hotels_v2_external_calendar_control'
    order by activity.id
  loop
    select count(*) into v_count
    from hotels_v2_private.hotel_external_calendar_plan_reviews review
    where review.consumed_correlation_id=v_activity.correlation_id
      and review.consumed_at is not null;
    if v_count<>1 then return false; end if;
    select * into strict v_review
    from hotels_v2_private.hotel_external_calendar_plan_reviews review
    where review.consumed_correlation_id=v_activity.correlation_id
      and review.consumed_at is not null;
    if jsonb_typeof(v_review.reviewed_plan->'operations') is distinct from 'array'
       or jsonb_array_length(v_review.reviewed_plan->'operations') is distinct from 1
       or v_review.reviewed_plan->>'review_id' is distinct from v_review.id::text
       or v_review.reviewed_plan->>'contract_version' is distinct from
         'hotels_v2_external_calendar_plan_v1'
       or v_review.reviewed_plan->>'actor_type' is distinct from v_review.actor_type
       or v_review.reviewed_plan->>'hotel_id' is distinct from v_review.hotel_id::text
       or v_review.reviewed_plan->'partner_id' is distinct from
         coalesce(to_jsonb(v_review.partner_id),'null'::jsonb)
       or v_review.reviewed_plan->'assignment_id' is distinct from
         coalesce(to_jsonb(v_review.assignment_id),'null'::jsonb)
       or v_review.reviewed_plan->'permission_version' is distinct from
         coalesce(to_jsonb(v_review.permission_version),'null'::jsonb)
       or v_review.reviewed_plan->'access_snapshot_token' is distinct from
         coalesce(to_jsonb(v_review.access_snapshot_token),'null'::jsonb)
       or v_review.reviewed_plan->>'snapshot_token' is distinct from v_review.snapshot_token
       or v_review.reviewed_plan->>'expires_at' is distinct from
         (to_jsonb(v_review.expires_at)#>>'{}')
       or v_review.plan_fingerprint is distinct from v_review.reviewed_plan->>'plan_fingerprint'
       or v_review.plan_fingerprint is distinct from public.hotel_v2_external_calendar_worker_hash(
         v_review.reviewed_plan-'plan_fingerprint')
       or v_review.actor_type is distinct from v_activity.actor_type
       or v_review.actor_id is distinct from v_activity.actor_id
       or v_review.hotel_id is distinct from v_activity.hotel_id
       or v_activity.entity_type is distinct from 'calendar_source' then
      return false;
    end if;
    v_operation:=v_review.reviewed_plan#>'{operations,0}';
    if v_operation->>'id' is distinct from v_activity.entity_id::text
       or v_activity.before_state is distinct from
         nullif(v_operation->'expected_original','null'::jsonb)
       or not ((v_operation->>'entity'='calendar_source'
          and v_operation->>'action' in('create','update','enable','disable')
          and v_activity.action=case when v_operation->>'action'='create' then 'create'
            when v_operation->>'action'='disable' then 'disable' else 'update' end)
        or (v_operation->>'entity'='ical_secret'
          and v_operation->>'action' in('set','rotate','clear') and v_activity.action='update')
        or (v_operation->>'entity'='calendar_sync'
          and v_operation->>'action'='trigger' and v_activity.action='update')) then
      return false;
    end if;
    if v_operation->>'entity'='calendar_source' and not exists(select 1
        from public.hotel_calendar_source_configs source
        where source.id=v_activity.entity_id and source.hotel_id=v_activity.hotel_id
          and source.source_type in('booking_com','airbnb','ical')) then
      return false;
    end if;
    select count(*) into v_count
    from hotels_v2_private.hotel_external_calendar_correlations correlation
    where correlation.correlation_id=v_activity.correlation_id;
    if v_count<>1 then return false; end if;
    select * into strict v_correlation
    from hotels_v2_private.hotel_external_calendar_correlations correlation
    where correlation.correlation_id=v_activity.correlation_id;
    if v_correlation.actor_type is distinct from v_review.actor_type
       or v_correlation.actor_id is distinct from v_review.actor_id then return false; end if;
    if v_operation->>'entity'='calendar_source' then
      v_expected_request_hash:=public.hotel_v2_external_calendar_worker_hash(
        jsonb_build_object('reviewed_plan',v_review.reviewed_plan,'url_fingerprint',null));
      if v_correlation.request_hash is distinct from v_expected_request_hash then return false; end if;
    end if;
    v_activity_projection:=jsonb_build_object('id',v_activity.id,'hotel_id',v_activity.hotel_id,
      'entity_type',v_activity.entity_type,'entity_id',v_activity.entity_id,
      'action',v_activity.action,'actor_type',v_activity.actor_type,
      'source',v_activity.source,'correlation_id',v_activity.correlation_id,
      'created_at',v_activity.created_at);
    if v_review.actor_type='admin' then
      select count(*) into v_count
      from hotels_v2_private.hotel_external_calendar_admin_receipts receipt
      where receipt.actor_id=v_review.actor_id and receipt.hotel_id=v_review.hotel_id
        and receipt.correlation_id=v_activity.correlation_id
        and receipt.idempotency_key=v_correlation.idempotency_key
        and receipt.request_hash=v_correlation.request_hash
        and receipt.result->>'contract_version'='hotels_v2_external_calendar_apply_result_v1'
        and receipt.result->>'hotel_id'=v_review.hotel_id::text
        and receipt.result->'partner_id'='null'::jsonb
        and receipt.result->>'correlation_id'=v_activity.correlation_id::text
        and receipt.result->>'idempotency_key'=v_correlation.idempotency_key::text
        and receipt.result->>'request_hash'=v_correlation.request_hash
        and receipt.result->'changed'='true'::jsonb
        and receipt.result->'replayed'='false'::jsonb
        and receipt.result?&array['contract_version','hotel_id','partner_id','correlation_id',
          'idempotency_key','replayed','changed','activity','request_hash']
        and public.hotel_v2_h2a_keys_allowed(receipt.result,array['contract_version','hotel_id',
          'partner_id','correlation_id','idempotency_key','replayed','changed','activity','request_hash'])
        and receipt.result->'activity'=jsonb_build_array(v_activity_projection);
      if v_count<>1 or exists(select 1 from public.hotel_partner_action_receipts receipt
          where receipt.correlation_id=v_activity.correlation_id) then return false; end if;
    elsif v_review.actor_type='partner' and v_review.partner_id is not null then
      select count(*) into v_count
      from public.hotel_partner_action_receipts receipt
      where receipt.partner_id=v_review.partner_id and receipt.hotel_id=v_review.hotel_id
        and receipt.actor_user_id=v_review.actor_id and receipt.action='h3_2d_external_calendar'
        and receipt.correlation_id=v_activity.correlation_id
        and receipt.idempotency_key=v_correlation.idempotency_key
        and receipt.request_hash=v_correlation.request_hash
        and receipt.result->>'contract_version'='hotels_v2_external_calendar_apply_result_v1'
        and receipt.result->>'hotel_id'=v_review.hotel_id::text
        and receipt.result->>'partner_id'=v_review.partner_id::text
        and receipt.result->>'correlation_id'=v_activity.correlation_id::text
        and receipt.result->>'idempotency_key'=v_correlation.idempotency_key::text
        and receipt.result->>'request_hash'=v_correlation.request_hash
        and receipt.result->'changed'='true'::jsonb
        and receipt.result->'replayed'='false'::jsonb
        and receipt.result?&array['contract_version','hotel_id','partner_id','correlation_id',
          'idempotency_key','replayed','changed','activity','request_hash']
        and public.hotel_v2_h2a_keys_allowed(receipt.result,array['contract_version','hotel_id',
          'partner_id','correlation_id','idempotency_key','replayed','changed','activity','request_hash'])
        and receipt.result->'activity'=jsonb_build_array(v_activity_projection);
      if v_count<>1 or exists(select 1
          from hotels_v2_private.hotel_external_calendar_admin_receipts receipt
          where receipt.correlation_id=v_activity.correlation_id) then return false; end if;
    else return false;
    end if;
  end loop;

  -- No consumed review, correlation, or excluded receipt may be orphaned from
  -- the exact external activity chain checked above.
  if exists(select 1 from hotels_v2_private.hotel_external_calendar_plan_reviews review
      where review.consumed_at is not null and not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=review.consumed_correlation_id))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_correlations correlation
      where not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=correlation.correlation_id))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_admin_receipts receipt
      where not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=receipt.correlation_id))
     or exists(select 1 from public.hotel_partner_action_receipts receipt
      where receipt.action='h3_2d_external_calendar' and not exists(select 1
        from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=receipt.correlation_id)) then
    return false;
  end if;

  if to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is null then
    return true;
  end if;
  execute 'select count(*) from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'
    into v_provider_receipt_count;
  if v_provider_receipt_count=0 then return true; end if;
  if v_provider_receipt_count<>1 then return false; end if;
  execute 'select provider_source_baseline,manual_source_fingerprint from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts where id=1'
    into v_baseline,v_manual_fingerprint;
  if v_baseline is null or jsonb_typeof(v_baseline)<>'array'
     or v_manual_fingerprint is null
     or v_manual_fingerprint<>public.hotel_v2_external_calendar_worker_hash(coalesce(
       (select jsonb_agg(to_jsonb(source) order by source.id)
        from public.hotel_calendar_source_configs source where source.source_type='manual'),'[]'::jsonb))
     or exists(select 1 from public.hotel_calendar_source_configs source
       where source.source_type<>'manual'
         and source.source_type not in('booking_com','airbnb','ical'))
     or exists(select 1 from jsonb_array_elements(v_baseline) baseline(value)
       where jsonb_typeof(baseline.value)<>'object'
         or baseline.value->>'source_type' not in('booking_com','airbnb','ical'))
     or exists(select 1 from jsonb_array_elements(v_baseline) baseline(value)
       where not exists(select 1 from public.hotel_calendar_source_configs source
         where source.id=(baseline.value->>'id')::uuid)) then
    return false;
  end if;

  -- A current supported source is either byte-identical to the immutable
  -- provider baseline or its exact source-config projection is the result of a
  -- reviewed calendar_source operation. Secret/sync operations never qualify.
  if exists(select 1 from public.hotel_calendar_source_configs source
      where source.source_type in('booking_com','airbnb','ical')
        and not exists(select 1 from jsonb_array_elements(v_baseline) baseline(value)
          where baseline.value=to_jsonb(source))
        and not exists(select 1 from public.hotel_activity_log activity
          join hotels_v2_private.hotel_external_calendar_plan_reviews review
            on review.consumed_correlation_id=activity.correlation_id
           and review.consumed_at is not null
          cross join lateral (select review.reviewed_plan#>'{operations,0}' operation) reviewed
          where activity.source='hotels_v2_external_calendar_control'
            and activity.entity_type='calendar_source' and activity.entity_id=source.id
            and activity.hotel_id=source.hotel_id
            and reviewed.operation->>'entity'='calendar_source'
            and reviewed.operation->>'action' in('create','update','enable','disable')
            and coalesce(reviewed.operation#>>'{payload,room_type_id}',
              reviewed.operation#>>'{expected_original,room_type_id}')=source.room_type_id::text
            and coalesce(reviewed.operation#>>'{payload,source_type}',
              reviewed.operation#>>'{expected_original,source_type}',
              case when source.source_type='ical' then 'ical' end)=source.source_type
            and (activity.after_state-array['health','secret_configured','binding_version']::text[])=
              jsonb_build_object('id',source.id,'hotel_id',source.hotel_id,
                'room_type_id',source.room_type_id,'code',source.code,'source_type',source.source_type,
                'is_enabled',source.is_enabled,'review_status',source.review_status,
                'priority',source.priority,'version',source.version,'updated_at',source.updated_at,
                'sync_interval_minutes',(source.configuration->>'sync_interval_minutes')::integer,
                'units_per_event',(source.configuration->>'units_per_event')::integer))) then
    return false;
  end if;
  return true;
exception when invalid_text_representation or no_data_found or too_many_rows then
  return false;
end
$function$;

-- The 114350 receipt remains the immutable source authority.  Task2 permits
-- exactly one later evolution of the Partner workspace: terminal property
-- proposals must no longer be projected as the current pending draft.
create function public.hotel_v2_partner_workspace_function_lineage_is_exact()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  c_signature constant text:='public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)';
  c_old constant text:='where draft.assignment_id=(v_access->>''assignment_id'')::uuid;';
  c_new constant text:='where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
    ||E'\n    and draft.status=''pending_admin_review'';';
  v_activation hotels_v2_private.hotel_external_calendar_activation_receipts%rowtype;
  v_receipt public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_current jsonb; v_source text; v_oid oid;
begin
  if (select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or (select count(*) from public.hotel_partner_workspace_foundation_receipts)<>1
     or (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1 then
    return false;
  end if;
  select * into strict v_activation
    from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1;
  select * into strict v_receipt
    from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  v_oid:=to_regprocedure(c_signature);
  if v_oid is null then return false; end if;
  v_source:=pg_get_functiondef(v_oid);
  v_current:=public.hotel_v2_external_calendar_activation_function_fingerprints();
  return v_receipt.original_h3_2b_foundation_fingerprint=(select protected_fingerprint
      from public.hotel_partner_workspace_foundation_receipts where id=1)
    and v_receipt.protected_fingerprint=public.hotel_v2_h3_2b_hash(v_receipt.protected_fingerprints)
    and v_receipt.stage2_compatibility_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
      pg_get_functiondef('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure)))
    and v_receipt.partner_workspace_source_before_hash=
      v_activation.compatibility_function_fingerprints->>c_signature
    and v_receipt.partner_workspace_source_after_hash=
      public.hotel_v2_external_calendar_worker_hash(to_jsonb(v_source))
    and v_receipt.partner_workspace_source_before_hash<>
      v_receipt.partner_workspace_source_after_hash
    and (v_current-c_signature) is not distinct from
      (v_activation.compatibility_function_fingerprints-c_signature)
    and v_current->>c_signature=v_receipt.partner_workspace_source_after_hash
    and (length(v_source)-length(replace(v_source,c_old,'')))/length(c_old)=0
    and (length(v_source)-length(replace(v_source,c_new,'')))/length(c_new)=1
    and v_receipt.partner_workspace_lineage_validator_source_hash=
      public.hotel_v2_external_calendar_worker_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_partner_workspace_function_lineage_is_exact()'::regprocedure)))
    and (select proowner from pg_proc where oid=v_oid)='postgres'::regrole
    and (select prosecdef from pg_proc where oid=v_oid)
    and (select proconfig from pg_proc where oid=v_oid)=
      array['search_path=pg_catalog, public, auth']::text[]
    and has_function_privilege('authenticated',v_oid,'EXECUTE')
    and not has_function_privilege(0::oid,v_oid,'EXECUTE')
    and not has_function_privilege('anon',v_oid,'EXECUTE')
    and not has_function_privilege('service_role',v_oid,'EXECUTE');
exception when no_data_found or too_many_rows then
  return false;
end
$function$;

-- This is an explicitly evolved projection, not a replacement for the raw
-- Stage 2 protected-fingerprint helper. It normalizes only the exact Task1
-- owner delta and Task2 proposal fields after their independent immutable
-- receipts/attribution checks pass. Task3 pricing keys remain visible.
create function public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_raw jsonb:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_owner_state jsonb;
  v_task2_foundation public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_task2_current jsonb;
  v_provider_prior jsonb; v_provider_receipt_count integer:=0;
begin
  select * into v_owner from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  v_owner_state:=public.hotel_v2_admin_d_current_foundation_snapshot();
  select * into v_task2_foundation
    from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  v_task2_current:=public.hotel_v2_seven_arches_property_proposal_protected_fingerprints();
  if to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is not null then
    execute 'select count(*) from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'
      into v_provider_receipt_count;
    if v_provider_receipt_count=1 then
      execute 'select prior_compatible_fingerprints from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts where id=1'
        into v_provider_prior;
    end if;
  end if;
  if v_owner.id is null
     or not coalesce((v_owner_state->>'original_receipt_intact')::boolean,false)
     or not coalesce((v_owner_state->>'seven_arches_assignment_exact')::boolean,false)
     or not coalesce((v_owner_state->>'seven_arches_owner_preset_exact')::boolean,false)
     or not coalesce((v_owner_state->>'audit_chain_exact')::boolean,false)
     or not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
          and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
        from public.site_settings)
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_external_sync_enabled and not exists(select 1
         from hotels_v2_private.hotel_external_calendar_activation_receipts activation
         where activation.id=setting.id
           and activation.site_settings_without_external_fingerprint=
             public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled')))
     or v_owner.stage2_current_protected_fingerprint<>
       public.hotel_v2_external_calendar_worker_hash(v_owner.stage2_current_protected_fingerprints)
     or v_task2_foundation.id is null
     or v_task2_foundation.protected_fingerprint<>
       public.hotel_v2_h3_2b_hash(v_task2_foundation.protected_fingerprints)
     or v_task2_foundation.provider_source_attribution_source_hash<>
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure)))
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or (v_provider_receipt_count=0 and
       (v_task2_current-array['hotel_rate_plans','hotel_room_rates_protected',
          'hotel_pricing_schedules','hotel_admin_pricing_action_receipts',
          'non_h3_2b_activity','non_h3_2b_partner_receipts']::text[]) is distinct from
        (v_task2_foundation.protected_fingerprints-array['hotel_rate_plans',
          'hotel_room_rates_protected','hotel_pricing_schedules',
          'hotel_admin_pricing_action_receipts','non_h3_2b_activity',
          'non_h3_2b_partner_receipts']::text[]))
     or (v_provider_receipt_count<>0 and (v_provider_receipt_count<>1
       or v_provider_prior is null
       or v_provider_prior->'non_ical_calendar_sources' is null
       or (v_task2_current-array['hotel_rate_plans','hotel_room_rates_protected',
          'hotel_pricing_schedules','hotel_admin_pricing_action_receipts',
          'non_h3_2b_activity','non_h3_2b_partner_receipts',
          'hotel_calendar_source_configs']::text[]) is distinct from
        (v_task2_foundation.protected_fingerprints-array['hotel_rate_plans',
          'hotel_room_rates_protected','hotel_pricing_schedules',
          'hotel_admin_pricing_action_receipts','non_h3_2b_activity',
          'non_h3_2b_partner_receipts','hotel_calendar_source_configs']::text[])))
     or not public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() then
    return v_raw;
  end if;
  v_raw:=jsonb_set(jsonb_set(jsonb_set(v_raw,'{hotels}',
      v_owner.stage2_current_protected_fingerprints->'hotels',false),
    '{site_settings}',v_owner.stage2_current_protected_fingerprints->'site_settings',false),
    '{non_external_calendar_activity}',to_jsonb(md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from 'hotels_v2_external_calendar_control'
        and activity.source is distinct from 'hotels_v2_h3_2b_partner_workspace'
        and activity.source is distinct from 'hotels_v2_h3_2b_property_proposal_admin_review'
        and not (activity.source='hotels_v2_admin_b_property_control' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action='accept'
            and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'')::text)),false)
    ||jsonb_build_object('non_external_calendar_partner_receipts',md5(
      pg_catalog.query_to_xml($query$
        select to_jsonb(receipt)::text from public.hotel_partner_action_receipts receipt
        where receipt.action not in('h3_2b_content','h3_2b_pricing','h3_2b_availability',
          'h3_2d_external_calendar') order by receipt.id$query$,true,true,'')::text));
  if v_provider_receipt_count=1 then
    v_raw:=jsonb_set(v_raw,'{non_ical_calendar_sources}',
      v_provider_prior->'non_ical_calendar_sources',false);
  end if;
  return v_raw;
end
$function$;

create trigger hotel_partner_property_proposal_foundation_receipts_immutable
before update or delete on public.hotel_partner_property_proposal_foundation_receipts
for each row execute function public.hotel_v2_h3_2b_immutable_row();
insert into public.hotel_partner_property_proposal_foundation_receipts(
  id,original_h3_2b_foundation_fingerprint,proposal_fields_baseline,
  protected_fingerprints,protected_fingerprint,stage2_compatibility_source_hash,
  partner_workspace_source_before_hash,partner_workspace_source_after_hash,
  partner_workspace_lineage_validator_source_hash,provider_source_attribution_source_hash)
select 1,foundation.protected_fingerprint,jsonb_build_object(
    'title',hotel.title,'title_i18n',hotel.title_i18n,
    'description',hotel.description,'description_i18n',hotel.description_i18n,
    'city',hotel.city,'address_line',hotel.address_line,'district',hotel.district,
    'postal_code',hotel.postal_code,'country',hotel.country,
    'latitude',hotel.latitude,'longitude',hotel.longitude,
    'google_maps_url',hotel.google_maps_url,'amenities',hotel.amenities,
    'check_in_from',hotel.check_in_from,'check_out_until',hotel.check_out_until,
    'cover_image_url',hotel.cover_image_url,'photos',hotel.photos,'updated_at',hotel.updated_at),snapshot.value,
  public.hotel_v2_h3_2b_hash(snapshot.value),public.hotel_v2_h3_2b_hash(to_jsonb(
    pg_get_functiondef('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure))),
  activation.compatibility_function_fingerprints->>
    'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
  public.hotel_v2_external_calendar_worker_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure))),
  public.hotel_v2_external_calendar_worker_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_partner_workspace_function_lineage_is_exact()'::regprocedure))),
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure)))
from public.hotel_partner_workspace_foundation_receipts foundation
join hotels_v2_private.hotel_external_calendar_activation_receipts activation on activation.id=foundation.id
join public.hotels hotel on hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
cross join lateral (select public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() value) snapshot
where foundation.id=1;

create function public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
returns boolean language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
declare v_expected jsonb; v_actual jsonb; v_authorized jsonb;
begin
  select receipt.proposal_fields_baseline into v_expected
  from public.hotel_partner_property_proposal_foundation_receipts receipt where receipt.id=1;
  if v_expected is null then return false; end if;
  select activity.after_state->'property' into v_authorized
  from public.hotel_activity_log activity
  cross join public.hotel_partner_property_proposal_foundation_receipts receipt
  where receipt.id=1
    and activity.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    and activity.entity_type='property'
    and activity.source='hotels_v2_admin_b_property_control'
    and activity.created_at>=receipt.created_at
  order by activity.created_at desc,activity.id desc limit 1;
  if v_authorized is not null then
    v_expected:=jsonb_build_object(
      'title',v_authorized->'title','title_i18n',v_authorized->'title_i18n',
      'description',v_authorized->'description','description_i18n',v_authorized->'description_i18n',
      'city',v_authorized->'city','address_line',v_authorized->'address_line',
      'district',v_authorized->'district','postal_code',v_authorized->'postal_code',
      'country',v_authorized->'country','latitude',v_authorized->'latitude',
      'longitude',v_authorized->'longitude','google_maps_url',v_authorized->'google_maps_url',
      'amenities',v_authorized->'amenities','check_in_from',v_authorized->'check_in_from',
      'check_out_until',v_authorized->'check_out_until',
      'cover_image_url',v_authorized->'cover_image_url','photos',v_authorized->'photos',
      'updated_at',v_authorized->'updated_at');
  end if;
  select jsonb_build_object(
    'title',hotel.title,'title_i18n',hotel.title_i18n,
    'description',hotel.description,'description_i18n',hotel.description_i18n,
    'city',hotel.city,'address_line',hotel.address_line,'district',hotel.district,
    'postal_code',hotel.postal_code,'country',hotel.country,
    'latitude',hotel.latitude,'longitude',hotel.longitude,
    'google_maps_url',hotel.google_maps_url,'amenities',hotel.amenities,
    'check_in_from',hotel.check_in_from,'check_out_until',hotel.check_out_until,
    'cover_image_url',hotel.cover_image_url,'photos',hotel.photos,'updated_at',hotel.updated_at)
  into v_actual from public.hotels hotel
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid;
  return v_actual is not null and v_actual is not distinct from v_expected;
end
$function$;

alter table public.hotel_partner_property_proposal_admin_reviews owner to postgres;
alter table public.hotel_partner_property_proposal_admin_transaction_context owner to postgres;
alter table public.hotel_partner_property_proposal_foundation_receipts owner to postgres;
alter function public.hotel_v2_seven_arches_property_proposal_review_guard() owner to postgres;
alter function public.hotel_v2_h3_2b_guard_property_draft() owner to postgres;
alter function public.hotel_v2_h3_2b_property_draft_projection(uuid) owner to postgres;
alter function public.hotel_v2_admin_get_partner_property_proposals(uuid) owner to postgres;
alter function public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb) owner to postgres;
alter function public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid) owner to postgres;
alter function public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() owner to postgres;
alter function public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() owner to postgres;
alter function public.hotel_v2_external_calendar_provider_sources_are_attributable() owner to postgres;
alter function public.hotel_v2_external_calendar_stage2_compatible_fingerprints() owner to postgres;
alter function public.hotel_v2_partner_workspace_function_lineage_is_exact() owner to postgres;

revoke all on function public.hotel_v2_seven_arches_property_proposal_review_guard()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_external_calendar_provider_sources_are_attributable()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_partner_workspace_function_lineage_is_exact()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_2b_property_draft_projection(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_get_partner_property_proposals(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_get_partner_property_proposals(uuid) to authenticated;
grant execute on function public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb) to authenticated;
grant execute on function public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid) to authenticated;

do $proposal_review_postconditions$
declare v_signature text; v_oid oid; v_relation text; v_role text; v_privilege text;
begin
  foreach v_signature in array array[
    'public.hotel_v2_admin_get_partner_property_proposals(uuid)',
    'public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb)',
    'public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)'
  ] loop
    v_oid:=to_regprocedure(v_signature);
    if v_oid is null or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
       or not (select prosecdef from pg_proc where oid=v_oid)
       or (select proconfig from pg_proc where oid=v_oid)
          is distinct from array['search_path=pg_catalog, public, auth']::text[]
       or has_function_privilege(0::oid,v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE')
       or not has_function_privilege('authenticated',v_oid,'EXECUTE') then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_property_proposal_rpc_security_failed',detail=v_signature;
    end if;
  end loop;
  foreach v_signature in array array[
    'public.hotel_v2_seven_arches_property_proposal_review_guard()',
    'public.hotel_v2_h3_2b_guard_property_draft()',
    'public.hotel_v2_h3_2b_property_draft_projection(uuid)',
    'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()',
    'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()',
    'public.hotel_v2_external_calendar_provider_sources_are_attributable()',
    'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()',
    'public.hotel_v2_partner_workspace_function_lineage_is_exact()'
  ] loop
    v_oid:=to_regprocedure(v_signature);
    if v_oid is null or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
       or has_function_privilege(0::oid,v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_property_proposal_helper_security_failed',detail=v_signature;
    end if;
  end loop;
  if exists(select 1 from (values
      ('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()'),
      ('public.hotel_v2_external_calendar_provider_sources_are_attributable()')
    ) expected(signature)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or not procedure.prosecdef
      or procedure.proconfig is distinct from array['search_path=pg_catalog, public']::text[]) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_helper_metadata_failed';
  end if;
  foreach v_relation in array array[
    'hotel_partner_property_drafts','hotel_partner_property_proposal_admin_reviews',
    'hotel_partner_property_proposal_foundation_receipts',
    'hotel_partner_property_proposal_admin_transaction_context'
  ] loop
    foreach v_role in array array['anon','authenticated','service_role'] loop
      foreach v_privilege in array array[
        'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
      ] loop
        if has_table_privilege(v_role,'public.'||v_relation,v_privilege)
           or has_table_privilege(0::oid,'public.'||v_relation,v_privilege) then
          raise exception using errcode='55000',
            message='hotels_v2_seven_arches_property_proposal_raw_acl_failed',
            detail=v_relation||':'||v_role||':'||v_privilege;
        end if;
      end loop;
    end loop;
  end loop;
  if public.hotel_v2_h3_2b_hash(
       public.hotel_v2_seven_arches_property_proposal_protected_fingerprints())
       is distinct from (select protected_fingerprint
         from public.hotel_partner_property_proposal_foundation_receipts where id=1) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_foundation_capture_failed';
  end if;
  if (select stage2_compatibility_source_hash from
       public.hotel_partner_property_proposal_foundation_receipts where id=1)
       is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure))) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_stage2_compatibility_source_drift';
  end if;
  if (select provider_source_attribution_source_hash from
       public.hotel_partner_property_proposal_foundation_receipts where id=1)
       is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure)))
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable() then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_provider_source_attribution_drift';
  end if;
  if not public.hotel_v2_partner_workspace_function_lineage_is_exact() then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_workspace_lineage_invalid';
  end if;
  if (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_foundation_cardinality_failed';
  end if;
  if not public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_canonical_baseline_failed';
  end if;
  if exists(select 1 from public.hotel_partner_property_proposal_admin_transaction_context) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_property_proposal_context_not_empty';
  end if;
end
$proposal_review_postconditions$;

notify pgrst,'reload schema';
commit;
