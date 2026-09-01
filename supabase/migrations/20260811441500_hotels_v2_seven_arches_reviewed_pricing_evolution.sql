begin;

set local lock_timeout='10s';
set local statement_timeout='120s';

-- 114415 is the reviewed-write boundary for the two independent 7 Arches
-- Room schedules installed by 114410.  It does not recreate that topology.
do $seven_arches_reviewed_pricing_dependencies$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
begin
  if to_regclass('public.hotel_seven_arches_independent_pricing_authority') is null
     or to_regclass('public.hotel_seven_arches_independent_pricing_evolution_receipts') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()') is null
     or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or (select count(*) from
       public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or (select count(*) from
       public.hotel_seven_arches_independent_pricing_evolution_receipts)<>1
     or (select count(*) from
       public.hotel_seven_arches_independent_pricing_authority)<>54
     or (select count(*) from public.hotel_pricing_schedules where id in(
       'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
       '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)
       and hotel_id=c_hotel and sharing_mode='independent'
       and is_active and review_status='reviewed')<>2
     or to_regclass('public.hotel_seven_arches_reviewed_pricing_proposals') is not null
     or to_regclass(
       'public.hotel_seven_arches_reviewed_pricing_evolution_receipts') is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_dependency_invalid';
  end if;

  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_partner_preview_pricing_plan(jsonb)'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='v'
       and procedure_row.proconfig=array[
         'search_path=pg_catalog, public, auth']::text[]
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         'c81d165af4482a8f29bead36b63f921574b82670b8ddcf45e7362ec9f83042c3'
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='v'
       and procedure_row.proconfig=array[
         'search_path=pg_catalog, public, auth']::text[]
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         'df217ff359f651193070cf177a56b6d41d9d2d62786854944c2e564e63cc337e'
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='v'
       and procedure_row.proconfig=array[
         'search_path=pg_catalog, public']::text[]
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         'd864f254c257be00491d0c2e508c4b6585e16bf3e35992fa174050d2205a6bf6')
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_independent_pricing_oracle()'::regprocedure
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         'a80c25ec1a2d82cd96ff5c30b48ae7402039a90b548504866a12dc67e6cf6d77')
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         '63165b5cfa3eb9d6ea1043c400b5f1db7f5a650d35716fe7eb175a10c95b51cb')
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='s'
       and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         '38f36103754f4756792fda73f223fccde4b46176c0d031782190a5b567ae11ab')
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='s'
       and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         '860f2f7b4249a8b572780384628f9654f087eb73850d0a8fe37a1e2c7c5781e8')
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='v'
       and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         '03f787a5e00fbbe65bdcaf1a96529512f60775074a1fdf4dcdd04104c7c7d335')
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_external_calendar_protected_fingerprints()'::regprocedure
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_dependency_source_drift';
  end if;
end;
$seven_arches_reviewed_pricing_dependencies$;

lock table public.hotels,
  public.hotel_partner_hotel_permissions,
  public.hotel_pricing_schedules,
  public.hotel_pricing_schedule_occupancy_tiers,
  public.hotel_seven_arches_independent_pricing_authority,
  public.hotel_seven_arches_independent_pricing_topology_receipts,
  public.hotel_seven_arches_independent_pricing_evolution_receipts,
  public.hotel_commission_policies,
  public.hotel_payment_policies,
  public.hotel_payment_policy_terms
in share row exclusive mode;

