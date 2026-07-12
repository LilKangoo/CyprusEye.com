-- Special Offers 3C.8B
-- SEO & Social metadata data model + public-safe SEO RPC.
--
-- Prepared only. Do not run until preflight is reviewed.
--
-- Scope:
-- - public.special_offers.meta_image_url
-- - public.special_offer_translations.meta_image_alt
-- - public.get_public_special_offer_seo(text,text)
--
-- Out of scope:
-- - Admin UI
-- - Cloudflare/server-rendered HTML
-- - Partner Portal UI/listing RPC
-- - sitemap
-- - entries, activities, referrals, winner workflow

begin;

do $$
begin
  if to_regclass('public.special_offers') is null then
    raise exception 'Missing required table public.special_offers';
  end if;

  if to_regclass('public.special_offer_translations') is null then
    raise exception 'Missing required table public.special_offer_translations';
  end if;

  if to_regprocedure('public.get_public_special_offer_landing(text)') is null then
    raise exception 'Missing required RPC public.get_public_special_offer_landing(text)';
  end if;
end $$;

alter table public.special_offers
  add column if not exists meta_image_url text;

alter table public.special_offer_translations
  add column if not exists meta_image_alt text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'special_offers'
      and con.conname = 'special_offers_meta_image_url_safe_check'
  ) then
    alter table public.special_offers
      add constraint special_offers_meta_image_url_safe_check
      check (
        meta_image_url is null
        or (
          btrim(meta_image_url) <> ''
          and meta_image_url !~ '^//'
          and meta_image_url ~* '^(https?://|/)'
        )
      );
  end if;
end $$;

create or replace function public.get_public_special_offer_seo(
  p_slug text,
  p_lang text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_requested_lang text := lower(btrim(coalesce(p_lang, '')));
  v_offer public.special_offers%rowtype;
  v_translation public.special_offer_translations%rowtype;
  v_resolved_lang text;
  v_meta_title text;
  v_meta_description text;
  v_meta_image_url text;
  v_meta_image_alt text;
begin
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return null;
  end if;

  if v_requested_lang not in ('pl', 'en', 'he') then
    return null;
  end if;

  select o.*
    into v_offer
  from public.special_offers o
  where o.slug = v_slug
    and o.visibility = 'public'
    and o.archived_at is null
    and o.start_at is not null
    and now() >= o.start_at
    and o.status in ('active', 'ended', 'locked')
  limit 1;

  if not found then
    return null;
  end if;

  select t.*
    into v_translation
  from public.special_offer_translations t
  where t.offer_id = v_offer.id
  order by
    case
      when t.lang = v_requested_lang then 0
      when t.lang = 'en' then 1
      when t.lang = 'pl' then 2
      when t.lang = 'he' then 3
      else 4
    end,
    t.lang
  limit 1;

  v_resolved_lang := coalesce(v_translation.lang, v_requested_lang);
  v_meta_title := nullif(btrim(coalesce(v_translation.seo_title, v_translation.title, v_offer.slug)), '');
  v_meta_description := left(
    regexp_replace(
      regexp_replace(
        coalesce(
          nullif(btrim(v_translation.seo_description), ''),
          nullif(btrim(v_translation.short_description), ''),
          nullif(btrim(v_translation.full_description), ''),
          ''
        ),
        '<[^>]*>',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    ),
    300
  );
  v_meta_description := btrim(coalesce(v_meta_description, ''));

  v_meta_image_url := nullif(btrim(coalesce(
    v_offer.meta_image_url,
    v_offer.cover_image_url,
    v_offer.hero_image_url,
    ''
  )), '');

  if v_meta_image_url is not null
    and (
      v_meta_image_url ~ '^//'
      or v_meta_image_url !~* '^(https?://|/)'
    ) then
    v_meta_image_url := null;
  end if;

  v_meta_image_alt := nullif(btrim(coalesce(
    v_translation.meta_image_alt,
    v_translation.title,
    v_offer.slug
  )), '');

  return jsonb_build_object(
    'campaign_slug', v_offer.slug,
    'requested_lang', v_requested_lang,
    'resolved_lang', v_resolved_lang,
    'meta_title', coalesce(v_meta_title, v_offer.slug),
    'meta_description', coalesce(v_meta_description, ''),
    'meta_image_url', v_meta_image_url,
    'meta_image_alt', coalesce(v_meta_image_alt, v_offer.slug),
    'campaign_status', v_offer.status,
    'start_at', v_offer.start_at,
    'end_at', v_offer.end_at
  );
end;
$$;

alter function public.get_public_special_offer_seo(text,text) owner to postgres;

revoke all on function public.get_public_special_offer_seo(text,text) from public;
revoke all on function public.get_public_special_offer_seo(text,text) from anon;
revoke all on function public.get_public_special_offer_seo(text,text) from authenticated;
revoke all on function public.get_public_special_offer_seo(text,text) from service_role;

grant execute on function public.get_public_special_offer_seo(text,text) to anon, authenticated;

comment on column public.special_offers.meta_image_url is
  'Optional campaign-level social sharing image for Special Offers. Public SEO fallback order is meta_image_url, cover_image_url, hero_image_url.';

comment on column public.special_offer_translations.meta_image_alt is
  'Optional localized alt text for the Special Offer social sharing image.';

comment on function public.get_public_special_offer_seo(text,text) is
  'Read-only public-safe localized SEO payload for public Special Offer clean routes. Returns no entries, answers, activities, referral attribution, audit, winner workflow identifiers, user ids or PII.';

commit;
