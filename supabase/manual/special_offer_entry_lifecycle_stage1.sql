-- Special Offers 3C.5C-6J entry lifecycle - Stage 1.
-- Adds one saved participant correction and admin hard-delete RPC.
-- Prepared for manual execution only. Do not run from Codex.

begin;

do $$
begin
  if to_regclass('public.special_offer_entries') is null then
    raise exception 'Missing required table public.special_offer_entries';
  end if;
  if to_regclass('public.special_offer_entry_answers') is null then
    raise exception 'Missing required table public.special_offer_entry_answers';
  end if;
  if to_regclass('public.special_offer_audit_log') is null then
    raise exception 'Missing required table public.special_offer_audit_log';
  end if;
  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;
end;
$$;

alter table public.special_offer_entries
  add column if not exists correction_count smallint not null default 0,
  add column if not exists corrected_at timestamptz,
  add column if not exists correction_client_submission_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.special_offer_entries'::regclass
      and conname = 'special_offer_entries_correction_count_check'
  ) then
    alter table public.special_offer_entries
      add constraint special_offer_entries_correction_count_check
      check (correction_count between 0 and 1);
  end if;
end;
$$;

create unique index if not exists idx_special_offer_entries_correction_client
  on public.special_offer_entries(id, correction_client_submission_id)
  where correction_client_submission_id is not null;