create temporary table seven_arches_reviewed_pricing_before on commit drop as
select
  current_setting('TimeZone') incoming_timezone,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_partner_preview_pricing_plan(jsonb)'::regprocedure)))
    partner_preview_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'::regprocedure)))
    partner_apply_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure)))
    freeze_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_independent_pricing_oracle()'::regprocedure)))
    phase1_oracle_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure)))
    topology_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure)))
    property_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()'::regprocedure)))
    property_attribution_source_hash,
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure)))
    graph_validator_source_hash,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
    jsonb_build_object('id',tier.id,'schedule_id',tier.schedule_id,
      'guest_count',tier.guest_count,'minimum_nights',tier.threshold_nights,
      'nightly_price',tier.nightly_rate,'active',tier.is_active,
      'version',tier.version)
    order by tier.schedule_id,tier.guest_count,tier.threshold_nights)
    from public.hotel_pricing_schedule_occupancy_tiers tier
    where tier.schedule_id in(
      'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
      '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)),'[]'::jsonb))
    normalized_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
    to_jsonb(authority)-'created_at' order by authority.target_tier_id)
    from public.hotel_seven_arches_independent_pricing_authority authority),'[]'::jsonb))
    authority_fingerprint,
  public.hotel_v2_h3_2b_hash((select hotel.pricing_tiers
    from public.hotels hotel
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid))
    legacy_fingerprint,
  public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
    to_jsonb(policy)-array['created_at','updated_at'] order by policy.id)
    from public.hotel_commission_policies policy
    where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb))
    commission_fingerprint,
  public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'policies',coalesce((select jsonb_agg(
      to_jsonb(policy)-array['created_at','updated_at'] order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'terms',coalesce((select jsonb_agg(
      to_jsonb(term)-array['created_at','updated_at'] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy
        on policy.id=term.payment_policy_id
      where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb)))
    payment_fingerprint,
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
    phase1_property_fingerprints,
  public.hotel_v2_h3_2b_hash((select jsonb_set(to_jsonb(receipt),'{created_at}',
    to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
    from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
    where receipt.id=1)) phase1_receipt_fingerprint;

create table public.hotel_seven_arches_reviewed_pricing_proposals(
  id uuid primary key default gen_random_uuid(),
  contract_version text not null check(contract_version=
    'hotels_v2_seven_arches_reviewed_pricing_proposal_v1'),
  hotel_id uuid not null check(
    hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
    references public.hotels(id) on delete restrict,
  initiator_type text not null check(initiator_type in('partner','admin')),
  partner_id uuid references public.partners(id) on delete restrict,
  assignment_id uuid,
  actor_id uuid not null,
  status text not null check(status in(
    'pending_admin_review','accepted','rejected')),
  version bigint not null default 1 check(version>0),
  assignment_version bigint,
  access_snapshot_token text,
  pricing_snapshot_token text,
  evolution_snapshot_token text not null
    check(evolution_snapshot_token~'^[0-9a-f]{64}$'),
  reason text not null check(reason=btrim(reason)
    and char_length(reason) between 3 and 500 and reason!~'[[:cntrl:]]'),
  reason_fingerprint text not null check(reason_fingerprint~'^[0-9a-f]{64}$'),
  item_count integer not null check(item_count between 1 and 54),
  plan_fingerprint text not null check(plan_fingerprint~'^[0-9a-f]{64}$'),
  submit_correlation_id uuid not null unique,
  submit_idempotency_key uuid not null,
  submit_result jsonb not null check(jsonb_typeof(submit_result)='object'),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_review_id uuid,
  consumed_correlation_id uuid,
  check(expires_at=created_at+interval '30 minutes'),
  check((initiator_type='partner' and partner_id is not null
      and assignment_id is not null and assignment_version is not null
      and access_snapshot_token is not null and pricing_snapshot_token is not null)
    or (initiator_type='admin' and partner_id is null and assignment_id is null
      and assignment_version is null and access_snapshot_token is null
      and pricing_snapshot_token is null)),
  check((status='pending_admin_review' and consumed_at is null
      and consumed_review_id is null and consumed_correlation_id is null)
    or (status in('accepted','rejected') and consumed_at is not null
      and consumed_review_id is not null and consumed_correlation_id is not null)),
  unique(actor_id,submit_idempotency_key),
  foreign key(assignment_id,partner_id,hotel_id)
    references public.hotel_partner_hotel_permissions(
      assignment_id,partner_id,hotel_id) on delete restrict
);

create unique index hotel_7a_reviewed_pricing_one_pending_assignment_uidx
  on public.hotel_seven_arches_reviewed_pricing_proposals(assignment_id)
  where status='pending_admin_review' and assignment_id is not null;

create table public.hotel_seven_arches_reviewed_pricing_proposal_items(
  proposal_id uuid not null references
    public.hotel_seven_arches_reviewed_pricing_proposals(id) on delete restrict,
  item_index smallint not null check(item_index between 1 and 54),
  hotel_id uuid not null check(
    hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  room_key text not null check(room_key in('upper','ground')),
  room_type_id uuid not null references public.hotel_room_types(id) on delete restrict,
  room_rate_id uuid not null references public.hotel_room_rates(id) on delete restrict,
  pricing_schedule_id uuid not null
    references public.hotel_pricing_schedules(id) on delete restrict,
  schedule_tier_id uuid not null
    references public.hotel_pricing_schedule_occupancy_tiers(id) on delete restrict,
  guest_count smallint not null check(guest_count between 2 and 4),
  minimum_nights integer not null check(minimum_nights between 2 and 10),
  currency text not null check(currency='EUR'),
  before_price numeric(12,2) not null check(before_price>=0),
  requested_price numeric(12,2) not null check(requested_price>=10),
  before_tier_version bigint not null check(before_tier_version>0),
  primary key(proposal_id,item_index),
  unique(proposal_id,schedule_tier_id),
  unique(proposal_id,room_key,guest_count,minimum_nights),
  check(before_price<>requested_price),
  check((room_key='upper'
      and room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
      and room_rate_id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
      and pricing_schedule_id='aec20731-7a56-35f0-334e-92b363351f02'::uuid)
    or (room_key='ground'
      and room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
      and room_rate_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
      and pricing_schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid))
);

create table public.hotel_seven_arches_reviewed_pricing_admin_reviews(
  id uuid primary key default gen_random_uuid(),
  contract_version text not null check(contract_version=
    'hotels_v2_seven_arches_reviewed_pricing_admin_review_v1'),
  hotel_id uuid not null check(
    hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  proposal_id uuid not null references
    public.hotel_seven_arches_reviewed_pricing_proposals(id) on delete restrict,
  proposal_version bigint not null check(proposal_version>0),
  actor_id uuid not null,
  action text not null check(action in('accept','reject')),
  reason text not null check(reason=btrim(reason)
    and char_length(reason) between 3 and 500 and reason!~'[[:cntrl:]]'),
  reviewed_plan jsonb not null check(jsonb_typeof(reviewed_plan)='object'),
  plan_fingerprint text not null check(plan_fingerprint~'^[0-9a-f]{64}$'),
  reviewed_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_correlation_id uuid unique,
  consumed_idempotency_key uuid,
  result jsonb check(result is null or jsonb_typeof(result)='object'),
  check(expires_at=reviewed_at+interval '30 minutes'),
  check((consumed_at is null and consumed_correlation_id is null
      and consumed_idempotency_key is null and result is null)
    or (consumed_at is not null and consumed_correlation_id is not null
      and consumed_idempotency_key is not null and result is not null)),
  unique(actor_id,consumed_idempotency_key)
);

alter table public.hotel_seven_arches_reviewed_pricing_proposals
  add constraint hotel_7a_reviewed_pricing_consumed_review_fk
  foreign key(consumed_review_id) references
    public.hotel_seven_arches_reviewed_pricing_admin_reviews(id) on delete restrict;

create unique index hotel_7a_reviewed_pricing_one_open_review_uidx
  on public.hotel_seven_arches_reviewed_pricing_admin_reviews(proposal_id)
  where consumed_at is null;

create table public.hotel_seven_arches_reviewed_pricing_transaction_context(
  backend_pid integer not null,
  transaction_id bigint not null,
  review_id uuid not null references
    public.hotel_seven_arches_reviewed_pricing_admin_reviews(id) on delete restrict,
  proposal_id uuid not null references
    public.hotel_seven_arches_reviewed_pricing_proposals(id) on delete restrict,
  actor_id uuid not null,
  correlation_id uuid not null,
  idempotency_key uuid not null,
  receipt_sequence bigint not null check(receipt_sequence>0),
  selected_tier_ids uuid[] not null check(cardinality(selected_tier_ids) between 1 and 54),
  created_at timestamptz not null default clock_timestamp(),
  primary key(backend_pid,transaction_id),
  unique(review_id),
  unique(correlation_id)
);

create table public.hotel_seven_arches_reviewed_pricing_foundation_receipts(
  id smallint primary key check(id=1),
  contract_version text not null check(contract_version=
    'hotels_v2_seven_arches_reviewed_pricing_foundation_v1'),
  hotel_id uuid not null check(
    hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  phase1_receipt_fingerprint text not null check(phase1_receipt_fingerprint~'^[0-9a-f]{64}$'),
  initial_normalized_fingerprint text not null check(initial_normalized_fingerprint~'^[0-9a-f]{64}$'),
  initial_authority_fingerprint text not null check(initial_authority_fingerprint~'^[0-9a-f]{64}$'),
  initial_reviewed_authority_fingerprint text not null
    check(initial_reviewed_authority_fingerprint~'^[0-9a-f]{64}$'),
  initial_legacy_fingerprint text not null check(initial_legacy_fingerprint~'^[0-9a-f]{64}$'),
  initial_reviewed_oracle_fingerprint text not null
    check(initial_reviewed_oracle_fingerprint~'^[0-9a-f]{32}$'),
  initial_unrelated_fingerprint text not null
    check(initial_unrelated_fingerprint~'^[0-9a-f]{64}$'),
  commission_fingerprint text not null check(commission_fingerprint~'^[0-9a-f]{64}$'),
  payment_fingerprint text not null check(payment_fingerprint~'^[0-9a-f]{64}$'),
  phase1_property_fingerprints jsonb not null
    check(jsonb_typeof(phase1_property_fingerprints)='object'),
  phase1_property_fingerprint text not null
    check(phase1_property_fingerprint~'^[0-9a-f]{64}$'),
  partner_preview_source_before_hash text not null check(partner_preview_source_before_hash~'^[0-9a-f]{64}$'),
  partner_preview_source_after_hash text not null check(partner_preview_source_after_hash~'^[0-9a-f]{64}$'),
  partner_apply_source_before_hash text not null check(partner_apply_source_before_hash~'^[0-9a-f]{64}$'),
  partner_apply_source_after_hash text not null check(partner_apply_source_after_hash~'^[0-9a-f]{64}$'),
  freeze_source_before_hash text not null check(freeze_source_before_hash~'^[0-9a-f]{64}$'),
  freeze_source_after_hash text not null check(freeze_source_after_hash~'^[0-9a-f]{64}$'),
  phase1_oracle_source_hash text not null check(phase1_oracle_source_hash~'^[0-9a-f]{64}$'),
  reviewed_oracle_source_hash text not null check(reviewed_oracle_source_hash~'^[0-9a-f]{64}$'),
  topology_source_before_hash text not null check(topology_source_before_hash~'^[0-9a-f]{64}$'),
  topology_source_after_hash text not null check(topology_source_after_hash~'^[0-9a-f]{64}$'),
  property_source_before_hash text not null check(property_source_before_hash~'^[0-9a-f]{64}$'),
  property_source_after_hash text not null check(property_source_after_hash~'^[0-9a-f]{64}$'),
  external_helper_source_hash text not null check(external_helper_source_hash=
    'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'),
  genesis_hash text not null check(genesis_hash~'^[0-9a-f]{64}$'),
  catalog_fingerprint text not null check(catalog_fingerprint~'^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  foundation_fingerprint text not null check(foundation_fingerprint~'^[0-9a-f]{64}$'),
  check(partner_preview_source_before_hash<>partner_preview_source_after_hash),
  check(partner_apply_source_before_hash<>partner_apply_source_after_hash),
  check(freeze_source_before_hash<>freeze_source_after_hash),
  check(topology_source_before_hash<>topology_source_after_hash),
  check(property_source_before_hash<>property_source_after_hash)
);

create table public.hotel_seven_arches_reviewed_pricing_evolution_receipts(
  sequence_no bigint primary key check(sequence_no>0),
  id uuid not null unique,
  contract_version text not null check(contract_version=
    'hotels_v2_seven_arches_reviewed_pricing_evolution_receipt_v1'),
  previous_receipt_hash text not null check(previous_receipt_hash~'^[0-9a-f]{64}$'),
  receipt_hash text not null unique check(receipt_hash~'^[0-9a-f]{64}$'),
  hotel_id uuid not null check(
    hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  proposal_id uuid not null unique references
    public.hotel_seven_arches_reviewed_pricing_proposals(id) on delete restrict,
  review_id uuid not null unique references
    public.hotel_seven_arches_reviewed_pricing_admin_reviews(id) on delete restrict,
  initiator_type text not null check(initiator_type in('partner','admin')),
  partner_id uuid,
  assignment_id uuid,
  actor_id uuid not null,
  correlation_id uuid not null unique,
  idempotency_key uuid not null,
  changed_items jsonb not null check(jsonb_typeof(changed_items)='array'
    and jsonb_array_length(changed_items) between 1 and 54),
  changed_tier_ids uuid[] not null check(cardinality(changed_tier_ids) between 1 and 54),
  changed_room_keys text[] not null check(changed_room_keys<@array['upper','ground']::text[]
    and cardinality(changed_room_keys) between 1 and 2),
  normalized_before_fingerprint text not null check(normalized_before_fingerprint~'^[0-9a-f]{64}$'),
  normalized_after_fingerprint text not null check(normalized_after_fingerprint~'^[0-9a-f]{64}$'),
  authority_before_fingerprint text not null check(authority_before_fingerprint~'^[0-9a-f]{64}$'),
  authority_after_fingerprint text not null check(authority_after_fingerprint~'^[0-9a-f]{64}$'),
  legacy_before_fingerprint text not null check(legacy_before_fingerprint~'^[0-9a-f]{64}$'),
  legacy_after_fingerprint text not null check(legacy_after_fingerprint~'^[0-9a-f]{64}$'),
  parity_before_fingerprint text not null check(parity_before_fingerprint~'^[0-9a-f]{32}$'),
  parity_after_fingerprint text not null check(parity_after_fingerprint~'^[0-9a-f]{32}$'),
  commission_fingerprint text not null check(commission_fingerprint~'^[0-9a-f]{64}$'),
  payment_fingerprint text not null check(payment_fingerprint~'^[0-9a-f]{64}$'),
  unrelated_before_fingerprint text not null check(unrelated_before_fingerprint~'^[0-9a-f]{64}$'),
  unrelated_after_fingerprint text not null check(unrelated_after_fingerprint~'^[0-9a-f]{64}$'),
  untouched_room_key text check(untouched_room_key in('upper','ground')),
  untouched_room_before_fingerprint text check(untouched_room_before_fingerprint is null
    or untouched_room_before_fingerprint~'^[0-9a-f]{64}$'),
  untouched_room_after_fingerprint text check(untouched_room_after_fingerprint is null
    or untouched_room_after_fingerprint~'^[0-9a-f]{64}$'),
  allowed_changed_keys text[] not null check(allowed_changed_keys=array[
    'hotel_pricing_schedule_occupancy_tiers',
    'hotel_seven_arches_independent_pricing_authority',
    'hotels.pricing_tiers','hotel_activity_log',
    'hotel_seven_arches_reviewed_pricing_workflow']::text[]),
  reason_fingerprint text not null check(reason_fingerprint~'^[0-9a-f]{64}$'),
  activity_ids uuid[] not null check(cardinality(activity_ids)>=1),
  created_at timestamptz not null,
  check((untouched_room_key is null and untouched_room_before_fingerprint is null
      and untouched_room_after_fingerprint is null)
    or (untouched_room_key is not null
      and untouched_room_before_fingerprint=untouched_room_after_fingerprint)),
  check(commission_fingerprint is not null and payment_fingerprint is not null),
  check(unrelated_before_fingerprint=unrelated_after_fingerprint),
  unique(actor_id,idempotency_key)
);

alter table public.hotel_seven_arches_reviewed_pricing_proposals enable row level security;
alter table public.hotel_seven_arches_reviewed_pricing_proposal_items enable row level security;
alter table public.hotel_seven_arches_reviewed_pricing_admin_reviews enable row level security;
alter table public.hotel_seven_arches_reviewed_pricing_transaction_context enable row level security;
alter table public.hotel_seven_arches_reviewed_pricing_foundation_receipts enable row level security;
alter table public.hotel_seven_arches_reviewed_pricing_evolution_receipts enable row level security;

revoke all on table public.hotel_seven_arches_reviewed_pricing_proposals,
  public.hotel_seven_arches_reviewed_pricing_proposal_items,
  public.hotel_seven_arches_reviewed_pricing_admin_reviews,
  public.hotel_seven_arches_reviewed_pricing_transaction_context,
  public.hotel_seven_arches_reviewed_pricing_foundation_receipts,
  public.hotel_seven_arches_reviewed_pricing_evolution_receipts
from public,anon,authenticated,service_role;

drop trigger hotel_seven_arches_independent_pricing_authority_immutable
  on public.hotel_seven_arches_independent_pricing_authority;

alter table public.hotel_seven_arches_independent_pricing_authority
  add column current_nightly_rate numeric(12,2),
  add column current_target_version bigint,
  add column current_receipt_sequence bigint,
  add column updated_at timestamptz;

update public.hotel_seven_arches_independent_pricing_authority authority set
  current_nightly_rate=authority.initial_nightly_rate,
  current_target_version=authority.target_initial_version,
  current_receipt_sequence=0,
  updated_at=authority.created_at;

alter table public.hotel_seven_arches_independent_pricing_authority
  alter column current_nightly_rate set not null,
  alter column current_target_version set not null,
  alter column current_receipt_sequence set not null,
  alter column updated_at set not null,
  add constraint hotel_7a_independent_authority_current_rate_check
    check(current_nightly_rate>=10),
  add constraint hotel_7a_independent_authority_current_version_check
    check(current_target_version>=target_initial_version),
  add constraint hotel_7a_independent_authority_receipt_sequence_check
    check(current_receipt_sequence>=0),
  add constraint hotel_7a_independent_authority_updated_at_check
    check(updated_at>=created_at);

create function public.hotel_v2_seven_arches_reviewed_pricing_proposal_guard()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_context public.hotel_seven_arches_reviewed_pricing_transaction_context%rowtype;
begin
  if tg_op='DELETE' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_proposal_delete_forbidden';
  end if;
  if tg_op='INSERT' then
    if new.status<>'pending_admin_review' or new.version<>1
       or new.created_at is null or not isfinite(new.created_at)
       or new.expires_at is null or not isfinite(new.expires_at)
       or new.expires_at<=statement_timestamp()
       or new.reason_fingerprint<>public.hotel_v2_h3_2b_hash(
         jsonb_build_object('reason',new.reason))
       or new.initiator_type='partner' and not exists(
         select 1 from public.hotel_partner_hotel_permissions permission
         where permission.assignment_id=new.assignment_id
           and permission.partner_id=new.partner_id
           and permission.hotel_id=new.hotel_id
           and permission.manage_prices
           and permission.version=new.assignment_version) then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_reviewed_pricing_proposal_insert_invalid';
    end if;
    return new;
  end if;
  select * into v_context
  from public.hotel_seven_arches_reviewed_pricing_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current()
    and context_row.proposal_id=old.id
    and context_row.review_id=new.consumed_review_id
    and context_row.correlation_id=new.consumed_correlation_id;
  if v_context.review_id is null
     or old.status<>'pending_admin_review'
     or new.status not in('accepted','rejected')
     or new.version<>old.version+1
     or new.id<>old.id or new.hotel_id<>old.hotel_id
     or new.initiator_type<>old.initiator_type
     or new.partner_id is distinct from old.partner_id
     or new.assignment_id is distinct from old.assignment_id
     or new.actor_id<>old.actor_id
     or new.assignment_version is distinct from old.assignment_version
     or new.access_snapshot_token is distinct from old.access_snapshot_token
     or new.pricing_snapshot_token is distinct from old.pricing_snapshot_token
     or new.evolution_snapshot_token<>old.evolution_snapshot_token
     or new.reason<>old.reason or new.reason_fingerprint<>old.reason_fingerprint
     or new.item_count<>old.item_count or new.plan_fingerprint<>old.plan_fingerprint
     or new.submit_correlation_id<>old.submit_correlation_id
     or new.submit_idempotency_key<>old.submit_idempotency_key
     or new.submit_result<>old.submit_result
     or new.created_at<>old.created_at or new.expires_at<>old.expires_at
     or new.consumed_at is null or not isfinite(new.consumed_at)
     or new.consumed_at<old.created_at
     or new.consumed_review_id<>v_context.review_id
     or new.consumed_correlation_id<>v_context.correlation_id
     or new.status<>(case (select review.action
       from public.hotel_seven_arches_reviewed_pricing_admin_reviews review
       where review.id=v_context.review_id)
         when 'accept' then 'accepted' else 'rejected' end) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_proposal_transition_invalid';
  end if;
  return new;
end;
$function$;

create function public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(
  p_proposal_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog,public
as $function$
select coalesce((select case proposal.initiator_type
  when 'admin' then proposal.partner_id is null
    and proposal.assignment_id is null and proposal.assignment_version is null
    and proposal.access_snapshot_token is null
  else exists(select 1
    from public.hotel_partner_hotel_permissions permission
    join public.partner_resources assignment
      on assignment.id=permission.assignment_id
      and assignment.partner_id=permission.partner_id
      and assignment.resource_type='hotels'
      and assignment.resource_id=permission.hotel_id
    join public.partner_users membership
      on membership.partner_id=permission.partner_id
      and membership.user_id=proposal.actor_id
      and membership.role in('owner','staff')
    join public.partners partner on partner.id=membership.partner_id
      and partner.status='active' and partner.can_manage_hotels
    where permission.assignment_id=proposal.assignment_id
      and permission.partner_id=proposal.partner_id
      and permission.hotel_id=proposal.hotel_id
      and permission.manage_prices and permission.has_mutation_capability
      and permission.version=proposal.assignment_version
      and (membership.role='owner' or exists(select 1
        from public.partner_user_resources scope
        where scope.partner_user_id=membership.id
          and scope.resource_type='hotels'
          and scope.resource_id=proposal.hotel_id))
      and proposal.access_snapshot_token=public.hotel_v2_h3_2b_hash(
        jsonb_build_object(
          'assignment_id',permission.assignment_id,'role',membership.role,
          'permission_version',permission.version,
          'has_mutation_capability',permission.has_mutation_capability,
          'capabilities',jsonb_build_object(
            'edit_property_content',permission.edit_property_content,
            'edit_property_photos',permission.edit_property_photos,
            'edit_room_content',permission.edit_room_content,
            'edit_room_photos',permission.edit_room_photos,
            'create_rooms',permission.create_rooms,
            'edit_room_structure',permission.edit_room_structure,
            'manage_prices',permission.manage_prices,
            'manage_availability',permission.manage_availability,
            'process_bookings',permission.process_bookings,
            'request_booking_changes',permission.request_booking_changes,
            'view_payment_status',permission.view_payment_status,
            'initiate_stripe_onboarding',permission.initiate_stripe_onboarding))))
  end
  from public.hotel_seven_arches_reviewed_pricing_proposals proposal
  where proposal.id=p_proposal_id),false);
$function$;

-- Pricing evolution updates hotels.pricing_tiers and therefore the generic
-- hotels updated_at column.  Re-prove the complete reviewed property payload
-- without treating that incidental timestamp as a property-content change.
-- The accepted canonical-attribution implementation remains source-pinned and
-- unchanged; this is the narrow successor representation bridge.
create function public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare v_expected jsonb; v_actual jsonb; v_authorized jsonb;
begin
  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='s'
       and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
       and encode(extensions.digest(convert_to(
         procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         '860f2f7b4249a8b572780384628f9654f087eb73850d0a8fe37a1e2c7c5781e8'
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return false;
  end if;
  select receipt.proposal_fields_baseline-'updated_at' into v_expected
  from public.hotel_partner_property_proposal_foundation_receipts receipt
  where receipt.id=1;
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
      'description',v_authorized->'description',
      'description_i18n',v_authorized->'description_i18n',
      'city',v_authorized->'city','address_line',v_authorized->'address_line',
      'district',v_authorized->'district','postal_code',v_authorized->'postal_code',
      'country',v_authorized->'country','latitude',v_authorized->'latitude',
      'longitude',v_authorized->'longitude',
      'google_maps_url',v_authorized->'google_maps_url',
      'amenities',v_authorized->'amenities','check_in_from',v_authorized->'check_in_from',
      'check_out_until',v_authorized->'check_out_until',
      'cover_image_url',v_authorized->'cover_image_url','photos',v_authorized->'photos');
  end if;
  select jsonb_build_object(
    'title',hotel.title,'title_i18n',hotel.title_i18n,
    'description',hotel.description,'description_i18n',hotel.description_i18n,
    'city',hotel.city,'address_line',hotel.address_line,'district',hotel.district,
    'postal_code',hotel.postal_code,'country',hotel.country,
    'latitude',hotel.latitude,'longitude',hotel.longitude,
    'google_maps_url',hotel.google_maps_url,'amenities',hotel.amenities,
    'check_in_from',hotel.check_in_from,'check_out_until',hotel.check_out_until,
    'cover_image_url',hotel.cover_image_url,'photos',hotel.photos)
  into v_actual from public.hotels hotel
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid;
  return v_actual is not null and v_actual is not distinct from v_expected;
exception when no_data_found or too_many_rows then
  return false;
end;
$function$;

-- JSON transports may serialize the same PostgreSQL numeric as 100, 100.0,
-- or 100.00.  Canonicalize only the known monetary leaves before hashing so
-- a reviewed plan remains byte-stable across PostgREST without weakening any
-- identity, lineage, reason, token, item, or timestamp binding.
create function public.hotel_v2_7a_reviewed_pricing_plan_fingerprint(p_plan jsonb)
returns text language plpgsql immutable security definer
set search_path=pg_catalog,public
as $function$
declare v_result jsonb; v_array_name text; v_money_key text;
  v_item jsonb; v_array jsonb;
begin
  if p_plan is null or jsonb_typeof(p_plan)<>'object' then return null; end if;
  v_result:=p_plan-'plan_fingerprint';
  foreach v_array_name in array array['items','canonical_items','commercial_impacts'] loop
    if v_result?v_array_name then
      if jsonb_typeof(v_result->v_array_name)<>'array' then return null; end if;
      v_array:='[]'::jsonb;
      for v_item in select value from jsonb_array_elements(v_result->v_array_name) loop
        if jsonb_typeof(v_item)<>'object' then return null; end if;
        foreach v_money_key in array array['before_price','requested_price',
          'customer_before','customer_after','cypruseye_commission',
          'partner_net_before','partner_net_after'] loop
          if v_item?v_money_key then
            if jsonb_typeof(v_item->v_money_key)<>'number' then return null; end if;
            v_item:=jsonb_set(v_item,array[v_money_key],to_jsonb(to_char(
              (v_item->>v_money_key)::numeric,'FM999999999999990.00')),false);
          end if;
        end loop;
        v_array:=v_array||jsonb_build_array(v_item);
      end loop;
      v_result:=jsonb_set(v_result,array[v_array_name],v_array,false);
    end if;
  end loop;
  if v_result?'commission_policy' then
    if jsonb_typeof(v_result->'commission_policy')<>'object'
       or jsonb_typeof(v_result#>'{commission_policy,amount}')<>'number' then
      return null;
    end if;
    v_result:=jsonb_set(v_result,'{commission_policy,amount}',to_jsonb(to_char(
      (v_result#>>'{commission_policy,amount}')::numeric,
      'FM999999999999990.00')),false);
  end if;
  return public.hotel_v2_h3_2b_hash(v_result);
exception when invalid_text_representation or numeric_value_out_of_range then
  return null;
end;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()
returns text language sql stable security definer
set search_path=pg_catalog,public
as $function$
select public.hotel_v2_h3_2b_hash(jsonb_build_object(
  'contract_version','hotels_v2_seven_arches_reviewed_pricing_catalog_v1',
  'relations',(select coalesce(jsonb_agg(jsonb_build_object(
    'name',relation.oid::regclass::text,'owner',relation.relowner::regrole::text,
    'kind',relation.relkind,'persistence',relation.relpersistence,
    'rls',relation.relrowsecurity,'force_rls',relation.relforcerowsecurity,
    'acl',to_jsonb(relation.relacl),
    'columns',coalesce((select jsonb_agg(jsonb_build_object(
      'number',attribute.attnum,'name',attribute.attname,
      'type',format_type(attribute.atttypid,attribute.atttypmod),
      'not_null',attribute.attnotnull,'identity',attribute.attidentity,
      'generated',attribute.attgenerated,
      'default',pg_get_expr(default_row.adbin,default_row.adrelid))
      order by attribute.attnum) from pg_attribute attribute
      left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
        and default_row.adnum=attribute.attnum
      where attribute.attrelid=relation.oid and attribute.attnum>0
        and not attribute.attisdropped),'[]'::jsonb),
    'constraints',coalesce((select jsonb_agg(jsonb_build_object(
      'name',constraint_row.conname,'type',constraint_row.contype,
      'key',constraint_row.conkey,'foreign_relation',case
        when constraint_row.confrelid=0 then null
        else constraint_row.confrelid::regclass::text end,
      'foreign_key',constraint_row.confkey,
      'deferrable',constraint_row.condeferrable,
      'initially_deferred',constraint_row.condeferred,
      'validated',constraint_row.convalidated,
      'no_inherit',constraint_row.connoinherit,
      'expression',pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
      'definition',pg_get_constraintdef(constraint_row.oid))
      order by constraint_row.conname) from pg_constraint constraint_row
      where constraint_row.conrelid=relation.oid),'[]'::jsonb),
    'policies',coalesce((select jsonb_agg(jsonb_build_object(
      'name',policy.polname,'command',policy.polcmd,
      'permissive',policy.polpermissive,'roles',policy.polroles,
      'qual',pg_get_expr(policy.polqual,policy.polrelid),
      'with_check',pg_get_expr(policy.polwithcheck,policy.polrelid))
      order by policy.polname) from pg_policy policy
      where policy.polrelid=relation.oid),'[]'::jsonb),
    'triggers',coalesce((select jsonb_agg(jsonb_build_object(
      'name',trigger_row.tgname,'function',trigger_row.tgfoid::regprocedure::text,
      'type',trigger_row.tgtype,'enabled',trigger_row.tgenabled,
      'deferrable',trigger_row.tgdeferrable,
      'initially_deferred',trigger_row.tginitdeferred)
      order by trigger_row.tgname) from pg_trigger trigger_row
      where trigger_row.tgrelid=relation.oid and not trigger_row.tgisinternal),
      '[]'::jsonb))
    order by relation.oid::regclass::text),'[]'::jsonb)
    from pg_class relation where relation.oid in(
      'public.hotel_seven_arches_reviewed_pricing_proposals'::regclass,
      'public.hotel_seven_arches_reviewed_pricing_proposal_items'::regclass,
      'public.hotel_seven_arches_reviewed_pricing_admin_reviews'::regclass,
      'public.hotel_seven_arches_reviewed_pricing_transaction_context'::regclass,
      'public.hotel_seven_arches_reviewed_pricing_foundation_receipts'::regclass,
      'public.hotel_seven_arches_reviewed_pricing_evolution_receipts'::regclass,
      'public.hotel_seven_arches_independent_pricing_authority'::regclass,
      'public.hotel_seven_arches_independent_pricing_topology_receipts'::regclass,
      'public.hotel_seven_arches_independent_pricing_evolution_receipts'::regclass)),
  'functions',(select coalesce(jsonb_agg(jsonb_build_object(
    'signature',procedure_row.oid::regprocedure::text,
    'owner',procedure_row.proowner::regrole::text,'language',language.lanname,
    'volatility',procedure_row.provolatile,'security_definer',procedure_row.prosecdef,
    'config',procedure_row.proconfig,'acl',to_jsonb(procedure_row.proacl),
    'public_execute',has_function_privilege(0::oid,procedure_row.oid,'EXECUTE'),
    'anon_execute',has_function_privilege('anon',procedure_row.oid,'EXECUTE'),
    'authenticated_execute',has_function_privilege(
      'authenticated',procedure_row.oid,'EXECUTE'),
    'service_execute',has_function_privilege('service_role',procedure_row.oid,'EXECUTE'),
    'source_hash',public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(procedure_row.oid))))
    order by procedure_row.oid::regprocedure::text),'[]'::jsonb)
    from pg_proc procedure_row join pg_language language on language.oid=procedure_row.prolang
    where procedure_row.oid in(
      to_regprocedure('public.hotel_v2_partner_preview_seven_arches_pricing_proposal(jsonb)'),
      to_regprocedure('public.hotel_v2_partner_submit_seven_arches_pricing_proposal(jsonb,uuid,uuid)'),
      to_regprocedure('public.hotel_v2_admin_get_seven_arches_reviewed_pricing()'),
      to_regprocedure('public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(jsonb)'),
      to_regprocedure('public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(jsonb,uuid,uuid)'),
      to_regprocedure('public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(uuid)'),
      to_regprocedure('public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()'),
      to_regprocedure('public.hotel_v2_7a_reviewed_pricing_plan_fingerprint(jsonb)'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_proposal_guard()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_item_guard()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_review_guard()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_context_guard()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_authority_guard()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_legacy_guard()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_receipt_guard()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_foundation_guard()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_oracle()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_current_state()'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_build_plan(jsonb,text)'),
      to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()'),
      'public.hotel_v2_partner_preview_pricing_plan(jsonb)'::regprocedure,
      'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'::regprocedure,
      to_regprocedure('public.hotel_v2_partner_preview_pricing_plan_legacy_core(jsonb)'),
      to_regprocedure('public.hotel_v2_partner_apply_pricing_plan_legacy_core(jsonb,uuid,uuid)'),
      'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure,
      'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure,
      'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure,
      'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'::regprocedure,
      'public.hotel_v2_external_calendar_protected_fingerprints()'::regprocedure))));
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_source constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  v_foundation public.hotel_seven_arches_reviewed_pricing_foundation_receipts%rowtype;
  v_receipt public.hotel_seven_arches_reviewed_pricing_evolution_receipts%rowtype;
  v_state jsonb; v_previous text; v_expected_sequence bigint:=1;
  v_receipt_count integer; v_phase1 record;
begin
  if (select count(*) from public.hotel_seven_arches_reviewed_pricing_foundation_receipts)<>1
     or exists(select 1
       from public.hotel_seven_arches_reviewed_pricing_transaction_context)
     or (select count(*) from public.hotel_seven_arches_independent_pricing_authority)<>54
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id='aec20731-7a56-35f0-334e-92b363351f02'::uuid)<>27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)<>27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id=c_source)<>27
     or (select count(*) from public.hotel_pricing_schedules schedule
       where schedule.id in(
         'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
         '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)
       and schedule.hotel_id=c_hotel and schedule.sharing_mode='independent'
       and schedule.is_active and schedule.review_status='reviewed')<>2
     or not exists(select 1 from public.hotel_room_rates rate
       where rate.id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
         and rate.room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
         and rate.pricing_schedule_id=
           'aec20731-7a56-35f0-334e-92b363351f02'::uuid)
     or not exists(select 1 from public.hotel_room_rates rate
       where rate.id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
         and rate.room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
         and rate.pricing_schedule_id=
           '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid) then
    raise notice 'REVIEWED_PRICING_CHAIN_FAIL:BASE_TOPOLOGY';
    return false;
  end if;
  select * into strict v_foundation
  from public.hotel_seven_arches_reviewed_pricing_foundation_receipts where id=1;
  if v_foundation.created_at is null or not isfinite(v_foundation.created_at)
     or v_foundation.phase1_receipt_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash((select jsonb_set(to_jsonb(receipt),'{created_at}',
         to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
         from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
         where receipt.id=1))
     or v_foundation.phase1_property_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_foundation.phase1_property_fingerprints)
     or v_foundation.external_helper_source_hash is distinct from
       'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'
     or v_foundation.external_helper_source_hash is distinct from
       encode(extensions.digest(convert_to((select procedure_row.prosrc
         from pg_proc procedure_row where procedure_row.oid=
           'public.hotel_v2_external_calendar_protected_fingerprints()'::regprocedure),
         'UTF8'),'sha256'),'hex')
     or v_foundation.phase1_oracle_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_independent_pricing_oracle()'::regprocedure)))
     or v_foundation.reviewed_oracle_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_reviewed_pricing_oracle()'::regprocedure)))
     or v_foundation.partner_preview_source_after_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_partner_preview_pricing_plan(jsonb)'::regprocedure)))
     or v_foundation.partner_apply_source_after_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'::regprocedure)))
     or v_foundation.freeze_source_after_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure)))
     or v_foundation.topology_source_after_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure)))
     or v_foundation.property_source_after_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure)))
     or v_foundation.catalog_fingerprint is distinct from
       public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()
     or v_foundation.foundation_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(jsonb_set(
         to_jsonb(v_foundation)-'foundation_fingerprint','{created_at}',
         to_jsonb((extract(epoch from v_foundation.created_at)*1000000)::bigint),false)) then
    raise notice 'REVIEWED_PRICING_CHAIN_FAIL:FOUNDATION:%',jsonb_build_object(
      'created',v_foundation.created_at is not null and isfinite(v_foundation.created_at),
      'phase1_receipt',v_foundation.phase1_receipt_fingerprint is not distinct from
        public.hotel_v2_h3_2b_hash((select jsonb_set(to_jsonb(receipt),'{created_at}',
          to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
          from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
          where receipt.id=1)),
      'property_hash',v_foundation.phase1_property_fingerprint is not distinct from
        public.hotel_v2_h3_2b_hash(v_foundation.phase1_property_fingerprints),
      'external_live',v_foundation.external_helper_source_hash is not distinct from
        encode(extensions.digest(convert_to((select procedure_row.prosrc
          from pg_proc procedure_row where procedure_row.oid=
            'public.hotel_v2_external_calendar_protected_fingerprints()'::regprocedure),
          'UTF8'),'sha256'),'hex'),
      'phase1_oracle',v_foundation.phase1_oracle_source_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_independent_pricing_oracle()'::regprocedure))),
      'reviewed_oracle',v_foundation.reviewed_oracle_source_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_reviewed_pricing_oracle()'::regprocedure))),
      'partner_preview',v_foundation.partner_preview_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_partner_preview_pricing_plan(jsonb)'::regprocedure))),
      'partner_apply',v_foundation.partner_apply_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'::regprocedure))),
      'freeze',v_foundation.freeze_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure))),
      'topology',v_foundation.topology_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure))),
      'property',v_foundation.property_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure))),
      'catalog',v_foundation.catalog_fingerprint is not distinct from
        public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint(),
      'self',v_foundation.foundation_fingerprint is not distinct from
        public.hotel_v2_h3_2b_hash(jsonb_set(
          to_jsonb(v_foundation)-'foundation_fingerprint','{created_at}',
          to_jsonb((extract(epoch from v_foundation.created_at)*1000000)::bigint),false)));
    return false;
  end if;
  if exists(select 1
      from public.hotel_seven_arches_independent_pricing_authority authority
      left join public.hotel_pricing_schedule_occupancy_tiers tier
        on tier.id=authority.target_tier_id
      left join public.hotel_pricing_schedule_occupancy_tiers source
        on source.id=authority.source_tier_id
      where tier.id is null or source.id is null
        or authority.hotel_id<>c_hotel
        or authority.guest_count not between 2 and 4
        or authority.threshold_nights not between 2 and 10
        or authority.currency<>'EUR'
        or source.schedule_id<>c_source
        or source.guest_count<>authority.guest_count
        or source.threshold_nights<>authority.threshold_nights
        or source.nightly_rate<>authority.initial_nightly_rate
        or source.version<>authority.source_tier_version
        or source.is_active<>authority.source_is_active
        or tier.schedule_id<>authority.independent_schedule_id
        or tier.guest_count<>authority.guest_count
        or tier.threshold_nights<>authority.threshold_nights
        or tier.nightly_rate<>authority.current_nightly_rate
        or tier.version<>authority.current_target_version
        or not tier.is_active
        or authority.initial_nightly_rate<10
        or authority.current_nightly_rate<10) then
    raise notice 'REVIEWED_PRICING_CHAIN_FAIL:AUTHORITY';
    return false;
  end if;
  select receipt.legacy_schedule_fingerprint_before,
    receipt.legacy_tier_fingerprint_before into strict v_phase1
  from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
  where receipt.id=1;
  if v_phase1.legacy_schedule_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         to_jsonb(schedule)-array['created_at','updated_at'] order by schedule.id)
         from public.hotel_pricing_schedules schedule where schedule.id in(c_source,
           '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb))
     or v_phase1.legacy_tier_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         to_jsonb(tier)-array['created_at','updated_at'] order by tier.id)
         from public.hotel_pricing_schedule_occupancy_tiers tier
         where tier.schedule_id in(c_source,
           '443065c0-984a-5de3-a22a-d03042c41107'::uuid)),'[]'::jsonb)) then
    raise notice 'REVIEWED_PRICING_CHAIN_FAIL:PHASE1_SHARED';
    return false;
  end if;
  v_state:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  if (v_state#>>'{oracle,core_case_count}')::integer<>100
     or (v_state#>>'{oracle,core_mismatch_count}')::integer<>0
     or (v_state#>>'{oracle,guest_one_case_count}')::integer<>20
     or (v_state#>>'{oracle,guest_one_mismatch_count}')::integer<>0
     or v_state->>'commission_fingerprint'<>v_foundation.commission_fingerprint
     or v_state->>'payment_fingerprint'<>v_foundation.payment_fingerprint
     or v_state->>'unrelated_fingerprint'<>
       v_foundation.initial_unrelated_fingerprint then
    raise notice 'REVIEWED_PRICING_CHAIN_FAIL:ORACLE_COMMERCIAL';
    return false;
  end if;
  select count(*)::integer into v_receipt_count
  from public.hotel_seven_arches_reviewed_pricing_evolution_receipts;
  if v_receipt_count=0 then
    if v_state->>'normalized_fingerprint'<>v_foundation.initial_normalized_fingerprint
       or v_state->>'authority_fingerprint'<>
         v_foundation.initial_reviewed_authority_fingerprint
       or v_state->>'legacy_fingerprint'<>v_foundation.initial_legacy_fingerprint
       or v_state#>>'{oracle,fingerprint}'<>
         v_foundation.initial_reviewed_oracle_fingerprint
       or exists(select 1
         from public.hotel_seven_arches_independent_pricing_authority authority
         where authority.current_nightly_rate<>authority.initial_nightly_rate
           or authority.current_target_version<>authority.target_initial_version
           or authority.current_receipt_sequence<>0) then
      raise notice 'REVIEWED_PRICING_CHAIN_FAIL:GENESIS_STATE';
      return false;
    end if;
  else
    v_previous:=v_foundation.genesis_hash;
    for v_receipt in select *
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no loop
      if v_receipt.sequence_no<>v_expected_sequence
         or v_receipt.previous_receipt_hash<>v_previous
         or v_receipt.created_at is null or not isfinite(v_receipt.created_at)
         or v_receipt.receipt_hash<>public.hotel_v2_h3_2b_hash(jsonb_set(
           to_jsonb(v_receipt)-'receipt_hash','{created_at}',
           to_jsonb((extract(epoch from v_receipt.created_at)*1000000)::bigint),false))
         or v_receipt.commission_fingerprint<>v_foundation.commission_fingerprint
         or v_receipt.payment_fingerprint<>v_foundation.payment_fingerprint
         or v_receipt.unrelated_before_fingerprint<>
           v_receipt.unrelated_after_fingerprint
         or v_receipt.unrelated_before_fingerprint<>
           v_foundation.initial_unrelated_fingerprint
         or v_receipt.allowed_changed_keys<>array[
           'hotel_pricing_schedule_occupancy_tiers',
           'hotel_seven_arches_independent_pricing_authority',
           'hotels.pricing_tiers','hotel_activity_log',
           'hotel_seven_arches_reviewed_pricing_workflow']::text[]
         or cardinality(v_receipt.activity_ids)<>1
         or not public.hotel_v2_h3_2a_jsonb_is_pii_free(v_receipt.changed_items)
         or not exists(select 1
           from public.hotel_seven_arches_reviewed_pricing_proposals proposal
           join public.hotel_seven_arches_reviewed_pricing_admin_reviews review
             on review.id=v_receipt.review_id and review.proposal_id=proposal.id
           where proposal.id=v_receipt.proposal_id and proposal.status='accepted'
             and proposal.consumed_review_id=review.id
             and proposal.consumed_correlation_id=v_receipt.correlation_id
             and review.consumed_correlation_id=v_receipt.correlation_id
             and review.consumed_idempotency_key=v_receipt.idempotency_key
             and review.action='accept'
             and v_receipt.initiator_type=proposal.initiator_type
             and v_receipt.partner_id is not distinct from proposal.partner_id
             and v_receipt.assignment_id is not distinct from proposal.assignment_id
             and v_receipt.actor_id=review.actor_id
             and v_receipt.reason_fingerprint=public.hotel_v2_h3_2b_hash(
               jsonb_build_object('proposal_reason',proposal.reason,
                 'admin_reason',review.reason))
             and v_receipt.changed_tier_ids=(select array_agg(
               item.schedule_tier_id order by item.schedule_tier_id)
               from public.hotel_seven_arches_reviewed_pricing_proposal_items item
               where item.proposal_id=proposal.id)
             and v_receipt.changed_room_keys=(select array_agg(
               distinct item.room_key order by item.room_key)
               from public.hotel_seven_arches_reviewed_pricing_proposal_items item
               where item.proposal_id=proposal.id)
             and v_receipt.changed_items is not distinct from (select jsonb_agg(
               jsonb_build_object('room_key',item.room_key,
                 'room_type_id',item.room_type_id,'room_rate_id',item.room_rate_id,
                 'pricing_schedule_id',item.pricing_schedule_id,
                 'schedule_tier_id',item.schedule_tier_id,
                 'pricing_occupancy',item.guest_count,
                 'minimum_nights',item.minimum_nights,'currency',item.currency,
                 'before_price',item.before_price,
                 'after_price',item.requested_price,
                 'before_version',item.before_tier_version,
                 'after_version',item.before_tier_version+1)
               order by item.schedule_tier_id)
               from public.hotel_seven_arches_reviewed_pricing_proposal_items item
               where item.proposal_id=proposal.id))
         or exists(select 1 from unnest(v_receipt.activity_ids) activity_id
           where not exists(select 1 from public.hotel_activity_log activity
             where activity.id=activity_id and activity.hotel_id=c_hotel
               and activity.correlation_id=v_receipt.correlation_id
               and activity.source=
                 'hotels_v2_seven_arches_reviewed_pricing_admin')) then
        raise notice 'REVIEWED_PRICING_CHAIN_FAIL:RECEIPT_ROW';
        return false;
      end if;
      if v_expected_sequence=1 and (
           v_receipt.normalized_before_fingerprint<>
             v_foundation.initial_normalized_fingerprint
           or v_receipt.authority_before_fingerprint<>
             v_foundation.initial_reviewed_authority_fingerprint
           or v_receipt.legacy_before_fingerprint<>
             v_foundation.initial_legacy_fingerprint
           or v_receipt.parity_before_fingerprint<>
             v_foundation.initial_reviewed_oracle_fingerprint) then
        raise notice 'REVIEWED_PRICING_CHAIN_FAIL:FIRST_RECEIPT';
        return false;
      end if;
      if v_expected_sequence>1 and exists(select 1
        from public.hotel_seven_arches_reviewed_pricing_evolution_receipts previous
        where previous.sequence_no=v_receipt.sequence_no-1 and (
          previous.normalized_after_fingerprint<>
            v_receipt.normalized_before_fingerprint
          or previous.authority_after_fingerprint<>
            v_receipt.authority_before_fingerprint
          or previous.legacy_after_fingerprint<>
            v_receipt.legacy_before_fingerprint
          or previous.parity_after_fingerprint<>
            v_receipt.parity_before_fingerprint)) then
        raise notice 'REVIEWED_PRICING_CHAIN_FAIL:RECEIPT_CONTINUITY';
        return false;
      end if;
      v_previous:=v_receipt.receipt_hash;
      v_expected_sequence:=v_expected_sequence+1;
    end loop;
    select * into strict v_receipt
    from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
    order by receipt.sequence_no desc limit 1;
    if v_receipt.normalized_after_fingerprint<>v_state->>'normalized_fingerprint'
       or v_receipt.authority_after_fingerprint<>v_state->>'authority_fingerprint'
       or v_receipt.legacy_after_fingerprint<>v_state->>'legacy_fingerprint'
       or v_receipt.parity_after_fingerprint<>v_state#>>'{oracle,fingerprint}'
       or v_receipt.receipt_hash<>v_state->>'last_receipt_hash'
       or v_receipt_count<>v_receipt.sequence_no then
      raise notice 'REVIEWED_PRICING_CHAIN_FAIL:LIVE_TAIL';
      return false;
    end if;
  end if;
  if exists(select 1 from (values
      ('public.hotel_seven_arches_reviewed_pricing_proposals'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_proposal_items'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_admin_reviews'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_transaction_context'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_foundation_receipts'::regclass),
      ('public.hotel_seven_arches_reviewed_pricing_evolution_receipts'::regclass),
      ('public.hotel_seven_arches_independent_pricing_authority'::regclass),
      ('public.hotel_seven_arches_independent_pricing_topology_receipts'::regclass),
      ('public.hotel_seven_arches_independent_pricing_evolution_receipts'::regclass)
    ) expected(relation_id) left join pg_class relation on relation.oid=expected.relation_id
    where relation.oid is null or relation.relowner<>'postgres'::regrole
      or not relation.relrowsecurity
      or relation.relforcerowsecurity or relation.relkind<>'r'
      or exists(select 1 from pg_policy policy where policy.polrelid=relation.oid)
      or exists(select 1 from unnest(array[
        'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name)
        where has_table_privilege(0::oid,relation.oid,privilege.name)
          or has_table_privilege('anon',relation.oid,privilege.name)
          or has_table_privilege('authenticated',relation.oid,privilege.name)
          or has_table_privilege('service_role',relation.oid,privilege.name))) then
    raise notice 'REVIEWED_PRICING_CHAIN_FAIL:RAW_ACL';
    return false;
  end if;
  return true;
exception when no_data_found or too_many_rows or undefined_table or undefined_function then
  raise notice 'REVIEWED_PRICING_CHAIN_FAIL:EXCEPTION:%',sqlerrm;
  return false;
end;
$function$;

create function public.hotel_v2_admin_get_seven_arches_reviewed_pricing()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,auth
as $function$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
begin
  perform public.hotel_v2_h2a_require_admin();
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_control_v1',
    'hotel_id',c_hotel,
    'proposals',coalesce((select jsonb_agg(jsonb_build_object(
        'id',proposal.id,'initiator_type',proposal.initiator_type,
      'partner_id',proposal.partner_id,'assignment_id',proposal.assignment_id,
      'status',proposal.status,'version',proposal.version,'reason',proposal.reason,
      'item_count',proposal.item_count,'created_at',proposal.created_at,
      'expires_at',proposal.expires_at,'fresh',proposal.expires_at>statement_timestamp()
        and proposal.status='pending_admin_review'
        and public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(
          proposal.id)
        and (proposal.initiator_type='admin' or exists(select 1
          from public.hotel_partner_hotel_permissions permission
          where permission.assignment_id=proposal.assignment_id
            and permission.partner_id=proposal.partner_id
            and permission.hotel_id=proposal.hotel_id and permission.manage_prices
            and permission.version=proposal.assignment_version))
        and not exists(select 1
          from public.hotel_seven_arches_reviewed_pricing_proposal_items item
          left join public.hotel_seven_arches_independent_pricing_authority authority
            on authority.target_tier_id=item.schedule_tier_id
          left join public.hotel_pricing_schedule_occupancy_tiers tier
            on tier.id=item.schedule_tier_id
          where item.proposal_id=proposal.id and (
            authority.target_tier_id is null or tier.id is null
            or authority.current_nightly_rate<>item.before_price
            or authority.current_target_version<>item.before_tier_version
            or tier.nightly_rate<>item.before_price
            or tier.version<>item.before_tier_version)),
      'items',(select jsonb_agg(jsonb_build_object(
        'item_index',item.item_index,'room_key',item.room_key,
        'room_type_id',item.room_type_id,'room_rate_id',item.room_rate_id,
        'pricing_schedule_id',item.pricing_schedule_id,
        'schedule_tier_id',item.schedule_tier_id,'guest_count',item.guest_count,
        'minimum_nights',item.minimum_nights,'currency',item.currency,
        'before_price',item.before_price,'requested_price',item.requested_price)
        order by item.item_index)
        from public.hotel_seven_arches_reviewed_pricing_proposal_items item
        where item.proposal_id=proposal.id)) order by proposal.created_at,proposal.id)
      from public.hotel_seven_arches_reviewed_pricing_proposals proposal
      where proposal.status='pending_admin_review'),'[]'::jsonb),
    'commission_policy',jsonb_build_object(
      'commission_mode','per_allocated_room_per_night','amount',10,'currency','EUR'),
    'current_state',public.hotel_v2_seven_arches_reviewed_pricing_current_state());
end;
$function$;

create function public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(
  p_request jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_actor uuid:=auth.uid(); v_proposal_id uuid; v_proposal_version bigint;
  v_proposal public.hotel_seven_arches_reviewed_pricing_proposals%rowtype;
  v_action text; v_reason text; v_items jsonb; v_plan jsonb;
  v_review_id uuid:=gen_random_uuid(); v_reviewed_at timestamptz:=clock_timestamp();
  v_expires_at timestamptz; v_reviewed jsonb; v_fingerprint text;
  v_item jsonb; v_index smallint:=0; v_submit_result jsonb; v_fresh boolean:=true;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_request is null or jsonb_typeof(p_request)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_request,array[
       'contract_version','hotel_id','proposal_id','proposal_version',
       'action','reason','items'])
     or not (p_request?&array['contract_version','hotel_id','action','reason'])
     or p_request->>'contract_version'<>
       'hotels_v2_seven_arches_reviewed_pricing_admin_request_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_request-'items')
     or (p_request->>'hotel_id')::uuid<>c_hotel
     or p_request->>'action' not in('accept','reject')
     or jsonb_typeof(p_request->'reason')<>'string'
     or p_request->>'reason'<>btrim(p_request->>'reason')
     or char_length(p_request->>'reason') not between 3 and 500
     or p_request->>'reason'~'[[:cntrl:]]' then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_reviewed_pricing_admin_request_invalid';
  end if;
  v_action:=p_request->>'action'; v_reason:=p_request->>'reason';
  if p_request?'proposal_id' and jsonb_typeof(p_request->'proposal_id')<>'null' then
    if not (p_request?'proposal_version')
       or jsonb_typeof(p_request->'proposal_version')<>'number'
       or p_request->>'proposal_version'!~'^[1-9][0-9]*$'
       or (p_request?'items' and jsonb_typeof(p_request->'items')<>'null') then
      raise exception using errcode='22023',
        message='hotels_v2_seven_arches_reviewed_pricing_admin_request_invalid';
    end if;
    v_proposal_id:=(p_request->>'proposal_id')::uuid;
    v_proposal_version:=(p_request->>'proposal_version')::bigint;
    select * into v_proposal
    from public.hotel_seven_arches_reviewed_pricing_proposals proposal
    where proposal.id=v_proposal_id and proposal.hotel_id=c_hotel
      and proposal.status='pending_admin_review';
    if v_proposal.id is null then
      raise exception using errcode='PT404',
        message='hotels_v2_seven_arches_reviewed_pricing_proposal_not_found';
    end if;
    v_fresh:=v_proposal.version=v_proposal_version
      and v_proposal.expires_at>statement_timestamp()
      and public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(
        v_proposal.id);
    if v_action='accept' and not v_fresh then
      raise exception using errcode='PT409',
        message='hotels_v2_seven_arches_reviewed_pricing_proposal_stale';
    end if;
    select jsonb_agg(jsonb_build_object(
      'hotel_id',item.hotel_id,'room_type_id',item.room_type_id,
      'room_rate_id',item.room_rate_id,'pricing_schedule_id',item.pricing_schedule_id,
      'schedule_tier_id',item.schedule_tier_id,'guest_count',item.guest_count,
      'minimum_nights',item.minimum_nights,'currency',item.currency,
      'before_price',item.before_price,'requested_price',item.requested_price)
      order by item.item_index) into v_items
    from public.hotel_seven_arches_reviewed_pricing_proposal_items item
    where item.proposal_id=v_proposal.id;
    v_plan:=public.hotel_v2_seven_arches_reviewed_pricing_build_plan(
      v_items,v_proposal.reason);
    if v_action='accept' and (
       v_plan->>'evolution_snapshot_token'<>v_proposal.evolution_snapshot_token
       or v_plan->'canonical_items' is distinct from (select jsonb_agg(
         jsonb_build_object('hotel_id',item.hotel_id,'room_key',item.room_key,
           'room_type_id',item.room_type_id,'room_rate_id',item.room_rate_id,
           'pricing_schedule_id',item.pricing_schedule_id,
           'schedule_tier_id',item.schedule_tier_id,'guest_count',item.guest_count,
           'minimum_nights',item.minimum_nights,'currency',item.currency,
           'before_price',item.before_price,'requested_price',item.requested_price,
           'before_tier_version',item.before_tier_version)
         order by item.schedule_tier_id)
         from public.hotel_seven_arches_reviewed_pricing_proposal_items item
         where item.proposal_id=v_proposal.id)) then
      raise exception using errcode='PT409',
        message='hotels_v2_seven_arches_reviewed_pricing_proposal_stale';
    end if;
  else
    if v_action<>'accept' or not (p_request?'items')
       or jsonb_typeof(p_request->'items')<>'array'
       or p_request?'proposal_version' then
      raise exception using errcode='22023',
        message='hotels_v2_seven_arches_reviewed_pricing_admin_request_invalid';
    end if;
    v_plan:=public.hotel_v2_seven_arches_reviewed_pricing_build_plan(
      p_request->'items',v_reason);
    v_fresh:=true;
    v_items:=p_request->'items'; v_proposal_id:=gen_random_uuid();
    v_proposal_version:=1;
    v_submit_result:=jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_submit_result_v1',
      'proposal_id',v_proposal_id,'hotel_id',c_hotel,'partner_id',null,
      'status','pending_admin_review','changed',false,'replayed',false,
      'correlation_id',gen_random_uuid(),'idempotency_key',gen_random_uuid(),
      'activity',null,'initiator_type','admin');
    insert into public.hotel_seven_arches_reviewed_pricing_proposals(
      id,contract_version,hotel_id,initiator_type,partner_id,assignment_id,
      actor_id,status,version,assignment_version,access_snapshot_token,
      pricing_snapshot_token,evolution_snapshot_token,reason,reason_fingerprint,
      item_count,plan_fingerprint,submit_correlation_id,submit_idempotency_key,
      submit_result,created_at,expires_at)
    values(v_proposal_id,
      'hotels_v2_seven_arches_reviewed_pricing_proposal_v1',c_hotel,'admin',
      null,null,v_actor,'pending_admin_review',1,null,null,null,
      v_plan->>'evolution_snapshot_token',v_reason,
      public.hotel_v2_h3_2b_hash(jsonb_build_object('reason',v_reason)),
      jsonb_array_length(v_plan->'canonical_items'),
      public.hotel_v2_h3_2b_hash(v_plan->'canonical_items'),
      (v_submit_result->>'correlation_id')::uuid,
      (v_submit_result->>'idempotency_key')::uuid,v_submit_result,
      v_reviewed_at,v_reviewed_at+interval '30 minutes');
    for v_item in select value from jsonb_array_elements(
        v_plan->'canonical_items') value order by value->>'schedule_tier_id' loop
      v_index:=v_index+1;
      insert into public.hotel_seven_arches_reviewed_pricing_proposal_items(
        proposal_id,item_index,hotel_id,room_key,room_type_id,room_rate_id,
        pricing_schedule_id,schedule_tier_id,guest_count,minimum_nights,
        currency,before_price,requested_price,before_tier_version)
      values(v_proposal_id,v_index,(v_item->>'hotel_id')::uuid,
        v_item->>'room_key',(v_item->>'room_type_id')::uuid,
        (v_item->>'room_rate_id')::uuid,(v_item->>'pricing_schedule_id')::uuid,
        (v_item->>'schedule_tier_id')::uuid,
        (v_item->>'guest_count')::smallint,
        (v_item->>'minimum_nights')::integer,v_item->>'currency',
        (v_item->>'before_price')::numeric,(v_item->>'requested_price')::numeric,
        (v_item->>'before_tier_version')::bigint);
    end loop;
    select * into strict v_proposal
    from public.hotel_seven_arches_reviewed_pricing_proposals proposal
    where proposal.id=v_proposal_id;
  end if;
  v_expires_at:=v_reviewed_at+interval '30 minutes';
  v_reviewed:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_plan_v1',
    'review_id',v_review_id,'hotel_id',c_hotel,'proposal_id',v_proposal_id,
    'proposal_version',v_proposal_version,'initiator_type',v_proposal.initiator_type,
    'partner_id',v_proposal.partner_id,'assignment_id',v_proposal.assignment_id,
    'actor_id',v_actor,'action',v_action,'admin_reason',v_reason,
    'proposal_reason',v_proposal.reason,'canonical_items',v_plan->'canonical_items',
    'commercial_impacts',v_plan->'commercial_impacts',
    'commission_policy',v_plan->'commission_policy',
    'evolution_snapshot_token',v_plan->>'evolution_snapshot_token',
    'reviewed_at',to_char(v_reviewed_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'expires_at',to_char(v_expires_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  v_fingerprint:=public.hotel_v2_7a_reviewed_pricing_plan_fingerprint(v_reviewed);
  v_reviewed:=v_reviewed||jsonb_build_object('plan_fingerprint',v_fingerprint);
  insert into public.hotel_seven_arches_reviewed_pricing_admin_reviews(
    id,contract_version,hotel_id,proposal_id,proposal_version,actor_id,
    action,reason,reviewed_plan,plan_fingerprint,reviewed_at,expires_at)
  values(v_review_id,
    'hotels_v2_seven_arches_reviewed_pricing_admin_review_v1',c_hotel,
    v_proposal_id,v_proposal_version,v_actor,v_action,v_reason,v_reviewed,
    v_fingerprint,v_reviewed_at,v_expires_at);
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_preview_v1',
    'hotel_id',c_hotel,'proposal_id',v_proposal_id,'action',v_action,
    'changed',v_action='accept','proposal_fresh',v_fresh,
    'commercial_impacts',v_plan->'commercial_impacts',
    'commission_policy',v_plan->'commission_policy','reviewed_plan',v_reviewed);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',
    message='hotels_v2_seven_arches_reviewed_pricing_admin_request_invalid';
end;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_item_guard()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_proposal public.hotel_seven_arches_reviewed_pricing_proposals%rowtype;
  v_authority public.hotel_seven_arches_independent_pricing_authority%rowtype;
  v_tier public.hotel_pricing_schedule_occupancy_tiers%rowtype;
begin
  if tg_op<>'INSERT' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_item_immutable';
  end if;
  select * into v_proposal
  from public.hotel_seven_arches_reviewed_pricing_proposals proposal
  where proposal.id=new.proposal_id and proposal.status='pending_admin_review';
  select * into v_authority
  from public.hotel_seven_arches_independent_pricing_authority authority
  where authority.target_tier_id=new.schedule_tier_id;
  select * into v_tier from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.id=new.schedule_tier_id;
  if v_proposal.id is null or v_authority.target_tier_id is null or v_tier.id is null
     or new.hotel_id<>v_proposal.hotel_id
     or new.room_key<>v_authority.room_key
     or new.room_type_id<>v_authority.room_type_id
     or new.room_rate_id<>v_authority.room_rate_id
     or new.pricing_schedule_id<>v_authority.independent_schedule_id
     or new.guest_count<>v_authority.guest_count
     or new.minimum_nights<>v_authority.threshold_nights
     or new.currency<>v_authority.currency
     or new.before_price<>v_authority.current_nightly_rate
     or new.before_tier_version<>v_authority.current_target_version
     or v_tier.schedule_id<>new.pricing_schedule_id
     or v_tier.guest_count<>new.guest_count
     or v_tier.threshold_nights<>new.minimum_nights
     or v_tier.nightly_rate<>new.before_price
     or v_tier.version<>new.before_tier_version
     or not v_tier.is_active then
    raise exception using errcode='23514',
      message='hotels_v2_seven_arches_reviewed_pricing_item_binding_invalid';
  end if;
  return new;
end;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_review_guard()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_context public.hotel_seven_arches_reviewed_pricing_transaction_context%rowtype;
begin
  if tg_op='DELETE' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_review_delete_forbidden';
  end if;
  if tg_op='INSERT' then
    if new.reviewed_at is null or not isfinite(new.reviewed_at)
       or new.expires_at is null or not isfinite(new.expires_at)
       or new.expires_at<=statement_timestamp()
     or new.plan_fingerprint<>
       public.hotel_v2_7a_reviewed_pricing_plan_fingerprint(new.reviewed_plan)
       or new.reviewed_plan->>'plan_fingerprint'<>new.plan_fingerprint
       or new.reviewed_plan->>'review_id'<>new.id::text
       or new.reviewed_plan->>'proposal_id'<>new.proposal_id::text
       or new.reviewed_plan->>'hotel_id'<>new.hotel_id::text
       or new.reviewed_plan->>'action'<>new.action
       or new.reviewed_plan->>'actor_id'<>new.actor_id::text
       or new.reviewed_plan->>'reviewed_at'<>to_char(
         new.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
       or new.reviewed_plan->>'expires_at'<>to_char(
         new.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_reviewed_pricing_review_insert_invalid';
    end if;
    return new;
  end if;
  select * into v_context
  from public.hotel_seven_arches_reviewed_pricing_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current()
    and context_row.review_id=old.id
    and context_row.correlation_id=new.consumed_correlation_id
    and context_row.idempotency_key=new.consumed_idempotency_key;
  if v_context.review_id is null or old.consumed_at is not null
     or new.id<>old.id or new.contract_version<>old.contract_version
     or new.hotel_id<>old.hotel_id or new.proposal_id<>old.proposal_id
     or new.proposal_version<>old.proposal_version
     or new.actor_id<>old.actor_id or new.action<>old.action
     or new.reason<>old.reason or new.reviewed_plan<>old.reviewed_plan
     or new.plan_fingerprint<>old.plan_fingerprint
     or new.reviewed_at<>old.reviewed_at or new.expires_at<>old.expires_at
     or new.consumed_at is null or not isfinite(new.consumed_at)
     or new.consumed_at<old.reviewed_at
     or new.consumed_correlation_id<>v_context.correlation_id
     or new.consumed_idempotency_key<>v_context.idempotency_key
     or jsonb_typeof(new.result)<>'object' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_review_transition_invalid';
  end if;
  return new;
end;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_context_guard()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_expected uuid[];
begin
  if tg_op='UPDATE' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_context_immutable';
  end if;
  if tg_op='DELETE' then
    if old.backend_pid<>pg_backend_pid() or old.transaction_id<>txid_current() then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_reviewed_pricing_context_delete_invalid';
    end if;
    return old;
  end if;
  select array_agg(item.schedule_tier_id order by item.schedule_tier_id)
    into v_expected
  from public.hotel_seven_arches_reviewed_pricing_proposal_items item
  where item.proposal_id=new.proposal_id;
  if new.backend_pid<>pg_backend_pid() or new.transaction_id<>txid_current()
     or new.created_at is null or not isfinite(new.created_at)
     or new.selected_tier_ids<>v_expected
     or new.receipt_sequence<>coalesce((select max(receipt.sequence_no)+1
       from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt),1)
     or not exists(select 1
       from public.hotel_seven_arches_reviewed_pricing_admin_reviews review
       join public.hotel_seven_arches_reviewed_pricing_proposals proposal
         on proposal.id=review.proposal_id
       where review.id=new.review_id and review.proposal_id=new.proposal_id
         and review.actor_id=new.actor_id and review.action in('accept','reject')
         and review.consumed_at is null and review.expires_at>statement_timestamp()
         and proposal.status='pending_admin_review') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_context_invalid';
  end if;
  return new;
end;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_authority_guard()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_context public.hotel_seven_arches_reviewed_pricing_transaction_context%rowtype;
  v_item public.hotel_seven_arches_reviewed_pricing_proposal_items%rowtype;
  v_tier public.hotel_pricing_schedule_occupancy_tiers%rowtype;
begin
  if tg_op<>'UPDATE' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_authority_immutable';
  end if;
  select * into v_context
  from public.hotel_seven_arches_reviewed_pricing_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current()
    and old.target_tier_id=any(context_row.selected_tier_ids);
  select * into v_item
  from public.hotel_seven_arches_reviewed_pricing_proposal_items item
  where item.proposal_id=v_context.proposal_id
    and item.schedule_tier_id=old.target_tier_id;
  select * into v_tier from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.id=old.target_tier_id;
  if v_context.review_id is null or v_item.proposal_id is null or v_tier.id is null
     or (to_jsonb(new)-array['current_nightly_rate','current_target_version',
       'current_receipt_sequence','updated_at']) is distinct from
       (to_jsonb(old)-array['current_nightly_rate','current_target_version',
       'current_receipt_sequence','updated_at'])
     or old.current_nightly_rate<>v_item.before_price
     or old.current_target_version<>v_item.before_tier_version
     or new.current_nightly_rate<>v_item.requested_price
     or new.current_target_version<>v_tier.version
     or new.current_nightly_rate<>v_tier.nightly_rate
     or new.current_receipt_sequence<>v_context.receipt_sequence
     or new.updated_at<=old.updated_at then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_authority_update_invalid';
  end if;
  return new;
end;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_legacy_guard()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_context public.hotel_seven_arches_reviewed_pricing_transaction_context%rowtype;
  v_expected jsonb;
begin
  if old.id<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
    return new;
  end if;
  select * into v_context
  from public.hotel_seven_arches_reviewed_pricing_transaction_context context_row
  join public.hotel_seven_arches_reviewed_pricing_admin_reviews review
    on review.id=context_row.review_id and review.action='accept'
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current();
  select jsonb_build_object('currency','EUR','rules',jsonb_agg(
    case when (rule.value->>'persons')::integer between 5 and 8 then
      jsonb_set(rule.value,'{price_per_night}',to_jsonb((
        select sum(tier.nightly_rate)
        from (values
          ('aec20731-7a56-35f0-334e-92b363351f02'::uuid),
          ('9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)
        ) schedule(id)
        join public.hotel_pricing_schedule_occupancy_tiers tier
          on tier.schedule_id=schedule.id and tier.is_active
          and tier.guest_count=case (rule.value->>'persons')::integer
            when 5 then 2 when 6 then 3 else 4 end
          and tier.threshold_nights=(rule.value->>'min_nights')::integer)),false)
    else rule.value end order by rule.ordinality)) into v_expected
  from jsonb_array_elements(old.pricing_tiers->'rules')
    with ordinality rule(value,ordinality);
  if v_context.review_id is null
     or jsonb_typeof(old.pricing_tiers->'rules')<>'array'
     or jsonb_array_length(old.pricing_tiers->'rules')<>63
     or new.pricing_tiers is distinct from v_expected then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_legacy_update_invalid';
  end if;
  return new;
end;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_receipt_guard()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_context public.hotel_seven_arches_reviewed_pricing_transaction_context%rowtype;
  v_foundation public.hotel_seven_arches_reviewed_pricing_foundation_receipts%rowtype;
  v_expected_previous text;
  v_expected_hash text;
begin
  if tg_op<>'INSERT' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_receipt_immutable';
  end if;
  select * into strict v_foundation
  from public.hotel_seven_arches_reviewed_pricing_foundation_receipts where id=1;
  select * into v_context
  from public.hotel_seven_arches_reviewed_pricing_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current()
    and context_row.review_id=new.review_id
    and context_row.proposal_id=new.proposal_id
    and context_row.actor_id=new.actor_id
    and context_row.correlation_id=new.correlation_id
    and context_row.idempotency_key=new.idempotency_key
    and context_row.receipt_sequence=new.sequence_no;
  select coalesce((select receipt.receipt_hash
    from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
    order by receipt.sequence_no desc limit 1),v_foundation.genesis_hash)
    into v_expected_previous;
  v_expected_hash:=public.hotel_v2_h3_2b_hash(jsonb_set(
    to_jsonb(new)-'receipt_hash','{created_at}',
    to_jsonb((extract(epoch from new.created_at)*1000000)::bigint),false));
  if v_context.review_id is null
     or new.previous_receipt_hash<>v_expected_previous
     or new.receipt_hash<>v_expected_hash
     or new.sequence_no<>coalesce((select max(receipt.sequence_no)+1
       from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt),1)
     or new.changed_tier_ids<>v_context.selected_tier_ids
     or new.created_at is null or not isfinite(new.created_at)
     or new.commission_fingerprint<>v_foundation.commission_fingerprint
     or new.payment_fingerprint<>v_foundation.payment_fingerprint
     or not public.hotel_v2_h3_2a_jsonb_is_pii_free(new.changed_items) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_receipt_invalid';
  end if;
  return new;
end;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_foundation_guard()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
begin
  if tg_op='INSERT'
     and to_regclass('pg_temp.seven_arches_reviewed_pricing_before') is not null
     and not exists(select 1
       from public.hotel_seven_arches_reviewed_pricing_foundation_receipts)
     and new.id=1
     and new.created_at is not null and isfinite(new.created_at)
     and new.foundation_fingerprint=public.hotel_v2_h3_2b_hash(jsonb_set(
       to_jsonb(new)-'foundation_fingerprint','{created_at}',
       to_jsonb((extract(epoch from new.created_at)*1000000)::bigint),false)) then
    return new;
  end if;
  raise exception using errcode='55000',
    message='hotels_v2_seven_arches_reviewed_pricing_foundation_immutable';
end;
$function$;

create trigger hotel_7a_reviewed_pricing_proposal_guard
before insert or update or delete on
  public.hotel_seven_arches_reviewed_pricing_proposals
for each row execute function
  public.hotel_v2_seven_arches_reviewed_pricing_proposal_guard();
create trigger hotel_7a_reviewed_pricing_item_guard
before insert or update or delete on
  public.hotel_seven_arches_reviewed_pricing_proposal_items
for each row execute function
  public.hotel_v2_seven_arches_reviewed_pricing_item_guard();
create trigger hotel_7a_reviewed_pricing_review_guard
before insert or update or delete on
  public.hotel_seven_arches_reviewed_pricing_admin_reviews
for each row execute function
  public.hotel_v2_seven_arches_reviewed_pricing_review_guard();
create trigger hotel_7a_reviewed_pricing_context_guard
before insert or update or delete on
  public.hotel_seven_arches_reviewed_pricing_transaction_context
for each row execute function
  public.hotel_v2_seven_arches_reviewed_pricing_context_guard();
create trigger hotel_7a_reviewed_pricing_authority_guard
before insert or update or delete on
  public.hotel_seven_arches_independent_pricing_authority
for each row execute function
  public.hotel_v2_seven_arches_reviewed_pricing_authority_guard();
create trigger hotel_7a_reviewed_pricing_legacy_guard
before update of pricing_tiers on public.hotels
for each row execute function
  public.hotel_v2_seven_arches_reviewed_pricing_legacy_guard();
create trigger hotel_7a_reviewed_pricing_receipt_guard
before insert or update or delete on
  public.hotel_seven_arches_reviewed_pricing_evolution_receipts
for each row execute function
  public.hotel_v2_seven_arches_reviewed_pricing_receipt_guard();
create trigger hotel_7a_reviewed_pricing_foundation_immutable
before insert or update or delete on
  public.hotel_seven_arches_reviewed_pricing_foundation_receipts
for each row execute function
  public.hotel_v2_seven_arches_reviewed_pricing_foundation_guard();

create function public.hotel_v2_seven_arches_reviewed_pricing_oracle()
returns jsonb language sql stable security definer
set search_path=pg_catalog,public
as $function$
with preview as (
  select public.hotel_v2_h3_1p_allocation_preview(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) value
), cases as (
  select (entry.value->>'guest_count')::integer requested_guest_count,
    option.ordinality::integer option_number,
    (comparison.value->>'nights')::integer nights,
    (comparison.value->>'threshold_nights')::integer threshold_nights,
    (comparison.value->>'legacy_nightly_rate')::numeric legacy_nightly_rate,
    (comparison.value->>'room_rate_sum')::numeric room_rate_sum,
    (comparison.value->>'stay_total')::numeric stay_total,
    comparison.value->'room_nightly_rates' room_nightly_rates,
    option.value->'allocation' allocation
  from preview
  cross join lateral jsonb_array_elements(preview.value) entry(value)
  cross join lateral jsonb_array_elements(entry.value->'options')
    with ordinality option(value,ordinality)
  cross join lateral jsonb_array_elements(
    option.value->'nightly_comparisons') comparison(value)
), checked as (
  select case_row.*,
    coalesce((select bool_and(
      authority.target_tier_id is not null
      and authority.current_nightly_rate=(room.value->>'nightly_rate')::numeric
      and authority.current_target_version=tier.version
      and tier.nightly_rate=authority.current_nightly_rate
      and tier.is_active)
      from jsonb_array_elements(case_row.room_nightly_rates) room(value)
      left join public.hotel_seven_arches_independent_pricing_authority authority
        on authority.room_rate_id=(room.value->>'room_rate_id')::uuid
        and authority.guest_count=(room.value->>'pricing_guest_count')::smallint
        and authority.threshold_nights=case_row.threshold_nights
      left join public.hotel_pricing_schedule_occupancy_tiers tier
        on tier.id=authority.target_tier_id),false) authority_exact,
    coalesce((select bool_and(
      (room.value->>'pricing_guest_count')::integer=2)
      from jsonb_array_elements(case_row.room_nightly_rates) room(value)),false)
      guest_one_floor_exact,
    (select sum((item.value->>'units_required')::integer)
      from jsonb_array_elements(case_row.allocation) item(value)) allocated_room_count
  from cases case_row
), summary as (
  select
    count(*) filter(where requested_guest_count between 2 and 8)::integer
      core_case_count,
    count(*) filter(where requested_guest_count between 2 and 8 and (
      not authority_exact
      or stay_total is distinct from room_rate_sum*nights
      or (requested_guest_count between 5 and 8
        and room_rate_sum is distinct from legacy_nightly_rate)))::integer
      core_mismatch_count,
    count(*) filter(where requested_guest_count=1)::integer guest_one_case_count,
    count(*) filter(where requested_guest_count=1 and (
      not authority_exact or not guest_one_floor_exact
      or stay_total is distinct from room_rate_sum*nights))::integer
      guest_one_mismatch_count,
    count(*)::integer total_case_count,
    md5(coalesce(string_agg(jsonb_build_object(
      'requested_guest_count',requested_guest_count,
      'option_number',option_number,'nights',nights,
      'threshold_nights',threshold_nights,
      'legacy_nightly_rate',legacy_nightly_rate,
      'room_rate_sum',room_rate_sum,'stay_total',stay_total,
      'room_nightly_rates',room_nightly_rates,'allocation',allocation,
      'authority_exact',authority_exact,
      'guest_one_floor_exact',guest_one_floor_exact,
      'commission_total',allocated_room_count*10*nights,
      'partner_net',stay_total-allocated_room_count*10*nights)::text,
      '|' order by requested_guest_count,option_number,nights),'')) fingerprint
  from checked
)
select jsonb_build_object(
  'contract_version','hotels_v2_seven_arches_reviewed_pricing_oracle_v1',
  'core_case_count',core_case_count,
  'core_mismatch_count',core_mismatch_count,
  'guest_one_case_count',guest_one_case_count,
  'guest_one_mismatch_count',guest_one_mismatch_count,
  'total_case_count',total_case_count,
  'fingerprint',fingerprint)
from summary;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_current_state()
returns jsonb language sql stable security definer
set search_path=pg_catalog,public
as $function$
with normalized as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',tier.id,'schedule_id',tier.schedule_id,
    'guest_count',tier.guest_count,'minimum_nights',tier.threshold_nights,
    'nightly_price',tier.nightly_rate,'active',tier.is_active,
    'version',tier.version)
    order by tier.schedule_id,tier.guest_count,tier.threshold_nights),'[]'::jsonb) value
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id in(
    'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
    '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)
), authority_state as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'target_tier_id',authority.target_tier_id,
    'room_key',authority.room_key,'hotel_id',authority.hotel_id,
    'room_type_id',authority.room_type_id,'room_rate_id',authority.room_rate_id,
    'pricing_schedule_id',authority.independent_schedule_id,
    'guest_count',authority.guest_count,
    'minimum_nights',authority.threshold_nights,'currency',authority.currency,
    'initial_nightly_price',authority.initial_nightly_rate,
    'current_nightly_price',authority.current_nightly_rate,
    'current_target_version',authority.current_target_version,
    'current_receipt_sequence',authority.current_receipt_sequence)
    order by authority.target_tier_id),'[]'::jsonb) value
  from public.hotel_seven_arches_independent_pricing_authority authority
), legacy as (
  select hotel.pricing_tiers value from public.hotels hotel
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
), commission as (
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(policy)-array['created_at','updated_at'] order by policy.id),
    '[]'::jsonb)) value
  from public.hotel_commission_policies policy
  where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
), payment as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'policies',coalesce((select jsonb_agg(
      to_jsonb(policy)-array['created_at','updated_at'] order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'terms',coalesce((select jsonb_agg(
      to_jsonb(term)-array['created_at','updated_at'] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy
        on policy.id=term.payment_policy_id
      where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb))) value
), unrelated as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'hotel',(select to_jsonb(hotel)-array['pricing_tiers','updated_at']
      from public.hotels hotel
      where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
    'rate_plans',coalesce((select jsonb_agg(
      to_jsonb(plan)-array['created_at','updated_at'] order by plan.id)
      from public.hotel_rate_plans plan where plan.hotel_id=
        '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'room_rates',coalesce((select jsonb_agg(
      to_jsonb(rate)-array['created_at','updated_at'] order by rate.id)
      from public.hotel_room_rates rate where rate.hotel_id=
        '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'schedules',coalesce((select jsonb_agg(
      to_jsonb(schedule)-array['created_at','updated_at'] order by schedule.id)
      from public.hotel_pricing_schedules schedule where schedule.hotel_id=
        '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'other_schedule_tiers',coalesce((select jsonb_agg(
      to_jsonb(tier)-array['created_at','updated_at'] order by tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      where schedule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and tier.schedule_id not in(
          'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
          '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)),'[]'::jsonb),
    'rate_rules',coalesce((select jsonb_agg(
      to_jsonb(rule)-array['created_at','updated_at'] order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate
        on rate.id=rule.room_rate_id where rate.hotel_id=
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'allocation_rules',coalesce((select jsonb_agg(
      to_jsonb(rule)-array['created_at','updated_at'] order by rule.id)
      from public.hotel_room_allocation_rules rule where rule.hotel_id=
        '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'allocation_items',coalesce((select jsonb_agg(
      to_jsonb(item)-array['created_at','updated_at'] order by item.id)
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_allocation_rules rule
        on rule.id=item.allocation_rule_id where rule.hotel_id=
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),'[]'::jsonb),
    'topology_receipts',coalesce((select jsonb_agg(
      jsonb_set(to_jsonb(receipt),'{created_at}',
        to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      order by receipt.room_key)
      from public.hotel_seven_arches_independent_pricing_topology_receipts receipt),
      '[]'::jsonb),
    'phase1_receipt',(select jsonb_set(to_jsonb(receipt),'{created_at}',
      to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
      where receipt.id=1))) value
), room_fingerprints as (
  select jsonb_object_agg(room_key,fingerprint) value from (
    select authority.room_key,public.hotel_v2_h3_2b_hash(jsonb_agg(
      jsonb_build_object('id',tier.id,'guest_count',tier.guest_count,
        'minimum_nights',tier.threshold_nights,'nightly_price',tier.nightly_rate,
        'active',tier.is_active,'version',tier.version)
      order by tier.guest_count,tier.threshold_nights)) fingerprint
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers tier
      on tier.id=authority.target_tier_id
    group by authority.room_key
  ) room
), evidence as (
  select jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_state_v1',
    'normalized_fingerprint',public.hotel_v2_h3_2b_hash(normalized.value),
    'authority_fingerprint',public.hotel_v2_h3_2b_hash(authority_state.value),
    'legacy_fingerprint',public.hotel_v2_h3_2b_hash(legacy.value),
    'oracle',public.hotel_v2_seven_arches_reviewed_pricing_oracle(),
    'commission_fingerprint',commission.value,
    'payment_fingerprint',payment.value,
    'unrelated_fingerprint',unrelated.value,
    'room_fingerprints',room_fingerprints.value,
    'last_receipt_hash',coalesce((select receipt.receipt_hash
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no desc limit 1),(select foundation.genesis_hash
      from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
      where foundation.id=1)),
    'receipt_count',(select count(*)::integer
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)) value
  from normalized,authority_state,legacy,commission,payment,unrelated,room_fingerprints
)
select evidence.value||jsonb_build_object(
  'snapshot_token',public.hotel_v2_h3_2b_hash(evidence.value))
from evidence;
$function$;

create function public.hotel_v2_seven_arches_reviewed_pricing_build_plan(
  p_items jsonb,p_reason text
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare v_item jsonb; v_authority record; v_seen uuid[]:='{}'::uuid[];
  v_canonical jsonb:='[]'::jsonb; v_impacts jsonb; v_state jsonb;
  v_requested numeric; v_before numeric; v_tier_text text;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array'
     or jsonb_array_length(p_items) not between 1 and 54
     or p_reason is null or p_reason<>btrim(p_reason)
     or char_length(p_reason) not between 3 and 500
     or p_reason~'[[:cntrl:]]' then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_reviewed_pricing_plan_invalid';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_item,array[
         'hotel_id','room_type_id','room_rate_id','pricing_schedule_id',
         'schedule_tier_id','guest_count','minimum_nights','currency',
         'before_price','requested_price'])
       or not (v_item?&array[
         'hotel_id','room_type_id','room_rate_id','pricing_schedule_id',
         'schedule_tier_id','guest_count','minimum_nights','currency',
         'before_price','requested_price'])
       or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(
         v_item-array['pricing_schedule_id','schedule_tier_id'])
       or v_item->>'pricing_schedule_id' not in(
         'aec20731-7a56-35f0-334e-92b363351f02',
         '9d109336-64f3-3c57-4684-968b59c94c3b')
       or v_item->>'schedule_tier_id'!~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_item->'guest_count')<>'number'
       or jsonb_typeof(v_item->'minimum_nights')<>'number'
       or jsonb_typeof(v_item->'before_price')<>'number'
       or jsonb_typeof(v_item->'requested_price')<>'number'
       or v_item->>'guest_count'!~'^[234]$'
       or v_item->>'minimum_nights'!~'^(?:[2-9]|10)$'
       or v_item->>'before_price'!~'^[0-9]+(?:[.][0-9]{1,2})?$'
       or v_item->>'requested_price'!~'^[0-9]+(?:[.][0-9]{1,2})?$' then
      raise exception using errcode='22023',
        message='hotels_v2_seven_arches_reviewed_pricing_item_invalid';
    end if;
    v_tier_text:=v_item->>'schedule_tier_id';
    if v_tier_text::uuid=any(v_seen) then
      raise exception using errcode='23505',
        message='hotels_v2_seven_arches_reviewed_pricing_duplicate_item';
    end if;
    v_seen:=array_append(v_seen,v_tier_text::uuid);
    begin
      select authority.room_key,authority.hotel_id,authority.room_type_id,
        authority.room_rate_id,authority.independent_schedule_id,
        authority.target_tier_id,authority.guest_count,
        authority.threshold_nights,authority.currency,
        authority.current_nightly_rate,authority.current_target_version,
        tier.nightly_rate,tier.version,tier.is_active
      into strict v_authority
      from public.hotel_seven_arches_independent_pricing_authority authority
      join public.hotel_pricing_schedule_occupancy_tiers tier
        on tier.id=authority.target_tier_id
      where authority.target_tier_id=v_tier_text::uuid;
    exception when no_data_found or too_many_rows then
      raise exception using errcode='PT404',
        message='hotels_v2_seven_arches_reviewed_pricing_tier_not_found';
    end;
    v_before:=(v_item->>'before_price')::numeric;
    v_requested:=(v_item->>'requested_price')::numeric;
    if (v_item->>'hotel_id')::uuid<>v_authority.hotel_id
       or (v_item->>'room_type_id')::uuid<>v_authority.room_type_id
       or (v_item->>'room_rate_id')::uuid<>v_authority.room_rate_id
       or (v_item->>'pricing_schedule_id')::uuid<>
         v_authority.independent_schedule_id
       or (v_item->>'guest_count')::smallint<>v_authority.guest_count
       or (v_item->>'minimum_nights')::integer<>v_authority.threshold_nights
       or v_item->>'currency'<>v_authority.currency
       or v_before<>v_authority.current_nightly_rate
       or v_before<>v_authority.nightly_rate
       or v_authority.current_target_version<>v_authority.version
       or not v_authority.is_active then
      raise exception using errcode='PT409',
        message='hotels_v2_seven_arches_reviewed_pricing_item_stale';
    end if;
    if v_requested=v_before then
      raise exception using errcode='23514',
        message='hotels_v2_seven_arches_reviewed_pricing_unchanged_item';
    end if;
    if v_requested<10 or v_requested>9999999999.99 then
      raise exception using errcode='23514',
        message='hotels_v2_seven_arches_reviewed_pricing_price_out_of_range';
    end if;
    v_canonical:=v_canonical||jsonb_build_array(jsonb_build_object(
      'hotel_id',v_authority.hotel_id,'room_key',v_authority.room_key,
      'room_type_id',v_authority.room_type_id,
      'room_rate_id',v_authority.room_rate_id,
      'pricing_schedule_id',v_authority.independent_schedule_id,
      'schedule_tier_id',v_authority.target_tier_id,
      'guest_count',v_authority.guest_count,
      'minimum_nights',v_authority.threshold_nights,
      'currency',v_authority.currency,'before_price',v_before,
      'requested_price',v_requested,
      'before_tier_version',v_authority.current_target_version));
  end loop;
  select coalesce(jsonb_agg(impact.value order by impact.sort_group,
    impact.requested_guest_count,impact.room_key,impact.minimum_nights),'[]'::jsonb)
    into v_impacts
  from (
    select 1 sort_group,(item->>'guest_count')::integer requested_guest_count,
      item->>'room_key' room_key,(item->>'minimum_nights')::integer minimum_nights,
      jsonb_build_object('scope','single_room','room_key',item->>'room_key',
        'guest_count',(item->>'guest_count')::integer,
        'minimum_nights',(item->>'minimum_nights')::integer,
        'customer_before',(item->>'before_price')::numeric,
        'customer_after',(item->>'requested_price')::numeric,
        'cypruseye_commission',10,'partner_net_before',
          (item->>'before_price')::numeric-10,
        'partner_net_after',(item->>'requested_price')::numeric-10,
        'currency','EUR') value
    from jsonb_array_elements(v_canonical) item
    union all
    select 2,bundle.requested_guest_count,null::text,bundle.minimum_nights,
      jsonb_build_object('scope','bundle',
        'requested_guest_count',bundle.requested_guest_count,
        'minimum_nights',bundle.minimum_nights,
        'customer_before',bundle.before_total,
        'customer_after',bundle.after_total,
        'cypruseye_commission',20,
        'partner_net_before',bundle.before_total-20,
        'partner_net_after',bundle.after_total-20,'currency','EUR')
    from (
      select mapping.requested_guest_count,
        authority.threshold_nights minimum_nights,
        sum(authority.current_nightly_rate) before_total,
        sum(coalesce((select (item->>'requested_price')::numeric
          from jsonb_array_elements(v_canonical) item
          where (item->>'schedule_tier_id')::uuid=authority.target_tier_id),
          authority.current_nightly_rate)) after_total
      from (values (5,2),(6,3),(7,4),(8,4))
        mapping(requested_guest_count,pricing_guest_count)
      join public.hotel_seven_arches_independent_pricing_authority authority
        on authority.guest_count=mapping.pricing_guest_count
      where exists(select 1 from jsonb_array_elements(v_canonical) item
        where (item->>'guest_count')::integer=mapping.pricing_guest_count
          and (item->>'minimum_nights')::integer=authority.threshold_nights)
      group by mapping.requested_guest_count,authority.threshold_nights
    ) bundle
  ) impact;
  v_state:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  return jsonb_build_object(
    'canonical_items',(select jsonb_agg(value order by value->>'schedule_tier_id')
      from jsonb_array_elements(v_canonical) value),
    'commercial_impacts',v_impacts,'reason',p_reason,
    'evolution_snapshot_token',v_state->>'snapshot_token',
    'commission_policy',jsonb_build_object(
      'commission_mode','per_allocated_room_per_night',
      'amount',10,'currency','EUR'));
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',
    message='hotels_v2_seven_arches_reviewed_pricing_item_invalid';
end;
$function$;

create function public.hotel_v2_partner_preview_seven_arches_pricing_proposal(
  p_draft jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_partner uuid; v_access jsonb; v_workspace jsonb; v_plan jsonb;
  v_reviewed jsonb; v_fingerprint text;
begin
  if p_draft is null or jsonb_typeof(p_draft)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_draft,array[
       'contract_version','partner_id','hotel_id','access_snapshot_token',
       'pricing_snapshot_token','items','reason'])
     or not (p_draft?&array['contract_version','partner_id','hotel_id',
       'access_snapshot_token','pricing_snapshot_token','items','reason'])
     or p_draft->>'contract_version'<>
       'hotels_v2_seven_arches_reviewed_pricing_partner_draft_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_draft-'items')
     or (p_draft->>'hotel_id')::uuid<>c_hotel then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_draft_invalid';
  end if;
  v_partner:=(p_draft->>'partner_id')::uuid;
  v_access:=public.hotel_v2_h3_2b_access_snapshot(v_partner,c_hotel,'manage_prices');
  v_workspace:=public.hotel_v2_partner_get_workspace(
    v_partner,c_hotel,current_date,current_date+30);
  if p_draft->>'access_snapshot_token' is distinct from
       v_workspace#>>'{assignment,access_snapshot_token}'
     or p_draft->>'pricing_snapshot_token' is distinct from
       v_workspace#>>'{pricing,snapshot_token}' then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_draft_stale';
  end if;
  v_plan:=public.hotel_v2_seven_arches_reviewed_pricing_build_plan(
    p_draft->'items',p_draft->>'reason');
  v_reviewed:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_partner_plan_v1',
    'partner_id',v_partner,'hotel_id',c_hotel,
    'assignment_id',(v_access->>'assignment_id')::uuid,
    'assignment_version',(v_access->>'permission_version')::bigint,
    'access_snapshot_token',p_draft->>'access_snapshot_token',
    'pricing_snapshot_token',p_draft->>'pricing_snapshot_token',
    'evolution_snapshot_token',v_plan->>'evolution_snapshot_token',
    'items',p_draft->'items','canonical_items',v_plan->'canonical_items',
    'commercial_impacts',v_plan->'commercial_impacts',
    'reason',p_draft->>'reason','commission_policy',v_plan->'commission_policy',
    'plan_fingerprint',repeat('0',64));
  v_fingerprint:=public.hotel_v2_7a_reviewed_pricing_plan_fingerprint(v_reviewed);
  v_reviewed:=jsonb_set(v_reviewed,'{plan_fingerprint}',to_jsonb(v_fingerprint),false);
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_partner_preview_v1',
    'changed',true,'reviewed_plan',v_reviewed,
    'commercial_impacts',v_plan->'commercial_impacts');
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',
    message='hotels_v2_seven_arches_reviewed_pricing_partner_draft_invalid';
