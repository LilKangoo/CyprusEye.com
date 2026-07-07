-- Special Offers 3C.4A draft only.
-- Adds entry storage tables for future public form submissions.
-- Prepared for manual review. Do not run automatically.
--
-- Scope:
-- - public.special_offer_entries
-- - public.special_offer_entry_answers
--
-- Out of scope:
-- - public submit UI activation
-- - tasks
-- - draws
-- - draw entries
-- - winners
-- - storage uploads

begin;

do $$
begin
  if to_regclass('public.special_offers') is null then
    raise exception 'Missing required table public.special_offers';
  end if;

  if to_regclass('public.special_offer_form_fields') is null then
    raise exception 'Missing required table public.special_offer_form_fields';
  end if;

  if to_regclass('public.special_offer_form_field_translations') is null then
    raise exception 'Missing required table public.special_offer_form_field_translations';
  end if;

  if to_regprocedure('public.special_offers_set_updated_at()') is null then
    raise exception 'Missing required trigger function public.special_offers_set_updated_at()';
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;
end;
$$;

create table if not exists public.special_offer_entries (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.special_offers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'submitted',
  submitted_lang text not null default 'pl',
  normalized_email text not null,
  first_name text,
  last_name text,
  phone text,
  answers_json jsonb not null default '{}'::jsonb,
  form_snapshot_json jsonb not null default '{}'::jsonb,
  client_submission_id uuid not null,
  reference text not null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_offer_entries_status_check check (
    status in ('submitted', 'pending_review', 'approved', 'rejected', 'disqualified', 'withdrawn')
  ),
  constraint special_offer_entries_submitted_lang_check check (submitted_lang in ('pl', 'en', 'he')),
  constraint special_offer_entries_normalized_email_not_blank check (length(trim(normalized_email)) > 0),
  constraint special_offer_entries_normalized_email_format check (
    normalized_email = lower(trim(normalized_email))
    and normalized_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint special_offer_entries_phone_format check (
    phone is null
    or phone ~ '^\+[1-9][0-9]{0,3}\s+[0-9][0-9\s().-]{3,39}$'
  ),
  constraint special_offer_entries_answers_json_object_check check (jsonb_typeof(answers_json) = 'object'),
  constraint special_offer_entries_form_snapshot_json_object_check check (jsonb_typeof(form_snapshot_json) = 'object'),
  constraint special_offer_entries_reference_not_blank check (length(trim(reference)) > 0),
  constraint special_offer_entries_offer_client_submission_key unique (offer_id, client_submission_id),
  constraint special_offer_entries_reference_key unique (reference)
);

create table if not exists public.special_offer_entry_answers (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.special_offer_entries(id) on delete cascade,
  field_id uuid references public.special_offer_form_fields(id) on delete set null,
  field_key text not null,
  value_text text,
  value_json jsonb,
  field_snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint special_offer_entry_answers_entry_field_key unique (entry_id, field_key),
  constraint special_offer_entry_answers_field_key_not_blank check (length(trim(field_key)) > 0),
  constraint special_offer_entry_answers_field_key_format check (
    field_key = lower(field_key)
    and field_key ~ '^[a-z0-9_]+$'
  ),
  constraint special_offer_entry_answers_field_snapshot_json_object_check check (
    jsonb_typeof(field_snapshot_json) = 'object'
  )
);

create index if not exists idx_special_offer_entries_offer_created
  on public.special_offer_entries(offer_id, created_at desc);

create index if not exists idx_special_offer_entries_offer_status
  on public.special_offer_entries(offer_id, status);

create index if not exists idx_special_offer_entries_user_offer
  on public.special_offer_entries(user_id, offer_id)
  where user_id is not null;

create index if not exists idx_special_offer_entries_email_offer
  on public.special_offer_entries(normalized_email, offer_id);

create index if not exists idx_special_offer_entries_client_submission
  on public.special_offer_entries(client_submission_id);

create index if not exists idx_special_offer_entry_answers_entry
  on public.special_offer_entry_answers(entry_id);

create index if not exists idx_special_offer_entry_answers_field
  on public.special_offer_entry_answers(field_id)
  where field_id is not null;

create index if not exists idx_special_offer_entry_answers_field_key
  on public.special_offer_entry_answers(field_key);

drop trigger if exists trg_special_offer_entries_set_updated_at
  on public.special_offer_entries;

create trigger trg_special_offer_entries_set_updated_at
  before update on public.special_offer_entries
  for each row
  execute function public.special_offers_set_updated_at();

alter table public.special_offer_entries enable row level security;
alter table public.special_offer_entry_answers enable row level security;

revoke all on public.special_offer_entries from public;
revoke all on public.special_offer_entries from anon;
revoke all on public.special_offer_entries from authenticated;

revoke all on public.special_offer_entry_answers from public;
revoke all on public.special_offer_entry_answers from anon;
revoke all on public.special_offer_entry_answers from authenticated;

-- Direct public writes are intentionally not granted.
-- Submit will be done through public.submit_special_offer_entry() only.
-- Authenticated users can read their own entries through RLS. Admins are also
-- authenticated users, so review/status updates are exposed only as
-- column-level UPDATE grants plus admin-only RLS policy.
grant select on public.special_offer_entries to authenticated;
grant update (status, reviewed_at, reviewed_by, review_note, rejection_reason, updated_at)
  on public.special_offer_entries to authenticated;
grant select on public.special_offer_entry_answers to authenticated;

grant all on public.special_offer_entries to service_role;
grant all on public.special_offer_entry_answers to service_role;

drop policy if exists "Admins can select special offer entries"
  on public.special_offer_entries;
create policy "Admins can select special offer entries"
  on public.special_offer_entries
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Admins can update special offer entries"
  on public.special_offer_entries;
create policy "Admins can update special offer entries"
  on public.special_offer_entries
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Users can select own special offer entries"
  on public.special_offer_entries;
create policy "Users can select own special offer entries"
  on public.special_offer_entries
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins can select special offer entry answers"
  on public.special_offer_entry_answers;
create policy "Admins can select special offer entry answers"
  on public.special_offer_entry_answers
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Admins can update special offer entry answers"
  on public.special_offer_entry_answers;
-- Entry answers are immutable in this stage. Future manual-verification edits
-- should use a reviewed RPC or a dedicated review table, not direct answer
-- updates.

drop policy if exists "Users can select own special offer entry answers"
  on public.special_offer_entry_answers;
create policy "Users can select own special offer entry answers"
  on public.special_offer_entry_answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.special_offer_entries e
      where e.id = special_offer_entry_answers.entry_id
        and e.user_id = auth.uid()
    )
  );

comment on table public.special_offer_entries is
  'Special Offers participant entries. Public writes are blocked; inserts must go through submit_special_offer_entry RPC.';
comment on column public.special_offer_entries.status is
  'Entry lifecycle status. No winner/backup states; winner workflow belongs to future draw/winner tables.';
comment on column public.special_offer_entries.answers_json is
  'Complete normalized answer snapshot submitted by the participant.';
comment on column public.special_offer_entries.form_snapshot_json is
  'Immutable snapshot of campaign/form fields, localized labels/help/options, and relevant rules at submit time.';
comment on column public.special_offer_entries.client_submission_id is
  'Client-generated idempotency UUID. Unique per campaign and validated by submit RPC.';
comment on table public.special_offer_entry_answers is
  'Per-field entry answers for filtering and manual verification. Parent entry keeps the full answers_json snapshot.';
comment on column public.special_offer_entry_answers.field_id is
  'Original form field reference. Set to null if the config field is later deleted; field_key and field_snapshot_json remain.';

commit;
