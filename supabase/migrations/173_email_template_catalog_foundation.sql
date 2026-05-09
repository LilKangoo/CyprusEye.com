-- Email template control foundation.
-- This migration only creates an isolated catalog/versioning layer.
-- Live email sending is intentionally not connected to these tables yet.

CREATE TABLE IF NOT EXISTS public.email_template_catalog (
  key text PRIMARY KEY,
  group_key text NOT NULL,
  label text NOT NULL,
  recipient text NOT NULL,
  source_key text NOT NULL,
  description text NOT NULL DEFAULT '',
  required_variables text[] NOT NULL DEFAULT ARRAY[]::text[],
  optional_variables text[] NOT NULL DEFAULT ARRAY[]::text[],
  preview_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  production_enabled boolean NOT NULL DEFAULT false,
  active_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL REFERENCES public.email_template_catalog(key) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('seed', 'draft', 'published', 'archived')),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  required_variables text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes text,
  created_by uuid,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT email_template_versions_unique_version UNIQUE (template_key, version_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_template_catalog_active_version_fk'
  ) THEN
    ALTER TABLE public.email_template_catalog
      ADD CONSTRAINT email_template_catalog_active_version_fk
      FOREIGN KEY (active_version_id)
      REFERENCES public.email_template_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_template_catalog_group_idx
  ON public.email_template_catalog (group_key, label);

CREATE INDEX IF NOT EXISTS email_template_versions_template_status_idx
  ON public.email_template_versions (template_key, status, version_number DESC);

CREATE OR REPLACE FUNCTION public.email_template_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_template_catalog_updated_at ON public.email_template_catalog;
CREATE TRIGGER trg_email_template_catalog_updated_at
  BEFORE UPDATE ON public.email_template_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.email_template_touch_updated_at();

DROP TRIGGER IF EXISTS trg_email_template_versions_updated_at ON public.email_template_versions;
CREATE TRIGGER trg_email_template_versions_updated_at
  BEFORE UPDATE ON public.email_template_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.email_template_touch_updated_at();

ALTER TABLE public.email_template_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_template_catalog FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.email_template_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_template_touch_updated_at() FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_template_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_template_versions TO authenticated;
GRANT ALL ON TABLE public.email_template_catalog TO service_role;
GRANT ALL ON TABLE public.email_template_versions TO service_role;

DROP POLICY IF EXISTS email_template_catalog_admin_all ON public.email_template_catalog;
DROP POLICY IF EXISTS email_template_versions_admin_all ON public.email_template_versions;

CREATE POLICY email_template_catalog_admin_all
ON public.email_template_catalog
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY email_template_versions_admin_all
ON public.email_template_versions
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

