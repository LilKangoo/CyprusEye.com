-- car-rental-multicity-stage2a-live-diagnostics-v1
-- Run manually only after schema_preflight_pass is true.

with offer_inventory as (
  select
    co.id,
    co.location,
    co.car_model,
    co.car_type,
    co.description,
    co.features,
    co.owner_partner_id,
    co.price_per_day,
    co.price_3days,
    co.price_4_6days,
    co.price_7_10days,
    co.price_10plus_days,
    co.currency,
    co.deposit_amount,
    co.insurance_per_day,
    co.young_driver_fee,
    co.young_driver_cost,
    co.stock_count,
    co.north_allowed,
    co.is_available,
    co.is_published,
    co.submission_status
  from public.car_offers co
),
invalid_legacy_locations as (
  select
    count(*)::bigint as affected_rows,
    coalesce(jsonb_agg(oi.id order by oi.id), '[]'::jsonb) as offer_ids
  from offer_inventory oi
  where lower(btrim(coalesce(oi.location, ''))) not in ('larnaca', 'paphos')
),
larnaca_price_issues as (
  select
    count(*)::bigint as affected_rows,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'offer_id', oi.id,
          'resolved_current_daily_rate', coalesce(
            nullif(oi.price_per_day, 0),
            nullif(oi.price_10plus_days, 0),
            nullif(oi.price_7_10days, 0),
            nullif(oi.price_4_6days, 0)
          )
        )
        order by oi.id
      ),
      '[]'::jsonb
    ) as offers
  from offer_inventory oi
  where lower(btrim(coalesce(oi.location, ''))) = 'larnaca'
    and (
      coalesce(
        nullif(oi.price_per_day, 0),
        nullif(oi.price_10plus_days, 0),
        nullif(oi.price_7_10days, 0),
        nullif(oi.price_4_6days, 0)
      ) <= 0
      or coalesce(
        nullif(oi.price_per_day, 0),
        nullif(oi.price_10plus_days, 0),
        nullif(oi.price_7_10days, 0),
        nullif(oi.price_4_6days, 0)
      ) is null
    )
),
paphos_matrix_issues as (
  select
    count(*)::bigint as affected_rows,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'offer_id', oi.id,
          'missing_or_nonpositive_fields', array_remove(array[
            case when coalesce(oi.price_3days, 0) <= 0 then 'price_3days' end,
            case when coalesce(oi.price_4_6days, 0) <= 0 then 'price_4_6days' end,
            case when coalesce(oi.price_7_10days, 0) <= 0 then 'price_7_10days' end,
            case when coalesce(oi.price_10plus_days, 0) <= 0 then 'price_10plus_days' end
          ]::text[], null)
        )
        order by oi.id
      ),
      '[]'::jsonb
    ) as offers
  from offer_inventory oi
  where lower(btrim(coalesce(oi.location, ''))) = 'paphos'
    and (
      coalesce(oi.price_3days, 0) <= 0
      or coalesce(oi.price_4_6days, 0) <= 0
      or coalesce(oi.price_7_10days, 0) <= 0
      or coalesce(oi.price_10plus_days, 0) <= 0
    )
),
larnaca_north_disabled as (
  select
    count(*)::bigint as affected_rows,
    coalesce(jsonb_agg(oi.id order by oi.id), '[]'::jsonb) as offer_ids
  from offer_inventory oi
  where lower(btrim(coalesce(oi.location, ''))) = 'larnaca'
    and oi.north_allowed is not true
),
public_larnaca_north_disabled as (
  select
    count(*)::bigint as affected_rows,
    coalesce(jsonb_agg(oi.id order by oi.id), '[]'::jsonb) as offer_ids
  from offer_inventory oi
  where lower(btrim(coalesce(oi.location, ''))) = 'larnaca'
    and oi.north_allowed is not true
    and oi.is_available is true
    and oi.is_published is true
),
unpublished_offers as (
  select
    count(*)::bigint as affected_rows,
    coalesce(jsonb_agg(oi.id order by oi.id), '[]'::jsonb) as offer_ids
  from offer_inventory oi
  where oi.is_published is not true
),
unavailable_offers as (
  select
    count(*)::bigint as affected_rows,
    coalesce(jsonb_agg(oi.id order by oi.id), '[]'::jsonb) as offer_ids
  from offer_inventory oi
  where oi.is_available is not true
),
runtime_shape_rows as (
  select 'car_model'::text as field_name, coalesce(jsonb_typeof(to_jsonb(oi.car_model)), 'sql_null') as runtime_shape
  from offer_inventory oi
  union all
  select 'car_type'::text, coalesce(jsonb_typeof(to_jsonb(oi.car_type)), 'sql_null')
  from offer_inventory oi
  union all
  select 'description'::text, coalesce(jsonb_typeof(to_jsonb(oi.description)), 'sql_null')
  from offer_inventory oi
  union all
  select 'features'::text, coalesce(jsonb_typeof(to_jsonb(oi.features)), 'sql_null')
  from offer_inventory oi
),
runtime_shape_counts as (
  select
    rsr.field_name,
    rsr.runtime_shape,
    count(*)::bigint as shape_count
  from runtime_shape_rows rsr
  group by rsr.field_name, rsr.runtime_shape
),
runtime_shape_fields as (
  select
    rsc.field_name,
    jsonb_object_agg(rsc.runtime_shape, rsc.shape_count order by rsc.runtime_shape) as shapes
  from runtime_shape_counts rsc
  group by rsc.field_name
),
runtime_shape_summary as (
  select coalesce(
    jsonb_object_agg(rsf.field_name, rsf.shapes order by rsf.field_name),
    '{}'::jsonb
  ) as details
  from runtime_shape_fields rsf
),
car_resource_groups as (
  select
    pr.resource_id as offer_id,
    count(*)::bigint as mapping_count,
    count(distinct pr.partner_id)::bigint as partner_count,
    array_agg(distinct pr.partner_id order by pr.partner_id) as partner_ids
  from public.partner_resources pr
  where lower(btrim(coalesce(pr.resource_type, ''))) in ('car', 'cars')
  group by pr.resource_id
),
multiple_car_resources as (
  select
    count(*)::bigint as affected_rows,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'offer_id', crg.offer_id,
          'mapping_count', crg.mapping_count,
          'partner_count', crg.partner_count,
          'partner_ids', to_jsonb(crg.partner_ids)
        )
        order by crg.offer_id
      ),
      '[]'::jsonb
    ) as offers
  from car_resource_groups crg
  where crg.mapping_count > 1
),
owner_resource_conflicts as (
  select
    count(distinct oi.id)::bigint as affected_rows,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'offer_id', oi.id,
          'owner_partner_id', oi.owner_partner_id,
          'mapped_partner_id', pr.partner_id
        )
        order by oi.id, pr.partner_id
      ),
      '[]'::jsonb
    ) as conflicts
  from offer_inventory oi
  join public.partner_resources pr
    on pr.resource_id = oi.id
   and lower(btrim(coalesce(pr.resource_type, ''))) in ('car', 'cars')
  where oi.owner_partner_id is not null
    and pr.partner_id is distinct from oi.owner_partner_id
),
orphan_car_resources as (
  select
    count(*)::bigint as affected_rows,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'resource_id', pr.resource_id,
          'partner_id', pr.partner_id
        )
        order by pr.resource_id, pr.partner_id
      ),
      '[]'::jsonb
    ) as resources
  from public.partner_resources pr
  where lower(btrim(coalesce(pr.resource_type, ''))) in ('car', 'cars')
    and not exists (
      select 1
      from offer_inventory oi
      where oi.id = pr.resource_id
    )
),
orphan_car_deposit_overrides as (
  select
    count(*)::bigint as affected_rows,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'override_id', sdo.id,
          'resource_id', sdo.resource_id
        )
        order by sdo.id
      ),
      '[]'::jsonb
    ) as overrides
  from public.service_deposit_overrides sdo
  where lower(btrim(coalesce(sdo.resource_type, ''))) in ('car', 'cars')
    and not exists (
      select 1
      from offer_inventory oi
      where oi.id = sdo.resource_id
    )
),
protected_offer_fingerprint as (
  select
    count(*)::bigint as offer_count,
    md5(coalesce(
      string_agg(
        jsonb_build_array(
          oi.id,
          oi.price_per_day,
          oi.price_3days,
          oi.price_4_6days,
          oi.price_7_10days,
          oi.price_10plus_days,
          oi.currency,
          oi.location,
          oi.owner_partner_id,
          oi.deposit_amount,
          oi.insurance_per_day,
          oi.young_driver_fee,
          oi.young_driver_cost,
          oi.stock_count,
          oi.north_allowed,
          oi.is_available,
          oi.is_published,
          oi.submission_status
        )::text,
        E'\n' order by oi.id
      ),
      ''
    )) as fingerprint
  from offer_inventory oi
),
base_checks as (
  select
    10 as check_order,
    'diagnostics_version'::text as check_name,
    'INFO'::text as severity,
    true as pass,
    0::bigint as affected_rows,
    jsonb_build_object('version', 'car-rental-multicity-stage2a-live-diagnostics-v1') as details
  union all
  select
    20,
    'invalid_car_offer_legacy_location',
    'BLOCKER',
    ill.affected_rows = 0,
    ill.affected_rows,
    jsonb_build_object('allowed_values', jsonb_build_array('larnaca', 'paphos'), 'offer_ids', ill.offer_ids)
  from invalid_legacy_locations ill
  union all
  select
    30,
    'larnaca_profile_missing_usable_price',
    'BLOCKER',
    lpi.affected_rows = 0,
    lpi.affected_rows,
    jsonb_build_object(
      'resolution_order', jsonb_build_array('price_per_day', 'price_10plus_days', 'price_7_10days', 'price_4_6days'),
      'offers', lpi.offers
    )
  from larnaca_price_issues lpi
  union all
  select
    40,
    'paphos_profile_incomplete_price_matrix',
    'BLOCKER',
    pmi.affected_rows = 0,
    pmi.affected_rows,
    jsonb_build_object(
      'required_durations', jsonb_build_array('3_days', '4_to_6_days', '7_to_10_days', '11_plus_days'),
      'offers', pmi.offers
    )
  from paphos_matrix_issues pmi
  union all
  select
    50,
    'larnaca_offers_with_north_disabled',
    'WARNING',
    lnd.affected_rows = 0,
    lnd.affected_rows,
    jsonb_build_object('offer_ids', lnd.offer_ids)
  from larnaca_north_disabled lnd
  union all
  select
    60,
    'public_larnaca_offers_with_north_disabled',
    'BLOCKER',
    plnd.affected_rows = 0,
    plnd.affected_rows,
    jsonb_build_object('offer_ids', plnd.offer_ids, 'public_definition', 'is_available=true and is_published=true')
  from public_larnaca_north_disabled plnd
  union all
  select
    70,
    'unpublished_car_offers',
    'INFO',
    true,
    uo.affected_rows,
    jsonb_build_object('offer_ids', uo.offer_ids)
  from unpublished_offers uo
  union all
  select
    80,
    'unavailable_car_offers',
    'INFO',
    true,
    uo.affected_rows,
    jsonb_build_object('offer_ids', uo.offer_ids)
  from unavailable_offers uo
  union all
  select
    90,
    'i18n_runtime_shapes',
    'INFO',
    true,
    (select count(*)::bigint from offer_inventory),
    rss.details
  from runtime_shape_summary rss
  union all
  select
    100,
    'multiple_partner_resources_per_exact_offer',
    'BLOCKER',
    mcr.affected_rows = 0,
    mcr.affected_rows,
    jsonb_build_object('offers', mcr.offers)
  from multiple_car_resources mcr
  union all
  select
    110,
    'owner_partner_conflicts_with_partner_resources',
    'BLOCKER',
    orc.affected_rows = 0,
    orc.affected_rows,
    jsonb_build_object('conflicts', orc.conflicts)
  from owner_resource_conflicts orc
  union all
  select
    120,
    'orphan_car_partner_resources',
    'BLOCKER',
    ocr.affected_rows = 0,
    ocr.affected_rows,
    jsonb_build_object('resources', ocr.resources)
  from orphan_car_resources ocr
  union all
  select
    130,
    'orphan_car_service_deposit_overrides',
    'BLOCKER',
    ocdo.affected_rows = 0,
    ocdo.affected_rows,
    jsonb_build_object('overrides', ocdo.overrides)
  from orphan_car_deposit_overrides ocdo
  union all
  select
    140,
    'protected_car_offer_fingerprint',
    'INFO',
    true,
    pof.offer_count,
    jsonb_build_object(
      'algorithm', 'md5-over-canonical-json-lines',
      'fingerprint', pof.fingerprint,
      'fields', jsonb_build_array(
        'id',
        'price_per_day',
        'price_3days',
        'price_4_6days',
        'price_7_10days',
        'price_10plus_days',
        'currency',
        'location',
        'owner_partner_id',
        'deposit_amount',
        'insurance_per_day',
        'young_driver_fee',
        'young_driver_cost',
        'stock_count',
        'north_allowed',
        'is_available',
        'is_published',
        'submission_status'
      )
    )
  from protected_offer_fingerprint pof
),
diagnostic_summary as (
  select
    count(*) filter (where bc.severity = 'BLOCKER' and not bc.pass)::bigint as failed_blockers,
    coalesce(
      jsonb_agg(bc.check_name order by bc.check_order) filter (
        where bc.severity = 'BLOCKER' and not bc.pass
      ),
      '[]'::jsonb
    ) as failed_blocker_names
  from base_checks bc
),
all_checks as (
  select
    bc.check_order,
    bc.check_name,
    bc.severity,
    bc.pass,
    bc.affected_rows,
    bc.details
  from base_checks bc
  union all
  select
    1000,
    'diagnostics_safe_to_continue',
    'SUMMARY',
    ds.failed_blockers = 0,
    ds.failed_blockers,
    jsonb_build_object(
      'failed_blockers', ds.failed_blocker_names,
      'safe_only_when_zero_blockers', true
    )
  from diagnostic_summary ds
)
select
  ac.check_name,
  ac.severity,
  ac.pass,
  ac.affected_rows,
  ac.details
from all_checks ac
order by ac.check_order;