end;
$function$;

create function public.hotel_v2_partner_submit_seven_arches_pricing_proposal(
  p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_actor uuid:=auth.uid(); v_partner uuid; v_assignment uuid; v_existing record;
  v_workspace jsonb; v_access jsonb; v_plan jsonb; v_proposal uuid:=gen_random_uuid();
  v_now timestamptz:=clock_timestamp(); v_result jsonb; v_activity jsonb;
  v_item jsonb; v_index smallint:=0; v_fingerprint text; v_constraint text;
begin
  if v_actor is null or p_correlation_id is null or p_idempotency_key is null
     or p_reviewed_plan is null or jsonb_typeof(p_reviewed_plan)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_reviewed_plan,array[
       'contract_version','partner_id','hotel_id','assignment_id',
       'assignment_version','access_snapshot_token','pricing_snapshot_token',
       'evolution_snapshot_token','items','canonical_items','commercial_impacts',
       'reason','commission_policy','plan_fingerprint'])
     or not (p_reviewed_plan?&array['contract_version','partner_id','hotel_id',
       'assignment_id','assignment_version','access_snapshot_token',
       'pricing_snapshot_token','evolution_snapshot_token','items',
       'canonical_items','commercial_impacts','reason','commission_policy',
       'plan_fingerprint'])
     or p_reviewed_plan->>'contract_version'<>
       'hotels_v2_seven_arches_reviewed_pricing_partner_plan_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(
       p_reviewed_plan-'items'-'canonical_items')
     or (p_reviewed_plan->>'hotel_id')::uuid<>c_hotel then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_plan_invalid';
  end if;
  v_partner:=(p_reviewed_plan->>'partner_id')::uuid;
  v_assignment:=(p_reviewed_plan->>'assignment_id')::uuid;
  v_fingerprint:=public.hotel_v2_7a_reviewed_pricing_plan_fingerprint(
    p_reviewed_plan);
  if p_reviewed_plan->>'plan_fingerprint'<>v_fingerprint then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_plan_hash_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-7a-reviewed-pricing-partner-key:'||v_partner::text||':'||
      p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-7a-reviewed-pricing-correlation:'||p_correlation_id::text,0));
  select proposal.submit_correlation_id,proposal.plan_fingerprint,
    proposal.submit_result into v_existing
  from public.hotel_seven_arches_reviewed_pricing_proposals proposal
  where proposal.actor_id=v_actor
    and proposal.submit_idempotency_key=p_idempotency_key;
  if found then
    if v_existing.submit_correlation_id=p_correlation_id
       and v_existing.plan_fingerprint=v_fingerprint then
      return v_existing.submit_result||jsonb_build_object('replayed',true);
    end if;
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_idempotency_conflict';
  end if;
  if exists(select 1 from public.hotel_seven_arches_reviewed_pricing_proposals proposal
    where proposal.submit_correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_correlation_conflict';
  end if;
  v_access:=public.hotel_v2_h3_2b_access_snapshot(v_partner,c_hotel,'manage_prices');
  v_workspace:=public.hotel_v2_partner_get_workspace(
    v_partner,c_hotel,current_date,current_date+30);
  if (v_access->>'assignment_id')::uuid<>v_assignment
     or (v_access->>'permission_version')::bigint<>
       (p_reviewed_plan->>'assignment_version')::bigint
     or p_reviewed_plan->>'access_snapshot_token'<>
       v_workspace#>>'{assignment,access_snapshot_token}'
     or p_reviewed_plan->>'pricing_snapshot_token'<>
       v_workspace#>>'{pricing,snapshot_token}' then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_plan_stale';
  end if;
  v_plan:=public.hotel_v2_seven_arches_reviewed_pricing_build_plan(
    p_reviewed_plan->'items',p_reviewed_plan->>'reason');
  if v_plan->>'evolution_snapshot_token'<>
       p_reviewed_plan->>'evolution_snapshot_token'
     or v_plan->'canonical_items' is distinct from
       p_reviewed_plan->'canonical_items'
     or v_plan->'commercial_impacts' is distinct from
       p_reviewed_plan->'commercial_impacts'
     or v_plan->'commission_policy' is distinct from
       p_reviewed_plan->'commission_policy' then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_plan_stale';
  end if;
  v_activity:=public.hotel_v2_h3_2b_record_activity(c_hotel,'pricing_schedule',
    v_proposal,'create',null,jsonb_build_object('status','pending_admin_review',
      'item_count',jsonb_array_length(v_plan->'canonical_items')),
    p_correlation_id,v_actor);
  v_result:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_submit_result_v1',
    'proposal_id',v_proposal,'hotel_id',c_hotel,'partner_id',v_partner,
    'status','pending_admin_review','changed',false,'replayed',false,
    'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
    'activity',v_activity);
  insert into public.hotel_seven_arches_reviewed_pricing_proposals(
    id,contract_version,hotel_id,initiator_type,partner_id,assignment_id,
    actor_id,status,version,assignment_version,access_snapshot_token,
    pricing_snapshot_token,evolution_snapshot_token,reason,reason_fingerprint,
    item_count,plan_fingerprint,submit_correlation_id,submit_idempotency_key,
    submit_result,created_at,expires_at)
  values(v_proposal,'hotels_v2_seven_arches_reviewed_pricing_proposal_v1',
    c_hotel,'partner',v_partner,v_assignment,v_actor,'pending_admin_review',1,
    (v_access->>'permission_version')::bigint,
    p_reviewed_plan->>'access_snapshot_token',
    p_reviewed_plan->>'pricing_snapshot_token',
    p_reviewed_plan->>'evolution_snapshot_token',p_reviewed_plan->>'reason',
    public.hotel_v2_h3_2b_hash(jsonb_build_object(
      'reason',p_reviewed_plan->>'reason')),
    jsonb_array_length(v_plan->'canonical_items'),v_fingerprint,
    p_correlation_id,p_idempotency_key,v_result,v_now,v_now+interval '30 minutes');
  for v_item in select value from jsonb_array_elements(
      v_plan->'canonical_items') value order by value->>'schedule_tier_id' loop
    v_index:=v_index+1;
    insert into public.hotel_seven_arches_reviewed_pricing_proposal_items(
      proposal_id,item_index,hotel_id,room_key,room_type_id,room_rate_id,
      pricing_schedule_id,schedule_tier_id,guest_count,minimum_nights,
      currency,before_price,requested_price,before_tier_version)
    values(v_proposal,v_index,(v_item->>'hotel_id')::uuid,v_item->>'room_key',
      (v_item->>'room_type_id')::uuid,(v_item->>'room_rate_id')::uuid,
      (v_item->>'pricing_schedule_id')::uuid,
      (v_item->>'schedule_tier_id')::uuid,
      (v_item->>'guest_count')::smallint,
      (v_item->>'minimum_nights')::integer,v_item->>'currency',
      (v_item->>'before_price')::numeric,
      (v_item->>'requested_price')::numeric,
      (v_item->>'before_tier_version')::bigint);
  end loop;
  return v_result;
