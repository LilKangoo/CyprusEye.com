-- Admin User Control Setup
-- Adds moderation columns, admin activity log, helper funcs, and RPCs for admin UI
-- Run in Supabase (Postgres)

-- 1) Columns on profiles
alter table if exists public.profiles
  add column if not exists banned_until timestamptz null,
  add column if not exists ban_reason text null,
  add column if not exists ban_permanent boolean not null default false,
  add column if not exists require_password_change boolean not null default false,
  add column if not exists require_email_update boolean not null default false;

-- 2) Admin activity log
create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_user_id uuid not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3) Helper: check admin from JWT
create or replace function public.is_current_user_admin()
returns boolean
language plpgsql
stable
security definer
as $$
declare
  uid uuid;
  is_admin boolean := false;
begin
  begin
    uid := auth.uid();
  exception when others then
    uid := null;
  end;
  if uid is null then
    return false;
  end if;
  select coalesce(p.is_admin, false) into is_admin from public.profiles p where p.id = uid;
  return coalesce(is_admin, false);
end;
$$;

-- 4) Helper: is a specific user banned
create or replace function public.is_user_banned(u_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(p.ban_permanent, false) or (p.banned_until is not null and now() < p.banned_until)
  from public.profiles p
  where p.id = u_id
$$;

-- 5) RPC: adjust XP
create or replace function public.admin_adjust_user_xp(target_user_id uuid, delta int)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'forbidden';
  end if;
  update public.profiles set xp = greatest(0, coalesce(xp,0) + delta) where id = target_user_id;
  insert into public.admin_activity_log(actor_id, target_user_id, action, details)
  values (auth.uid(), target_user_id, 'xp_adjust', jsonb_build_object('delta', delta));
end;
$$;

-- 6) RPC: set XP and Level
create or replace function public.admin_set_user_xp_level(target_user_id uuid, xp int, level int)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'forbidden';
  end if;
  update public.profiles set 
    xp = case when xp is null or xp < 0 then 0 else xp end,
    level = case when level is null or level < 0 then 0 else level end
  where id = target_user_id;
  update public.profiles set xp = greatest(0, coalesce($2, xp)), level = greatest(0, coalesce($3, level)) where id = target_user_id;
  insert into public.admin_activity_log(actor_id, target_user_id, action, details)
  values (auth.uid(), target_user_id, 'xp_level_set', jsonb_build_object('xp', xp, 'level', level));
end;
$$;

-- 7) RPC: update user profile (username, name, is_admin)
-- Drop old version first to avoid return type/signature conflicts
drop function if exists public.admin_update_user_profile(uuid, text, text, integer, integer, boolean);
create or replace function public.admin_update_user_profile(
  target_user_id uuid,
  new_username text,
  new_name text,
  new_xp int,
  new_level int,
  new_is_admin boolean
)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'forbidden';
  end if;
  update public.profiles set
    username = coalesce(new_username, username),
    name = coalesce(new_name, name),
    xp = coalesce(new_xp, xp),
    level = coalesce(new_level, level),
    is_admin = coalesce(new_is_admin, is_admin)
  where id = target_user_id;
  insert into public.admin_activity_log(actor_id, target_user_id, action, details)
  values (auth.uid(), target_user_id, 'profile_update', jsonb_build_object('username', new_username, 'name', new_name, 'xp', new_xp, 'level', new_level, 'is_admin', new_is_admin));
end;
$$;

-- 8) RPC: set enforcement flags
create or replace function public.admin_set_user_enforcement(
  target_user_id uuid,
  require_password_change boolean,
  require_email_update boolean
)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'forbidden';
  end if;
  update public.profiles set
    require_password_change = coalesce($2, require_password_change),
    require_email_update = coalesce($3, require_email_update)
  where id = target_user_id;
  insert into public.admin_activity_log(actor_id, target_user_id, action, details)
  values (auth.uid(), target_user_id, 'enforcement_update', jsonb_build_object('require_password_change', $2, 'require_email_update', $3));
end;
$$;

-- 9) RPC: get user details (profile + stats)
-- Drop old version first to avoid return type/signature conflicts
drop function if exists public.admin_get_user_details(uuid);
create or replace function public.admin_get_user_details(target_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  p public.profiles%rowtype;
  a record;
  result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'forbidden';
  end if;

  select * into p from public.profiles where id = target_user_id;

  -- Fetch minimal auth data (email, created_at, last_sign_in_at)
  select u.email, u.created_at, u.last_sign_in_at
  into a
  from auth.users u
  where u.id = target_user_id;

  result := jsonb_build_object(
    'profile', to_jsonb(p),
    'auth_data', jsonb_build_object(
      'email', a.email,
      'created_at', a.created_at,
      'last_sign_in_at', a.last_sign_in_at,
      'banned_until', p.banned_until
    ),
    'stats', jsonb_build_object(
      'comments', coalesce((select count(*) from public.poi_comments c where c.user_id = target_user_id),0),
      'ratings',  coalesce((select count(*) from public.poi_ratings r where r.user_id = target_user_id),0),
      'visits',   coalesce((select count(*) from public.user_poi_visits v where v.user_id = target_user_id),0),
      'completed_tasks', coalesce((select count(*) from public.completed_tasks ct where ct.user_id = target_user_id),0),
      'total_xp', coalesce((select sum(t.xp) from public.completed_tasks ct join public.tasks t on t.id = ct.task_id where ct.user_id = target_user_id),0)
    )
  );
  return result;
end;
$$;

-- 10) Basic RLS example: block banned users from inserting comments (adjust per your tables)
-- Example policy (ensure RLS is enabled on your UGC tables):
-- alter table public.poi_comments enable row level security;
-- create policy if not exists poi_comments_insert_allowed on public.poi_comments
--   for insert
--   with check ( not public.is_user_banned(auth.uid()) );

-- 11) Grants for RPCs
grant execute on function public.admin_adjust_user_xp(uuid, int) to authenticated;
grant execute on function public.admin_set_user_xp_level(uuid, int, int) to authenticated;
grant execute on function public.admin_update_user_profile(uuid, text, text, integer, integer, boolean) to authenticated;
grant execute on function public.admin_set_user_enforcement(uuid, boolean, boolean) to authenticated;
grant execute on function public.admin_get_user_details(uuid) to authenticated;
