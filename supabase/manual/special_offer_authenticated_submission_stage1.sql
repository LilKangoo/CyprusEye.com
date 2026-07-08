-- Special Offers 3C.5C-0 draft only.
-- Tightens submit_special_offer_entry RPC for authenticated, confirmed-email submissions.
-- Prepared for manual review. Do not run automatically.
--
-- Scope:
-- - public.submit_special_offer_entry(text, text, jsonb, uuid)
-- - require auth.uid() and confirmed Supabase Auth email
-- - keep user_id sourced only from auth.uid()
-- - optional profile enrichment for existing allowlisted profile columns
--
-- Out of scope:
-- - public UI activation by SQL
-- - activity points
-- - tasks
-- - draws
-- - winners

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

  if to_regclass('public.special_offer_entries') is null then
    raise exception 'Missing required table public.special_offer_entries';
  end if;

  if to_regclass('public.special_offer_entry_answers') is null then
    raise exception 'Missing required table public.special_offer_entry_answers';
  end if;

  if to_regclass('public.partners') is null then
    raise exception 'Missing required table public.partners';
  end if;

  if to_regclass('public.partner_users') is null then
    raise exception 'Missing required table public.partner_users';
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;
end;
$$;

create or replace function public.submit_special_offer_entry(
  p_offer_slug text,
  p_lang text,
  p_answers jsonb,
  p_client_submission_id uuid
)
returns table(entry_id uuid, status text, reference text, idempotent boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_offer public.special_offers%rowtype;
  v_existing public.special_offer_entries%rowtype;
  v_uid uuid := null;
  v_jwt jsonb := '{}'::jsonb;
  v_lang text := lower(trim(coalesce(p_lang, 'pl')));
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_normalized_email text := '';
  v_auth_email text := '';
  v_auth_email_confirmed_at timestamptz := null;
  v_now timestamptz := now();
  v_active_field_count integer := 0;
  v_existing_count integer := 0;
  v_status text := 'submitted';
  v_entry_id uuid := gen_random_uuid();
  v_reference text := 'SO-' || upper(substr(replace(v_entry_id::text, '-', ''), 1, 10));
  v_answers_snapshot jsonb := '{}'::jsonb;
  v_fields_snapshot jsonb := '[]'::jsonb;
  v_answer_rows jsonb := '[]'::jsonb;
  v_form_snapshot jsonb := '{}'::jsonb;
  v_campaign_translation jsonb := '{}'::jsonb;
  v_field record;
  v_answer_row jsonb;
  v_key text;
  v_value jsonb;
  v_value_type text;
  v_text text;
  v_value_json jsonb;
  v_required_missing boolean;
  v_min_length integer;
  v_max_length integer;
  v_min_age integer;
  v_birth_date date;
  v_option_allowed boolean;
  v_option_value text;
  v_option_json jsonb;
  v_field_snapshot jsonb;
  v_identity_key text := '';
  v_field_count integer := 0;
  v_max_text_length integer;
  v_today date;
  v_first_name text := null;
  v_last_name text := null;
  v_phone text := null;
  v_profile_name text := null;
  v_profile_enriched_fields text[] := array[]::text[];
  v_profile_update_count integer := 0;
begin
  if p_offer_slug is null or length(trim(p_offer_slug)) = 0 then
    raise exception 'offer_slug_required' using errcode = '23514';
  end if;

  if p_client_submission_id is null then
    raise exception 'client_submission_id_required' using errcode = '23514';
  end if;

  if v_lang not in ('pl', 'en', 'he') then
    v_lang := 'pl';
  end if;

  if jsonb_typeof(v_answers) <> 'object' then
    raise exception 'answers_must_be_object' using errcode = '23514';
  end if;

  if octet_length(v_answers::text) > 65536 then
    raise exception 'answers_payload_too_large' using errcode = '23514';
  end if;

  select count(*)
    into v_field_count
  from jsonb_object_keys(v_answers);

  if v_field_count > 100 then
    raise exception 'too_many_answer_fields' using errcode = '23514';
  end if;

  begin
    v_uid := auth.uid();
  exception when others then
    v_uid := null;
  end;

  begin
    v_jwt := coalesce(auth.jwt(), '{}'::jsonb);
  exception when others then
    v_jwt := '{}'::jsonb;
  end;

  if v_uid is null then
    raise exception 'login_required' using errcode = '42501';
  end if;

  select *
    into v_offer
  from public.special_offers
  where slug = lower(trim(p_offer_slug))
  limit 1
  for update;

  if not found then
    raise exception 'campaign_not_available' using errcode = 'P0001';
  end if;

  -- Serialize submission validation/inserts for one campaign before campaign
  -- availability and identity checks. A second identity-scoped lock is taken
  -- after canonical identity is known.
  perform pg_advisory_xact_lock(hashtextextended('special_offer_entry:' || v_offer.id::text, 0));

  if v_offer.status <> 'active'
     or v_offer.visibility <> 'public'
     or v_offer.requires_form is not true then
    raise exception 'campaign_not_available' using errcode = 'P0001';
  end if;

  if v_offer.start_at is not null and v_now < v_offer.start_at then
    raise exception 'campaign_not_open' using errcode = 'P0001';
  end if;

  if v_offer.end_at is not null and v_now > v_offer.end_at then
    raise exception 'campaign_closed' using errcode = 'P0001';
  end if;

  select count(*)
    into v_active_field_count
  from public.special_offer_form_fields f
  where f.offer_id = v_offer.id
    and f.active = true;

  if v_active_field_count = 0 then
    raise exception 'form_not_configured' using errcode = 'P0001';
  end if;

  select
    lower(trim(coalesce(u.email, ''))),
    coalesce(u.email_confirmed_at, u.confirmed_at)
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

  v_normalized_email := v_auth_email;

  if v_normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '23514';
  end if;

  v_identity_key := 'user:' || v_uid::text;

  perform pg_advisory_xact_lock(hashtextextended(
    'special_offer_entry_identity:' || v_offer.id::text || ':' || v_identity_key,
    0
  ));

  if v_offer.exclude_admins is true and coalesce(public.is_current_user_admin(), false) then
    raise exception 'admin_entries_blocked' using errcode = '42501';
  end if;

  if v_offer.exclude_partners is true and v_uid is not null and exists (
    select 1
    from public.partner_users pu
    join public.partners p on p.id = pu.partner_id
    where pu.user_id = v_uid
      and coalesce(p.status, 'active') = 'active'
  ) then
    raise exception 'partner_entries_blocked' using errcode = '42501';
  end if;

  select *
    into v_existing
  from public.special_offer_entries e
  where e.offer_id = v_offer.id
    and e.client_submission_id = p_client_submission_id
  limit 1;

  if found then
    if v_existing.user_id = v_uid then
      entry_id := v_existing.id;
      status := v_existing.status;
      reference := v_existing.reference;
      idempotent := true;
      return next;
      return;
    end if;

    raise exception 'submission_not_accepted' using errcode = '23505';
  end if;

  select count(*)
    into v_existing_count
  from public.special_offer_entries e
  where e.offer_id = v_offer.id
    and e.user_id = v_uid
    and e.status <> 'withdrawn';

  if coalesce(v_offer.allow_multiple_entries, false) is false and v_existing_count >= 1 then
    raise exception 'duplicate_entry' using errcode = '23505';
  end if;

  if v_existing_count >= greatest(coalesce(v_offer.max_entries_per_user, 1), 1) then
    raise exception 'max_entries_reached' using errcode = '23505';
  end if;

  for v_key in
    select jsonb_object_keys(v_answers)
  loop
    if not exists (
      select 1
      from public.special_offer_form_fields f
      where f.offer_id = v_offer.id
        and f.active = true
        and f.field_key = v_key
    ) then
      raise exception 'unknown_or_inactive_field: %', v_key using errcode = '23514';
    end if;
  end loop;

  select to_jsonb(t)
    into v_campaign_translation
  from public.special_offer_translations t
  where t.offer_id = v_offer.id
  order by
    case t.lang
      when v_lang then 0
      when 'pl' then 1
      when 'en' then 2
      when 'he' then 3
      else 4
    end
  limit 1;

  v_campaign_translation := coalesce(v_campaign_translation, '{}'::jsonb);

  for v_field in
    select
      f.id,
      f.field_key,
      f.field_type,
      f.required,
      f.sort_order,
      f.validation_json,
      coalesce(ft_req.lang, ft_pl.lang, ft_en.lang, ft_he.lang, v_lang) as snapshot_lang,
      coalesce(ft_req.label, ft_pl.label, ft_en.label, ft_he.label, '') as label,
      coalesce(ft_req.placeholder, ft_pl.placeholder, ft_en.placeholder, ft_he.placeholder, '') as placeholder,
      coalesce(ft_req.help_text, ft_pl.help_text, ft_en.help_text, ft_he.help_text, '') as help_text,
      coalesce(ft_req.options_json, ft_pl.options_json, ft_en.options_json, ft_he.options_json, '[]'::jsonb) as options_json
    from public.special_offer_form_fields f
    left join public.special_offer_form_field_translations ft_req
      on ft_req.field_id = f.id and ft_req.lang = v_lang
    left join public.special_offer_form_field_translations ft_pl
      on ft_pl.field_id = f.id and ft_pl.lang = 'pl'
    left join public.special_offer_form_field_translations ft_en
      on ft_en.field_id = f.id and ft_en.lang = 'en'
    left join public.special_offer_form_field_translations ft_he
      on ft_he.field_id = f.id and ft_he.lang = 'he'
    where f.offer_id = v_offer.id
      and f.active = true
    order by f.sort_order asc, f.created_at asc
  loop
    v_value := v_answers -> v_field.field_key;

    if v_field.field_key = 'email' and v_uid is not null then
      v_value := to_jsonb(v_normalized_email);
    end if;

    v_value_type := coalesce(jsonb_typeof(v_value), 'missing');
    v_text := null;
    v_value_json := 'null'::jsonb;
    v_required_missing := false;

    if v_value_type in ('missing', 'null') then
      v_required_missing := v_field.required;
    elsif v_field.field_type in ('checkbox', 'consent') then
      if v_value_type <> 'boolean' then
        raise exception 'invalid_boolean_field: %', v_field.field_key using errcode = '23514';
      end if;
      v_required_missing := v_field.required and (v_value <> 'true'::jsonb);
      if coalesce(nullif(v_field.validation_json ->> 'must_be_true', '')::boolean, false) is true
         and v_value <> 'true'::jsonb then
        raise exception 'must_be_true_field: %', v_field.field_key using errcode = '23514';
      end if;
      v_value_json := v_value;
      v_text := v_value #>> '{}';
    elsif v_field.field_type = 'checkbox_group' then
      if v_value_type <> 'array' then
        raise exception 'invalid_checkbox_group_field: %', v_field.field_key using errcode = '23514';
      end if;
      if jsonb_array_length(v_value) > 50 then
        raise exception 'too_many_options_field: %', v_field.field_key using errcode = '23514';
      end if;
      v_required_missing := v_field.required and jsonb_array_length(v_value) = 0;
      for v_option_json in
        select value
        from jsonb_array_elements(v_value)
      loop
        if jsonb_typeof(v_option_json) <> 'string' or char_length(v_option_json #>> '{}') > 200 then
          raise exception 'invalid_option_field: %', v_field.field_key using errcode = '23514';
        end if;
      end loop;
      for v_option_value in
        select jsonb_array_elements_text(v_value)
      loop
        select exists (
          select 1
          from jsonb_array_elements(coalesce(v_field.options_json, '[]'::jsonb)) opt
          where opt ->> 'value' = v_option_value
        ) into v_option_allowed;
        if not coalesce(v_option_allowed, false) then
          raise exception 'invalid_option_field: %', v_field.field_key using errcode = '23514';
        end if;
      end loop;
      v_value_json := v_value;
      v_text := array_to_string(array(select jsonb_array_elements_text(v_value)), ', ');
    else
      if v_value_type <> 'string' then
        raise exception 'invalid_text_field: %', v_field.field_key using errcode = '23514';
      end if;
      v_text := trim(v_value #>> '{}');
      v_required_missing := v_field.required and v_text = '';
      v_value_json := to_jsonb(v_text);
    end if;

    if v_required_missing then
      raise exception 'required_field_missing: %', v_field.field_key using errcode = '23514';
    end if;

    if v_value_type not in ('missing', 'null') and v_field.field_type in (
      'text', 'textarea', 'email', 'phone', 'date', 'date_of_birth', 'country', 'city',
      'contest_answer', 'facebook_profile_url', 'shared_post_url', 'url', 'custom',
      'select'
    ) then
      v_max_text_length := case
        when v_field.field_type in ('textarea', 'contest_answer', 'custom') then 5000
        when v_field.field_type in ('facebook_profile_url', 'shared_post_url', 'url') then 2048
        else 500
      end;

      if char_length(coalesce(v_text, '')) > v_max_text_length then
        raise exception 'field_payload_too_large: %', v_field.field_key using errcode = '23514';
      end if;
    end if;

    if v_value_type not in ('missing', 'null') and v_field.field_type in (
      'text', 'textarea', 'contest_answer', 'facebook_profile_url', 'shared_post_url', 'url', 'custom'
    ) then
      v_min_length := nullif(v_field.validation_json ->> 'min_length', '')::integer;
      v_max_length := nullif(v_field.validation_json ->> 'max_length', '')::integer;

      if v_min_length is not null and char_length(v_text) < v_min_length then
        raise exception 'min_length_field: %', v_field.field_key using errcode = '23514';
      end if;

      if v_max_length is not null and char_length(v_text) > v_max_length then
        raise exception 'max_length_field: %', v_field.field_key using errcode = '23514';
      end if;
    end if;

    if v_value_type not in ('missing', 'null') and v_field.field_type = 'email' then
      if lower(v_text) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'invalid_email_field: %', v_field.field_key using errcode = '23514';
      end if;
      v_text := lower(v_text);
      v_value_json := to_jsonb(v_text);
    end if;

    if v_value_type not in ('missing', 'null') and v_field.field_type in ('url', 'facebook_profile_url', 'shared_post_url') then
      if v_text !~* '^https?://[^[:space:]]+$' then
        raise exception 'invalid_url_field: %', v_field.field_key using errcode = '23514';
      end if;
    end if;

    if v_value_type not in ('missing', 'null') and v_field.field_type = 'phone' then
      if v_text !~ '^\+[1-9][0-9]{0,3}\s+[0-9][0-9\s().-]{3,39}$' then
        raise exception 'invalid_phone_field: %', v_field.field_key using errcode = '23514';
      end if;
    end if;

    if v_value_type not in ('missing', 'null') and v_field.field_type = 'date' then
      begin
        perform v_text::date;
      exception when others then
        raise exception 'invalid_date_field: %', v_field.field_key using errcode = '23514';
      end;
    end if;

    if v_value_type not in ('missing', 'null') and v_field.field_type = 'date_of_birth' then
      begin
        v_birth_date := v_text::date;
      exception when others then
        raise exception 'invalid_date_of_birth_field: %', v_field.field_key using errcode = '23514';
      end;

      v_min_age := nullif(v_field.validation_json ->> 'min_age', '')::integer;
      v_today := (v_now at time zone coalesce(nullif(v_offer.timezone, ''), 'Asia/Nicosia'))::date;
      if v_min_age is not null and v_birth_date > (v_today - make_interval(years => v_min_age))::date then
        raise exception 'min_age_field: %', v_field.field_key using errcode = '23514';
      end if;
    end if;

    if v_value_type not in ('missing', 'null') and v_field.field_type = 'select' then
      select exists (
        select 1
        from jsonb_array_elements(coalesce(v_field.options_json, '[]'::jsonb)) opt
        where opt ->> 'value' = v_text
      ) into v_option_allowed;
      if not coalesce(v_option_allowed, false) then
        raise exception 'invalid_option_field: %', v_field.field_key using errcode = '23514';
      end if;
    end if;

    v_field_snapshot := jsonb_build_object(
      'field_id', v_field.id,
      'field_key', v_field.field_key,
      'field_type', v_field.field_type,
      'required', v_field.required,
      'sort_order', v_field.sort_order,
      'validation_json', coalesce(v_field.validation_json, '{}'::jsonb),
      'lang', v_field.snapshot_lang,
      'label', coalesce(v_field.label, ''),
      'placeholder', coalesce(v_field.placeholder, ''),
      'help_text', coalesce(v_field.help_text, ''),
      'options_json', coalesce(v_field.options_json, '[]'::jsonb)
    );

    v_answers_snapshot := v_answers_snapshot || jsonb_build_object(v_field.field_key, v_value_json);
    v_fields_snapshot := v_fields_snapshot || jsonb_build_array(v_field_snapshot);
    v_answer_rows := v_answer_rows || jsonb_build_array(
      jsonb_build_object(
        'field_id', v_field.id,
        'field_key', v_field.field_key,
        'value_text', nullif(v_text, ''),
        'value_json', v_value_json,
        'field_snapshot_json', v_field_snapshot
      )
    );
  end loop;

  v_status := case
    when coalesce(v_offer.requires_manual_approval, true) then 'pending_review'
    else 'submitted'
  end;

  v_form_snapshot := jsonb_build_object(
    'offer_id', v_offer.id,
    'offer_slug', v_offer.slug,
    'submitted_lang', v_lang,
    'captured_at', v_now,
    'campaign_translation', jsonb_build_object(
      'lang', coalesce(v_campaign_translation ->> 'lang', v_lang),
      'title', coalesce(v_campaign_translation ->> 'title', ''),
      'rules_html', coalesce(v_campaign_translation ->> 'rules_html', '')
    ),
    'fields', v_fields_snapshot
  );

  v_first_name := nullif(left(trim(coalesce(v_answers_snapshot ->> 'first_name', '')), 120), '');
  v_last_name := nullif(left(trim(coalesce(v_answers_snapshot ->> 'last_name', '')), 120), '');
  v_phone := nullif(left(trim(coalesce(v_answers_snapshot ->> 'phone', '')), 80), '');
  v_profile_name := nullif(left(trim(concat_ws(' ', v_first_name, v_last_name)), 160), '');

  insert into public.special_offer_entries (
    id,
    offer_id,
    user_id,
    status,
    submitted_lang,
    normalized_email,
    first_name,
    last_name,
    phone,
    answers_json,
    form_snapshot_json,
    client_submission_id,
    reference,
    created_at,
    updated_at
  )
  values (
    v_entry_id,
    v_offer.id,
    v_uid,
    v_status,
    v_lang,
    v_normalized_email,
    v_first_name,
    v_last_name,
    v_phone,
    v_answers_snapshot,
    v_form_snapshot,
    p_client_submission_id,
    v_reference,
    v_now,
    v_now
  );

  for v_answer_row in
    select value
    from jsonb_array_elements(v_answer_rows)
  loop
    insert into public.special_offer_entry_answers (
      entry_id,
      field_id,
      field_key,
      value_text,
      value_json,
      field_snapshot_json
    )
    values (
      v_entry_id,
      (v_answer_row ->> 'field_id')::uuid,
      v_answer_row ->> 'field_key',
      nullif(v_answer_row ->> 'value_text', ''),
      coalesce(v_answer_row -> 'value_json', 'null'::jsonb),
      coalesce(v_answer_row -> 'field_snapshot_json', '{}'::jsonb)
    );
  end loop;

  if to_regclass('public.profiles') is not null then
    if v_profile_name is not null and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'name'
    ) then
      execute
        'update public.profiles
            set name = $1,
                updated_at = now()
          where id = $2
            and nullif(btrim(coalesce(name, '''')), '''') is null'
      using v_profile_name, v_uid;
      get diagnostics v_profile_update_count = row_count;
      if v_profile_update_count > 0 then
        v_profile_enriched_fields := array_append(v_profile_enriched_fields, 'name');
      end if;
    end if;

    if v_phone is not null and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'phone'
    ) then
      execute
        'update public.profiles
            set phone = $1,
                updated_at = now()
          where id = $2
            and nullif(btrim(coalesce(phone, '''')), '''') is null'
      using v_phone, v_uid;
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
            set preferred_language = $1,
                updated_at = now()
          where id = $2
            and preferred_language is null'
      using v_lang, v_uid;
      get diagnostics v_profile_update_count = row_count;
      if v_profile_update_count > 0 then
        v_profile_enriched_fields := array_append(v_profile_enriched_fields, 'preferred_language');
      end if;
    end if;
  end if;

  if to_regclass('public.special_offer_audit_log') is not null then
    begin
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
        v_offer.id,
        v_uid,
        'special_offer.entry_submitted',
        'special_offer_entry',
        v_entry_id,
        null,
        jsonb_build_object(
          'entry_id', v_entry_id,
          'status', v_status,
          'reference', v_reference
        ),
        jsonb_build_object(
          'source', 'submit_special_offer_entry',
          'stage', '3C.5C-0',
          'answers_logged', false,
          'submitted_lang', v_lang,
          'auth_required', true,
          'email_confirmed_required', true,
          'profile_enriched_fields', to_jsonb(v_profile_enriched_fields)
        )
      );
    exception when others then
      -- Never fail participant submit because audit insert failed.
      null;
    end;
  end if;

  entry_id := v_entry_id;
  status := v_status;
  reference := v_reference;
  idempotent := false;
  return next;
end;
$$;

alter function public.submit_special_offer_entry(text, text, jsonb, uuid)
  owner to postgres;

revoke all on function public.submit_special_offer_entry(text, text, jsonb, uuid)
  from public;
revoke all on function public.submit_special_offer_entry(text, text, jsonb, uuid)
  from anon;
revoke all on function public.submit_special_offer_entry(text, text, jsonb, uuid)
  from authenticated;
revoke all on function public.submit_special_offer_entry(text, text, jsonb, uuid)
  from service_role;

grant execute on function public.submit_special_offer_entry(text, text, jsonb, uuid)
  to authenticated, service_role;

comment on function public.submit_special_offer_entry(text, text, jsonb, uuid) is
  'Atomically validates and stores an authenticated, confirmed-email Special Offers form entry. Public direct table writes remain blocked.';

commit;
