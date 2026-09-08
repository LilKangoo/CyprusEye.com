BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout='120s';
DO $postinstall$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=
      'hotel_stripe_connect_private.onboarding_authorizations'::regclass
      AND c.relowner='postgres'::regrole AND c.relkind='r' AND c.relpersistence='p'
      AND c.relrowsecurity AND c.relforcerowsecurity)
    OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=
      'hotel_stripe_connect_private.onboarding_authorizations'::regclass)
    OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL
      aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid='hotel_stripe_connect_private.onboarding_authorizations'::regclass
        AND a.grantee<>c.relowner)
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) r(role)
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(privilege)
      WHERE has_table_privilege(r.role,'hotel_stripe_connect_private.onboarding_authorizations',p.privilege))
    OR (SELECT count(*) FROM pg_trigger WHERE tgrelid=
      'hotel_stripe_connect_private.onboarding_authorizations'::regclass AND NOT tgisinternal)<>2
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=
      'hotel_stripe_connect_private.onboarding_authorizations'::regclass
      AND tgname='stripe_onboarding_authorization_guard' AND tgtype=31 AND tgenabled='O'
      AND tgfoid='hotel_stripe_connect_private.guard_authorization_receipt()'::regprocedure)
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=
      'hotel_stripe_connect_private.onboarding_authorizations'::regclass
      AND tgname='stripe_onboarding_authorization_no_truncate' AND tgtype=34 AND tgenabled='O'
      AND tgfoid='hotel_stripe_connect_private.guard_authorization_receipt()'::regprocedure)
    OR EXISTS(SELECT 1 FROM hotel_stripe_connect_private.onboarding_authorizations)
    OR public.hotel_v2_external_calendar_provider_evolution_is_safe() IS NOT TRUE
    OR NOT EXISTS(SELECT 1 FROM public.site_settings WHERE id=1
      AND NOT hotel_rooms_v2_enabled AND NOT hotel_stripe_connect_enabled AND NOT hotel_instant_booking_enabled)
  THEN RAISE EXCEPTION 'hotel_stripe_authorization_postinstall_state_failed';END IF;
  IF EXISTS(SELECT 1 FROM (VALUES
    ('hotel_stripe_connect_private.scope(uuid,uuid,uuid)',
      '58c64002fd15b8690a7e2e89b64120225763415517674c9a2e0a350b07b16eda','plpgsql','s',true,
      ARRAY['search_path=pg_catalog, public'],false,false),
    ('public.hotel_v2_stripe_connect_service(text,jsonb)',
      '72869ca7d965c802b5ad67f6235cbbe1712f56c1961fd5beaadb35f200aac0c4','plpgsql','v',true,
      ARRAY['search_path=pg_catalog, public, hotel_stripe_connect_private'],false,true),
    ('hotel_stripe_connect_private.authorization_receipt_hash(jsonb)',
      '64aef185af0ffbecf4fdf378b36414d6e2f7da32dd70cb25c4ae0a2f8ea9c052','sql','i',false,
      ARRAY['search_path=pg_catalog, public'],false,false),
    ('hotel_stripe_connect_private.authorization_state(uuid)',
      '23d55b3b97ee8893d2b464d9ea688af47827dbd9dd6570cea585346291e96fcb','plpgsql','s',true,
      ARRAY['search_path=pg_catalog, public'],false,false),
    ('hotel_stripe_connect_private.guard_authorization_receipt()',
      '235988d6ff8107dc333eda8cf68178ce05f00b48315569c485a5d28da3eada8d','plpgsql','v',true,
      ARRAY['search_path=pg_catalog, public, auth'],false,false),
    ('public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text)',
      '10e1a64961f129ef145736b21119774d6c665b77b467510c551042bfc07523d7','plpgsql','v',true,
      ARRAY['search_path=pg_catalog, public, auth'],true,false),
    ('public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)',
      '45dc3a00c73a0f031298523cf41e9ffeac90e1e46c50c532b796a231276de473','plpgsql','s',true,
      ARRAY['search_path=pg_catalog, public, auth'],true,false)
  ) e(signature,hash,language,volatility,definer,path,authenticated_execute,service_execute)
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
    LEFT JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid IS NULL OR p.proowner<>'postgres'::regrole OR p.prosecdef IS DISTINCT FROM e.definer
      OR p.provolatile::text IS DISTINCT FROM e.volatility OR l.lanname IS DISTINCT FROM e.language
      OR p.proconfig IS DISTINCT FROM e.path OR p.proleakproof OR p.proretset
      OR encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') IS DISTINCT FROM e.hash
      OR has_function_privilege(0::oid,p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE')
      OR has_function_privilege('authenticated',p.oid,'EXECUTE') IS DISTINCT FROM e.authenticated_execute
      OR has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM e.service_execute)
  THEN RAISE EXCEPTION 'hotel_stripe_authorization_postinstall_source_security_failed';END IF;
END
$postinstall$;
SELECT 'STRIPE_PARTNER_AUTHORIZATION_POSTINSTALL_OK' AS sentinel,
  current_setting('transaction_read_only') AS transaction_read_only,
  0 AS authorization_receipts, false AS installation_enabled_any_flag;
ROLLBACK;
