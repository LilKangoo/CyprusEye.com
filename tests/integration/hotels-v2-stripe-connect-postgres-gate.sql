\set ON_ERROR_STOP on
\ir ../../supabase/manual/hotels_v2_partner_stripe_connect_prewrite_readonly.sql
\ir ../../supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql
\ir ../../supabase/manual/hotels_v2_partner_stripe_connect_postinstall_readonly.sql

begin;
-- Synthetic owner capability/flag only. Entire fixture lifecycle rolls back.
-- Older pricing fixtures seed profiles/Partner membership without auth.users.
insert into auth.users(id) values('10000000-0000-4000-8000-000000000002') on conflict do nothing;
update public.hotel_partner_hotel_permissions set initiate_stripe_onboarding=true
 where partner_id='20000000-0000-4000-8000-000000000001';
do $test$
declare
 c_actor uuid:='10000000-0000-4000-8000-000000000002';
 c_partner uuid:='20000000-0000-4000-8000-000000000001';
 c_hotel uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
 v_context jsonb; v_result jsonb; v_neg integer:=0; v_role text; v_attempt jsonb;
begin
 v_context:=jsonb_build_object('actor',c_actor,'partner_id',c_partner,'hotel_id',c_hotel);
 if (public.hotel_v2_stripe_connect_service('scope',v_context)->>'enabled')::boolean is not false then
   raise exception 'disabled flag not retained'; end if;
 begin
   perform public.hotel_v2_stripe_connect_service('begin',v_context);
   raise exception 'disabled begin accepted';
 exception when insufficient_privilege then v_neg:=v_neg+1; end;
 foreach v_role in array array['anon','authenticated'] loop
   begin
     execute format('set local role %I',v_role);
     perform public.hotel_v2_stripe_connect_service('scope',v_context);
     raise exception 'browser service boundary exposed';
   exception when insufficient_privilege then reset role;v_neg:=v_neg+1; end;
 end loop;
 foreach v_role in array array['anon','authenticated','service_role'] loop
   begin
     execute format('set local role %I',v_role);
     perform 1 from hotel_stripe_connect_private.accounts;
     raise exception 'raw accounts exposed';
   exception when insufficient_privilege then reset role;v_neg:=v_neg+1; end;
 end loop;
 update public.site_settings set hotel_stripe_connect_enabled=true where id=1;
 for v_attempt in select value from jsonb_array_elements(jsonb_build_array(
   v_context||jsonb_build_object('actor','10000000-0000-4000-8000-000000000004'),
   v_context||jsonb_build_object('hotel_id','00000000-0000-4000-8000-000000000000'),
   v_context||jsonb_build_object('partner_id','00000000-0000-4000-8000-000000000000'))) loop
   begin
     perform public.hotel_v2_stripe_connect_service('scope',v_attempt);
     raise exception 'scope isolation failed';
   exception when insufficient_privilege then v_neg:=v_neg+1; end;
 end loop;
 v_attempt:=v_context||jsonb_build_object('state',repeat('a',64),'request_id','46000000-0000-4000-8000-000000000001');
 perform public.hotel_v2_stripe_connect_service('begin',v_attempt);
 perform public.hotel_v2_stripe_connect_service('begin',v_attempt);
 if (select count(*) from hotel_stripe_connect_private.oauth_states)<>1 then raise exception 'idempotency failed'; end if;
 begin
   perform public.hotel_v2_stripe_connect_service('begin',v_attempt||jsonb_build_object('hotel_id','c1000000-0000-4000-8000-000000000001'));
   raise exception 'cross-Hotel idempotency accepted';
 exception when raise_exception then
   if sqlerrm<>'hotel_stripe_connect_idempotency_conflict' then raise;end if;v_neg:=v_neg+1;
 end;
 perform public.hotel_v2_stripe_connect_service('claim',v_attempt);
 begin
   perform public.hotel_v2_stripe_connect_service('claim',v_attempt);
   raise exception 'replayed claim accepted';
 exception when raise_exception then
   if sqlerrm<>'hotel_stripe_connect_state_claimed' then raise;end if; v_neg:=v_neg+1;
 end;
 perform public.hotel_v2_stripe_connect_service('finish',v_attempt||jsonb_build_object('account_id','acct_Synthetic','live_mode',false,'status','CONNECTED'));
 v_result:=public.hotel_v2_stripe_connect_service('status',v_context||jsonb_build_object('hotel_id','c1000000-0000-4000-8000-000000000001'));
 if v_result->>'account_id'<>'acct_Synthetic' or v_result->>'status'<>'CONNECTED' then raise exception 'Partner-wide reuse failed'; end if;
 if (public.hotel_v2_stripe_connect_service('status',v_context||jsonb_build_object('actor','10000000-0000-4000-8000-000000000010'))->>'account_id')<>'acct_Synthetic' then
   raise exception 'same Partner co-owner scope failed';end if;
 begin
   insert into hotel_stripe_connect_private.accounts(partner_id,account_id,live_mode,status)
     select id,'acct_Synthetic',false,'CONNECTED' from public.partners where id<>c_partner limit 1;
   raise exception 'cross-Partner duplicate account accepted';
 exception when unique_violation then v_neg:=v_neg+1;end;
 begin
   perform public.hotel_v2_stripe_connect_service('finish',v_attempt||jsonb_build_object('account_id','acct_Synthetic','live_mode',false,'status','CONNECTED'));
   raise exception 'replayed finish accepted';
 exception when raise_exception then
   if sqlerrm<>'hotel_stripe_connect_state_invalid' then raise;end if;v_neg:=v_neg+1;
 end;
 v_attempt:=v_context||jsonb_build_object('state',repeat('b',64),'request_id','46000000-0000-4000-8000-000000000002');
 perform public.hotel_v2_stripe_connect_service('begin',v_attempt);
 update hotel_stripe_connect_private.oauth_states set created_at=clock_timestamp()-interval '20 minutes',
   expires_at=clock_timestamp()-interval '10 minutes' where state=repeat('b',64);
 begin
   perform public.hotel_v2_stripe_connect_service('claim',v_attempt);raise exception 'expired state accepted';
 exception when raise_exception then
   if sqlerrm<>'hotel_stripe_connect_state_invalid' then raise;end if;v_neg:=v_neg+1;
 end;
 v_attempt:=v_context||jsonb_build_object('state',repeat('c',64),'request_id','46000000-0000-4000-8000-000000000003');
 perform public.hotel_v2_stripe_connect_service('begin',v_attempt);
 perform public.hotel_v2_stripe_connect_service('claim',v_attempt);
 begin
   perform public.hotel_v2_stripe_connect_service('finish',v_attempt||jsonb_build_object('account_id','acct_Replacement','live_mode',false,'status','CONNECTED'));
   raise exception 'implicit account replacement accepted';
 exception when raise_exception then
   if sqlerrm<>'hotel_stripe_connect_account_replacement_forbidden' then raise;end if;v_neg:=v_neg+1;
 end;
 perform public.hotel_v2_stripe_connect_service('event',jsonb_build_object('event_id','evt_Revoke','account_id','acct_Synthetic','live_mode',false,'revoked',true,'status','DISABLED','expected_revision',1));
 perform public.hotel_v2_stripe_connect_service('event',jsonb_build_object('event_id','evt_Update','account_id','acct_Synthetic','live_mode',false,'revoked',false,'status','CONNECTED','expected_revision',2));
 if (public.hotel_v2_stripe_connect_service('status',v_context)->>'status')<>'DISABLED' then raise exception 'revocation lost';end if;
 v_result:=public.hotel_v2_stripe_connect_service('event',jsonb_build_object('event_id','evt_Revoke','account_id','acct_Synthetic','live_mode',false,'revoked',true,'status','DISABLED','expected_revision',1));
 if v_result->>'duplicate'<>'true' then raise exception 'event replay not deduplicated';end if;
 if v_neg<>15 then raise exception 'negative count %',v_neg;end if;
 raise notice 'STRIPE_CONNECT_POSTGRES=PASS negatives=% account_scope=Partner two_Hotels=true',v_neg;
end
$test$;
rollback;
do $containment$
begin
 if exists(select 1 from hotel_stripe_connect_private.accounts)
   or exists(select 1 from hotel_stripe_connect_private.oauth_states)
   or exists(select 1 from hotel_stripe_connect_private.events)
   or exists(select 1 from public.site_settings where hotel_stripe_connect_enabled is not false) then
   raise exception 'Stripe fixture containment failed'; end if;
 raise notice 'STRIPE_CONNECT_ROLLBACK_CONTAINMENT=PASS';
end
$containment$;
