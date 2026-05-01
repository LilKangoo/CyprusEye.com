begin;

-- Stage 20: restore the legacy admin_adjust_user_xp fallback grant.
--
-- Stage 19 revoked the old overload after code search showed the current admin
-- UI primarily calls public.admin_adjust_user_xp(uuid, integer, text). A linked
-- PL/pgSQL lint then exposed that the newer overload may depend on optional
-- legacy XP event columns. Keep the old overload executable for authenticated
-- admins so the existing fallback remains available while the XP schema is
-- audited separately.
--
-- This restores only the compatibility fallback; public and anon remain revoked.

do $$
declare
  target_function regprocedure := to_regprocedure('public.admin_adjust_user_xp(uuid,integer)');
begin
  if target_function is not null then
    execute format('revoke execute on function %s from public', target_function);
    execute format('revoke execute on function %s from anon', target_function);
    execute format('grant execute on function %s to authenticated', target_function);
    execute format('grant execute on function %s to service_role', target_function);
  end if;
end
$$;

commit;
