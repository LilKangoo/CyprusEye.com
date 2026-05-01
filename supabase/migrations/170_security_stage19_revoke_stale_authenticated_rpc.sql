begin;

-- Stage 19: remove signed-in execution from stale app-owned SECURITY DEFINER
-- RPCs that are not part of the current frontend flow.
--
-- Current admin UI calls:
--   public.admin_adjust_user_xp(uuid, integer, text)
-- and no current app code calls:
--   public.admin_adjust_user_xp(uuid, integer)
--   public.is_user_admin(uuid)
--
-- This is grant-only. It does not change function bodies, triggers, policies,
-- table data, Edge Functions, or service_role access.

do $$
declare
  target_signature text;
  target_function regprocedure;
begin
  foreach target_signature in array array[
    'public.admin_adjust_user_xp(uuid,integer)',
    'public.is_user_admin(uuid)'
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