INSERT INTO public.email_template_catalog (
  key,
  group_key,
  label,
  recipient,
  source_key,
  description,
  required_variables,
  preview_content
) VALUES
  (
    'customer_deposit_requested',
    'Bookings',
    'Customer deposit request',
    'Customer',
    'send-admin-notification:event=customer_deposit_requested',
    'Payment link sent after partner/admin acceptance when a deposit is required.',
    ARRAY['booking_reference','customer_name','deposit_amount','currency','payment_url']::text[],
    '{"pl":{"subject":"Link do płatności depozytu - {{booking_reference}}","heading":"Twoja rezerwacja jest zaakceptowana","intro":"Partner potwierdził dostępność. Opłać depozyt, aby dokończyć rezerwację.","cta":"Opłać depozyt"},"en":{"subject":"Deposit payment link - {{booking_reference}}","heading":"Your booking is accepted","intro":"The partner confirmed availability. Pay the deposit to complete your booking.","cta":"Pay deposit"}}'::jsonb
  ),
  (
    'customer_received',
    'Bookings',
    'Customer booking received',
    'Customer',
    'send-admin-notification:event=customer_received',
    'Initial confirmation that the request was received and is waiting for processing.',
    ARRAY['booking_reference','customer_name','service_name','booking_summary']::text[],
    '{"pl":{"subject":"Otrzymaliśmy Twoją rezerwację - {{booking_reference}}","heading":"Rezerwacja przyjęta","intro":"Dziękujemy. Weryfikujemy dostępność i wrócimy z potwierdzeniem.","cta":"Zobacz szczegóły"},"en":{"subject":"We received your booking - {{booking_reference}}","heading":"Booking received","intro":"Thank you. We are checking availability and will follow up with confirmation.","cta":"View details"}}'::jsonb
  ),
  (
    'admin_generic_notification',
    'Bookings',
    'Admin new booking notice',
    'Admin',
    'send-admin-notification:generic admin notification',
    'Internal notification for a newly submitted booking or service request.',
    ARRAY['booking_reference','service_type','customer_name','customer_email','admin_url']::text[],
    '{"pl":{"subject":"Nowa rezerwacja - {{booking_reference}}","heading":"Nowa rezerwacja w panelu admin","intro":"Klient wysłał nowe zapytanie. Sprawdź szczegóły i dostępność.","cta":"Otwórz admin"},"en":{"subject":"New booking - {{booking_reference}}","heading":"New admin booking","intro":"A customer submitted a new request. Check details and availability.","cta":"Open admin"}}'::jsonb
  ),
  (
    'partner_pending_acceptance',
    'Partner fulfillment',
    'Partner pending booking',
    'Partner',
    'send-admin-notification:event=partner_pending_acceptance',
    'Partner request to accept or reject a booking before customer payment.',
    ARRAY['booking_reference','partner_name','service_name','accept_url','reject_url']::text[],
    '{"pl":{"subject":"Nowa rezerwacja do akceptacji - {{booking_reference}}","heading":"Masz nową rezerwację","intro":"Sprawdź dostępność i zaakceptuj albo odrzuć zapytanie.","cta":"Otwórz portal partnera"},"en":{"subject":"New booking to accept - {{booking_reference}}","heading":"You have a new booking","intro":"Check availability and accept or reject the request.","cta":"Open partner portal"}}'::jsonb
  ),
  (
    'partner_accepted',
    'Partner fulfillment',
    'Partner accepted notice',
    'Admin',
    'send-admin-notification:event=partner_accepted',
    'Internal notice after a partner accepts a booking or fulfillment.',
    ARRAY['booking_reference','service_type','partner_name','service_name','admin_url']::text[],
    '{"pl":{"subject":"Partner zaakceptował rezerwację - {{booking_reference}}","heading":"Partner zaakceptował rezerwację","intro":"Partner potwierdził realizację. System może przejść do kolejnego kroku płatności lub potwierdzenia.","cta":"Otwórz admin"},"en":{"subject":"Partner accepted booking - {{booking_reference}}","heading":"Partner accepted the booking","intro":"The partner confirmed fulfillment. The system can continue to payment or confirmation.","cta":"Open admin"}}'::jsonb
  ),
  (
    'partner_rejected',
    'Partner fulfillment',
    'Partner rejected notice',
    'Admin',
    'send-admin-notification:event=partner_rejected',
    'Internal notice after a partner rejects a booking or fulfillment.',
    ARRAY['booking_reference','service_type','partner_name','reason','admin_url']::text[],
    '{"pl":{"subject":"Partner odrzucił rezerwację - {{booking_reference}}","heading":"Partner odrzucił rezerwację","intro":"Sprawdź powód odrzucenia i zdecyduj o dalszej obsłudze klienta.","cta":"Otwórz admin"},"en":{"subject":"Partner rejected booking - {{booking_reference}}","heading":"Partner rejected the booking","intro":"Check the rejection reason and decide the next customer handling step.","cta":"Open admin"}}'::jsonb
  ),
  (
    'partner_sla',
    'Partner fulfillment',
    'Partner SLA reminder',
    'Admin',
    'send-admin-notification:event=partner_sla',
    'Internal warning when partner acceptance SLA passes without response.',
    ARRAY['booking_reference','service_type','partner_name','admin_url']::text[],
    '{"pl":{"subject":"Brak odpowiedzi partnera - {{booking_reference}}","heading":"Partner nie odpowiedział w SLA","intro":"Partner nie zaakceptował rezerwacji w wymaganym czasie.","cta":"Otwórz admin"},"en":{"subject":"Partner response missing - {{booking_reference}}","heading":"Partner SLA passed","intro":"The partner did not accept the booking within the expected time.","cta":"Open admin"}}'::jsonb
  ),
  (
    'customer_deposit_paid',
    'Payments',
    'Customer payment confirmation',
    'Customer',
    'send-admin-notification:event=customer_deposit_paid',
    'Confirmation after successful deposit or full payment.',
    ARRAY['booking_reference','customer_name','paid_amount','currency','booking_summary']::text[],
    '{"pl":{"subject":"Płatność potwierdzona - {{booking_reference}}","heading":"Płatność zakończona","intro":"Otrzymaliśmy płatność. Twoja rezerwacja została potwierdzona.","cta":"Zobacz rezerwację"},"en":{"subject":"Payment confirmed - {{booking_reference}}","heading":"Payment complete","intro":"We received the payment. Your booking has been confirmed.","cta":"View booking"}}'::jsonb
  ),
  (
    'partner_deposit_paid',
    'Payments',
    'Partner payment confirmation',
    'Partner',
    'send-admin-notification:event=partner_deposit_paid',
    'Partner notification after the customer pays and fulfillment should proceed.',
    ARRAY['booking_reference','partner_name','customer_name','service_name','booking_summary']::text[],
    '{"pl":{"subject":"Klient opłacił rezerwację - {{booking_reference}}","heading":"Płatność klienta potwierdzona","intro":"Klient zapłacił. Możesz przygotować realizację usługi.","cta":"Otwórz portal partnera"},"en":{"subject":"Customer paid - {{booking_reference}}","heading":"Customer payment confirmed","intro":"The customer paid. You can prepare the service fulfillment.","cta":"Open partner portal"}}'::jsonb
  ),
  (
    'trip_date_options_ready',
    'Trips',
    'Trip date options',
    'Customer',
    'send-admin-notification:event=trip_date_options_ready',
    'Email with available dates when a trip requires customer date selection.',
    ARRAY['booking_reference','customer_name','trip_name','date_options_url']::text[],
    '{"pl":{"subject":"Wybierz termin wycieczki - {{booking_reference}}","heading":"Wybierz dostępny termin","intro":"Przygotowaliśmy dostępne terminy dla Twojej wycieczki.","cta":"Wybierz termin"},"en":{"subject":"Choose your trip date - {{booking_reference}}","heading":"Choose an available date","intro":"We prepared available dates for your trip.","cta":"Choose date"}}'::jsonb
  ),
  (
    'trip_date_selected',
    'Trips',
    'Trip selected date notice',
    'Admin / Partner',
    'send-admin-notification:event=trip_date_selected',
    'Internal notification after the customer selects a trip date.',
    ARRAY['booking_reference','customer_name','selected_date','trip_name']::text[],
    '{"pl":{"subject":"Klient wybrał termin - {{booking_reference}}","heading":"Wybrano termin wycieczki","intro":"Klient potwierdził preferowany termin. Sprawdź szczegóły w panelu.","cta":"Otwórz szczegóły"},"en":{"subject":"Customer selected a date - {{booking_reference}}","heading":"Trip date selected","intro":"The customer confirmed the preferred date. Check details in the panel.","cta":"Open details"}}'::jsonb
  ),
  (
    'shop_customer_payment_received',
    'Shop',
    'Shop payment received',
    'Customer',
    'send-customer-notification:type=payment_received',
    'Customer notification after a shop payment is received and the order waits for confirmation.',
    ARRAY['order_reference','customer_name']::text[],
    '{"pl":{"subject":"Płatność otrzymana - zamówienie {{order_reference}}","heading":"Płatność otrzymana","intro":"Otrzymaliśmy płatność. Zamówienie czeka teraz na potwierdzenie.","cta":"Zobacz zamówienie"},"en":{"subject":"Payment received - Order {{order_reference}}","heading":"Payment received","intro":"We received your payment. Your order is now waiting for confirmation.","cta":"View order"}}'::jsonb
  ),
  (
    'shop_customer_order_confirmed',
    'Shop',
    'Shop order confirmed',
    'Customer',
    'send-customer-notification:type=order_confirmed',
    'Confirmation after a shop order is paid and accepted.',
    ARRAY['order_reference','customer_name']::text[],
    '{"pl":{"subject":"Zamówienie potwierdzone - {{order_reference}}","heading":"Zamówienie potwierdzone","intro":"Płatność została przyjęta. Przygotujemy Twoje zamówienie.","cta":"Zobacz zamówienie"},"en":{"subject":"Order confirmed - {{order_reference}}","heading":"Order confirmed","intro":"Payment was received. We will prepare your order.","cta":"View order"}}'::jsonb
  ),
  (
    'shop_paid_admin_notice',
    'Shop',
    'Shop paid admin notice',
    'Admin',
    'send-admin-notification:category=shop,event=paid',
    'Internal notification when a shop order is paid.',
    ARRAY['order_reference','customer_name','order_total','currency','admin_url']::text[],
    '{"pl":{"subject":"Opłacone zamówienie sklepu - {{order_reference}}","heading":"Zamówienie opłacone","intro":"Klient opłacił zamówienie w sklepie. Sprawdź szczegóły w panelu.","cta":"Otwórz admin"},"en":{"subject":"Paid shop order - {{order_reference}}","heading":"Shop order paid","intro":"The customer paid for a shop order. Check details in the panel.","cta":"Open admin"}}'::jsonb
  ),
  (
    'affiliate_cashout_requested',
    'Affiliate',
    'Affiliate cashout requested',
    'Admin',
    'send-admin-notification:event=affiliate_cashout_requested',
    'Internal notification when a partner requests affiliate payout.',
    ARRAY['partner_name','requested_amount','currency','admin_url']::text[],
    '{"pl":{"subject":"Wniosek o wypłatę afiliacyjną - {{partner_name}}","heading":"Partner poprosił o wypłatę","intro":"Sprawdź saldo, historię poleceń i zatwierdź albo odrzuć wypłatę.","cta":"Otwórz admin"},"en":{"subject":"Affiliate cashout request - {{partner_name}}","heading":"Partner requested payout","intro":"Check balance, referral history and approve or reject the payout.","cta":"Open admin"}}'::jsonb
  ),
  (
    'partner_plus_application_created',
    'Partner+',
    'Partner+ application',
    'Admin',
    'send-admin-notification:event=partner_plus_application_created',
    'Internal notification when a Partner+ application is created.',
    ARRAY['applicant_name','business_name','package_tier','admin_url']::text[],
    '{"pl":{"subject":"Nowa aplikacja Partner+ - {{business_name}}","heading":"Nowa aplikacja Partner+","intro":"Kandydat wysłał formularz Partner+. Sprawdź szczegóły i pakiet.","cta":"Otwórz admin"},"en":{"subject":"New Partner+ application - {{business_name}}","heading":"New Partner+ application","intro":"An applicant submitted a Partner+ form. Check details and selected package.","cta":"Open admin"}}'::jsonb
  ),
  (
    'trip_plan_email',
    'Trip planner',
    'Trip plan email',
    'Customer',
    'send-plan-email',
    'Email with generated or saved trip plan details.',
    ARRAY['customer_name','plan_title','plan_summary','plan_url']::text[],
    '{"pl":{"subject":"Twój plan podróży po Cyprze","heading":"Plan podróży gotowy","intro":"Przygotowaliśmy plan zwiedzania. Możesz go otworzyć i kontynuować później.","cta":"Otwórz plan"},"en":{"subject":"Your Cyprus trip plan","heading":"Your trip plan is ready","intro":"We prepared your itinerary. You can open it and continue later.","cta":"Open plan"}}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  group_key = EXCLUDED.group_key,
  label = EXCLUDED.label,
  recipient = EXCLUDED.recipient,
  source_key = EXCLUDED.source_key,
  description = EXCLUDED.description,
  required_variables = EXCLUDED.required_variables,
  preview_content = EXCLUDED.preview_content,
  updated_at = now();

INSERT INTO public.email_template_versions (
  template_key,
  version_number,
  status,
  content,
  required_variables,
  notes
)
SELECT
  key,
  1,
  'seed',
  preview_content,
  required_variables,
  'Initial read-only catalog seed. Not connected to production sending.'
FROM public.email_template_catalog
ON CONFLICT (template_key, version_number) DO UPDATE SET
  status = EXCLUDED.status,
  content = EXCLUDED.content,
  required_variables = EXCLUDED.required_variables,
  notes = EXCLUDED.notes,
  updated_at = now();

UPDATE public.email_template_catalog c
SET active_version_id = v.id
FROM public.email_template_versions v
WHERE v.template_key = c.key
  AND v.version_number = 1
  AND c.active_version_id IS DISTINCT FROM v.id;

COMMENT ON TABLE public.email_template_catalog IS
  'Global email template catalog for admin control. production_enabled remains false until sending functions explicitly support database templates.';

COMMENT ON TABLE public.email_template_versions IS
  'Versioned email template content. Step 2 foundation only; not used by live sending yet.';
