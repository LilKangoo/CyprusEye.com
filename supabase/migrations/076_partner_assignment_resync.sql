CREATE OR REPLACE FUNCTION public.partner_service_fulfillment_partner_id_for_resource(
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  has_pr BOOLEAN;
  rel REGCLASS;
  has_owner BOOLEAN;
BEGIN
  IF p_resource_id IS NULL THEN
    RETURN NULL;
  END IF;

  has_pr := (to_regclass('public.partner_resources') IS NOT NULL);

  IF p_resource_type = 'cars' THEN
    rel := to_regclass('public.car_offers');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(co.owner_partner_id, pr.partner_id)
           FROM public.car_offers co
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''cars''
            AND pr.resource_id = co.id
           WHERE co.id = $1
           ORDER BY pr.created_at ASC NULLS LAST
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''cars''
             AND pr.resource_id = $1
           ORDER BY pr.created_at ASC
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT co.owner_partner_id
           FROM public.car_offers co
           WHERE co.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  IF p_resource_type = 'trips' THEN
    rel := to_regclass('public.trips');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(t.owner_partner_id, pr.partner_id)
           FROM public.trips t
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''trips''
            AND pr.resource_id = t.id
           WHERE t.id = $1
           ORDER BY pr.created_at ASC NULLS LAST
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''trips''
             AND pr.resource_id = $1
           ORDER BY pr.created_at ASC
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT t.owner_partner_id
           FROM public.trips t
           WHERE t.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  IF p_resource_type = 'hotels' THEN
    rel := to_regclass('public.hotels');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(h.owner_partner_id, pr.partner_id)
           FROM public.hotels h
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''hotels''
            AND pr.resource_id = h.id
           WHERE h.id = $1
           ORDER BY pr.created_at ASC NULLS LAST
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''hotels''
             AND pr.resource_id = $1
           ORDER BY pr.created_at ASC
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT h.owner_partner_id
           FROM public.hotels h
           WHERE h.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  RETURN NULL;
END;
$$;