exception when unique_violation then
  get stacked diagnostics v_constraint=constraint_name;
  if v_constraint in('hotel_7a_reviewed_pricing_one_pending_assignment_uidx',
      'hotel_seven_arches_reviewed_pricing_proposals_actor_id_submit_idempotency_key_key',
      'hotel_seven_arches_reviewed_pricing_proposals_submit_correlation_id_key') then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_pending_proposal_exists';
  end if;
  raise;
end;
$function$;

create function public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
  p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_actor uuid:=auth.uid(); v_review_id uuid;
  v_review public.hotel_seven_arches_reviewed_pricing_admin_reviews%rowtype;
  v_proposal public.hotel_seven_arches_reviewed_pricing_proposals%rowtype;
  v_item public.hotel_seven_arches_reviewed_pricing_proposal_items%rowtype;
  v_plan jsonb; v_raw_items jsonb; v_before jsonb; v_after jsonb;
  v_now timestamptz:=clock_timestamp(); v_sequence bigint; v_previous_hash text;
  v_result jsonb; v_activity_id uuid; v_activity_ids uuid[];
  v_receipt public.hotel_seven_arches_reviewed_pricing_evolution_receipts%rowtype;
  v_changed_items jsonb:='[]'::jsonb; v_changed_rooms text[];
  v_untouched text; v_existing record;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_correlation_id is null or p_idempotency_key is null
     or p_reviewed_plan is null or jsonb_typeof(p_reviewed_plan)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_reviewed_plan,array[
       'contract_version','review_id','hotel_id','proposal_id','proposal_version',
       'initiator_type','partner_id','assignment_id','actor_id','action',
       'admin_reason','proposal_reason','canonical_items','commercial_impacts',
       'commission_policy','evolution_snapshot_token','reviewed_at','expires_at',
       'plan_fingerprint'])
     or not (p_reviewed_plan?&array['contract_version','review_id','hotel_id',
       'proposal_id','proposal_version','initiator_type','partner_id','assignment_id',
       'actor_id','action','admin_reason','proposal_reason','canonical_items',
       'commercial_impacts','commission_policy','evolution_snapshot_token',
       'reviewed_at','expires_at','plan_fingerprint'])
     or p_reviewed_plan->>'contract_version'<>
       'hotels_v2_seven_arches_reviewed_pricing_admin_plan_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(
       p_reviewed_plan-'canonical_items')
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_reviewed_plan)
     or (p_reviewed_plan->>'hotel_id')::uuid<>c_hotel
     or (p_reviewed_plan->>'actor_id')::uuid<>v_actor then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_reviewed_pricing_admin_plan_invalid';
  end if;
  v_review_id:=(p_reviewed_plan->>'review_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-7a-reviewed-pricing-review:'||v_review_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-7a-reviewed-pricing-correlation:'||p_correlation_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-7a-reviewed-pricing-idempotency:'||v_actor::text||':'||
      p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-7a-reviewed-pricing-receipt-chain',0));
  select * into v_review
  from public.hotel_seven_arches_reviewed_pricing_admin_reviews review
  where review.id=v_review_id for update;
  if v_review.id is null or v_review.actor_id<>v_actor
     or v_review.reviewed_plan is distinct from p_reviewed_plan
     or v_review.plan_fingerprint<>
       public.hotel_v2_7a_reviewed_pricing_plan_fingerprint(
         p_reviewed_plan) then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_reviewed_pricing_admin_plan_invalid';
  end if;
  if v_review.consumed_at is not null then
    if v_review.consumed_correlation_id=p_correlation_id
       and v_review.consumed_idempotency_key=p_idempotency_key then
      return v_review.result||jsonb_build_object('replayed',true);
    end if;
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_review_consumed';
  end if;
  if v_review.expires_at<=clock_timestamp() then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_review_expired';
  end if;
  select * into v_existing
  from public.hotel_seven_arches_reviewed_pricing_admin_reviews review
  where review.actor_id=v_actor and review.consumed_idempotency_key=p_idempotency_key
    and review.id<>v_review.id;
  if found or exists(select 1
      from public.hotel_seven_arches_reviewed_pricing_admin_reviews review
      where review.consumed_correlation_id=p_correlation_id and review.id<>v_review.id)
     or exists(select 1 from public.hotel_activity_log activity
      where activity.correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_apply_identity_conflict';
  end if;
  select * into v_proposal
  from public.hotel_seven_arches_reviewed_pricing_proposals proposal
  where proposal.id=v_review.proposal_id for update;
  if v_proposal.id is null or v_proposal.status<>'pending_admin_review'
     or v_proposal.version<>v_review.proposal_version
     or v_proposal.expires_at<=clock_timestamp() then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_proposal_stale';
  end if;
  if public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(
       v_proposal.id) is not true then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_assignment_stale';
  end if;
  perform 1 from public.hotels where id=c_hotel for update;
  perform 1 from public.hotel_pricing_schedules where hotel_id=c_hotel order by id for update;
  perform 1 from public.hotel_pricing_schedule_occupancy_tiers tier
    where tier.schedule_id in(
      'aec20731-7a56-35f0-334e-92b363351f02'::uuid,
      '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)
    order by tier.id for update;
  perform 1 from public.hotel_seven_arches_independent_pricing_authority
    order by target_tier_id for update;
  perform 1 from public.hotel_commission_policies where hotel_id=c_hotel
    order by id for update;
  perform 1 from public.hotel_payment_policies where hotel_id=c_hotel
    order by id for update;
  perform term.id from public.hotel_payment_policy_terms term
    join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
    where policy.hotel_id=c_hotel order by term.id for update of term;
  if public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
       is not true
     or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
       is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_topology_precondition_failed';
  end if;
  select jsonb_agg(jsonb_build_object(
    'hotel_id',item.hotel_id,'room_type_id',item.room_type_id,
    'room_rate_id',item.room_rate_id,'pricing_schedule_id',item.pricing_schedule_id,
    'schedule_tier_id',item.schedule_tier_id,'guest_count',item.guest_count,
    'minimum_nights',item.minimum_nights,'currency',item.currency,
    'before_price',item.before_price,'requested_price',item.requested_price)
    order by item.item_index),array_agg(distinct item.room_key order by item.room_key)
    into v_raw_items,v_changed_rooms
  from public.hotel_seven_arches_reviewed_pricing_proposal_items item
  where item.proposal_id=v_proposal.id;
  v_plan:=public.hotel_v2_seven_arches_reviewed_pricing_build_plan(
    v_raw_items,v_proposal.reason);
  if v_review.action='accept' and (
       v_plan->>'evolution_snapshot_token'<>
         p_reviewed_plan->>'evolution_snapshot_token'
       or v_plan->'canonical_items' is distinct from
         p_reviewed_plan->'canonical_items'
       or v_plan->'commercial_impacts' is distinct from
         p_reviewed_plan->'commercial_impacts'
       or v_plan->'commission_policy' is distinct from
         p_reviewed_plan->'commission_policy') then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_proposal_stale';
  end if;
  v_sequence:=coalesce((select max(receipt.sequence_no)+1
    from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt),1);
  insert into public.hotel_seven_arches_reviewed_pricing_transaction_context(
    backend_pid,transaction_id,review_id,proposal_id,actor_id,correlation_id,
    idempotency_key,receipt_sequence,selected_tier_ids,created_at)
  select pg_backend_pid(),txid_current(),v_review.id,v_proposal.id,v_actor,
    p_correlation_id,p_idempotency_key,v_sequence,
    array_agg(item.schedule_tier_id order by item.schedule_tier_id),v_now
  from public.hotel_seven_arches_reviewed_pricing_proposal_items item
  where item.proposal_id=v_proposal.id;
  v_before:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  if v_review.action='accept' then
    for v_item in select *
      from public.hotel_seven_arches_reviewed_pricing_proposal_items item
      where item.proposal_id=v_proposal.id order by item.schedule_tier_id loop
      update public.hotel_pricing_schedule_occupancy_tiers tier set
        nightly_rate=v_item.requested_price,version=tier.version+1,
        updated_at=clock_timestamp()
      where tier.id=v_item.schedule_tier_id
        and tier.version=v_item.before_tier_version
        and tier.nightly_rate=v_item.before_price;
      if not found then
        raise exception using errcode='PT409',
          message='hotels_v2_seven_arches_reviewed_pricing_tier_stale';
      end if;
      update public.hotel_seven_arches_independent_pricing_authority authority set
        current_nightly_rate=v_item.requested_price,
        current_target_version=tier.version,
        current_receipt_sequence=v_sequence,updated_at=clock_timestamp()
      from public.hotel_pricing_schedule_occupancy_tiers tier
      where authority.target_tier_id=v_item.schedule_tier_id
        and tier.id=authority.target_tier_id;
      if not found then
        raise exception using errcode='55000',
          message='hotels_v2_seven_arches_reviewed_pricing_authority_update_failed';
      end if;
      v_changed_items:=v_changed_items||jsonb_build_array(jsonb_build_object(
        'room_key',v_item.room_key,'room_type_id',v_item.room_type_id,
        'room_rate_id',v_item.room_rate_id,
        'pricing_schedule_id',v_item.pricing_schedule_id,
        'schedule_tier_id',v_item.schedule_tier_id,
        'pricing_occupancy',v_item.guest_count,'minimum_nights',v_item.minimum_nights,
        'currency',v_item.currency,'before_price',v_item.before_price,
        'after_price',v_item.requested_price,
        'before_version',v_item.before_tier_version,
        'after_version',(select tier.version
          from public.hotel_pricing_schedule_occupancy_tiers tier
          where tier.id=v_item.schedule_tier_id)));
    end loop;
    update public.hotels hotel set pricing_tiers=(
      select jsonb_build_object('currency','EUR','rules',jsonb_agg(
        case when (rule.value->>'persons')::integer between 5 and 8 then
          jsonb_set(rule.value,'{price_per_night}',to_jsonb((
            select sum(tier.nightly_rate)
            from (values
              ('aec20731-7a56-35f0-334e-92b363351f02'::uuid),
              ('9d109336-64f3-3c57-4684-968b59c94c3b'::uuid)
            ) schedule(id)
            join public.hotel_pricing_schedule_occupancy_tiers tier
              on tier.schedule_id=schedule.id and tier.is_active
              and tier.guest_count=case (rule.value->>'persons')::integer
                when 5 then 2 when 6 then 3 else 4 end
              and tier.threshold_nights=(rule.value->>'min_nights')::integer)),false)
        else rule.value end order by rule.ordinality))
      from jsonb_array_elements(hotel.pricing_tiers->'rules')
        with ordinality rule(value,ordinality))
    where hotel.id=c_hotel;
    v_after:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
    if (v_after#>>'{oracle,core_case_count}')::integer<>100
       or (v_after#>>'{oracle,core_mismatch_count}')::integer<>0
       or (v_after#>>'{oracle,guest_one_case_count}')::integer<>20
       or (v_after#>>'{oracle,guest_one_mismatch_count}')::integer<>0
       or v_after->>'commission_fingerprint'<>v_before->>'commission_fingerprint'
       or v_after->>'payment_fingerprint'<>v_before->>'payment_fingerprint'
       or v_after->>'unrelated_fingerprint'<>v_before->>'unrelated_fingerprint' then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_reviewed_pricing_apply_postcondition_failed';
    end if;
    if cardinality(v_changed_rooms)=1 then
      v_untouched:=case v_changed_rooms[1] when 'upper' then 'ground' else 'upper' end;
      if v_before#>>array['room_fingerprints',v_untouched] is distinct from
         v_after#>>array['room_fingerprints',v_untouched] then
        raise exception using errcode='55000',
          message='hotels_v2_seven_arches_reviewed_pricing_untouched_room_changed';
      end if;
    end if;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,
      before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'pricing_schedule',v_proposal.id,'update',
      jsonb_build_object('review_id',v_review.id,'items',v_changed_items,
        'state_fingerprint',v_before->>'snapshot_token'),
      jsonb_build_object('review_id',v_review.id,'items',v_changed_items,
        'state_fingerprint',v_after->>'snapshot_token'),
      'admin',v_actor,'hotels_v2_seven_arches_reviewed_pricing_admin',
      p_correlation_id) returning id into v_activity_id;
    v_activity_ids:=array[v_activity_id];
    select coalesce((select receipt.receipt_hash
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no desc limit 1),foundation.genesis_hash)
      into v_previous_hash
    from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
    where foundation.id=1;
    v_receipt.sequence_no:=v_sequence; v_receipt.id:=gen_random_uuid();
    v_receipt.contract_version:=
      'hotels_v2_seven_arches_reviewed_pricing_evolution_receipt_v1';
    v_receipt.previous_receipt_hash:=v_previous_hash;
    v_receipt.receipt_hash:=repeat('0',64); v_receipt.hotel_id:=c_hotel;
    v_receipt.proposal_id:=v_proposal.id; v_receipt.review_id:=v_review.id;
    v_receipt.initiator_type:=v_proposal.initiator_type;
    v_receipt.partner_id:=v_proposal.partner_id;
    v_receipt.assignment_id:=v_proposal.assignment_id; v_receipt.actor_id:=v_actor;
    v_receipt.correlation_id:=p_correlation_id;
    v_receipt.idempotency_key:=p_idempotency_key;
    v_receipt.changed_items:=v_changed_items;
    v_receipt.changed_tier_ids:=(select array_agg(item.schedule_tier_id
      order by item.schedule_tier_id)
      from public.hotel_seven_arches_reviewed_pricing_proposal_items item
      where item.proposal_id=v_proposal.id);
    v_receipt.changed_room_keys:=v_changed_rooms;
    v_receipt.normalized_before_fingerprint:=v_before->>'normalized_fingerprint';
    v_receipt.normalized_after_fingerprint:=v_after->>'normalized_fingerprint';
    v_receipt.authority_before_fingerprint:=v_before->>'authority_fingerprint';
    v_receipt.authority_after_fingerprint:=v_after->>'authority_fingerprint';
    v_receipt.legacy_before_fingerprint:=v_before->>'legacy_fingerprint';
    v_receipt.legacy_after_fingerprint:=v_after->>'legacy_fingerprint';
    v_receipt.parity_before_fingerprint:=v_before#>>'{oracle,fingerprint}';
    v_receipt.parity_after_fingerprint:=v_after#>>'{oracle,fingerprint}';
    v_receipt.commission_fingerprint:=v_after->>'commission_fingerprint';
    v_receipt.payment_fingerprint:=v_after->>'payment_fingerprint';
    v_receipt.unrelated_before_fingerprint:=v_before->>'unrelated_fingerprint';
    v_receipt.unrelated_after_fingerprint:=v_after->>'unrelated_fingerprint';
    v_receipt.untouched_room_key:=v_untouched;
    v_receipt.untouched_room_before_fingerprint:=case when v_untouched is null
      then null else v_before#>>array['room_fingerprints',v_untouched] end;
    v_receipt.untouched_room_after_fingerprint:=case when v_untouched is null
      then null else v_after#>>array['room_fingerprints',v_untouched] end;
    v_receipt.allowed_changed_keys:=array[
      'hotel_pricing_schedule_occupancy_tiers',
      'hotel_seven_arches_independent_pricing_authority',
      'hotels.pricing_tiers','hotel_activity_log',
      'hotel_seven_arches_reviewed_pricing_workflow']::text[];
    v_receipt.reason_fingerprint:=public.hotel_v2_h3_2b_hash(jsonb_build_object(
      'proposal_reason',v_proposal.reason,'admin_reason',v_review.reason));
    v_receipt.activity_ids:=v_activity_ids; v_receipt.created_at:=v_now;
    v_receipt.receipt_hash:=public.hotel_v2_h3_2b_hash(jsonb_set(
      to_jsonb(v_receipt)-'receipt_hash','{created_at}',
      to_jsonb((extract(epoch from v_receipt.created_at)*1000000)::bigint),false));
    insert into public.hotel_seven_arches_reviewed_pricing_evolution_receipts
      select (v_receipt).*;
    v_result:=jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_apply_v1',
      'hotel_id',c_hotel,'proposal_id',v_proposal.id,'review_id',v_review.id,
      'action','accept','status','accepted','changed',true,'replayed',false,
      'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
      'receipt_sequence',v_sequence,'receipt_id',v_receipt.id,
      'receipt_hash',v_receipt.receipt_hash,'changed_items',v_changed_items,
      'commercial_impacts',p_reviewed_plan->'commercial_impacts',
      'commission_policy',p_reviewed_plan->'commission_policy',
      'activity_ids',to_jsonb(v_activity_ids));
  else
    v_after:=v_before;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,
      before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'pricing_schedule',v_proposal.id,'update',
      jsonb_build_object('status',v_proposal.status,'version',v_proposal.version),
      jsonb_build_object('status','rejected','review_id',v_review.id,
        'reason_fingerprint',public.hotel_v2_h3_2b_hash(
          jsonb_build_object('reason',v_review.reason))),
      'admin',v_actor,'hotels_v2_seven_arches_reviewed_pricing_admin',
      p_correlation_id) returning id into v_activity_id;
    v_result:=jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_apply_v1',
      'hotel_id',c_hotel,'proposal_id',v_proposal.id,'review_id',v_review.id,
      'action','reject','status','rejected','changed',false,'replayed',false,
      'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
      'receipt_sequence',null,'receipt_id',null,'receipt_hash',null,
      'changed_items','[]'::jsonb,'commercial_impacts',
      p_reviewed_plan->'commercial_impacts','commission_policy',
      p_reviewed_plan->'commission_policy','activity_ids',jsonb_build_array(v_activity_id));
  end if;
  update public.hotel_seven_arches_reviewed_pricing_proposals proposal set
    status=case v_review.action when 'accept' then 'accepted' else 'rejected' end,
    version=proposal.version+1,consumed_at=clock_timestamp(),
    consumed_review_id=v_review.id,consumed_correlation_id=p_correlation_id
  where proposal.id=v_proposal.id;
  update public.hotel_seven_arches_reviewed_pricing_admin_reviews review set
    consumed_at=clock_timestamp(),consumed_correlation_id=p_correlation_id,
    consumed_idempotency_key=p_idempotency_key,result=v_result
  where review.id=v_review.id;
  delete from public.hotel_seven_arches_reviewed_pricing_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current() and context_row.review_id=v_review.id;
  if not found then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_context_cleanup_failed';
  end if;
  if v_review.action='accept' and
     public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
       is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_receipt_postcondition_failed';
  end if;
  return v_result;
exception when invalid_text_representation or numeric_value_out_of_range
    or datetime_field_overflow then
  raise exception using errcode='22023',
    message='hotels_v2_seven_arches_reviewed_pricing_admin_plan_invalid';
end;
$function$;

-- Preserve the generic Partner pricing implementation for every other Hotel,
-- then make the protected 7 Arches entry point explicit and fail closed.
do $seven_arches_reviewed_pricing_legacy_partner_cores$
declare v_source text; v_needle text;
begin
  if to_regprocedure(
       'public.hotel_v2_partner_preview_pricing_plan_legacy_core(jsonb)') is not null
     or to_regprocedure(
       'public.hotel_v2_partner_apply_pricing_plan_legacy_core(jsonb,uuid,uuid)') is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_legacy_core_exists';
  end if;
  v_source:=pg_get_functiondef(
    'public.hotel_v2_partner_preview_pricing_plan(jsonb)'::regprocedure);
  v_needle:='CREATE OR REPLACE FUNCTION public.hotel_v2_partner_preview_pricing_plan(p_draft jsonb)';
  if (length(v_source)-length(replace(v_source,v_needle,'')))/length(v_needle)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_preview_source_drift';
  end if;
  execute replace(v_source,v_needle,
    'CREATE FUNCTION public.hotel_v2_partner_preview_pricing_plan_legacy_core(p_draft jsonb)');
  v_source:=pg_get_functiondef(
    'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'::regprocedure);
  v_needle:='CREATE OR REPLACE FUNCTION public.hotel_v2_partner_apply_pricing_plan(p_reviewed_plan jsonb, p_correlation_id uuid, p_idempotency_key uuid)';
  if (length(v_source)-length(replace(v_source,v_needle,'')))/length(v_needle)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_partner_apply_source_drift';
  end if;
  execute replace(v_source,v_needle,
    'CREATE FUNCTION public.hotel_v2_partner_apply_pricing_plan_legacy_core(p_reviewed_plan jsonb, p_correlation_id uuid, p_idempotency_key uuid)');
end;
$seven_arches_reviewed_pricing_legacy_partner_cores$;

create or replace function public.hotel_v2_partner_preview_pricing_plan(p_draft jsonb)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
begin
  if p_draft is not null and jsonb_typeof(p_draft)='object'
     and p_draft->>'hotel_id'=
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca' then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_required';
  end if;
  return public.hotel_v2_partner_preview_pricing_plan_legacy_core(p_draft);
end;
$function$;

create or replace function public.hotel_v2_partner_apply_pricing_plan(
  p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
begin
  if p_reviewed_plan is not null and jsonb_typeof(p_reviewed_plan)='object'
     and p_reviewed_plan->>'hotel_id'=
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca' then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_reviewed_pricing_required';
  end if;
  return public.hotel_v2_partner_apply_pricing_plan_legacy_core(
    p_reviewed_plan,p_correlation_id,p_idempotency_key);
end;
$function$;

do $seven_arches_reviewed_pricing_freeze_evolution$
declare v_source text; v_needle text; v_replacement text;
begin
  v_source:=pg_get_functiondef(
    'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure);
  v_needle='and not v_activation_context then';
  if (length(v_source)-length(replace(v_source,v_needle,'')))/length(v_needle)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_freeze_source_drift';
  end if;
  v_replacement:=$replacement$and not v_activation_context
     and not (tg_op='UPDATE'
       and tg_table_name='hotel_pricing_schedule_occupancy_tiers'
       and v_old_hotel=c_hotel and v_new_hotel=c_hotel
       and exists(select 1
         from public.hotel_seven_arches_reviewed_pricing_transaction_context context_row
         join public.hotel_seven_arches_reviewed_pricing_admin_reviews review
           on review.id=context_row.review_id and review.action='accept'
             and review.consumed_at is null
         join public.hotel_seven_arches_reviewed_pricing_proposal_items item
           on item.proposal_id=context_row.proposal_id
             and item.schedule_tier_id=old.id
         where context_row.backend_pid=pg_backend_pid()
           and context_row.transaction_id=txid_current()
           and old.id=any(context_row.selected_tier_ids)
           and (to_jsonb(old)->>'schedule_id')::uuid=item.pricing_schedule_id
           and (to_jsonb(old)->>'guest_count')::smallint=item.guest_count
           and (to_jsonb(old)->>'threshold_nights')::integer=item.minimum_nights
           and (to_jsonb(old)->>'nightly_rate')::numeric=item.before_price
           and (to_jsonb(old)->>'version')::bigint=item.before_tier_version
           and new.id=old.id
           and (to_jsonb(new)->>'schedule_id')::uuid=
             (to_jsonb(old)->>'schedule_id')::uuid
           and (to_jsonb(new)->>'guest_count')::smallint=
             (to_jsonb(old)->>'guest_count')::smallint
           and (to_jsonb(new)->>'threshold_nights')::integer=
             (to_jsonb(old)->>'threshold_nights')::integer
           and (to_jsonb(new)->>'is_active')::boolean=
             (to_jsonb(old)->>'is_active')::boolean
           and (to_jsonb(new)->>'nightly_rate')::numeric=item.requested_price
           and (to_jsonb(new)->>'version')::bigint=
             (to_jsonb(old)->>'version')::bigint+1
           and (to_jsonb(new)-array['nightly_rate','version','updated_at'])
             is not distinct from
             (to_jsonb(old)-array['nightly_rate','version','updated_at']))) then$replacement$;
  execute replace(v_source,v_needle,v_replacement);
end;
$seven_arches_reviewed_pricing_freeze_evolution$;

create or replace function
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare v_result jsonb:=public.hotel_v2_h3_2b_protected_fingerprints();
  v_legacy jsonb; v_phase1 jsonb; v_key text;
begin
  v_result:=v_result||jsonb_build_object(
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
        and activity.source is distinct from
          'hotels_v2_seven_arches_reviewed_pricing_admin'
        and not (activity.source='hotels_v2_admin_b_property_control' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action='accept'
            and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'')::text));
  v_legacy:=public.hotel_v2_seven_arches_independent_pricing_legacy_projection();
  if v_legacy is not null then
    foreach v_key in array array['hotel_room_rates_protected',
      'hotel_pricing_schedules','hotel_schedule_tiers_protected'] loop
      v_result:=jsonb_set(v_result,array[v_key],
        v_legacy#>array['property',v_key],false);
    end loop;
  end if;
  if public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() then
    select foundation.phase1_property_fingerprints into strict v_phase1
    from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
    where foundation.id=1;
    foreach v_key in array array['hotels','hotel_room_rates_protected',
      'hotel_pricing_schedules','hotel_schedule_tiers_protected'] loop
      if v_result->v_key is null or v_phase1->v_key is null then
        return null;
      end if;
      v_result:=jsonb_set(v_result,array[v_key],v_phase1->v_key,false);
    end loop;
  end if;
  return v_result;
exception when no_data_found or too_many_rows then
  return null;
end;
$function$;

create or replace function
  public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare c_source constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  v_phase1 public.hotel_seven_arches_independent_pricing_evolution_receipts%rowtype;
  v_lineage jsonb;
  v_lineage_normalized jsonb;
begin
  if public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
       is not true then
    return false;
  end if;
  select * into strict v_phase1
  from public.hotel_seven_arches_independent_pricing_evolution_receipts
  where id=1;
  v_lineage:=public.hotel_v2_seven_arches_independent_pricing_activation_lineage();
  if v_lineage is null then
    return false;
  end if;
  v_lineage_normalized:=v_lineage;
  if v_lineage->>'property_attribution_exact' is distinct from 'true' then
    if public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()
         is not true then
      return false;
    end if;
    v_lineage_normalized:=jsonb_set(v_lineage,
      '{property_attribution_exact}','true'::jsonb,false);
  end if;
  if public.hotel_v2_h3_2b_hash(v_lineage_normalized)
       is distinct from v_phase1.historical_activation_lineage_fingerprint
     or (select count(*)
       from public.hotel_seven_arches_independent_pricing_topology_receipts)<>2
     or exists(select 1
       from public.hotel_seven_arches_independent_pricing_topology_receipts topology
       where topology.contract_version<>
           'hotels_v2_seven_arches_independent_pricing_topology_v1'
         or topology.created_at is null or not isfinite(topology.created_at)
         or topology.room_key not in('upper','ground')
         or topology.source_schedule_id<>c_source
         or topology.source_tier_count<>27 or topology.target_tier_count<>27
         or topology.room_type_id<>case topology.room_key
           when 'upper' then 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
           else '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid end
         or topology.room_rate_id<>case topology.room_key
           when 'upper' then '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
           else '3320590d-632d-423f-80d0-fd021cba7293'::uuid end
         or topology.independent_schedule_id<>case topology.room_key
           when 'upper' then 'aec20731-7a56-35f0-334e-92b363351f02'::uuid
           else '9d109336-64f3-3c57-4684-968b59c94c3b'::uuid end
         or topology.independent_schedule_code<>case topology.room_key
           when 'upper' then 'upper-apartment-independent'
           else 'ground-apartment-independent' end
         or topology.source_tier_fingerprint<>
           topology.target_initial_tier_fingerprint
         or topology.source_tier_fingerprint<>public.hotel_v2_h3_2b_hash(
           coalesce((select jsonb_agg(jsonb_build_object(
             'guest_count',tier.guest_count,
             'threshold_nights',tier.threshold_nights,
             'nightly_rate',tier.nightly_rate,
             'currency',btrim(schedule.currency::text),
             'is_active',tier.is_active,'version',tier.version)
             order by tier.guest_count,tier.threshold_nights)
           from public.hotel_pricing_schedule_occupancy_tiers tier
           join public.hotel_pricing_schedules schedule
             on schedule.id=tier.schedule_id
           where tier.schedule_id=c_source),'[]'::jsonb))
         or topology.target_initial_tier_fingerprint<>
           public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
             jsonb_build_object('guest_count',authority.guest_count,
               'threshold_nights',authority.threshold_nights,
               'nightly_rate',authority.initial_nightly_rate,
               'currency',authority.currency,
               'is_active',authority.target_initial_is_active,
               'version',authority.target_initial_version)
             order by authority.guest_count,authority.threshold_nights)
           from public.hotel_seven_arches_independent_pricing_authority authority
           where authority.room_key=topology.room_key),'[]'::jsonb))
         or topology.source_schedule_fingerprint<>
           public.hotel_v2_h3_2b_hash((select jsonb_build_object(
             'name_i18n',schedule.name_i18n,
             'application_scope',schedule.application_scope,
             'currency',btrim(schedule.currency::text),
             'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
             'maximum_party_size',schedule.maximum_party_size,
             'is_active',schedule.is_active,'review_status',schedule.review_status,
             'source',schedule.source,'sharing_mode',schedule.sharing_mode,
             'version',schedule.version)
           from public.hotel_pricing_schedules schedule where schedule.id=c_source))
         or topology.target_schedule_fingerprint<>
           public.hotel_v2_h3_2b_hash((select jsonb_build_object(
             'name_i18n',schedule.name_i18n,
             'application_scope',schedule.application_scope,
             'currency',btrim(schedule.currency::text),
             'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
             'maximum_party_size',schedule.maximum_party_size,
             'is_active',schedule.is_active,'review_status',schedule.review_status,
             'source',schedule.source,'sharing_mode',schedule.sharing_mode,
             'version',schedule.version)
           from public.hotel_pricing_schedules schedule
           where schedule.id=topology.independent_schedule_id))
         or topology.authority_fingerprint<>
           public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
             to_jsonb(authority)-array['created_at','current_nightly_rate',
               'current_target_version','current_receipt_sequence','updated_at']
             order by authority.target_tier_id)
           from public.hotel_seven_arches_independent_pricing_authority authority
           where authority.room_key=topology.room_key),'[]'::jsonb))) then
    return false;
  end if;
  return true;
