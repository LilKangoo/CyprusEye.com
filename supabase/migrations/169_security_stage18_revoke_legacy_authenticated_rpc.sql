begin;

-- Stage 18: revoke signed-in execution from legacy app-owned RPCs that are no
-- longer called by the current frontend/Edge Function flow.
--
-- Current partner/admin fulfillment actions call the partner-fulfillment-action
-- Edge Function, not these legacy direct RPCs. The active admin_ban_user
-- overload used by the admin panel is (uuid, text, interval) and is left intact.

do $$
declare
  target_signature text;
  target_function regprocedure;
begin
  foreach target_signature in array array[
    'public.partner_accept_fulfillment(uuid)',
    'public.partner_reject_fulfillment(uuid,text)',
    'public.partner_accept_service_fulfillment(uuid)',
    'public.partner_reject_service_fulfillment(uuid,text)',
    'public.admin_ban_user(uuid,timestamp with time zone,text)'
  ]
  loop
    target_function := to_regprocedure(target_signature);

    if target_function is not null then
      execute format('revoke execute on function %s from public', target_function);
      execute format('revoke execute on function %s from anon', target_function);
      execute format('revoke execute on function %s from authenticated', target_function);
      execute format('grant execute on function %s to service_role', target_function);
    end if;
  end loop;
end
$$;

commit;
