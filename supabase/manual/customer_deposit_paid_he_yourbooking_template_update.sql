-- Manual review SQL for the active customer_deposit_paid DB email template.
-- Scope:
-- - customer_deposit_paid only
-- - adds HE localized copy and CTA
-- - adds yourbooking_url to required_variables for catalog + active published version
-- - removes payment_url from required_variables for this paid confirmation template if present
-- - does not touch customer_deposit_requested or any Stripe/payment request template

BEGIN;

WITH active_template AS (
  SELECT
    c.key,
    c.active_version_id,
    v.id AS version_id
  FROM public.email_template_catalog c
  JOIN public.email_template_versions v ON v.id = c.active_version_id
  WHERE c.key = 'customer_deposit_paid'
    AND c.production_enabled = true
    AND v.template_key = 'customer_deposit_paid'
    AND v.status = 'published'
),
guard AS (
  SELECT count(*) AS row_count
  FROM active_template
),
updated_version AS (
  UPDATE public.email_template_versions v
  SET
    content = jsonb_set(
      coalesce(v.content, '{}'::jsonb),
      '{he}',
      coalesce(v.content -> 'he', '{}'::jsonb) || jsonb_build_object(
        'subject', 'התשלום אושר - {{booking_reference}}',
        'heading', 'התשלום הושלם',
        'intro', 'קיבלנו את התשלום. ההזמנה שלך אושרה.',
        'cta', 'צפייה בהזמנה'
      ),
      true
    ),
    required_variables = (
      SELECT array_agg(DISTINCT item ORDER BY item)
      FROM unnest(
        array_append(
          array_remove(coalesce(v.required_variables, '{}'::text[]), 'payment_url'),
          'yourbooking_url'
        )
      ) AS item
    ),
    updated_at = now()
  FROM active_template t
  WHERE v.id = t.version_id
    AND (SELECT row_count FROM guard) = 1
  RETURNING v.id
),
updated_catalog AS (
  UPDATE public.email_template_catalog c
  SET
    required_variables = (
      SELECT array_agg(DISTINCT item ORDER BY item)
      FROM unnest(
        array_append(
          array_remove(coalesce(c.required_variables, '{}'::text[]), 'payment_url'),
          'yourbooking_url'
        )
      ) AS item
    ),
    updated_at = now()
  FROM active_template t
  WHERE c.key = t.key
    AND (SELECT row_count FROM guard) = 1
  RETURNING c.key
)
SELECT
  (SELECT row_count FROM guard) AS matched_active_templates,
  (SELECT count(*) FROM updated_version) AS updated_versions,
  (SELECT count(*) FROM updated_catalog) AS updated_catalog_rows;

DO $$
DECLARE
  matched_active_templates integer;
  catalog_has_yourbooking integer;
  version_has_yourbooking integer;
  catalog_has_payment_url integer;
  version_has_payment_url integer;
  he_cta text;
BEGIN
  SELECT count(*)
    INTO matched_active_templates
  FROM public.email_template_catalog c
  JOIN public.email_template_versions v ON v.id = c.active_version_id
  WHERE c.key = 'customer_deposit_paid'
    AND c.production_enabled = true
    AND v.template_key = 'customer_deposit_paid'
    AND v.status = 'published';

  IF matched_active_templates <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one active published customer_deposit_paid template, found %', matched_active_templates;
  END IF;

  SELECT count(*)
    INTO catalog_has_yourbooking
  FROM public.email_template_catalog
  WHERE key = 'customer_deposit_paid'
    AND 'yourbooking_url' = ANY(coalesce(required_variables, '{}'::text[]));

  IF catalog_has_yourbooking <> 1 THEN
    RAISE EXCEPTION 'customer_deposit_paid catalog required_variables does not include yourbooking_url';
  END IF;

  SELECT count(*)
    INTO version_has_yourbooking
  FROM public.email_template_catalog c
  JOIN public.email_template_versions v ON v.id = c.active_version_id
  WHERE c.key = 'customer_deposit_paid'
    AND 'yourbooking_url' = ANY(coalesce(v.required_variables, '{}'::text[]));

  IF version_has_yourbooking <> 1 THEN
    RAISE EXCEPTION 'customer_deposit_paid active version required_variables does not include yourbooking_url';
  END IF;

  SELECT count(*)
    INTO catalog_has_payment_url
  FROM public.email_template_catalog
  WHERE key = 'customer_deposit_paid'
    AND 'payment_url' = ANY(coalesce(required_variables, '{}'::text[]));

  IF catalog_has_payment_url <> 0 THEN
    RAISE EXCEPTION 'customer_deposit_paid catalog still requires payment_url';
  END IF;

  SELECT count(*)
    INTO version_has_payment_url
  FROM public.email_template_catalog c
  JOIN public.email_template_versions v ON v.id = c.active_version_id
  WHERE c.key = 'customer_deposit_paid'
    AND 'payment_url' = ANY(coalesce(v.required_variables, '{}'::text[]));

  IF version_has_payment_url <> 0 THEN
    RAISE EXCEPTION 'customer_deposit_paid active version still requires payment_url';
  END IF;

  SELECT v.content #>> '{he,cta}'
    INTO he_cta
  FROM public.email_template_catalog c
  JOIN public.email_template_versions v ON v.id = c.active_version_id
  WHERE c.key = 'customer_deposit_paid';

  IF coalesce(he_cta, '') <> 'צפייה בהזמנה' THEN
    RAISE EXCEPTION 'customer_deposit_paid HE CTA mismatch: %', coalesce(he_cta, 'NULL');
  END IF;
END $$;

SELECT
  c.key,
  c.required_variables AS catalog_required_variables,
  v.id AS active_version_id,
  v.required_variables AS version_required_variables,
  v.content #>> '{pl,cta}' AS pl_cta,
  v.content #>> '{en,cta}' AS en_cta,
  v.content #>> '{he,cta}' AS he_cta,
  v.content #>> '{he,subject}' AS he_subject,
  v.content #>> '{he,heading}' AS he_heading
FROM public.email_template_catalog c
JOIN public.email_template_versions v ON v.id = c.active_version_id
WHERE c.key = 'customer_deposit_paid';

COMMIT;
