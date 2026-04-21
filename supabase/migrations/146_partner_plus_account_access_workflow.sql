ALTER TABLE public.partner_plus_applications
  ADD COLUMN IF NOT EXISTS account_invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_invite_sent_to text,
  ADD COLUMN IF NOT EXISTS access_granted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_partner_plus_applications_access_pending
  ON public.partner_plus_applications (workflow_status, access_granted, approved_partner_id)
  WHERE workflow_status = 'approved' AND access_granted IS NOT TRUE;

UPDATE public.partner_plus_applications
SET access_granted_at = COALESCE(access_granted_at, reviewed_at, updated_at, created_at)
WHERE access_granted IS TRUE
  AND access_granted_at IS NULL;
