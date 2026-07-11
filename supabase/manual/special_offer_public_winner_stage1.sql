-- Special Offers 3C.6E
-- Public-safe winner result read path + ended public campaign landing support.
--
-- Purpose:
-- - keep public Special Offer campaign content readable after the campaign ends,
-- - keep submit/activity RPC date guards unchanged,
-- - expose only the manually approved public winner name after admin publication,
-- - never expose entry ids, workflow ids, user ids, contact notes, score, answers, evidence or PII.
--
-- Run only after 3C.6A manual winner backend has verified successfully.

begin;

do $$
begin
  if to_regclass('public.special_offers') is null then
    raise exception 'Missing required table public.special_offers';
  end if;
  if to_regclass('public.special_offer_translations') is null then
    raise exception 'Missing required table public.special_offer_translations';
  end if;
  if to_regclass('public.special_offer_prizes') is null then
    raise exception 'Missing required table public.special_offer_prizes';
  end if;
  if to_regclass('public.special_offer_prize_translations') is null then
    raise exception 'Missing required table public.special_offer_prize_translations';
  end if;
  if to_regclass('public.special_offer_links') is null then
    raise exception 'Missing required table public.special_offer_links';
  end if;
  if to_regclass('public.special_offer_link_translations') is null then
    raise exception 'Missing required table public.special_offer_link_translations';
  end if;
  if to_regclass('public.special_offer_form_fields') is null then
    raise exception 'Missing required table public.special_offer_form_fields';
  end if;
  if to_regclass('public.special_offer_form_field_translations') is null then
    raise exception 'Missing required table public.special_offer_form_field_translations';
  end if;
  if to_regclass('public.special_offer_winner_workflows') is null then
    raise exception 'Missing required table public.special_offer_winner_workflows';
  end if;
  if to_regclass('public.special_offer_winner_publications') is null then
    raise exception 'Missing required table public.special_offer_winner_publications';
  end if;
end $$;

create or replace function public.get_public_special_offer_landing(
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_offer public.special_offers%rowtype;
begin
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return null;
  end if;

  select o.*
    into v_offer
  from public.special_offers o
  where o.slug = v_slug
    and o.status in ('active', 'ended', 'locked')
    and o.visibility = 'public'
    and o.archived_at is null
    and o.start_at is not null
    and o.end_at is not null
    and now() >= o.start_at
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'campaign',
      to_jsonb(v_offer)
      - 'created_by'
      - 'updated_by',
    'translations',
      coalesce((
        select jsonb_agg(to_jsonb(t) order by t.lang)
        from public.special_offer_translations t
        where t.offer_id = v_offer.id
      ), '[]'::jsonb),
    'prizes',
      coalesce((
        select jsonb_agg(to_jsonb(p) order by p.sort_order, p.id)
        from public.special_offer_prizes p
        where p.offer_id = v_offer.id
      ), '[]'::jsonb),
    'prizeTranslations',
      coalesce((
        select jsonb_agg(to_jsonb(pt) order by pt.lang, pt.id)
        from public.special_offer_prize_translations pt
        join public.special_offer_prizes p on p.id = pt.prize_id
        where p.offer_id = v_offer.id
      ), '[]'::jsonb),
    'links',
      coalesce((
        select jsonb_agg(to_jsonb(l) order by l.sort_order, l.id)
        from public.special_offer_links l
        where l.offer_id = v_offer.id
      ), '[]'::jsonb),
    'linkTranslations',
      coalesce((
        select jsonb_agg(to_jsonb(lt) order by lt.lang, lt.id)
        from public.special_offer_link_translations lt
        join public.special_offer_links l on l.id = lt.link_id
        where l.offer_id = v_offer.id
      ), '[]'::jsonb),
    'formFields',
      case
        when v_offer.requires_form is true then coalesce((
          select jsonb_agg(
            to_jsonb(f)
            - 'admin_note'
            - 'created_by'
            - 'updated_by'
            order by f.sort_order, f.id
          )
          from public.special_offer_form_fields f
          where f.offer_id = v_offer.id
            and f.active is true
        ), '[]'::jsonb)
        else '[]'::jsonb
      end,
    'formFieldTranslations',
      case
        when v_offer.requires_form is true then coalesce((
          select jsonb_agg(to_jsonb(ft) order by ft.lang, ft.id)
          from public.special_offer_form_field_translations ft
          join public.special_offer_form_fields f on f.id = ft.field_id
          where f.offer_id = v_offer.id
            and f.active is true
        ), '[]'::jsonb)
        else '[]'::jsonb
      end
  );
end;
$$;

create or replace function public.get_public_special_offer_winner(
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_result jsonb;
begin
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return jsonb_build_object(
      'winner_published', false,
      'public_name', null,
      'published_at', null,
      'campaign_slug', null
    );
  end if;

  select jsonb_build_object(
      'winner_published', true,
      'public_name', p.public_name,
      'published_at', p.published_at,
      'campaign_slug', o.slug
    )
    into v_result
  from public.special_offers o
  join public.special_offer_winner_workflows w
    on w.offer_id = o.id
   and w.status = 'published'
   and w.published_at is not null
  join public.special_offer_winner_publications p
    on p.workflow_id = w.id
   and p.offer_id = o.id
   and p.entry_id = w.confirmed_entry_id
  where o.slug = v_slug
    and o.visibility = 'public'
    and o.status in ('active', 'ended', 'locked')
    and o.archived_at is null
    and p.publication_consent_confirmed is true
    and p.published_at is not null
    and p.unpublished_at is null
    and nullif(btrim(p.public_name), '') is not null
  order by p.published_at desc
  limit 1;

  return coalesce(v_result, jsonb_build_object(
    'winner_published', false,
    'public_name', null,
    'published_at', null,
    'campaign_slug', v_slug
  ));
end;
$$;

alter function public.get_public_special_offer_landing(text) owner to postgres;
alter function public.get_public_special_offer_winner(text) owner to postgres;

revoke all on function public.get_public_special_offer_landing(text) from public;
revoke all on function public.get_public_special_offer_landing(text) from anon;
revoke all on function public.get_public_special_offer_landing(text) from authenticated;
revoke all on function public.get_public_special_offer_landing(text) from service_role;
grant execute on function public.get_public_special_offer_landing(text) to anon, authenticated;

revoke all on function public.get_public_special_offer_winner(text) from public;
revoke all on function public.get_public_special_offer_winner(text) from anon;
revoke all on function public.get_public_special_offer_winner(text) from authenticated;
revoke all on function public.get_public_special_offer_winner(text) from service_role;
grant execute on function public.get_public_special_offer_winner(text) to anon, authenticated;

comment on function public.get_public_special_offer_landing(text) is
  'Read-only public landing payload for public Special Offer campaigns after start_at, including ended/locked public campaigns. Keeps submit/activity guards unchanged and returns no entries, answers, activities, audit log, auth user ids, or PII.';

comment on function public.get_public_special_offer_winner(text) is
  'Read-only public-safe winner result for manually published Special Offers. Returns only public_name, published_at, campaign_slug and winner_published; never exposes entry/workflow ids, scores, contact notes, answers, evidence or PII.';

commit;
