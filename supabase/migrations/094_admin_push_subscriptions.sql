CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  subscription jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  last_seen_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_push_subscriptions_user_endpoint_uq
  ON public.admin_push_subscriptions (user_id, endpoint);

CREATE INDEX IF NOT EXISTS admin_push_subscriptions_user_id_idx
  ON public.admin_push_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS admin_push_subscriptions_updated_at_idx
  ON public.admin_push_subscriptions (updated_at DESC);

CREATE OR REPLACE FUNCTION public.admin_push_subscriptions_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_push_subscriptions_set_updated_at ON public.admin_push_subscriptions;
CREATE TRIGGER trg_admin_push_subscriptions_set_updated_at
  BEFORE INSERT OR UPDATE ON public.admin_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_push_subscriptions_set_updated_at();

ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_push_subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_push_subscriptions FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_push_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_push_subscriptions TO authenticated;

DROP POLICY IF EXISTS admin_push_subscriptions_select_own ON public.admin_push_subscriptions;
CREATE POLICY admin_push_subscriptions_select_own
ON public.admin_push_subscriptions
FOR SELECT
TO authenticated
USING (public.is_current_user_admin() AND user_id = auth.uid());

DROP POLICY IF EXISTS admin_push_subscriptions_insert_own ON public.admin_push_subscriptions;
CREATE POLICY admin_push_subscriptions_insert_own
ON public.admin_push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (public.is_current_user_admin() AND user_id = auth.uid());

DROP POLICY IF EXISTS admin_push_subscriptions_update_own ON public.admin_push_subscriptions;
CREATE POLICY admin_push_subscriptions_update_own
ON public.admin_push_subscriptions
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin() AND user_id = auth.uid())
WITH CHECK (public.is_current_user_admin() AND user_id = auth.uid());

DROP POLICY IF EXISTS admin_push_subscriptions_delete_own ON public.admin_push_subscriptions;
CREATE POLICY admin_push_subscriptions_delete_own
ON public.admin_push_subscriptions
FOR DELETE
TO authenticated
USING (public.is_current_user_admin() AND user_id = auth.uid());
