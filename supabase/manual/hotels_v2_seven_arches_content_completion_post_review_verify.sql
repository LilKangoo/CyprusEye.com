-- 7 Arches property/two-Room completion verifier (READ ONLY).
-- It distinguishes exact reviewed content readiness from still-unconfirmed
-- physical details. An absent value is never converted into a guessed fact.

with constants as(
  select '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id,
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid upper_id,
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid ground_id
), room_checks as(
  select room.id,
    public.hotel_v2_admin_b_i18n_is_valid(room.name_i18n,true,240)
      and room.name_i18n?&array['pl','en','he']
      and not exists(select 1 from jsonb_each_text(room.name_i18n) text_value
        where text_value.key in('pl','en','he') and nullif(btrim(text_value.value),'') is null)
      name_ready,
    public.hotel_v2_admin_b_i18n_is_valid(room.description_i18n,false,12000)
      and room.description_i18n?&array['pl','en','he']
      and not exists(select 1 from jsonb_each_text(room.description_i18n) text_value
        where text_value.key in('pl','en','he') and nullif(btrim(text_value.value),'') is null)
      description_ready,
    jsonb_array_length(coalesce(room.gallery,'[]'::jsonb))>0
      and public.hotel_v2_admin_b_room_gallery_is_valid(
        constants.hotel_id,room.id,room.gallery,room.gallery) gallery_ready,
    case when room.id=constants.upper_id then
      room.amenities@>array['air_conditioning','balcony','terrace']::text[]
        and cardinality(room.amenities)=3
    else room.amenities@>array['air_conditioning','terrace']::text[]
        and cardinality(room.amenities)=2 end amenities_ready,
    room.max_occupancy=4 and room.capacity_adults is null
      and room.capacity_children is null and room.inventory_mode='pooled'
      and room.base_inventory_count=1 structure_baseline_ready,
    room.bed_configuration<>'[]'::jsonb
      and public.hotel_v2_admin_b_beds_are_valid(room.bed_configuration)
      and room.bathrooms is not null and room.bathrooms between 0 and 100
      and room.size_sqm is not null and room.size_sqm>0 physical_details_confirmed,
    exists(select 1 from public.hotel_activity_log activity
      where activity.hotel_id=constants.hotel_id and activity.entity_type='room_type'
        and activity.entity_id=room.id
        and activity.source in('hotels_v2_admin_b_room_control','hotels_v2_h3_2b_partner_workspace')
        and not exists(select 1
          from jsonb_each(public.hotel_v2_h3_2b_room_projection(room.id)) current_field(key,value)
          where activity.after_state->current_field.key is distinct from current_field.value)
        and not exists(select 1 from public.hotel_activity_log later
          where later.hotel_id=activity.hotel_id and later.entity_type='room_type'
            and later.entity_id=activity.entity_id
            and later.source in('hotels_v2_admin_b_room_control','hotels_v2_h3_2b_partner_workspace')
            and (later.created_at,later.id)>(activity.created_at,activity.id))) reviewed_activity_exists,
    room.name_i18n,room.description_i18n,room.bed_configuration,room.bathrooms,
    room.size_sqm,room.gallery
  from public.hotel_room_types room cross join constants
  where room.id in(constants.upper_id,constants.ground_id)
), property_check as(
  select public.hotel_v2_admin_b_i18n_is_valid(hotel.title_i18n,true,240)
      and public.hotel_v2_admin_b_i18n_is_valid(hotel.description_i18n,false,12000)
      and hotel.title_i18n?&array['pl','en','he']
      and hotel.description_i18n?&array['pl','en','he']
      and not exists(select 1 from jsonb_each_text(hotel.title_i18n) text_value
        where text_value.key in('pl','en','he') and nullif(btrim(text_value.value),'') is null)
      and not exists(select 1 from jsonb_each_text(hotel.description_i18n) text_value
        where text_value.key in('pl','en','he') and nullif(btrim(text_value.value),'') is null)
      as canonical_content_ready,
    jsonb_array_length(coalesce(hotel.photos,'[]'::jsonb))>0
      and public.hotel_v2_admin_b_property_gallery_is_valid(
        hotel.id,hotel.photos,hotel.photos) gallery_ready,
    exists(select 1 from public.hotel_activity_log activity
      where activity.hotel_id=hotel.id and activity.entity_type='property'
        and activity.source in('hotels_v2_admin_b_property_control',
          'hotels_v2_h2b1_shadow_prepare')) canonical_review_activity_exists,
    exists(select 1 from public.hotel_partner_property_drafts draft
      where draft.hotel_id=hotel.id and draft.status='pending_admin_review') partner_proposal_pending
  from public.hotels hotel cross join constants where hotel.id=constants.hotel_id
), proposal_ledger as(
  select not exists(select 1 from public.hotel_partner_property_drafts draft
    left join public.hotel_partner_property_proposal_admin_reviews review
      on review.proposal_id=draft.id and review.proposal_version+1=draft.version
      and review.consumed_at is not null
    where draft.hotel_id=(select hotel_id from constants)
      and draft.status in('accepted','rejected') and (
        review.id is null
        or review.action is distinct from case when draft.status='accepted' then 'accept' else 'reject' end
        or not exists(select 1 from public.hotel_activity_log activity
          where activity.correlation_id=review.consumed_correlation_id
            and activity.source='hotels_v2_h3_2b_property_proposal_admin_review'
            and activity.entity_type='property' and activity.entity_id=draft.hotel_id)
        or review.result->>'proposal_id' is distinct from draft.id::text
        or review.result->>'status' is distinct from draft.status
        or review.result->>'correlation_id' is distinct from review.consumed_correlation_id::text
        or (draft.status='accepted' and (
          review.result#>>'{admin_b_result,contract_version}' is distinct from
            'hotels_v2_admin_b_property_control_v1'
          or jsonb_typeof(review.result#>'{admin_b_result,changed}')<>'boolean'
          or ((review.result#>>'{admin_b_result,changed}')::boolean and not exists(select 1
            from public.hotel_activity_log activity
            where activity.correlation_id=review.consumed_correlation_id
              and activity.source='hotels_v2_admin_b_property_control'
              and activity.entity_type='property' and activity.entity_id=draft.hotel_id
              and not exists(select 1
                from jsonb_each(draft.content||draft.photos) proposed(key,value)
                where activity.after_state#>array['property',proposed.key] is distinct from
                  case when proposed.key in('check_in_from','check_out_until')
                    and proposed.value<>'null'::jsonb
                    then to_jsonb((proposed.value#>>'{}')::time)
                    else proposed.value end))
          or (not (review.result#>>'{admin_b_result,changed}')::boolean and (
            exists(select 1 from public.hotel_activity_log activity
              where activity.correlation_id=review.consumed_correlation_id
                and activity.source='hotels_v2_admin_b_property_control')
            or exists(select 1 from jsonb_each(draft.content||draft.photos) proposed(key,value)
              where review.result#>'{admin_b_result,workspace,property}'->proposed.key
                is distinct from case when proposed.key in('check_in_from','check_out_until')
                  and proposed.value<>'null'::jsonb
                  then to_jsonb((proposed.value#>>'{}')::time)
                  else proposed.value end)))))
        or (draft.status='rejected' and exists(select 1
          from public.hotel_activity_log activity
          where activity.correlation_id=review.consumed_correlation_id
            and activity.source='hotels_v2_admin_b_property_control'))
      )) and not exists(select 1
        from public.hotel_partner_property_proposal_admin_transaction_context)) value
), accepted_canonical as(
  select public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() value
), foundation as(
  select exists(select 1 from public.hotel_partner_workspace_foundation_receipts original
    join public.hotel_partner_property_proposal_foundation_receipts evolved on evolved.id=original.id
    join public.hotel_admin_availability_foundation_evolution_receipts owner_evolution
      on owner_evolution.id=evolved.owner_evolution_receipt_id
    join public.hotel_admin_availability_foundation_receipts admin_d_original
      on admin_d_original.id=owner_evolution.original_foundation_receipt_id
    where original.id=1
      and original.protected_fingerprint=public.hotel_v2_h3_2b_hash(original.protected_fingerprints)
      and evolved.original_h3_2b_foundation_fingerprint=original.protected_fingerprint
      and evolved.owner_evolution_receipt_id=1
      and evolved.owner_evolution_receipt_fingerprint=
        public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(owner_evolution),'{created_at}',
          to_jsonb(extract(epoch from owner_evolution.created_at)),false))
      and owner_evolution.contract_version='hotels_v2_admin_d_foundation_evolution_v2'
      and owner_evolution.original_protected_fingerprint=admin_d_original.protected_fingerprint
      and admin_d_original.protected_fingerprint=
        public.hotel_v2_h3_2b_hash(admin_d_original.protected_fingerprints)
      and owner_evolution.before_current_protected_fingerprint=
        public.hotel_v2_h3_2b_hash(owner_evolution.before_current_protected_fingerprints)
      and owner_evolution.current_protected_fingerprint=
        public.hotel_v2_h3_2b_hash(owner_evolution.current_protected_fingerprints)
      and owner_evolution.stage2_before_current_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          owner_evolution.stage2_before_current_protected_fingerprints)
      and owner_evolution.stage2_current_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          owner_evolution.stage2_current_protected_fingerprints)
      and evolved.protected_fingerprint=public.hotel_v2_h3_2b_hash(evolved.protected_fingerprints)
      and evolved.protected_fingerprints=
        public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()) value
), verdict as(
  select (select count(*) from room_checks)=2
      and not exists(select 1 from room_checks where not name_ready or not description_ready
        or not gallery_ready or not amenities_ready or not structure_baseline_ready
        or not reviewed_activity_exists) reviewed_content_ready,
    (select count(*) from room_checks)=2
      and not exists(select 1 from room_checks where not physical_details_confirmed)
      as physical_details_confirmed,
    property_check.canonical_content_ready and property_check.gallery_ready
      and property_check.canonical_review_activity_exists as canonical_property_ready,
    property_check.partner_proposal_pending,
    proposal_ledger.value and accepted_canonical.value and foundation.value proposal_ledger_safe
  from property_check cross join proposal_ledger cross join accepted_canonical cross join foundation
)
select 'hotels_v2_seven_arches_content_completion_post_review_v1' contract_version,
  verdict.canonical_property_ready,
  verdict.reviewed_content_ready as two_room_content_ready,
  verdict.physical_details_confirmed,
  verdict.partner_proposal_pending,
  verdict.proposal_ledger_safe,
  coalesce((select jsonb_agg(jsonb_build_object('id',room.id,
    'name_i18n',room.name_i18n,'description_i18n',room.description_i18n,
    'bed_configuration',room.bed_configuration,'bathrooms',room.bathrooms,
    'size_sqm',room.size_sqm,'gallery_count',jsonb_array_length(room.gallery),
    'physical_details_confirmed',room.physical_details_confirmed)
    order by room.id) from room_checks room),'[]'::jsonb) room_completion,
  verdict.canonical_property_ready and verdict.reviewed_content_ready
    and verdict.proposal_ledger_safe and not verdict.partner_proposal_pending
    as hotels_v2_seven_arches_reviewed_content_safe,
  verdict.canonical_property_ready and verdict.reviewed_content_ready
    and verdict.physical_details_confirmed and verdict.proposal_ledger_safe
    and not verdict.partner_proposal_pending
    as hotels_v2_seven_arches_full_content_completion_safe
from verdict;