exception when no_data_found or too_many_rows or undefined_table
    or undefined_function then
  return false;
end;
$function$;

alter table public.hotel_seven_arches_reviewed_pricing_proposals owner to postgres;
alter table public.hotel_seven_arches_reviewed_pricing_proposal_items owner to postgres;
alter table public.hotel_seven_arches_reviewed_pricing_admin_reviews owner to postgres;
alter table public.hotel_seven_arches_reviewed_pricing_transaction_context owner to postgres;
alter table public.hotel_seven_arches_reviewed_pricing_foundation_receipts owner to postgres;
alter table public.hotel_seven_arches_reviewed_pricing_evolution_receipts owner to postgres;

alter function public.hotel_v2_seven_arches_reviewed_pricing_proposal_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_item_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_review_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_context_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_authority_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_legacy_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_receipt_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_foundation_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_oracle() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_current_state() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_build_plan(jsonb,text) owner to postgres;
alter function public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(uuid) owner to postgres;
alter function public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact() owner to postgres;
alter function public.hotel_v2_7a_reviewed_pricing_plan_fingerprint(jsonb) owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint() owner to postgres;
alter function public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() owner to postgres;
alter function public.hotel_v2_partner_preview_seven_arches_pricing_proposal(jsonb) owner to postgres;
alter function public.hotel_v2_partner_submit_seven_arches_pricing_proposal(jsonb,uuid,uuid) owner to postgres;
alter function public.hotel_v2_admin_get_seven_arches_reviewed_pricing() owner to postgres;
alter function public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(jsonb) owner to postgres;
alter function public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(jsonb,uuid,uuid) owner to postgres;
alter function public.hotel_v2_partner_preview_pricing_plan_legacy_core(jsonb) owner to postgres;
alter function public.hotel_v2_partner_apply_pricing_plan_legacy_core(jsonb,uuid,uuid) owner to postgres;

