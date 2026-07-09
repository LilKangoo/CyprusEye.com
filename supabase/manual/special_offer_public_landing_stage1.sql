-- Special Offers 3C.5C-6G
-- Public landing read RPC for active/public campaigns.
--
-- Purpose:
-- - expose only public campaign landing content to anon/authenticated visitors,
-- - keep base Special Offers tables admin-only,
-- - do not expose entries, answers, activities, audit log, user ids, or PII,
-- - do not change campaign status, dates, RLS policies, table grants, or data.

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
    and o.status = 'active'
    and o.visibility = 'public'
    and o.archived_at is null
    and o.start_at is not null
    and o.end_at is not null
    and now() >= o.start_at
    and now() <= o.end_at
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

alter function public.get_public_special_offer_landing(text) owner to postgres;

revoke all on function public.get_public_special_offer_landing(text) from public;
revoke all on function public.get_public_special_offer_landing(text) from anon;
revoke all on function public.get_public_special_offer_landing(text) from authenticated;

grant execute on function public.get_public_special_offer_landing(text) to anon, authenticated;

comment on function public.get_public_special_offer_landing(text) is
  'Read-only public landing payload for active/public/in-window Special Offer campaigns. Keeps base tables admin-only and returns no entries, answers, activities, audit log, auth user ids, or PII.';

commit;