create or replace function public.update_special_offer_entry_once(
  p_entry_id uuid,
  p_answers jsonb,
  p_client_correction_id uuid
)
returns table(entry_id uuid, status text, reference text, correction_count smallint, idempotent boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_entry public.special_offer_entries%rowtype;
  v_offer public.special_offers%rowtype;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_auth_email text := '';
  v_auth_email_confirmed_at timestamptz;
  v_now timestamptz := now();
  v_answer record;
  v_key text;
  v_snapshot jsonb;
  v_type text;
  v_required boolean;
  v_value jsonb;
  v_value_type text;
  v_text text;
  v_value_json jsonb;
  v_new_answers jsonb := '{}'::jsonb;
  v_changed_fields text[] := array[]::text[];
  v_previous_status text;
  v_first_name text := null;
  v_last_name text := null;
  v_phone text := null;
  v_profile_name text := null;
  v_profile_enriched_fields text[] := array[]::text[];
  v_profile_update_count integer := 0;
  v_previous_profile_name text := null;
  v_previous_phone text := null;
  v_lang text := 'pl';
  v_allowed boolean;
  v_min_age integer;
  v_birth_date date;
  v_today date;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  if p_entry_id is null then
    raise exception 'entry_id_required' using errcode = '23514';
  end if;
  if p_client_correction_id is null then
    raise exception 'client_correction_id_required' using errcode = '23514';
  end if;
  if jsonb_typeof(v_answers) <> 'object' then
    raise exception 'answers_must_be_object' using errcode = '23514';
  end if;
  if octet_length(v_answers::text) > 65536 then
    raise exception 'answers_payload_too_large' using errcode = '23514';
  end if;

  select lower(btrim(coalesce(u.email, ''))), coalesce(u.email_confirmed_at, u.confirmed_at)
    into v_auth_email, v_auth_email_confirmed_at
  from auth.users u
  where u.id = v_uid
  limit 1;

  if v_auth_email = '' then
    raise exception 'authenticated_email_missing' using errcode = '23514';
  end if;
  if v_auth_email_confirmed_at is null then
    raise exception 'email_not_confirmed' using errcode = '42501';
  end if;

  select *
    into v_entry
  from public.special_offer_entries e
  where e.id = p_entry_id
  for update;

  if not found or v_entry.user_id is distinct from v_uid then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;

  if v_entry.correction_count = 1
     and v_entry.correction_client_submission_id = p_client_correction_id then
    entry_id := v_entry.id;
    status := v_entry.status;
    reference := v_entry.reference;
    correction_count := v_entry.correction_count;
    idempotent := true;
    return next;
    return;
  end if;

  if v_entry.correction_count >= 1 then
    raise exception 'correction_already_used' using errcode = '23505';
  end if;

  if v_entry.status not in ('submitted', 'pending_review', 'approved', 'rejected') then
    raise exception 'entry_not_correctable' using errcode = '23514';
  end if;

  select *
    into v_offer
  from public.special_offers o
  where o.id = v_entry.offer_id
  for update;

  if not found
     or v_offer.status <> 'active'
     or v_offer.visibility <> 'public'
     or v_offer.start_at is null
     or v_offer.end_at is null
     or v_now < v_offer.start_at
     or v_now > v_offer.end_at then
    raise exception 'campaign_not_available' using errcode = 'P0001';
  end if;

  for v_key in select jsonb_object_keys(v_answers)
  loop
    if not exists (
      select 1
      from public.special_offer_entry_answers a
      where a.entry_id = v_entry.id
        and a.field_key = v_key
    ) then
      raise exception 'unknown_or_inactive_field: %', v_key using errcode = '23514';
    end if;
  end loop;

  v_previous_status := v_entry.status;
  v_previous_profile_name := nullif(btrim(concat_ws(' ', v_entry.first_name, v_entry.last_name)), '');
  v_previous_phone := nullif(btrim(coalesce(v_entry.phone, '')), '');
  v_lang := case
    when lower(coalesce(v_entry.submitted_lang, 'pl')) in ('pl', 'en', 'he')
      then lower(coalesce(v_entry.submitted_lang, 'pl'))
    else 'pl'
  end;

  for v_answer in
    select *
    from public.special_offer_entry_answers a
    where a.entry_id = v_entry.id
    order by coalesce((a.field_snapshot_json ->> 'sort_order')::integer, 9999), a.created_at asc
  loop
    v_snapshot := coalesce(v_answer.field_snapshot_json, '{}'::jsonb);
    v_key := v_answer.field_key;
    v_type := lower(coalesce(v_snapshot ->> 'field_type', 'text'));
    v_required := coalesce((v_snapshot ->> 'required')::boolean, false);
    v_value := v_answers -> v_key;

    if v_key = 'email' then
      v_value := to_jsonb(v_auth_email);
    elsif not (v_answers ? v_key) then
      v_value := coalesce(v_answer.value_json, 'null'::jsonb);
    end if;

    v_value_type := coalesce(jsonb_typeof(v_value), 'missing');
    v_text := null;
    v_value_json := 'null'::jsonb;

    if v_value_type in ('missing', 'null') then
      if v_required then
        raise exception 'required_field_missing: %', v_key using errcode = '23514';
      end if;
    elsif v_type in ('checkbox', 'consent') then
      if v_value_type <> 'boolean' then
        raise exception 'invalid_boolean_field: %', v_key using errcode = '23514';
      end if;
      if v_required and v_value <> 'true'::jsonb then
        raise exception 'must_be_true_field: %', v_key using errcode = '23514';
      end if;
      v_value_json := v_value;
      v_text := v_value #>> '{}';
    elsif v_type = 'checkbox_group' then
      if v_value_type <> 'array' then
        raise exception 'invalid_checkbox_group_field: %', v_key using errcode = '23514';
      end if;
      if v_required and jsonb_array_length(v_value) = 0 then
        raise exception 'required_field_missing: %', v_key using errcode = '23514';
      end if;
      select not exists (
        select 1
        from jsonb_array_elements_text(v_value) selected(value)
        where not exists (
          select 1
          from jsonb_array_elements(coalesce(v_snapshot -> 'options_json', '[]'::jsonb)) opt
          where opt ->> 'value' = selected.value
        )
      ) into v_allowed;
      if not coalesce(v_allowed, false) then
        raise exception 'invalid_option_field: %', v_key using errcode = '23514';
      end if;
      v_value_json := v_value;
      v_text := array_to_string(array(select jsonb_array_elements_text(v_value)), ', ');
    else
      if v_value_type <> 'string' then
        raise exception 'invalid_text_field: %', v_key using errcode = '23514';
      end if;
      v_text := btrim(v_value #>> '{}');
      if v_required and v_text = '' then
        raise exception 'required_field_missing: %', v_key using errcode = '23514';
      end if;
      v_value_json := to_jsonb(v_text);
    end if;

    if v_type in ('text', 'textarea', 'contest_answer', 'custom') and char_length(coalesce(v_text, '')) > 5000 then
      raise exception 'field_payload_too_large: %', v_key using errcode = '23514';
    end if;

    if v_type in ('url', 'facebook_profile_url', 'shared_post_url') and coalesce(v_text, '') <> '' and v_text !~* '^https?://[^[:space:]]+$' then
      raise exception 'invalid_url_field: %', v_key using errcode = '23514';
    end if;

    if v_type = 'email' and lower(coalesce(v_text, '')) <> v_auth_email then
      raise exception 'invalid_email_field: %', v_key using errcode = '23514';
    end if;

    if v_type = 'phone' and coalesce(v_text, '') <> '' and v_text !~ '^\+[1-9][0-9]{0,3}\s+[0-9][0-9\s().-]{3,39}$' then
      raise exception 'invalid_phone_field: %', v_key using errcode = '23514';
    end if;

    if v_type = 'date_of_birth' and coalesce(v_text, '') <> '' then
      begin
        v_birth_date := v_text::date;
      exception when others then
        raise exception 'invalid_date_of_birth_field: %', v_key using errcode = '23514';
      end;
      v_min_age := nullif(v_snapshot #>> '{validation_json,min_age}', '')::integer;
      v_today := (v_now at time zone coalesce(nullif(v_offer.timezone, ''), 'Asia/Nicosia'))::date;
      if v_min_age is not null and v_birth_date > (v_today - make_interval(years => v_min_age))::date then
        raise exception 'min_age_field: %', v_key using errcode = '23514';
      end if;
    end if;

    if v_type = 'select' and coalesce(v_text, '') <> '' then
      select exists (
        select 1
        from jsonb_array_elements(coalesce(v_snapshot -> 'options_json', '[]'::jsonb)) opt
        where opt ->> 'value' = v_text
      ) into v_allowed;
      if not coalesce(v_allowed, false) then
        raise exception 'invalid_option_field: %', v_key using errcode = '23514';
      end if;
    end if;

    if coalesce(v_answer.value_json, 'null'::jsonb) is distinct from v_value_json then
      v_changed_fields := array_append(v_changed_fields, v_key);
    end if;

    update public.special_offer_entry_answers
       set value_text = nullif(v_text, ''),
           value_json = v_value_json,
           field_snapshot_json = v_answer.field_snapshot_json
     where id = v_answer.id;

    v_new_answers := v_new_answers || jsonb_build_object(v_key, v_value_json);
  end loop;

  v_first_name := nullif(left(btrim(coalesce(v_new_answers ->> 'first_name', '')), 120), '');
  v_last_name := nullif(left(btrim(coalesce(v_new_answers ->> 'last_name', '')), 120), '');
  v_phone := nullif(left(btrim(coalesce(v_new_answers ->> 'phone', '')), 80), '');
  v_profile_name := nullif(left(btrim(concat_ws(' ', v_first_name, v_last_name)), 160), '');

  update public.special_offer_entries
     set status = 'pending_review',
         answers_json = v_new_answers,
         first_name = v_first_name,
         last_name = v_last_name,
         phone = v_phone,
         reviewed_at = null,
         reviewed_by = null,
         review_note = null,
         rejection_reason = null,
         correction_count = 1,
         corrected_at = v_now,
         correction_client_submission_id = p_client_correction_id,
         updated_at = v_now
   where id = v_entry.id;

  if to_regclass('public.profiles') is not null then
    if v_profile_name is not null and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'name'
    ) then
      execute
        'update public.profiles
            set name = $1, updated_at = now()
          where id = $2
            and (nullif(btrim(coalesce(name, '''')), '''') is null or name = $3)'
      using v_profile_name, v_uid, v_previous_profile_name;
      get diagnostics v_profile_update_count = row_count;
      if v_profile_update_count > 0 then
        v_profile_enriched_fields := array_append(v_profile_enriched_fields, 'name');
      end if;
    end if;

    if v_phone is not null and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
    ) then
      execute
        'update public.profiles
            set phone = $1, updated_at = now()
          where id = $2
            and (nullif(btrim(coalesce(phone, '''')), '''') is null or phone = $3)'
      using v_phone, v_uid, v_previous_phone;
      get diagnostics v_profile_update_count = row_count;
      if v_profile_update_count > 0 then
        v_profile_enriched_fields := array_append(v_profile_enriched_fields, 'phone');
      end if;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'preferred_language'
    ) and (
      v_lang <> 'he'
      or not exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = 'profiles'
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%preferred_language%'
      )
      or exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = 'profiles'
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%preferred_language%'
          and pg_get_constraintdef(con.oid) ilike '%he%'
      )
    ) then
      execute
        'update public.profiles
            set preferred_language = $1, updated_at = now()
          where id = $2
            and (preferred_language is null or preferred_language = $1)'
      using v_lang, v_uid;
      get diagnostics v_profile_update_count = row_count;
      if v_profile_update_count > 0 then
        v_profile_enriched_fields := array_append(v_profile_enriched_fields, 'preferred_language');
      end if;
    end if;
  end if;

  insert into public.special_offer_audit_log (
    offer_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value,
    metadata
  )
  values (
    v_entry.offer_id,
    v_uid,
    'entry_corrected',
    'special_offer_entry',
    v_entry.id,
    jsonb_build_object('status', v_previous_status, 'correction_count', v_entry.correction_count),
    jsonb_build_object('status', 'pending_review', 'correction_count', 1),
    jsonb_build_object(
      'entry_id', v_entry.id,
      'changed_fields', to_jsonb(v_changed_fields),
      'profile_enriched_fields', to_jsonb(v_profile_enriched_fields),
      'answers_logged', false
    )
  );

  entry_id := v_entry.id;
  status := 'pending_review';
  reference := v_entry.reference;
  correction_count := 1;
  idempotent := false;
  return next;
end;
$$;

create or replace function public.admin_delete_special_offer_entry(
  p_entry_id uuid,
  p_expected_reference text,
  p_reason text
)
returns table(entry_id uuid, deleted boolean, answers_deleted integer, activities_deleted integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_entry public.special_offer_entries%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_answers_count integer := 0;
  v_activities_count integer := 0;
  v_winner_count integer := 0;
begin
  if v_actor is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  if not coalesce(public.is_current_user_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_entry_id is null then
    raise exception 'entry_id_required' using errcode = '23514';
  end if;
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'delete_reason_required' using errcode = '23514';
  end if;

  select *
    into v_entry
  from public.special_offer_entries e
  where e.id = p_entry_id
  for update;

  if not found then
    if exists (
      select 1
      from public.special_offer_audit_log a
      where a.action = 'entry_hard_deleted'
        and a.entity_type = 'special_offer_entry'
        and a.entity_id = p_entry_id
    ) then
      entry_id := p_entry_id;
      deleted := false;
      answers_deleted := 0;
      activities_deleted := 0;
      return next;
      return;
    end if;
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;
  if coalesce(p_expected_reference, '') <> coalesce(v_entry.reference, '') then
    raise exception 'entry_reference_mismatch' using errcode = '23514';
  end if;

  if to_regclass('public.special_offer_winners') is not null then
    execute 'select count(*) from public.special_offer_winners where entry_id = $1'
      into v_winner_count
      using v_entry.id;
    if v_winner_count > 0 then
      raise exception 'entry_has_winner_record' using errcode = '23514';
    end if;
  end if;

  select count(*)::integer into v_answers_count
  from public.special_offer_entry_answers
  where entry_id = v_entry.id;

  if to_regclass('public.special_offer_entry_activities') is not null then
    select count(*)::integer into v_activities_count
    from public.special_offer_entry_activities
    where entry_id = v_entry.id;
  end if;

  insert into public.special_offer_audit_log (
    offer_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value,
    metadata
  )
  values (
    v_entry.offer_id,
    v_actor,
    'entry_hard_deleted',
    'special_offer_entry',
    v_entry.id,
    null,
    jsonb_build_object('deleted', true),
    jsonb_build_object(
      'entry_id', v_entry.id,
      'answers_deleted', v_answers_count,
      'activities_deleted', v_activities_count,
      'reason_present', true,
      'pii_logged', false
    )
  );

  delete from public.special_offer_entries
  where id = v_entry.id;

  entry_id := v_entry.id;
  deleted := true;
  answers_deleted := v_answers_count;
  activities_deleted := v_activities_count;
  return next;
end;
$$;

alter function public.update_special_offer_entry_once(uuid, jsonb, uuid)
  owner to postgres;
alter function public.admin_delete_special_offer_entry(uuid, text, text)
  owner to postgres;

revoke all on function public.update_special_offer_entry_once(uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_delete_special_offer_entry(uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.update_special_offer_entry_once(uuid, jsonb, uuid)
  to authenticated;
grant execute on function public.admin_delete_special_offer_entry(uuid, text, text)
  to authenticated;

comment on function public.update_special_offer_entry_once(uuid, jsonb, uuid) is
  'Allows the authenticated owner to save exactly one correction to a Special Offer entry, preserving snapshots and audit without PII.';
comment on function public.admin_delete_special_offer_entry(uuid, text, text) is
  'Admin-only hard delete for a Special Offer entry and dependent entry data. Requires reference confirmation and minimal no-PII audit tombstone.';

commit;