revoke all on function
  public.hotel_v2_seven_arches_reviewed_pricing_proposal_guard(),
  public.hotel_v2_seven_arches_reviewed_pricing_item_guard(),
  public.hotel_v2_seven_arches_reviewed_pricing_review_guard(),
  public.hotel_v2_seven_arches_reviewed_pricing_context_guard(),
  public.hotel_v2_seven_arches_reviewed_pricing_authority_guard(),
  public.hotel_v2_seven_arches_reviewed_pricing_legacy_guard(),
  public.hotel_v2_seven_arches_reviewed_pricing_receipt_guard(),
  public.hotel_v2_seven_arches_reviewed_pricing_foundation_guard(),
  public.hotel_v2_seven_arches_reviewed_pricing_oracle(),
  public.hotel_v2_seven_arches_reviewed_pricing_current_state(),
  public.hotel_v2_seven_arches_reviewed_pricing_build_plan(jsonb,text),
  public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(uuid),
  public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact(),
  public.hotel_v2_7a_reviewed_pricing_plan_fingerprint(jsonb),
  public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint(),
  public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
  public.hotel_v2_partner_preview_seven_arches_pricing_proposal(jsonb),
  public.hotel_v2_partner_submit_seven_arches_pricing_proposal(jsonb,uuid,uuid),
  public.hotel_v2_admin_get_seven_arches_reviewed_pricing(),
  public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(jsonb),
  public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(jsonb,uuid,uuid),
  public.hotel_v2_partner_preview_pricing_plan_legacy_core(jsonb),
  public.hotel_v2_partner_apply_pricing_plan_legacy_core(jsonb,uuid,uuid)
