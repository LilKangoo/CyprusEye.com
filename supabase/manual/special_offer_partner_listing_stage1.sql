-- =====================================================
-- Special Offers 3C.7A - Partner active listing RPC
-- =====================================================
-- Prepared only. Do not run until preflight is reviewed.
--
-- Scope:
-- - read-only partner-authenticated listing RPC
--
-- Out of scope:
-- - Partner Portal UI
-- - referral attribution writes
-- - entries / answers / activities
-- - winner workflow data
-- =====================================================

do $$
begin
  if to_regclass('public.special_offers') is null then
    raise exception 'Missing required table public.special_offers';
  end if;

  if to_regclass('public.special_offer_translations') is null then
    raise exception 'Missing required table public.special_offer_translations';
  end if;

  if to_regclass('public.partners') is null then
    raise exception 'Missing required table public.partners';
  end if;

  if to_regclass('public.partner_users') is null then
    raise exception 'Missing required table public.partner_users';
  end if;

  if to_regprocedure('public.is_partner_user(uuid)') is null then
    raise exception 'Missing required helper public.is_partner_user(uuid)';
  end if;
end $$;

create or replace function public.get_partner_active_special_offers(
  p_lang text
)
returns table (
  slug text,
  requested_lang text,
  resolved_lang text,
  title text,
  short_description text,
  cover_image_url text,
  start_at timestamptz,
  end_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested_lang text := lower(btrim(coalesce(p_lang, '')));
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_requested_lang not in ('pl', 'en', 'he') then
    raise exception 'invalid_language' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.partners p
    where p.status = 'active'
      and public.is_partner_user(p.id)
  ) then
    raise exception 'partner_required' using errcode = '42501';
  end if;

  return query
  with eligible_offers as (
    select
      o.id,
      o.slug,
      o.cover_image_url,
      o.hero_image_url,
      o.start_at,
      o.end_at
    from public.special_offers o
    where o.status = 'active'
      and o.visibility = 'public'
      and o.start_at is not null
      and o.end_at is not null
      and now() >= o.start_at
      and now() <= o.end_at
      and o.archived_at is null
  ),
  localized as (
    select
      eo.slug,
      v_requested_lang as requested_lang,
      coalesce(req.lang, en.lang, pl.lang, he.lang) as resolved_lang,
      coalesce(req.title, en.title, pl.title, he.title) as title,
      coalesce(req.short_description, en.short_description, pl.short_description, he.short_description) as short_description,
      nullif(btrim(coalesce(eo.cover_image_url, eo.hero_image_url, '')), '') as cover_image_url,
      eo.start_at,
      eo.end_at
    from eligible_offers eo
    left join public.special_offer_translations req
      on req.offer_id = eo.id
     and req.lang = v_requested_lang
    left join public.special_offer_translations en
      on en.offer_id = eo.id
     and en.lang = 'en'
    left join public.special_offer_translations pl
      on pl.offer_id = eo.id
     and pl.lang = 'pl'
    left join public.special_offer_translations he
      on he.offer_id = eo.id
     and he.lang = 'he'
  )
  select
    l.slug,
    l.requested_lang,
    l.resolved_lang,
    l.title,
    l.short_description,
    l.cover_image_url,
    l.start_at,
    l.end_at
  from localized l
  where l.resolved_lang is not null
    and nullif(btrim(coalesce(l.title, '')), '') is not null
  order by l.end_at asc, l.slug asc;
end;
$$;

alter function public.get_partner_active_special_offers(text) owner to postgres;

revoke all on function public.get_partner_active_special_offers(text) from public;
revoke all on function public.get_partner_active_special_offers(text) from anon;
revoke all on function public.get_partner_active_special_offers(text) from authenticated;
revoke all on function public.get_partner_active_special_offers(text) from service_role;

grant execute on function public.get_partner_active_special_offers(text) to authenticated;

comment on function public.get_partner_active_special_offers(text) is
  'Read-only active Special Offers listing for authenticated active partners. Returns public campaign card fields only; referral URLs are built in Partner Portal.';
