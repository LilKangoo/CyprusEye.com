-- car-rental-multicity-stage2a-live-proposal-v1
-- Manual proposal inventory. Every proposed row remains in legacy mode.

with offer_source as (
  select
    co.id as offer_id,
    lower(btrim(coalesce(co.location, ''))) as legacy_location,
    to_jsonb(co.car_model) as model_json,
    co.owner_partner_id,
    co.price_per_day,
    co.price_3days,
    co.price_4_6days,
    co.price_7_10days,
    co.price_10plus_days,
    co.north_allowed,
    co.is_available,
    co.is_published,
    co.submission_status
  from public.car_offers co
),
normalized_offers as (
  select
    os.*,
    coalesce(
      case jsonb_typeof(os.model_json)
        when 'string' then nullif(btrim(os.model_json #>> '{}'), '')
        when 'object' then coalesce(
          nullif(btrim(os.model_json ->> 'en'), ''),
          nullif(btrim(os.model_json ->> 'pl'), ''),
          nullif(btrim(os.model_json ->> 'he'), ''),
          (
            select nullif(btrim(model_value.value), '')
            from jsonb_each_text(os.model_json) as model_value(key, value)
            where nullif(btrim(model_value.value), '') is not null
            order by model_value.key
            limit 1
          )
        )
        when 'null' then null
        else nullif(btrim(os.model_json::text), '')
      end,
      'Unnamed car offer'
    ) as normalized_model
  from offer_source os
)
select
  'car-rental-multicity-stage2a-live-proposal-v1'::text as proposal_version,
  no.offer_id,
  no.normalized_model as model,
  no.legacy_location,
  case no.legacy_location
    when 'larnaca' then 'larnaca'
    when 'paphos' then 'paphos'
    else null
  end as proposed_pricing_profile,
  case no.legacy_location
    when 'larnaca' then array['larnaca']::text[]
    when 'paphos' then array['paphos']::text[]
    else '{}'::text[]
  end as proposed_pickup_cities,
  case no.legacy_location
    when 'larnaca' then array['larnaca']::text[]
    when 'paphos' then array['paphos']::text[]
    else '{}'::text[]
  end as proposed_return_cities,
  case no.legacy_location
    when 'larnaca' then array[
      'larnaca',
      'nicosia',
      'ayia-napa',
      'protaras',
      'limassol',
      'paphos'
    ]::text[]
    when 'paphos' then array['paphos']::text[]
    else '{}'::text[]
  end as supported_candidate_cities,
  array_remove(array[
    case
      when no.legacy_location not in ('larnaca', 'paphos')
      then 'invalid_legacy_location'
    end,
    case
      when no.legacy_location = 'larnaca'
      then 'candidate_cities_require_manual_review'
    end,
    case
      when no.legacy_location = 'paphos'
      then 'paphos_profile_stage2_limited_to_paphos'
    end,
    case
      when no.legacy_location = 'larnaca'
       and coalesce(
         nullif(no.price_per_day, 0),
         nullif(no.price_10plus_days, 0),
         nullif(no.price_7_10days, 0),
         nullif(no.price_4_6days, 0)
       ) is null
      then 'larnaca_usable_price_missing'
    end,
    case
      when no.legacy_location = 'larnaca'
       and coalesce(
         nullif(no.price_per_day, 0),
         nullif(no.price_10plus_days, 0),
         nullif(no.price_7_10days, 0),
         nullif(no.price_4_6days, 0)
       ) <= 0
      then 'larnaca_usable_price_nonpositive'
    end,
    case
      when no.legacy_location = 'paphos'
       and (
         coalesce(no.price_3days, 0) <= 0
         or coalesce(no.price_4_6days, 0) <= 0
         or coalesce(no.price_7_10days, 0) <= 0
         or coalesce(no.price_10plus_days, 0) <= 0
       )
      then 'paphos_price_matrix_incomplete'
    end,
    case when no.owner_partner_id is null then 'owner_partner_not_set' end,
    case when no.north_allowed is not true then 'north_not_allowed' end,
    case when no.is_available is not true then 'offer_not_available' end,
    case when no.is_published is not true then 'offer_not_published' end,
    case
      when coalesce(no.submission_status, '') <> 'approved'
      then 'submission_status_not_approved'
    end,
    case when no.normalized_model = 'Unnamed car offer' then 'model_missing' end
  ]::text[], null) as warnings,
  no.owner_partner_id,
  no.north_allowed,
  no.is_available,
  no.is_published,
  'legacy'::text as resulting_availability_mode
from normalized_offers no
order by no.legacy_location, no.normalized_model, no.offer_id;
