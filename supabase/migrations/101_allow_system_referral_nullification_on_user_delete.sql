-- Allow system/service contexts to nullify profiles.referred_by during account deletion.
-- This keeps referral immutability for normal user-driven profile edits.

CREATE OR REPLACE FUNCTION public.prevent_referred_by_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  jwt_role text;
BEGIN
  BEGIN
    uid := auth.uid();
  EXCEPTION WHEN others THEN
    uid := NULL;
  END;

  BEGIN
    jwt_role := COALESCE(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true));
  EXCEPTION WHEN others THEN
    jwt_role := current_setting('request.jwt.claim.role', true);
  END;

  IF uid IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.referred_by IS NOT NULL AND NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    RAISE EXCEPTION 'referred_by_immutable';
  END IF;

  RETURN NEW;
END;
$$;
