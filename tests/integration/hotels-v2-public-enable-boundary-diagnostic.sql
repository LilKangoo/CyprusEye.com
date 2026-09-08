\set ON_ERROR_STOP on
-- LOCAL SYNTHETIC FIXTURE ONLY. This is a regression diagnostic, NOT a
-- production preflight or authorization to enable public Hotels V2.
begin;
do $local_only$
begin
 if current_database() !~ '^hotels_functional_' then raise exception 'local fixture required';end if;
end
$local_only$;
do $boundary$
declare v_request jsonb;v_off text;v_on text;
begin
 v_request:=jsonb_build_object('contract_version','hotels_v2_seven_arches_public_quote_request_v1',
   'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   'room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
   'room_rate_id','7e420964-9cbf-4f1b-abd3-09840af5240f',
   'arrival_date',current_date+45,'departure_date',current_date+47,'guest_count',2,'selected_extra_ids','[]'::jsonb);
 update public.site_settings set hotel_rooms_v2_enabled=false where id=1;
 begin perform public.hotel_v2_public_quote_seven_arches(v_request);
 exception when others then v_off:=sqlstate||':'||sqlerrm;end;
 update public.site_settings set hotel_rooms_v2_enabled=true where id=1;
 begin perform public.hotel_v2_public_quote_seven_arches(v_request);
 exception when others then v_on:=sqlstate||':'||sqlerrm;end;
 if v_off is distinct from '42501:hotels_v2_public_booking_disabled'
   or v_on is distinct from '55000:hotels_v2_seven_arches_public_quote_authority_invalid' then
   raise exception 'different boundary: off=%,on=%',v_off,v_on;
 end if;
 raise notice 'PUBLIC_NEW_BOOKING_BLOCKER_REPRODUCED off=% on=%',v_off,v_on;
 update public.site_settings set hotel_rooms_v2_enabled=false,hotel_stripe_connect_enabled=true where id=1;
 if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not false then
   raise exception 'different Stripe lifecycle boundary';end if;
 raise notice 'STRIPE_GLOBAL_FLAG_INTEGRATION_BLOCKER=topology_requires_stripe_false';
end
$boundary$;
rollback;
