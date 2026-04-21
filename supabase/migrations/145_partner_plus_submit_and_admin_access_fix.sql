CREATE OR REPLACE FUNCTION public.partner_plus_is_admin_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid uuid := NULL;
  v_jwt jsonb := '{}'::jsonb;
  v_email text := '';
  v_is_admin boolean := false;
BEGIN
  -- Allows manual verification in Supabase SQL Editor without weakening PostgREST access.
  IF session_user IN ('postgres', 'supabase_admin') THEN
    RETURN true;
  END IF;

  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN others THEN
    v_uid := NULL;
  END;

  BEGIN
    v_jwt := coalesce(auth.jwt(), '{}'::jsonb);
  EXCEPTION WHEN others THEN
    v_jwt := '{}'::jsonb;
  END;

  v_email := lower(trim(coalesce(v_jwt ->> 'email', '')));

  IF v_uid = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid THEN
    RETURN true;
  END IF;

  IF v_email = 'lilkangoomedia@gmail.com' THEN
    RETURN true;
  END IF;

  IF lower(coalesce(v_jwt #>> '{app_metadata,is_admin}', '')) IN ('true', '1', 'yes') THEN
    RETURN true;
  END IF;

  IF lower(coalesce(v_jwt #>> '{user_metadata,is_admin}', '')) IN ('true', '1', 'yes') THEN
    RETURN true;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT coalesce(p.is_admin, false)
      INTO v_is_admin
    FROM public.profiles p
    WHERE p.id = v_uid
    LIMIT 1;
  END IF;

  RETURN coalesce(v_is_admin, false);
END;
$$;

REVOKE ALL ON FUNCTION public.partner_plus_is_admin_request() FROM public;
GRANT EXECUTE ON FUNCTION public.partner_plus_is_admin_request() TO authenticated;

DROP POLICY IF EXISTS partner_plus_applications_admin_all
  ON public.partner_plus_applications;

CREATE POLICY partner_plus_applications_admin_all
  ON public.partner_plus_applications
  FOR ALL
  TO authenticated
  USING (public.partner_plus_is_admin_request())
  WITH CHECK (public.partner_plus_is_admin_request());

CREATE OR REPLACE FUNCTION public.admin_list_partner_plus_applications(p_limit integer DEFAULT 500)
RETURNS SETOF public.partner_plus_applications
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
BEGIN
  IF NOT public.partner_plus_is_admin_request() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.partner_plus_applications
  ORDER BY created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_partner_plus_applications(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_partner_plus_applications(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_partner_plus_application(
  p_source_context text DEFAULT 'advertise-partner',
  p_language text DEFAULT NULL,
  p_partner_type text DEFAULT NULL,
  p_package_tier text DEFAULT NULL,
  p_service text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_service_description text DEFAULT NULL,
  p_tour_types text DEFAULT NULL,
  p_tour_languages text DEFAULT NULL,
  p_tour_area text DEFAULT NULL,
  p_accommodation_type text DEFAULT NULL,
  p_accommodation_capacity text DEFAULT NULL,
  p_local_service_category text DEFAULT NULL,
  p_local_service_offer text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_referer text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE(id uuid, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_source_context text := nullif(left(trim(coalesce(p_source_context, 'advertise-partner')), 60), '');
  v_language text := nullif(left(trim(coalesce(p_language, '')), 12), '');
  v_partner_type text := nullif(left(trim(coalesce(p_partner_type, '')), 40), '');
  v_package_tier text := nullif(left(trim(coalesce(p_package_tier, '')), 40), '');
  v_service text := nullif(left(trim(coalesce(p_service, '')), 120), '');
  v_name text := nullif(left(trim(coalesce(p_name, '')), 120), '');
  v_email text := lower(nullif(left(trim(coalesce(p_email, '')), 180), ''));
  v_phone text := nullif(left(trim(coalesce(p_phone, '')), 80), '');
  v_location text := nullif(left(trim(coalesce(p_location, '')), 140), '');
  v_website text := nullif(left(trim(coalesce(p_website, '')), 240), '');
  v_service_description text := nullif(left(trim(coalesce(p_service_description, '')), 1500), '');
  v_tour_types text := nullif(left(trim(coalesce(p_tour_types, '')), 240), '');
  v_tour_languages text := nullif(left(trim(coalesce(p_tour_languages, '')), 240), '');
  v_tour_area text := nullif(left(trim(coalesce(p_tour_area, '')), 240), '');
  v_accommodation_type text := nullif(left(trim(coalesce(p_accommodation_type, '')), 140), '');
  v_accommodation_capacity text := nullif(left(trim(coalesce(p_accommodation_capacity, '')), 140), '');
  v_local_service_category text := nullif(left(trim(coalesce(p_local_service_category, '')), 180), '');
  v_local_service_offer text := nullif(left(trim(coalesce(p_local_service_offer, '')), 240), '');
  v_message text := nullif(left(trim(coalesce(p_message, '')), 2000), '');
  v_referer text := nullif(left(trim(coalesce(p_referer, '')), 400), '');
  v_user_agent text := nullif(left(trim(coalesce(p_user_agent, '')), 500), '');
  v_profile_id uuid := NULL;
  v_existing_id uuid := NULL;
  v_existing_created_at timestamptz := NULL;
BEGIN
  v_source_context := coalesce(v_source_context, 'advertise-partner');
  v_language := CASE WHEN lower(v_language) = 'pl' THEN 'pl' ELSE 'en' END;

  IF v_partner_type IS NULL
     OR v_package_tier IS NULL
     OR v_service IS NULL
     OR v_name IS NULL
     OR v_email IS NULL
     OR v_location IS NULL
     OR v_service_description IS NULL THEN
    RAISE EXCEPTION 'Missing required Partner+ application fields' USING ERRCODE = '23514';
  END IF;

  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid e-mail address' USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_profile_id := auth.uid();
  EXCEPTION WHEN others THEN
    v_profile_id := NULL;
  END;

  IF v_profile_id IS NULL THEN
    SELECT p.id
      INTO v_profile_id
    FROM public.profiles p
    WHERE lower(p.email) = v_email
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  SELECT a.id, a.created_at
    INTO v_existing_id, v_existing_created_at
  FROM public.partner_plus_applications a
  WHERE lower(a.email) = v_email
    AND a.source_context = v_source_context
    AND coalesce(a.partner_type, '') = coalesce(v_partner_type, '')
    AND coalesce(a.package_tier, '') = coalesce(v_package_tier, '')
    AND coalesce(a.service, '') = coalesce(v_service, '')
    AND a.workflow_status = 'pending'
    AND a.created_at >= timezone('utc', now()) - interval '20 minutes'
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    id := v_existing_id;
    created_at := v_existing_created_at;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.partner_plus_applications (
    source_context,
    workflow_status,
    language,
    partner_type,
    package_tier,
    service,
    name,
    email,
    phone,
    location,
    website,
    service_description,
    tour_types,
    tour_languages,
    tour_area,
    accommodation_type,
    accommodation_capacity,
    local_service_category,
    local_service_offer,
    message,
    referer,
    user_agent,
    matched_profile_id
  )
  VALUES (
    v_source_context,
    'pending',
    v_language,
    v_partner_type,
    v_package_tier,
    v_service,
    v_name,
    v_email,
    v_phone,
    v_location,
    v_website,
    v_service_description,
    v_tour_types,
    v_tour_languages,
    v_tour_area,
    v_accommodation_type,
    v_accommodation_capacity,
    v_local_service_category,
    v_local_service_offer,
    v_message,
    v_referer,
    v_user_agent,
    v_profile_id
  )
  RETURNING partner_plus_applications.id, partner_plus_applications.created_at
  INTO id, created_at;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_partner_plus_application(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) FROM public;

GRANT EXECUTE ON FUNCTION public.submit_partner_plus_application(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_notify_admin_partner_plus_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'category', 'partners',
    'event', 'partner_plus_application_created',
    'record_id', NEW.id::text,
    'table', 'partner_plus_applications',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'partners',
    'partner_plus_application_created',
    NEW.id::text,
    'partner_plus_applications',
    payload,
    'partner_plus_application_created:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_partner_plus_application_ins
  ON public.partner_plus_applications;

CREATE TRIGGER trg_notify_admin_partner_plus_application_ins
  AFTER INSERT ON public.partner_plus_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_admin_partner_plus_application();
