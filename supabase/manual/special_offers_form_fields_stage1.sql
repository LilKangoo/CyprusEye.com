-- Special Offers 3C.1 draft only.
-- Adds campaign form builder configuration tables.
-- Do not run automatically. Review manually before applying in Supabase.

begin;

do $$
begin
  if to_regclass('public.special_offers') is null then
    raise exception 'Missing required table public.special_offers';
  end if;

  if to_regprocedure('public.special_offers_set_updated_at()') is null then
    raise exception 'Missing required trigger function public.special_offers_set_updated_at()';
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;
end;
$$;

create table if not exists public.special_offer_form_fields (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.special_offers(id) on delete cascade,
  field_key text not null,
  field_type text not null,
  required boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  validation_json jsonb not null default '{}'::jsonb,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint special_offer_form_fields_offer_key_key unique (offer_id, field_key),
  constraint special_offer_form_fields_field_key_not_blank check (length(trim(field_key)) > 0),
  constraint special_offer_form_fields_field_key_format check (
    field_key = lower(field_key)
    and field_key ~ '^[a-z0-9_]+$'
  ),
  constraint special_offer_form_fields_field_type_check check (
    field_type in (
      'text',
      'textarea',
      'email',
      'phone',
      'date',
      'date_of_birth',
      'country',
      'city',
      'url',
      'select',
      'checkbox',
      'checkbox_group',
      'consent',
      'contest_answer',
      'facebook_profile_url',
      'shared_post_url',
      'custom'
    )
  ),
  constraint special_offer_form_fields_validation_json_object_check check (
    jsonb_typeof(validation_json) = 'object'
  )
);

create index if not exists idx_special_offer_form_fields_offer
  on public.special_offer_form_fields(offer_id);

create index if not exists idx_special_offer_form_fields_offer_active_sort
  on public.special_offer_form_fields(offer_id, active, sort_order);

create index if not exists idx_special_offer_form_fields_type
  on public.special_offer_form_fields(field_type);

drop trigger if exists trg_special_offer_form_fields_set_updated_at
  on public.special_offer_form_fields;

create trigger trg_special_offer_form_fields_set_updated_at
  before update on public.special_offer_form_fields
  for each row
  execute function public.special_offers_set_updated_at();

create or replace function public.special_offer_form_field_is_public(p_field_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.special_offer_form_fields f
    join public.special_offers o on o.id = f.offer_id
    where f.id = p_field_id
      and f.active = true
      and o.status = 'active'
      and o.visibility = 'public'
      and o.requires_form = true
      and (o.start_at is null or now() >= o.start_at)
      and (o.end_at is null or now() <= o.end_at)
  );
$$;

revoke all on function public.special_offer_form_field_is_public(uuid)
  from public, anon, authenticated;
grant execute on function public.special_offer_form_field_is_public(uuid)
  to anon, authenticated, service_role;

alter table public.special_offer_form_fields enable row level security;

revoke all on public.special_offer_form_fields from public;
revoke all on public.special_offer_form_fields from anon;
revoke all on public.special_offer_form_fields from authenticated;

grant select on public.special_offer_form_fields to anon;
grant select, insert, update, delete on public.special_offer_form_fields to authenticated;
grant all on public.special_offer_form_fields to service_role;

drop policy if exists "Admins can select special offer form fields"
  on public.special_offer_form_fields;
create policy "Admins can select special offer form fields"
  on public.special_offer_form_fields
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Admins can insert special offer form fields"
  on public.special_offer_form_fields;
create policy "Admins can insert special offer form fields"
  on public.special_offer_form_fields
  for insert
  to authenticated
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update special offer form fields"
  on public.special_offer_form_fields;
create policy "Admins can update special offer form fields"
  on public.special_offer_form_fields
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Admins can delete special offer form fields"
  on public.special_offer_form_fields;
create policy "Admins can delete special offer form fields"
  on public.special_offer_form_fields
  for delete
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Public can select active special offer form fields"
  on public.special_offer_form_fields;
create policy "Public can select active special offer form fields"
  on public.special_offer_form_fields
  for select
  to anon, authenticated
  using (public.special_offer_form_field_is_public(id));

create table if not exists public.special_offer_form_field_translations (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.special_offer_form_fields(id) on delete cascade,
  lang text not null,
  label text not null default '',
  placeholder text,
  help_text text,
  options_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_offer_form_field_translations_field_lang_key unique (field_id, lang),
  constraint special_offer_form_field_translations_lang_check check (lang in ('pl', 'en', 'he')),
  constraint special_offer_form_field_translations_options_json_array_check check (
    jsonb_typeof(options_json) = 'array'
  )
);

create index if not exists idx_special_offer_form_field_translations_field_lang
  on public.special_offer_form_field_translations(field_id, lang);

create index if not exists idx_special_offer_form_field_translations_lang
  on public.special_offer_form_field_translations(lang);

drop trigger if exists trg_special_offer_form_field_translations_set_updated_at
  on public.special_offer_form_field_translations;

create trigger trg_special_offer_form_field_translations_set_updated_at
  before update on public.special_offer_form_field_translations
  for each row
  execute function public.special_offers_set_updated_at();

alter table public.special_offer_form_field_translations enable row level security;

revoke all on public.special_offer_form_field_translations from public;
revoke all on public.special_offer_form_field_translations from anon;
revoke all on public.special_offer_form_field_translations from authenticated;

grant select on public.special_offer_form_field_translations to anon;
grant select, insert, update, delete on public.special_offer_form_field_translations to authenticated;
grant all on public.special_offer_form_field_translations to service_role;

drop policy if exists "Admins can select special offer form field translations"
  on public.special_offer_form_field_translations;
create policy "Admins can select special offer form field translations"
  on public.special_offer_form_field_translations
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Admins can insert special offer form field translations"
  on public.special_offer_form_field_translations;
create policy "Admins can insert special offer form field translations"
  on public.special_offer_form_field_translations
  for insert
  to authenticated
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update special offer form field translations"
  on public.special_offer_form_field_translations;
create policy "Admins can update special offer form field translations"
  on public.special_offer_form_field_translations
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Admins can delete special offer form field translations"
  on public.special_offer_form_field_translations;
create policy "Admins can delete special offer form field translations"
  on public.special_offer_form_field_translations
  for delete
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Public can select active special offer form field translations"
  on public.special_offer_form_field_translations;
create policy "Public can select active special offer form field translations"
  on public.special_offer_form_field_translations
  for select
  to anon, authenticated
  using (public.special_offer_form_field_is_public(field_id));

comment on table public.special_offer_form_fields is
  'Special Offers campaign form builder fields. Configuration only; no entries are created in stage 3C.1.';
comment on column public.special_offer_form_fields.field_key is
  'Lowercase technical key using a-z, 0-9, and underscore only.';
comment on column public.special_offer_form_fields.field_type is
  'Allowed form field type for rendering and validation.';
comment on column public.special_offer_form_fields.validation_json is
  'Field-level validation settings, such as min_age or must_be_true.';

comment on table public.special_offer_form_field_translations is
  'Localized labels, placeholders, help text, and options for Special Offers form fields.';
comment on column public.special_offer_form_field_translations.options_json is
  'Array of localized option objects for select and checkbox_group fields.';
comment on function public.special_offer_form_field_is_public(uuid) is
  'Security definer helper for public form field read checks without granting public SELECT on special_offers.';

commit;
