CREATE OR REPLACE FUNCTION public.admin_set_user_referred_by(
  target_user_id uuid,
  new_referred_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_staff() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF new_referred_by IS NOT NULL AND new_referred_by = target_user_id THEN
    RAISE EXCEPTION 'invalid_referrer';
  END IF;

  IF new_referred_by IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = new_referred_by) THEN
      RAISE EXCEPTION 'referrer_not_found';
    END IF;
  END IF;

  UPDATE public.profiles
  SET referred_by = new_referred_by
  WHERE id = target_user_id;

  IF to_regclass('public.referrals') IS NOT NULL THEN
    DELETE FROM public.referrals
    WHERE referred_id = target_user_id;

    IF new_referred_by IS NOT NULL THEN
      INSERT INTO public.referrals(referrer_id, referred_id, status)
      VALUES (new_referred_by, target_user_id, 'confirmed');
    END IF;
  END IF;

  IF to_regclass('public.admin_activity_log') IS NOT NULL THEN
    INSERT INTO public.admin_activity_log(actor_id, target_user_id, action, details)
    VALUES (
      auth.uid(),
      target_user_id,
      'set_referred_by',
      jsonb_build_object('referred_by', new_referred_by)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_referred_by(uuid, uuid) TO authenticated;
