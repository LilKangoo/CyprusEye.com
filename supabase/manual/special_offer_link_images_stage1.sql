-- Special Offers 3C.4C draft only.
-- Adds an optional image URL to each Special Offer linked service/CTA.
-- Prepared only. Do not run automatically.
--
-- Scope:
-- - public.special_offer_links.image_url
--
-- Out of scope:
-- - file uploads
-- - Supabase Storage
-- - Open Graph fetching
-- - campaign activation/publication
-- - entries/tasks/draws/winners

begin;

do $$
begin
  if to_regclass('public.special_offer_links') is null then
    raise exception 'Required table public.special_offer_links is missing.';
  end if;
end;
$$;

alter table public.special_offer_links
  add column if not exists image_url text;

alter table public.special_offer_links
  drop constraint if exists special_offer_links_image_url_safe_check;

alter table public.special_offer_links
  add constraint special_offer_links_image_url_safe_check
  check (
    image_url is null
    or (
      length(image_url) between 1 and 2048
      and image_url !~ '[[:space:][:cntrl:]]'
      and (
        image_url ~* '^https://[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?(?:[/?#][^[:space:][:cntrl:]]*)?$'
        or image_url ~ '^/[^/[:space:][:cntrl:]?#][^[:space:][:cntrl:]]*$'
      )
    )
  );

comment on column public.special_offer_links.image_url is
  'Optional image URL for this Special Offers linked service/CTA. Use HTTPS URLs or local paths starting with /. No uploads or external metadata fetches.';

commit;
