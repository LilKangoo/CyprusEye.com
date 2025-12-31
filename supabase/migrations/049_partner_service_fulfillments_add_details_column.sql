ALTER TABLE IF EXISTS public.partner_service_fulfillments
ADD COLUMN IF NOT EXISTS details jsonb;