from public,anon,authenticated,service_role;

revoke all on function
  public.hotel_v2_partner_preview_pricing_plan(jsonb),
  public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid),
  public.hotel_v2_admin_c_h3_1p_freeze_trigger(),
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints(),
  public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
from public,anon,authenticated,service_role;

grant execute on function
  public.hotel_v2_partner_preview_seven_arches_pricing_proposal(jsonb),
  public.hotel_v2_partner_submit_seven_arches_pricing_proposal(jsonb,uuid,uuid),
  public.hotel_v2_admin_get_seven_arches_reviewed_pricing(),
  public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(jsonb),
  public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(jsonb,uuid,uuid),
  public.hotel_v2_partner_preview_pricing_plan(jsonb),
  public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)
to authenticated;

do $seven_arches_reviewed_pricing_foundation$
declare v_before seven_arches_reviewed_pricing_before%rowtype;
  v_foundation public.hotel_seven_arches_reviewed_pricing_foundation_receipts%rowtype;
  v_state jsonb; v_created timestamptz:=clock_timestamp();
begin
  select * into strict v_before from seven_arches_reviewed_pricing_before;
  v_state:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  v_foundation.id:=1;
  v_foundation.contract_version:=
    'hotels_v2_seven_arches_reviewed_pricing_foundation_v1';
  v_foundation.hotel_id:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_foundation.phase1_receipt_fingerprint:=v_before.phase1_receipt_fingerprint;
  v_foundation.initial_normalized_fingerprint:=v_before.normalized_fingerprint;
  v_foundation.initial_authority_fingerprint:=v_before.authority_fingerprint;
  v_foundation.initial_reviewed_authority_fingerprint:=
    v_state->>'authority_fingerprint';
  v_foundation.initial_legacy_fingerprint:=v_before.legacy_fingerprint;
  v_foundation.initial_reviewed_oracle_fingerprint:=
    v_state#>>'{oracle,fingerprint}';
  v_foundation.initial_unrelated_fingerprint:=v_state->>'unrelated_fingerprint';
  v_foundation.commission_fingerprint:=v_before.commission_fingerprint;
  v_foundation.payment_fingerprint:=v_before.payment_fingerprint;
  v_foundation.phase1_property_fingerprints:=v_before.phase1_property_fingerprints;
  v_foundation.phase1_property_fingerprint:=
    public.hotel_v2_h3_2b_hash(v_before.phase1_property_fingerprints);
  v_foundation.partner_preview_source_before_hash:=v_before.partner_preview_source_hash;
  v_foundation.partner_preview_source_after_hash:=public.hotel_v2_h3_2b_hash(
    to_jsonb(pg_get_functiondef(
      'public.hotel_v2_partner_preview_pricing_plan(jsonb)'::regprocedure)));
  v_foundation.partner_apply_source_before_hash:=v_before.partner_apply_source_hash;
  v_foundation.partner_apply_source_after_hash:=public.hotel_v2_h3_2b_hash(
    to_jsonb(pg_get_functiondef(
      'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'::regprocedure)));
  v_foundation.freeze_source_before_hash:=v_before.freeze_source_hash;
  v_foundation.freeze_source_after_hash:=public.hotel_v2_h3_2b_hash(
    to_jsonb(pg_get_functiondef(
      'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure)));
  v_foundation.phase1_oracle_source_hash:=v_before.phase1_oracle_source_hash;
  v_foundation.reviewed_oracle_source_hash:=public.hotel_v2_h3_2b_hash(
    to_jsonb(pg_get_functiondef(
      'public.hotel_v2_seven_arches_reviewed_pricing_oracle()'::regprocedure)));
  v_foundation.topology_source_before_hash:=v_before.topology_source_hash;
  v_foundation.topology_source_after_hash:=public.hotel_v2_h3_2b_hash(
    to_jsonb(pg_get_functiondef(
      'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure)));
  v_foundation.property_source_before_hash:=v_before.property_source_hash;
  v_foundation.property_source_after_hash:=public.hotel_v2_h3_2b_hash(
    to_jsonb(pg_get_functiondef(
      'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure)));
  v_foundation.external_helper_source_hash:=
    'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5';
  v_foundation.genesis_hash:=public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_genesis_v1',
    'hotel_id',v_foundation.hotel_id,
    'phase1_receipt_fingerprint',v_foundation.phase1_receipt_fingerprint,
    'normalized',v_foundation.initial_normalized_fingerprint,
    'authority',v_foundation.initial_reviewed_authority_fingerprint,
    'legacy',v_foundation.initial_legacy_fingerprint,
    'oracle',v_foundation.initial_reviewed_oracle_fingerprint,
    'commission',v_foundation.commission_fingerprint,
    'payment',v_foundation.payment_fingerprint));
  v_foundation.catalog_fingerprint:=
    public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint();
  v_foundation.created_at:=v_created;
  v_foundation.foundation_fingerprint:=repeat('0',64);
  v_foundation.foundation_fingerprint:=public.hotel_v2_h3_2b_hash(jsonb_set(
    to_jsonb(v_foundation)-'foundation_fingerprint','{created_at}',
    to_jsonb((extract(epoch from v_created)*1000000)::bigint),false));
  insert into public.hotel_seven_arches_reviewed_pricing_foundation_receipts
    select (v_foundation).*;
end;
$seven_arches_reviewed_pricing_foundation$;

do $seven_arches_reviewed_pricing_postconditions$
declare v_before seven_arches_reviewed_pricing_before%rowtype;
  v_oracle jsonb; v_evolved integer; v_canonical jsonb;
  v_task2_diff jsonb; v_stage2_diff jsonb;
  v_activation public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
begin
  select * into strict v_before from seven_arches_reviewed_pricing_before;
  v_oracle:=public.hotel_v2_seven_arches_reviewed_pricing_oracle();
  v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();
  select * into strict v_activation
  from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
  select coalesce(jsonb_agg(diff.key order by diff.key),'[]'::jsonb)
    into v_task2_diff
  from (
    select coalesce(current_entry.key,expected_entry.key) key
    from jsonb_each(v_canonical->'task2_protected_fingerprints') current_entry
    full join jsonb_each(v_activation.after_protected_fingerprints) expected_entry
      on expected_entry.key=current_entry.key
    where current_entry.value is distinct from expected_entry.value
  ) diff;
  select coalesce(jsonb_agg(diff.key order by diff.key),'[]'::jsonb)
    into v_stage2_diff
  from (
    select coalesce(current_entry.key,expected_entry.key) key
    from jsonb_each(v_canonical->'stage2_protected_fingerprints') current_entry
    full join jsonb_each(v_activation.after_stage2_protected_fingerprints) expected_entry
      on expected_entry.key=current_entry.key
    where current_entry.value is distinct from expected_entry.value
  ) diff;
  select count(*) into v_evolved from (values
    ('public.hotel_v2_partner_preview_pricing_plan(jsonb)'::regprocedure,
      v_before.partner_preview_source_hash),
    ('public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'::regprocedure,
      v_before.partner_apply_source_hash),
    ('public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure,
      v_before.freeze_source_hash),
    ('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure,
      v_before.property_source_hash),
    ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure,
      v_before.topology_source_hash)
  ) expected(function_id,before_hash)
  where public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(function_id)))<>
    before_hash;
  if current_setting('TimeZone')<>v_before.incoming_timezone
     or v_evolved<>5
     or (select count(*) from
       public.hotel_seven_arches_reviewed_pricing_foundation_receipts)<>1
     or (select count(*) from
       public.hotel_seven_arches_reviewed_pricing_evolution_receipts)<>0
     or (select count(*) from
       public.hotel_seven_arches_independent_pricing_authority)<>54
     or (v_oracle->>'core_case_count')::integer<>100
     or (v_oracle->>'core_mismatch_count')::integer<>0
     or (v_oracle->>'guest_one_case_count')::integer<>20
     or (v_oracle->>'guest_one_mismatch_count')::integer<>0
     or public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
       is not true
     or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
       is not true
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
       is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
       is not true
     or v_task2_diff is distinct from
       '["hotel_pricing_schedules","hotel_room_rates_protected","hotel_schedule_tiers_protected"]'::jsonb
     or v_stage2_diff is distinct from
       '["hotel_pricing_schedules","hotel_room_rates_protected","hotel_schedule_tiers_protected"]'::jsonb
     or encode(extensions.digest(convert_to((select procedure_row.prosrc
       from pg_proc procedure_row where procedure_row.oid=
         'public.hotel_v2_external_calendar_protected_fingerprints()'::regprocedure),
       'UTF8'),'sha256'),'hex')<>
       'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'
     or exists(select 1 from (values
       ('public.hotel_v2_partner_preview_pricing_plan(jsonb)'::regprocedure,'v'::"char",true,
         array['search_path=pg_catalog, public, auth']::text[]),
       ('public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'::regprocedure,'v'::"char",true,
         array['search_path=pg_catalog, public, auth']::text[]),
       ('public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure,'v'::"char",true,
         array['search_path=pg_catalog, public']::text[]),
       ('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()'::regprocedure,
         's'::"char",true,array['search_path=pg_catalog, public']::text[]),
       ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure,
         's'::"char",true,array['search_path=pg_catalog, public']::text[])
     ) expected(function_id,volatility,security_definer,config)
     join pg_proc procedure_row on procedure_row.oid=expected.function_id
     where procedure_row.proowner<>'postgres'::regrole
       or procedure_row.provolatile<>expected.volatility
       or procedure_row.prosecdef<>expected.security_definer
       or procedure_row.proconfig<>expected.config) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_postcondition_failed',
      detail=jsonb_build_object(
        'timezone',current_setting('TimeZone')=v_before.incoming_timezone,
        'evolved_count',v_evolved,
        'foundation_count',(select count(*) from
          public.hotel_seven_arches_reviewed_pricing_foundation_receipts),
        'receipt_count',(select count(*) from
          public.hotel_seven_arches_reviewed_pricing_evolution_receipts),
        'authority_count',(select count(*) from
          public.hotel_seven_arches_independent_pricing_authority),
        'oracle',v_oracle,
        'receipt_chain',public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
        'topology',public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
        'activation_receipt',public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact(),
        'current_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
        'task2_exact',public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact(),
        'property_attributable',
          public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable(),
        'workspace_lineage',public.hotel_v2_partner_workspace_function_lineage_is_exact(),
        'canonical_null',public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() is null,
        'task2_diff',v_task2_diff,
        'stage2_diff',v_stage2_diff,
        'external_hash',encode(extensions.digest(convert_to((select procedure_row.prosrc
          from pg_proc procedure_row where procedure_row.oid=
            'public.hotel_v2_external_calendar_protected_fingerprints()'::regprocedure),
          'UTF8'),'sha256'),'hex'))::text;
  end if;
end;
$seven_arches_reviewed_pricing_postconditions$;

notify pgrst,'reload schema';
commit;
