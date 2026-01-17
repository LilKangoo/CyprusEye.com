CREATE OR REPLACE FUNCTION public.admin_enable_affiliate_only_user(
  target_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_partner_id uuid;
  created_partner_id uuid;
  slug_base text;
  desired_slug text;
  desired_name text;
  suffix integer := 0;
  u record;
BEGIN
  IF NOT public.is_current_user_staff() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, username, email, name
  INTO u
  FROM public.profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  SELECT pu.partner_id
  INTO existing_partner_id
  FROM public.partner_users pu
  JOIN public.partners p ON p.id = pu.partner_id
  WHERE pu.user_id = target_user_id
    AND COALESCE(p.affiliate_enabled, false) = true
  ORDER BY (pu.role = 'owner') DESC, pu.created_at ASC
  LIMIT 1;

  IF existing_partner_id IS NOT NULL THEN
    RETURN existing_partner_id;
  END IF;

  desired_name := 'Affiliate - ' || COALESCE(
    NULLIF(trim(COALESCE(u.username, '')), ''),
    NULLIF(trim(COALESCE(u.email, '')), ''),
    NULLIF(trim(COALESCE(u.name, '')), ''),
    left(target_user_id::text, 8)
  );

  slug_base := 'affiliate-' || left(target_user_id::text, 8);
  desired_slug := slug_base;

  LOOP
    BEGIN
      INSERT INTO public.partners(
        name,
        slug,
        status,
        can_manage_shop,
        can_manage_cars,
        can_manage_trips,
        can_manage_hotels,
        can_create_offers,
        can_view_stats,
        can_view_payouts,
        affiliate_enabled
      ) VALUES (
        desired_name,
        desired_slug,
        'active',
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        true
      )
      RETURNING id INTO created_partner_id;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      suffix := suffix + 1;
      desired_slug := slug_base || '-' || suffix::text;
      IF suffix > 50 THEN
        RAISE EXCEPTION 'slug_generation_failed';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.partner_users(partner_id, user_id, role)
  VALUES (created_partner_id, target_user_id, 'owner')
  ON CONFLICT (partner_id, user_id) DO NOTHING;

  IF to_regclass('public.admin_activity_log') IS NOT NULL THEN
    INSERT INTO public.admin_activity_log(actor_id, target_user_id, action, details)
    VALUES (
      auth.uid(),
      target_user_id,
      'enable_affiliate_only',
      jsonb_build_object('partner_id', created_partner_id)
    );
  END IF;

  RETURN created_partner_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_enable_affiliate_only_user(uuid) TO authenticated;
