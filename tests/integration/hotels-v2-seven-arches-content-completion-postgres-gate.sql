\set ON_ERROR_STOP on
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql
\ir ../../supabase/manual/hotels_v2_seven_arches_content_completion_preflight.sql

begin;
set local statement_timeout='180s';

do $seven_arches_proposal_lifecycle$
declare
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_workspace jsonb; v_draft jsonb; v_preview jsonb; v_apply jsonb;
  v_control jsonb; v_admin_preview jsonb; v_admin_apply jsonb;
  v_proposal jsonb; v_accepted_proposal uuid; v_failed boolean; v_message text;
  v_original_city text; v_assignment uuid; v_slug text; v_photo_path text; v_photo_url text;
begin
  select permission.assignment_id,hotel.slug,hotel.city
  into strict v_assignment,v_slug,v_original_city
  from public.hotel_partner_hotel_permissions permission
  join public.hotels hotel on hotel.id=permission.hotel_id
  where permission.partner_id=c_partner and permission.hotel_id=c_hotel;
  v_photo_path:='hotels/'||v_slug||'/gallery/partner-'||v_assignment::text||
    '-38500000-0000-4000-8000-000000000010.webp';
  v_photo_url:='https://daoohnbnnowmmcizgvrq.supabase.co/storage/v1/object/public/poi-photos/'||v_photo_path;
  insert into storage.objects(id,bucket_id,name,metadata)
  values('38500000-0000-4000-8000-000000000011','poi-photos',v_photo_path,
    '{"mimetype":"image/webp","size":"4096"}'::jsonb);

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_failed:=false;
  begin perform public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  exception when sqlstate '42501' then v_failed:=true; end;
  reset role;
  if not v_failed then raise exception 'seven_arches_non_admin_control_allowed'; end if;

  -- Partner submits one exact proposal through the existing stored Review.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+2);
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',jsonb_build_object(
      'entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','7 Łuków — propozycja','en','7 Arches proposal','he','הצעת 7 קשתות'),
        'check_in_from','15:30'),
      'reason','Reviewed Partner property proposal'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  if not (v_preview->>'changed')::boolean then
    raise exception 'seven_arches_partner_proposal_preview_no_change'; end if;
  v_apply:=public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38500000-0000-4000-8000-000000000001','38500000-0000-4000-8000-000000000002');
  if (v_apply->>'replayed')::boolean then
    raise exception 'seven_arches_partner_proposal_apply_failed'; end if;
  reset role;

  select draft.id into v_accepted_proposal
  from public.hotel_partner_property_drafts draft
  where draft.assignment_id=v_assignment and draft.status='pending_admin_review';
  v_failed:=false;
  begin
    update public.hotel_partner_property_drafts set status='rejected',version=version+1,
      updated_at=clock_timestamp() where id=v_accepted_proposal;
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_h3_2b_property_draft_terminal_review_context_required';
  end;
  if not v_failed then raise exception 'seven_arches_direct_terminal_update_allowed'; end if;

  -- Admin accepts atomically through the existing ADMIN-B property Apply.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  if jsonb_array_length(v_control->'proposals')<>1 then
    raise exception 'seven_arches_admin_pending_proposal_missing:%',v_control; end if;
  v_proposal:=v_control#>'{proposals,0}';
  v_accepted_proposal:=(v_proposal->>'id')::uuid;
  v_admin_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
    'hotel_id',c_hotel,'proposal_id',v_proposal->'id','proposal_version',v_proposal->'version',
    'action','accept','reason','Admin accepted reviewed Partner proposal'));
  v_admin_apply:=public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_admin_preview->'reviewed_plan','38500000-0000-4000-8000-000000000003');
  reset role;
  if v_admin_apply->>'status'<>'accepted'
     or v_admin_apply#>>'{admin_b_result,contract_version}'<>'hotels_v2_admin_b_property_control_v1'
     or (select status from public.hotel_partner_property_drafts
       where id=(v_proposal->>'id')::uuid)<>'accepted' then
    raise exception 'seven_arches_admin_accept_failed:%',v_admin_apply; end if;
  if not public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
     or (select check_in_from::text from public.hotels where id=c_hotel)<>'15:30:00' then
    raise exception 'seven_arches_accepted_canonical_or_time_binding_failed'; end if;

  -- Accepted terminal state is hidden from Partner current draft projection;
  -- the exact canonical value is used and an identical request is a no-op.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+2);
  if (v_workspace#>>'{property_draft,exists}')::boolean
     or v_workspace#>>'{property,title_i18n,en}'<>'7 Arches proposal' then
    raise exception 'seven_arches_terminal_accept_projection_failed:%',v_workspace->'property_draft'; end if;
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',jsonb_build_object(
      'entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',v_workspace#>'{property,title_i18n}'),
      'reason','Exact canonical no-op check'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  if (v_preview->>'changed')::boolean or v_preview->'reviewed_plan'<>'null'::jsonb then
    raise exception 'seven_arches_canonical_noop_failed:%',v_preview; end if;

  -- A fresh edit after terminal acceptance creates a new pending row and does
  -- not merge content from the accepted historical proposal.
  v_draft:=jsonb_set(v_draft,'{intent,payload,title_i18n}',
    '{"pl":"7 Łuków — odrzuć","en":"7 Arches reject","he":"7 קשתות דחייה"}'::jsonb,false);
  v_draft:=jsonb_set(v_draft,'{intent,reason}','"Fresh proposal after accepted terminal"'::jsonb,false);
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  v_apply:=public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38500000-0000-4000-8000-000000000004','38500000-0000-4000-8000-000000000005');
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  if jsonb_array_length(v_control->'proposals')<>1
     or (v_proposal->>'id')::uuid=v_accepted_proposal then
    raise exception 'seven_arches_new_pending_after_terminal_failed:%',v_control; end if;
  v_admin_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
    'hotel_id',c_hotel,'proposal_id',v_proposal->'id','proposal_version',v_proposal->'version',
    'action','reject','reason','Admin rejected fresh Partner proposal'));
  v_admin_apply:=public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_admin_preview->'reviewed_plan','38500000-0000-4000-8000-000000000006');
  reset role;
  if v_admin_apply->>'status'<>'rejected'
     or (select title_i18n->>'en' from public.hotels where id=c_hotel)<>'7 Arches proposal' then
    raise exception 'seven_arches_admin_reject_changed_canonical:%',v_admin_apply; end if;

  -- Create one more pending proposal and prove a fresh canonical Hotel edit
  -- makes the already-reviewed Admin acceptance stale and atomic.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+2);
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',jsonb_build_object(
      'entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','7 Łuków — stale','en','7 Arches stale','he','7 קשתות מיושן')),
      'reason','Proposal used for stale Admin review'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38500000-0000-4000-8000-000000000007','38500000-0000-4000-8000-000000000008');
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  v_admin_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
    'hotel_id',c_hotel,'proposal_id',v_proposal->'id','proposal_version',v_proposal->'version',
    'action','accept','reason','Stale acceptance must be rejected'));
  reset role;
  update public.hotels set city=city||' stale' where id=c_hotel;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_failed:=false;
  begin
    perform public.hotel_v2_admin_apply_partner_property_proposal_plan(
      v_admin_preview->'reviewed_plan','38500000-0000-4000-8000-000000000009');
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_seven_arches_property_proposal_stale';
  end;
  reset role;
  if not v_failed or (select status from public.hotel_partner_property_drafts
      where id=(v_proposal->>'id')::uuid)<>'pending_admin_review' then
    raise exception 'seven_arches_stale_acceptance_atomicity_failed'; end if;
  reset role;
  update public.hotels set city=v_original_city where id=c_hotel;

  -- The exact stale proposal can still be rejected, so one pending row cannot
  -- deadlock future submissions. Replay requires the original correlation.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_admin_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
    'hotel_id',c_hotel,'proposal_id',v_proposal->'id','proposal_version',v_proposal->'version',
    'action','reject','reason','Reject stale proposal to unblock future submissions'));
  v_admin_apply:=public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_admin_preview->'reviewed_plan','38500000-0000-4000-8000-000000000012');
  if not (public.hotel_v2_admin_apply_partner_property_proposal_plan(
      v_admin_preview->'reviewed_plan','38500000-0000-4000-8000-000000000012')->>'replayed')::boolean then
    raise exception 'seven_arches_exact_replay_failed'; end if;
  v_failed:=false;
  begin perform public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_admin_preview->'reviewed_plan','38500000-0000-4000-8000-000000000013');
  exception when sqlstate 'PT409' then v_failed:=true; end;
  if not v_failed then raise exception 'seven_arches_consumed_review_correlation_reuse_allowed'; end if;

  v_failed:=false;
  begin perform public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
    'hotel_id',upper(c_hotel::text),'proposal_id',v_proposal->'id',
    'proposal_version',v_proposal->'version','action','reject','reason','Invalid UUID case',
    'smuggled',true));
  exception when sqlstate '22023' then v_failed:=true; end;
  reset role;
  if not v_failed then raise exception 'seven_arches_admin_review_smuggling_allowed'; end if;

  -- Exact approved Partner storage URL -> pending photo proposal -> Admin accept.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+2);
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',jsonb_build_object(
      'entity','property_photos','action','update','id',c_hotel,
      'payload',jsonb_build_object('cover_image_url',v_photo_url,
        'photos',(v_workspace#>'{property,photos}')||jsonb_build_array(v_photo_url)),
      'reason','Reviewed Partner property photo proposal'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38500000-0000-4000-8000-000000000014','38500000-0000-4000-8000-000000000015');
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  v_admin_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
    'hotel_id',c_hotel,'proposal_id',v_proposal->'id','proposal_version',v_proposal->'version',
    'action','accept','reason','Admin accepted reviewed Partner photo proposal'));
  v_admin_apply:=public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_admin_preview->'reviewed_plan','38500000-0000-4000-8000-000000000016');
  reset role;
  if v_admin_apply->>'status'<>'accepted'
     or (select cover_image_url from public.hotels where id=c_hotel)<>v_photo_url
     or exists(select 1 from public.hotel_partner_property_drafts
       where hotel_id=c_hotel and status='pending_admin_review')
     or not public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() then
    raise exception 'seven_arches_photo_accept_or_terminal_verification_failed'; end if;

  -- A pending proposal may be reviewed back to the exact canonical value.
  -- Admin acceptance is then a proven ADMIN-B semantic no-op with no activity.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+2);
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',jsonb_build_object(
      'entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','Tymczasowy pending','en','Temporary pending','he','טיוטה זמנית')),
      'reason','Create proposal that will return to canonical'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38500000-0000-4000-8000-000000000017','38500000-0000-4000-8000-000000000018');
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+2);
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',jsonb_build_object(
      'entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',v_workspace#>'{property,title_i18n}'),
      'reason','Return pending proposal to exact canonical content'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38500000-0000-4000-8000-000000000019','38500000-0000-4000-8000-000000000020');
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  v_admin_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
    'hotel_id',c_hotel,'proposal_id',v_proposal->'id','proposal_version',v_proposal->'version',
    'action','accept','reason','Accept exact canonical semantic no-op'));
  v_admin_apply:=public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_admin_preview->'reviewed_plan','38500000-0000-4000-8000-000000000021');
  reset role;
  if (v_admin_apply#>>'{admin_b_result,changed}')::boolean
     or exists(select 1 from public.hotel_activity_log
       where source='hotels_v2_admin_b_property_control'
         and correlation_id='38500000-0000-4000-8000-000000000021')
     or exists(select 1 from public.hotel_partner_property_drafts
       where hotel_id=c_hotel and status='pending_admin_review') then
    raise exception 'seven_arches_canonical_noop_accept_failed:%',v_admin_apply; end if;
end
$seven_arches_proposal_lifecycle$;

\ir ../../supabase/manual/hotels_v2_h3_2b_partner_hotel_workspace_post_partner_verify.sql

rollback;

select true as hotels_v2_seven_arches_content_completion_postgres_gate_pass;
