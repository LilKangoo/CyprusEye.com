BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';

-- One closed evolution at 114415. Historical receipts are never rewritten.
-- This stage records an already-authorized operational transition; it grants
-- no permission and exposes no reconciliation mutation RPC.
DO $boundary$
DECLARE r regclass;
BEGIN
  IF to_regnamespace('hotels_lineage_private') IS NOT NULL
    OR to_regprocedure('public.hotel_v2_public_create_seven_arches_booking(jsonb)') IS NOT NULL
    OR to_regprocedure('public.hotel_v2_public_quote_seven_arches(jsonb)') IS NOT NULL
    OR to_regclass('public.hotel_seven_arches_public_quote_issuances') IS NOT NULL
    OR to_regnamespace('hotels_lifecycle_private') IS NOT NULL THEN
    RAISE EXCEPTION 'hotels_114416_boundary_mismatch';
  END IF;
  IF EXISTS(SELECT 1 FROM (VALUES
    ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',
      '5d8e31185a165c555c2fcfcce2802fe569bb7cc201ddfb7ac91978acfa2e3141'),
    ('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
      'e895de1ed9bd868f2aaf8b5b21cf17b1a7fdf5a75de33f943991151012fa89eb'),
    ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
      'c93374ece2a04386ca3b1e6f1168de3ba5162425d977857d1a4b137626ce6650')
  ) e(signature,sha) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
  WHERE p.oid IS NULL OR p.proowner<>'postgres'::regrole OR NOT p.prosecdef
    OR p.provolatile<>'s' OR p.proconfig<>ARRAY['search_path=pg_catalog, public']
    OR encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')<>e.sha
    OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.grantee<>p.proowner)) THEN
    RAISE EXCEPTION 'hotels_114416_source_security_mismatch';
  END IF;
  -- Match the existing rollout lock-first pattern; include the audit ledgers,
  -- current business graph and all immutable anchors read by this evolution.
  FOR r IN SELECT c.oid::regclass FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND ((n.nspname='public' AND
      (c.relname LIKE 'hotel\_%' ESCAPE '\' OR c.relname IN
       ('hotels','partners','partner_users','partner_resources','partner_user_resources','site_settings')))
      OR n.nspname='hotels_v2_private') ORDER BY n.nspname,c.relname
  LOOP EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE',r); END LOOP;
  IF (SELECT count(*) FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts)<>1
    OR EXISTS(SELECT 1 FROM public.hotel_seven_arches_reviewed_pricing_transaction_context)
    OR EXISTS(SELECT 1 FROM public.hotel_seven_arches_pricing_activation_transaction_context)
    OR public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint() IS DISTINCT FROM
       (SELECT catalog_fingerprint FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts WHERE id=1)
  THEN RAISE EXCEPTION 'hotels_114416_historical_foundation_mismatch'; END IF;
END $boundary$;

CREATE SCHEMA hotels_lineage_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA hotels_lineage_private FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE hotels_lineage_private.reconciliation_receipts(
 id integer PRIMARY KEY CHECK(id=1),
 contract_version text NOT NULL CHECK(contract_version='hotels_7a_lineage_reconciliation_v1'),
 evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),
 evidence_hash text NOT NULL CHECK(evidence_hash=public.hotel_v2_h3_2b_hash(evidence)),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE hotels_lineage_private.reconciliation_receipts OWNER TO postgres;
ALTER TABLE hotels_lineage_private.reconciliation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hotels_lineage_private.reconciliation_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER reconciliation_immutable BEFORE UPDATE OR DELETE
 ON hotels_lineage_private.reconciliation_receipts FOR EACH ROW
 EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
CREATE TRIGGER reconciliation_no_truncate BEFORE TRUNCATE
 ON hotels_lineage_private.reconciliation_receipts FOR EACH STATEMENT
 EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();

-- Finite successor certificates, inserted only by the owning atomic migration.
-- Historical reconciliation evidence is never updated. A missing certificate
-- cannot mask a changed function: the baseline projection then sees raw drift.
CREATE TABLE hotels_lineage_private.successor_receipts(
 stage integer PRIMARY KEY CHECK(stage IN(114450,114480)),
 previous_hash text NOT NULL CHECK(previous_hash ~ '^[0-9a-f]{64}$'),
 bindings jsonb NOT NULL CHECK(jsonb_typeof(bindings)='object'),
 receipt_hash text NOT NULL CHECK(receipt_hash=public.hotel_v2_h3_2b_hash(
  jsonb_build_object('stage',stage,'previous_hash',previous_hash,'bindings',bindings)))
);
ALTER TABLE hotels_lineage_private.successor_receipts OWNER TO postgres;
ALTER TABLE hotels_lineage_private.successor_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hotels_lineage_private.successor_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER successor_immutable BEFORE UPDATE OR DELETE
 ON hotels_lineage_private.successor_receipts FOR EACH ROW
 EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();
CREATE TRIGGER successor_no_truncate BEFORE TRUNCATE
 ON hotels_lineage_private.successor_receipts FOR EACH STATEMENT
 EXECUTE FUNCTION public.hotel_v2_h3_2b_immutable_row();

CREATE FUNCTION hotels_lineage_private.successor_manifest(p_stage integer)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$
 -- Finite compiler-checked stage manifests. No other stage is recognized.
 SELECT CASE p_stage WHEN 114450 THEN $manifest450$
{
"public.hotel_v2_admin_d_current_foundation_snapshot()":{"before_source":"2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a","before_definition":"2d48a1d79953d6aec50cf1232eefa9354715a178495c51572b26ec8a722a75ca","after_source":"d5fc70d1a21b4a33e40479d3f1f449103cfc9904ad4108797eff9da6fe7e3c68","after_definition":"248a739e17b8dee326767f9bee9c49f6dcce199aafce7b979ac01c71e07d6905","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)":{"before_source":"c356babeced94194355f5215fbb810beb1e17f9cc66b66a094652bc5532444d4","before_definition":"2cbdfe2537e0c6f1a93776eb9ade81cfb3fd9d9229d3b7a8f92c37a7b2eb5714","after_source":"7f665d523ae4cd0ecd9183645e50b2898426e1e62fd1bd74b652b87a227c1e7b","after_definition":"a950b07c97a3479591a9513384c088c2a5af176f71d3cb7151713e920c4953a8","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)":{"before_source":"a90e31de536eac6e20f1c2c741ff0cb3acb83c63d828bb53b1fb497d1f062f1f","before_definition":"9c719834a860b6a2af992837d19cef93249a7adce73cb1a4441c3a27f9cb3598","after_source":"b9c54e3bc693cbf5fc29ef42d473040cbf2031f7d254421c9f8a7f7eb2fa8ec3","after_definition":"d71ce2a6e0ccab38d8acfaf233798c458103785230b4dd74f8d58bd1093c24ef","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_control_common(text,uuid,uuid)":{"before_source":"4cd6c670dd75759f628afad1c2a19ad93fe33f7cef289f30abc0479c1a03f4c8","before_definition":"4516cdb8bd8252a06243b2c9b315bd92ccc4225397c4e701c7549177de9af0ab","after_source":"60dfacd10826d5b405771a4f9b1e65c8aa681051695e23febe0e6462aaca032f","after_definition":"21f3257085959ddfe967e59fdf182e223904fbd3236b207da513979a3f550c0e","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_guard_room_unit_capacity()":{"before_source":"9d076b4ef7506123580609ccd2dc95d1732a5b6737bd26e1cbebb894f3132267","before_definition":"487e102aa2bf4a0fc6c94dd651ec923e35146b589fbdc708f48b505da147ea5a","after_source":"5e2e6bdeba8c3cb24ea9a71b5c76b2bd49f954593b79136105d752d9a36f8222","after_definition":"684c350dab4ad20b35d6b8e1958967eb2f17dc499a9d43f14eb50060a5b8a3ce","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_guard_source()":{"before_source":"1f32c2178e1ff4052a1060bdfe247d87f4378b14cf6b07222bb160f2addd9aa1","before_definition":"eb519004f29cec38ea899f92804f97cca629a9a61e9cd6920d6d3cf5a98131fb","after_source":"fa7de473c2ab0c4a9ef038baa3bcc1058d0d013eb809d930bcd5ef29ebb969f5","after_definition":"b35dfa4b143a6b2056e58e411c690bf747f3da0211148ff9b738d30922a40848","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_preview_common(text,jsonb)":{"before_source":"58597bf1f2d41482f51c3582e3267a87671144becd49a73bf53cac3144fd8d46","before_definition":"1766bedc089275b52f57e388092617a7c1611c899565eee9c91048477c44b1af","after_source":"78aa6fbb83e51d945422a05ce06c4086984c2deb3c2bb1099cec32f3f759d901","after_definition":"2fc5490f1eae3934b566b6e183cf8c945a0b862da01b9541d957a5caf8fcd687","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_protected_fingerprints()":{"before_source":"e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5","before_definition":"6fd856cf403534bce6a3605c721b232935ff8dc669cb8a9d45918e2bce7b9614","after_source":"f432744ec7753928726b3a4d4c999183d6f1f394217aa35182f594cd05b39d49","after_definition":"e86ea0df3add4c4863ab082de1ee1d00a7c081d2aae1b604a2365e4f6ca82f0b","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_provider_sources_are_attributable()":{"before_source":"6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f","before_definition":"d1151e2424adbffb1615000eaf7da19f53a24824a9fb299c5dc05f5177b63ef2","after_source":"78cef0753a71a5bf7304f0a627fdf687b12998b80e84626d59d41884dc522d68","after_definition":"cdd258fa0600f7f133ff1222102b17a69f9f22895dd6ec7718982f738d463616","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)":{"before_source":"71219e42a4fcac040981f2aca5630f396733c41c9d844c00d248db85b557783d","before_definition":"e455238b3667cba5b93802662b262cefce8298198f528372d8a35f16a3b6a1b9","after_source":"6de9d9631aacd3a14e79469e2d96e40612e58fb143319326bb9c39a106021569","after_definition":"1b226bab063f8f515f4dcd334df513938447edc203af61c906450a272a241099","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)":{"before_source":"a7f8b25a863a2c8ae66c66de487d95be1dc0da96b75527b10b3f36a398907606","before_definition":"5103f2bd32de937e7b51b2601ef30b10c0902aef750adf27660dafe699c461d7","after_source":"e18d8cc350dbe42e830ae32ac10a2024dc4141c62fd6285afce2ce8cf49dd45b","after_definition":"255c7ad9fe299105dbfb5ffe585c0596a3519cc1e05f9c692f7f9a945d74f50f","before_metadata":{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":true,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":true,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)":{"before_source":"7147beb1ff3dffaac4bf22479e6b8a9eebcbf198f701ce008f3fdaf4b17542a2","before_definition":"2b19cd1cda30646e0d20480bfe2fa27ee8cb2636f62a30b2d3e7de1aa1b0ff5c","after_source":"83c6e75dd0fc4cc234ceb4f0633a8fe8c5f90150b3625d662e7d69993406ab5e","after_definition":"da19ef127a419bf1bda745623f1a67a0c29195a62352ea9fd9bde12503ef0320","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_source_projection(uuid)":{"before_source":"654b9f24f7e4f82a62a62752079bc9b1e37c60a61ce533b9b746b92b05efe06a","before_definition":"82c29250013972fb288efbcc1f46659fe5b7a4e8343b8e6fa065db13d9b25d0d","after_source":"59915068c797ad9f21c14ace288f6aa4e8b1e00eac58b6194a83334cf30bac88","after_definition":"a68508e165dde9308db8489b1ba7f5273e18faeed5f3e8790bce6b994e7f9d1b","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_worker_begin_sync(jsonb)":{"before_source":"d6f13d351a8902d04fdfe3f303e71a888f12f66f1791e841139c949db7f62c47","before_definition":"4a3d6ba2f76ab0070eec3710a1ff6b8cc395c676f514ef408eba874ea99a1b1e","after_source":"423d15aec62502b804902f609ef5bb91e6a5e08a075e2ad751f5d23bca8de956","after_definition":"f987d8d7a0f32a076fb054e643188379013fe6586efeaaec042f97c858c6d99f","before_metadata":{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":true,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":true,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)":{"before_source":"9c70cddfe946e1c19644ec39ae5958669b0aec95d60474aa18bf87e1bc13fc1f","before_definition":"a779d644fec3f22630d5d3fb8ba0e2ea21a50f756134a7aa59ae05e283a62635","after_source":"e9e7068b376afe9f54140016f54b65e61965888146c8290aead6fa415d0374a0","after_definition":"5eb43a4bd3d82d2cea0a4345811788c0a6dce46cbbcf3733c47c707dc8961fcf","before_metadata":{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":true,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":true,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)":{"before_source":"a268d6e3e505b49bddb83dc5a49f5bb0f532621db91f030415bb2f460ef3c00e","before_definition":"1be604fd3f5a8588a5610503e7736e4d5fad835150af4c85efbcc34e5f93c906","after_source":"335a16b0883f463bd2989f38061620c740132852dd82b6c62f8530426496154e","after_definition":"1bb6a80e2df2cdc0962c822d86b63e3cbfb37f108ee88b41e4e1664a8a867e90","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_worker_list_sources(integer)":{"before_source":"965d53dbf9ad378ac9c67645234df5591b0be556eec3bf6478b712708cd68494","before_definition":"03c8d95cc708a596c54dfb255a0805baca165a192a5a47e23b40c8605b58f177","after_source":"1d29be21198d690b6ee36349ddfefa6753843e8ce1829b9102b43727f49348b8","after_definition":"1845fc8e9c466a1eafe05920a3babba708883fd676bdd356e4ebd7e9bf0cabbd","before_metadata":{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":true,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":true,"authenticated_execute":false}},
"public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)":{"before_source":"455713d256a08bbfb16426ec870cff301915ef76c438bac98ea3be6ae093fcba","before_definition":"f65adc816907b28cb8827a955bec5e901df68c04ff1aca0c2ed8e22eab0effd2","after_source":"a7eb79c9c2d94989740282a2e31c94ea80722b2b756d875a11becf9f3a4d9892","after_definition":"8abab98cbd2a7baba431bfc9ebbac7b027c7d500d50d6cede4d270f457974ba2","before_metadata":{"acl":["postgres=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":true},"after_metadata":{"acl":["postgres=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":true}},
"public.hotel_v2_public_quote_seven_arches_core(jsonb)":{"before_source":"5265e97e8971d06e95e27db72ebc2f5e006eac8cb17779f1cff6ab519f9e6559","before_definition":"0b88496636142967e021d2a5b4d448f63cca26532deb05a600f40af26dea812d","after_source":"77e6b78131dc054e78950851a044c39042e1dc21f267be70dc1b413f1640aeb1","after_definition":"adac228ee11c497757233d8f5f58cd8d4d2cea5ae2c02cf8155c0adcb00a01f5","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_independent_pricing_activation_lineage()":{"before_source":"83d47602a08cdcc0db71fe0270a0c5e61ee6ce6d6a33c5d84cd7c78bc7d448fe","before_definition":"9d40ee590478e63929712dd8da5b59291647d086e554768823bfa0059d52e3a9","after_source":"2438f50b54d60d603a169b499b9918b975a0f215993b23e480e9e77fdd5bacba","after_definition":"7fb9b84ec635311001c78b641c5d2fc1062d478a98fecc5ada831c8f58b47f6e","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()":{"before_source":"8657d02bb8ae500ddfa366a84d1dfee6bf9f425f529cba30269522a8d9485df2","before_definition":"5f2ace0dd7842d7bad48e77a9629d3e5837270c3e9c6b851bb64190f34065336","after_source":"9c891fee2fa897b4bb10940269d73d107b2e0d718247db0e61d9dc99a4b2b6bd","after_definition":"e55161f1c6eb8ec756df36972ff1bbeb21ffddba76dcce9f0b1223c6c5fa302a","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()":{"before_source":"e42b5b7cabecd6e7ec7a847796983e497572f9f8fc0802f642fdc6b995d84ac3","before_definition":"e57b182cc5629263c29352532bdfb0b39dfe1aa8b99e34c7e1f2b71b90ea9a20","after_source":"1ceacd910ff472446e3da8c2d6ffe692ef01db704524426bfb0aaebdb8e2cfd0","after_definition":"598c1c42f75a4e6554211bd88b6e89daab604f823c8aa4b14942e8d96e69e8d9","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()":{"before_source":"0a6255e457f0912452949966e47e29a0ce0f6cda3e85c53b999343f9b68c3a95","before_definition":"8e8cd4ed7c5f5a346d8363107e31868d17ed05449b6b25786fcdf77af9d08e20","after_source":"fd5ec022e7e2483b2f2febcb17267e2750e634f8d3f296425a49768268420a1a","after_definition":"de96a9d90148e606b87d4db3d674053d4f57b8eae9fa6800fb9de29b4a0e1edc","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()":{"before_source":"b3693dead7fbbe9029a9503e361d085e2c21ef0fef025d150149ef013f249873","before_definition":"68f9b5048ba7721962f63221220f826eb963480c18f0fefb0fbeb780563f1c6e","after_source":"9274511497439aecd69a3ad839f44852afbc3023650ff1d27e0ce3ebcb149690","after_definition":"6bcbb97643fdaccba7a440fae4422305cda25424887f44d17718381cdedeede3","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}}
}
 $manifest450$::jsonb WHEN 114480 THEN $manifest480$
{
"public.hotel_v2_seven_arches_independent_pricing_activation_lineage()":{"before_source":"2438f50b54d60d603a169b499b9918b975a0f215993b23e480e9e77fdd5bacba","before_definition":"7fb9b84ec635311001c78b641c5d2fc1062d478a98fecc5ada831c8f58b47f6e","after_source":"2c40bc68f2d7dd54bb50654d0ca3e5a528509964377fc57e460718e7baa82fd9","after_definition":"3b1a1cc2a9cfa2670c7425cf5b672fba49df8d980f0d20b1bf9928bda3163132","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_h3_2b_flags_off()":{"before_source":"24913daf8524b3f9eea0d35b1e25e84807664edda55a6bcc0802a19cb85b8513","before_definition":"f3363dcda325ed4e98b9d356481c3524f3724f8d2ffdad2a9e62fc33c6817c8e","after_source":"c4866c37cc2a4c5569e9efee957db4f13cc641290e2b2ea4b96f6265e9a2691f","after_definition":"eae9ed4d381ab67e80238570a0a9c713262c7c01d1664754396789a49a55b3d2","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_partner_list_assigned_properties(uuid)":{"before_source":"96509745b06e4c21c3ea67d94f7aa57d7bf17d86772fbf4ac9710ae421b3c017","before_definition":"54caeb053a540a0197ab42feb40408c721cd3c4dba974fe473892120d55498e0","after_source":"01a3987c9596801a9bdbb34df9bc2825d60daad2e83f0f7c0c8f5e7df82af6a3","after_definition":"37af7548f516458006c6a4f0e7522e0b879bfa3bd876bee83be936c2d9f4517d","before_metadata":{"acl":["postgres=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":true},"after_metadata":{"acl":["postgres=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":true}},
"public.hotel_v2_admin_c_validate_pricing_graph(uuid)":{"before_source":"03f787a5e00fbbe65bdcaf1a96529512f60775074a1fdf4dcdd04104c7c7d335","before_definition":"f215434218a5db801469d8394ddf4a90c656da8ba4ca568def7a50687c159d84","after_source":"4c5b744e6117c1e27a6215a98ebd788b30d06e6bcf4040ea2335a2f4f1fbb6f0","after_definition":"c8bf8052a8b81cd2f636b28e3220186b43446617fcd4823b8d0dfb852e47a1cc","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_admin_c_pricing_control_snapshot(uuid)":{"before_source":"3f954c525277c771c3009e9ca1fbbf6c68776904f40bc70978d01f7f10a060b0","before_definition":"b6f98c59f06409053264cf2d8135829ae1abee79f63b16f127232028c92b7556","after_source":"5d40f4475e8bbda75d3f44820ba90cca32fbb57cc405191e2c1369d1fc5a01c3","after_definition":"70a57944e746b59ee3a9982af70e307de6461b9e184cd6340eff7e0f8264db23","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)":{"before_source":"54623c446938b9606b3b798e779efbe39820dd3a715e49fcc4b30a803a5de942","before_definition":"85bde1bba40e620df617c7e045c957688e5a9614ce7092577e5e8e5cd7024966","after_source":"ae51c6ed5516fe7c37b684ac843572af0d2b23b08ca28759b58c926c97df9798","after_definition":"bbfe5f0ab5358b7edfc397c3e0ba302bcf3091452d545a4af910be91f056565c","before_metadata":{"acl":["postgres=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":true},"after_metadata":{"acl":["postgres=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":true}},
"public.hotel_v2_admin_d_snapshot_external_base(uuid,date,date,boolean)":{"before_source":"b256a7e58e52c0ee53336c2dff5e4f351c16187e09fb00bdf434a5c2dd36a43d","before_definition":"41c0adb5e8de9489f67ce9eedfba6ec681a463651fe527a2d9930c698ee9e61a","after_source":"0d8e57d5bb06811f3ad39f6d4a638783d4517bf6c0b660a64a551790059e625c","after_definition":"4916833c3bd1d3bac7678fd4dce701ddc6f7bcfae8aa948135b0e68e2687a1f3","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_partner_workspace_function_lineage_is_exact()":{"before_source":"dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85","before_definition":"45a628ab102fcf62e3832b4ff7da654a0cc9c63005c9cebe3459caad869f7d7e","after_source":"e1bbb882e4ed18b28ff638262aedd9f29692a520d62aa016b6ef2b82f79a7757","after_definition":"863c098734afa002405d968bad5b1985b2e877929cabf483bf009a73f633f15f","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_public_create_seven_arches_booking(jsonb)":{"before_source":"82949643fe6099308f9293a335f27e1d1be9f66c1aa3e0d77925458cdd7142f7","before_definition":"b6d0c728dd0ff784a52e4bf22754b0ea7aa92f51ccb5f96f42c5d0dd53a767aa","after_source":"1406fba4204f321bb4478a380ff391b0317ebee87548ada0252c4c9fd655feb6","after_definition":"cca3383cae303edfdd7c574a604ae79a0acb3c5f3e4e024dd34b0d8c7747ffcb","before_metadata":{"acl":["postgres=X/postgres","anon=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":true,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":true},"after_metadata":{"acl":["postgres=X/postgres","anon=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":true,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":true}},
"public.hotel_v2_external_calendar_site_settings_fingerprint()":{"before_source":"e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd","before_definition":"b85c2bea43d31eed31f3da624500a5d1e0162760d3bc87198e674ffca92f2b9c","after_source":"8e88d7f4778e65afda80b98a9ba4b32a7ed7c56ae4022312bedcfd6f2b8e45f9","after_definition":"223d2f63e7847f6c6d94bb4dfcc92c1b53c2e7ea2e6188e6bb7c0f31d07f807c","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)":{"before_source":"b21177e87bbac4750e90243dd4d695c45d361deb69fbd5d9cce5be8eb1412d7c","before_definition":"dba4c90785651c1a03d8fd129eb8e936b219ec9f34b8bde6b82cbe69a0b4633a","after_source":"2b5702a60866205e56c6ecb7492581cf1b262098f5142b39559de5c6feb012cf","after_definition":"de32aab032b9a2d310614aed39b6fdccd7b573994db6630b5a7fe5c7e97e40ab","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_activation_function_fingerprints()":{"before_source":"fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914","before_definition":"26cdd7b4ad44060ff78137b50bb46a4009287573d274bdfb41f40e3e35863b23","after_source":"4050571cca29b2e8210f01806e8af643e484af6039985a0d2517b89ada5c2693","after_definition":"4d05c597fb4c7ab3d94ec0d5638bb4ea68ca274a1ac5f63e1b46a0a170f1bba2","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_pricing_scoped_lineage()":{"before_source":"196c9b7ffa1901cbbafcbd05dadc722546ae1ed07e5a0170e97b4e2b3e5cf2e8","before_definition":"ded3ba1f142f2c26fc67390d87186ad45121032a78e330c6d1f7ea213a677024","after_source":"11f6a865ddea542368bf76e707b0ec660a7245742a3db3441e99b9de22f7224d","after_definition":"f01fd6b200db6f6eaa58d22a8de0d2323b968cc1b9b3ce4577eace2bd9bd7fb0","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_admin_d_current_foundation_snapshot()":{"before_source":"d5fc70d1a21b4a33e40479d3f1f449103cfc9904ad4108797eff9da6fe7e3c68","before_definition":"248a739e17b8dee326767f9bee9c49f6dcce199aafce7b979ac01c71e07d6905","after_source":"677c8fba8970df369b356bf76fb42e07f3884fdcc058407151ea9d67f847bd62","after_definition":"fc4352c58f73c24305e1bd117964f6b2c21e2305f846bae119edaba504983001","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()":{"before_source":"1ceacd910ff472446e3da8c2d6ffe692ef01db704524426bfb0aaebdb8e2cfd0","before_definition":"598c1c42f75a4e6554211bd88b6e89daab604f823c8aa4b14942e8d96e69e8d9","after_source":"6e53ef01e748a54cb1dbbae5d35010a343aa4331a0c5450a4d2fc967a1e253fd","after_definition":"15ae83a24e9d1da13780d6f53f8b0c17ac6cb228dd12fc4c11fbc67bea817536","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)":{"before_source":"786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef","before_definition":"543cdc02168bd6219823271b009b1c991daa5f13d95ae1b0744b4d94e098b31d","after_source":"0715f51bc7f331754c7fcc4fada0585a59675b6ae286d1fe5dc394aff16c2e28","after_definition":"2fcfb002c33d1d376a109296ee42f786fe791ad087f968e5e9a19bbd60c630db","before_metadata":{"acl":["postgres=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth","statement_timeout=60s"],"public_execute":false,"service_execute":false,"authenticated_execute":true},"after_metadata":{"acl":["postgres=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public, auth","statement_timeout=60s"],"public_execute":false,"service_execute":false,"authenticated_execute":true}},
"public.hotel_v2_7a_pricing_activation_transaction_is_preserved()":{"before_source":"1e3c8c0d3383d8ecc384ff1da4e7ddf687bb8ae3f957247e1a63f6196f92ea81","before_definition":"54957a752115bc49101e13b8bff28889e9a2b5c2334e6008ad5b12c0d825815b","after_source":"1e74c1b709abb1fb29de0283d37d03325fd0ed7d5f6a01567a73174f8c6e983e","after_definition":"9c96064e0e927da70fa71ddf3eeec86aafaf5e5baa9009627cf79f14778b1aa1","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()":{"before_source":"fd5ec022e7e2483b2f2febcb17267e2750e634f8d3f296425a49768268420a1a","before_definition":"de96a9d90148e606b87d4db3d674053d4f57b8eae9fa6800fb9de29b4a0e1edc","after_source":"17b801fefd47c93859f1e7868b606d3d56288dd590f931aa4c385148a72d85cc","after_definition":"3ad9eb4ebc7e8e9e219425aec251ad24e806110080083071a618a6d274b737b2","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_independent_pricing_legacy_projection()":{"before_source":"1d7a7fe016be8d615660a92e5ef911754bc858154e1b909592e4266476a7a57a","before_definition":"84cd8525625f88df4b6dfa13e2849a91e983c9959deb171a8fa597ec687d1a3a","after_source":"b596013a158f7358a1ca7514bff6228d0dc88c2e4e1c7b2e4f6ee7437ecbac75","after_definition":"6fc0c26ca43004bb851eab4c8aafe0abc47ec6f7d6a5cb53dce926939fb53f54","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()":{"before_source":"9e9cc99a27d6397d4ec769df213b5a0344c5f0a7dcaf828a5b07683c09b7f932","before_definition":"83a71f86be4c7d90e1994fe5169fabe7b959172b21a7efb4fdf6a64bff740603","after_source":"3ff36a3245901ea37f53e6dfbf9213e1bc72f127b7531041904833d5993eef17","after_definition":"81f4ca6d12bbe8317e03a5fca9691aaa4610e7419bccd1567d1777d96ae8ec87","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()":{"before_source":"9274511497439aecd69a3ad839f44852afbc3023650ff1d27e0ce3ebcb149690","before_definition":"6bcbb97643fdaccba7a440fae4422305cda25424887f44d17718381cdedeede3","after_source":"ca914b81c1b0d22ad186669010b27b13c946949e73bfc84ce8065bea037e5424","after_definition":"6b61c40bdac2791317109a09604bf594353ce631ad6c39a02f9c223e74e75071","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()":{"before_source":"c0e257ae4a8bbf8fae16270025dbbd34490ff39ebeda1733e26de1215b372e0e","before_definition":"6d7d1d2ce50ee5235918705b73b865afc549e38eee1a48dc3cd26392da1d49cb","after_source":"448e4e89c367efe15c33c3c6fa0a92f4d9972957da130b365536c15bd25fc69a","after_definition":"84fc46af163582080a16d8279dd5b02704384731e9c32a89a1fe55a314a426bf","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_public_quote_seven_arches(jsonb)":{"before_source":"df28183f1566e5d4a9a234373c3fdd1976935774f58f9b37b69c2361e597e81c","before_definition":"1fc04a8e198fbb9d9175e28a2cdcd8dedaddda126ca4ff6d0413fef842655f4b","after_source":"9968579d255778c5f632d8e566a2bcc49b370e23bfb61bffb1a95792136b22ca","after_definition":"0a986b930334e9f097e63147c670d3501995210ee278bf820dbb486b09f8e671","before_metadata":{"acl":["postgres=X/postgres","anon=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":true,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":true},"after_metadata":{"acl":["postgres=X/postgres","anon=X/postgres","authenticated=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":true,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":true}},
"public.hotel_v2_external_calendar_guard_source()":{"before_source":"fa7de473c2ab0c4a9ef038baa3bcc1058d0d013eb809d930bcd5ef29ebb969f5","before_definition":"b35dfa4b143a6b2056e58e411c690bf747f3da0211148ff9b738d30922a40848","after_source":"420566d02e827709d6b0cf3e5f671216ef10789beb9b693b4df70314a48c5fba","after_definition":"77ce0c830a3e78dd4c37ff9802162a16bbfc72b80e35700131df6cf00d991ad8","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_provider_protected_fingerprints()":{"before_source":"4fbaaf830310f6cd1bf8500255f812c43cee95c71a679f44c6e0b72fa421c74a","before_definition":"195e314773039cdd6d26985a72fe2a9771772e80302830062eed2daad9dd3ff5","after_source":"70e1931dc0e075af8ac9139936dd7388668e38f5880a2d229a3f9834bda52acd","after_definition":"5951e9e2fdd8284c17049a5539b9d5a650875a5629174f1b9b59985410940b01","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_provider_evolution_is_safe()":{"before_source":"07c8246f8729217b497cb0e15834406fa80b1c3caf44b28f1128771a569777b3","before_definition":"8fc78a0646b3fb7cf4c8cdf1576b31451c6dc9cad7d549119b5994d830004ef1","after_source":"04cedf05665423bd1f01dc28aefe9be7e59ae34688601bcee759b57cc099c5a3","after_definition":"c14f2bbdf4f774c2beefcfdbe4dbdff5901f7a9fcad42b9c51d6669aa9729443","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_stage2_compatible_fingerprints()":{"before_source":"3cc1148945a35dd044203e88f5153374adf112188b84e83ce47f03d5a3193eca","before_definition":"d8d3f6034bce834798c1730689cd76b48920b5a2a76b260f0bc4ab3caa76067f","after_source":"8fbfdbc8807fb6efee5371ed9126da892fc958474f943a6098f583e31af39096","after_definition":"fa97c3a0afa2dd7e5b1dcd4f025cb4f07c0065cd59b7673f3c7ff7a0f6d2e48c","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()":{"before_source":"d5715bd29b456053bb32b0cf26793553617e8082443762091b7643943d5282db","before_definition":"85a54577b703d637d260c9e567a2b8202dd6f84169229374ecd855d27d8ec343","after_source":"93cfd999504d4cd55e22252dec42a0ad96e0d35d5ed336333cfb2c7da35d2ff9","after_definition":"e3508e7d300473abaa4c871e1ba659c849f556cd16ab72b3bb9f12e3640d7e29","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()":{"before_source":"7f35ba043a7bf730aa70204438f59639e743a80f7937a3be5b8efa793a7b113a","before_definition":"420933d7d0cbbf363106c4886a7903f838bbf9381989217e9fa886863d27e857","after_source":"0469f5be71cfaeaa3656bb31cdbf9c89e4284817229ac98971d833216122bbf5","after_definition":"f6490c61d3030a784a609f1657acce8d96b588e736b43ff07462af4a094d059b","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"hotels_v2_private.hotel_external_calendar_provider_function_source_hashes()":{"before_source":"2a69f53d963d295b767dc5d4b17a5df7c175513efe5f36e9aac350746091d1cd","before_definition":"cfe451f6e0b7e5e8c2399114a6b3cb894f83dfca23e7b82f52e2428a2e90816c","after_source":"c6bd94ce0c4d1d01709acd21c64b2270a16d23c7bf9402ecdba0d669d8fc88dd","after_definition":"430d1cff2d9ff2b8a8e67791e948831bf045060d797fc1ce55756f8a6ab3cc62","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}},
"hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()":{"before_source":"2a122fdadc46adcdfd8114f4a011fe6d28d2dd9710bc2cc9830cc98178c2889e","before_definition":"bd15156805a4a5f3deed8ad8e6f3cc665ae31bdee9f2f6cc38d1cdf89ed429de","after_source":"7a8e5e487451c8834dd42d7ab89a47742e4006d0e92d87480b1c643e288aef5a","after_definition":"4251301512ea160e41d03f841c15b46206203752e7502cf0547c34fa52d0d531","before_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false},"after_metadata":{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","strict":false,"definer":true,"language":"sql","parallel":"u","leakproof":false,"volatility":"s","returns_set":false,"anon_execute":false,"configuration":["search_path=pg_catalog, public"],"public_execute":false,"service_execute":false,"authenticated_execute":false}}
}
 $manifest480$::jsonb END
$function$;

CREATE FUNCTION hotels_lineage_private.successor_metadata(p_oid oid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$
 SELECT jsonb_build_object('owner',p.proowner::regrole::text,'language',l.lanname,
 'kind',p.prokind,'definer',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,
 'leakproof',p.proleakproof,'parallel',p.proparallel,'returns_set',p.proretset,
 'configuration',p.proconfig,'acl',p.proacl,
 'public_execute',has_function_privilege(0::oid,p.oid,'EXECUTE'),
 'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'))
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=p_oid
$function$;

CREATE FUNCTION hotels_lineage_private.successor_binding_pin(b jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$
 SELECT jsonb_build_object(
 'before_source',b->'before_source','before_definition',b->'before_definition',
 'after_source',b->'after_source','after_definition',b->'after_definition',
 'before_metadata',b->'before_metadata','after_metadata',b->'after_metadata')
$function$;

CREATE FUNCTION hotels_lineage_private.successors_are_exact(p_root_hash text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$
DECLARE r hotels_lineage_private.successor_receipts%rowtype; previous text:=p_root_hash;
 expected_stage integer:=114450; pins jsonb; linked boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid='hotels_lineage_private.successor_receipts'::regclass
   AND c.relowner='postgres'::regrole AND c.relkind='r' AND c.relpersistence='p'
   AND c.relrowsecurity AND NOT c.relforcerowsecurity)
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='hotels_lineage_private.successor_receipts'::regclass)
  OR EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
   WHERE c.oid='hotels_lineage_private.successor_receipts'::regclass AND a.grantee<>c.relowner)
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) x(privilege)
   WHERE has_table_privilege(0::oid,'hotels_lineage_private.successor_receipts',x.privilege)
    OR has_table_privilege('anon','hotels_lineage_private.successor_receipts',x.privilege)
    OR has_table_privilege('authenticated','hotels_lineage_private.successor_receipts',x.privilege)
    OR has_table_privilege('service_role','hotels_lineage_private.successor_receipts',x.privilege))
  OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='hotels_lineage_private.successor_receipts'::regclass AND NOT tgisinternal)<>2
  OR EXISTS(SELECT 1 FROM (VALUES('successor_immutable',27),('successor_no_truncate',34)) e(name,type)
   LEFT JOIN pg_trigger t ON t.tgrelid='hotels_lineage_private.successor_receipts'::regclass AND t.tgname=e.name
   WHERE t.oid IS NULL OR t.tgtype<>e.type OR t.tgenabled<>'O'
    OR t.tgfoid<>'public.hotel_v2_h3_2b_immutable_row()'::regprocedure)
 THEN RETURN false; END IF;
 FOR r IN SELECT * FROM hotels_lineage_private.successor_receipts ORDER BY stage LOOP
  SELECT jsonb_object_agg(k,hotels_lineage_private.successor_binding_pin(v)) INTO pins
   FROM jsonb_each(r.bindings) x(k,v);
  IF r.stage<>expected_stage OR r.previous_hash IS DISTINCT FROM previous
   OR pins IS NULL OR hotels_lineage_private.successor_manifest(r.stage) IS NULL
   OR r.bindings IS DISTINCT FROM pins
   OR pins IS DISTINCT FROM hotels_lineage_private.successor_manifest(r.stage)
   OR r.receipt_hash IS DISTINCT FROM public.hotel_v2_h3_2b_hash(
    jsonb_build_object('stage',r.stage,'previous_hash',r.previous_hash,'bindings',r.bindings))
  THEN RETURN false; END IF;
  IF r.stage=114450 THEN
   IF to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') IS NULL
   THEN RETURN false; END IF;
   EXECUTE $linked_provider$
    SELECT count(*)=1 AND bool_and(id=1 AND contract_version='hotels_v2_external_calendar_provider_evolution_v1'
     AND prior_reviewed_pricing_catalog_fingerprint=(SELECT evidence->>'catalog_after'
       FROM hotels_lineage_private.reconciliation_receipts WHERE id=1)
     AND NOT EXISTS(SELECT 1 FROM jsonb_each($1) x(signature,pin)
       WHERE prior_function_source_hashes->>signature IS DISTINCT FROM pin->>'before_source'
        OR prior_function_fingerprints->>signature IS DISTINCT FROM pin->>'before_definition'))
    FROM hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
   $linked_provider$ INTO linked USING pins;
   IF hotels_lineage_private.predecessor_source_hash(to_regprocedure(
       'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()')) IS DISTINCT FROM
       'd5715bd29b456053bb32b0cf26793553617e8082443762091b7643943d5282db'
    OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(
       'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()')
      AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='s'
      AND p.prokind='f' AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset AND p.proparallel='u'
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
      AND p.proconfig=ARRAY['search_path=pg_catalog, public']
      AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner)
      AND NOT has_function_privilege(0::oid,p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
      AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('service_role',p.oid,'EXECUTE'))
   THEN RETURN false; END IF;
  ELSE
   IF to_regclass('hotels_lifecycle_private.foundation') IS NULL
     OR to_regclass('hotels_lifecycle_private.bindings') IS NULL THEN RETURN false; END IF;
   EXECUTE $linked_lifecycle$
    SELECT (SELECT count(*)=1 AND bool_and(id=1) FROM hotels_lifecycle_private.foundation)
     AND (SELECT count(*) FROM hotels_lifecycle_private.bindings)=(SELECT count(*) FROM jsonb_object_keys($1))
     AND NOT EXISTS(SELECT 1 FROM jsonb_each($1) x(signature,pin)
      LEFT JOIN hotels_lifecycle_private.bindings b ON b.signature=x.signature
      WHERE b.signature IS NULL OR b.before_hash IS DISTINCT FROM pin->>'before_source'
       OR b.after_hash IS DISTINCT FROM pin->>'after_source'
       OR encode(extensions.digest(convert_to(b.before_source,'UTF8'),'sha256'),'hex') IS DISTINCT FROM pin->>'before_source'
       OR public.hotel_v2_h3_2b_hash(to_jsonb(b.before_definition)) IS DISTINCT FROM pin->>'before_definition')
   $linked_lifecycle$ INTO linked USING pins;
   IF linked IS NOT TRUE THEN RETURN false; END IF;
   -- Pin the entire low-level call closure before invoking its raw projector.
   -- None of these three functions calls scoped lineage or a composite.
   IF EXISTS(SELECT 1 FROM (VALUES
    ('hotels_lifecycle_private.hash(jsonb)','0efcedbc625bdd5c0e6dc3f27a59e846460fe328880fd562d3f0de352c913b5a','i',false,true),
    ('hotels_lifecycle_private.metadata(oid)','2b49509d355fc1078aafed91f4f9307c3d55413169d7e514cab68f9e1faf760d','s',true,true),
    ('hotels_lifecycle_private.catalog_snapshot()','ef46235b2ad39502b4d4787b34b817e7dee986a5ea0bd526c76690cb2f6b2a71','s',true,false)
   ) e(signature,sha,volatility,definer,strict) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
   WHERE p.oid IS NULL OR p.proowner<>'postgres'::regrole OR p.prosecdef<>e.definer OR p.proisstrict<>e.strict
    OR p.prokind<>'f' OR p.proleakproof OR p.proretset OR p.proparallel<>'u'
    OR p.provolatile<>e.volatility::"char"
    OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='sql')
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']
    OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner)
    OR encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') IS DISTINCT FROM e.sha
    OR has_function_privilege(0::oid,p.oid,'EXECUTE')
    OR has_function_privilege('anon',p.oid,'EXECUTE')
    OR has_function_privilege('authenticated',p.oid,'EXECUTE')
    OR has_function_privilege('service_role',p.oid,'EXECUTE'))
   THEN RETURN false; END IF;
   EXECUTE 'SELECT catalog IS NOT DISTINCT FROM hotels_lifecycle_private.catalog_snapshot()
     FROM hotels_lifecycle_private.foundation WHERE id=1' INTO linked;
  END IF;
  IF linked IS NOT TRUE THEN RETURN false; END IF;
  previous:=r.receipt_hash; expected_stage:=114480;
 END LOOP;
 -- Validate every manifested current object, not just functions referenced by
 -- the baseline pricing catalog. This includes provider worker/runtime seams.
 IF EXISTS(SELECT 1 FROM (SELECT DISTINCT k FROM hotels_lineage_private.successor_receipts certificate,
    LATERAL jsonb_object_keys(certificate.bindings) x(k)) signatures
   WHERE hotels_lineage_private.predecessor(to_regprocedure(k)) IS NULL)
 THEN RETURN false; END IF;
 RETURN true;
END $function$;

CREATE FUNCTION hotels_lineage_private.predecessor(p_oid oid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$
DECLARE r record; b jsonb; pin jsonb; s text; d text; m jsonb; signature text;
BEGIN
 SELECT CASE WHEN n.nspname='public' THEN 'public.' ELSE '' END||p.oid::regprocedure::text,
  encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(p.oid))) INTO signature,s,d
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid=p_oid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 m:=hotels_lineage_private.successor_metadata(p_oid);
 FOR r IN SELECT * FROM hotels_lineage_private.successor_receipts ORDER BY stage DESC LOOP
  b:=r.bindings->signature;
  IF b IS NULL THEN CONTINUE; END IF;
  pin:=hotels_lineage_private.successor_manifest(r.stage)->signature;
  IF pin IS NULL OR pin IS DISTINCT FROM b
   OR s IS DISTINCT FROM b->>'after_source'
   OR d IS DISTINCT FROM b->>'after_definition'
   OR m IS DISTINCT FROM b->'after_metadata'
  THEN RETURN NULL; END IF;
  s:=b->>'before_source'; d:=b->>'before_definition'; m:=b->'before_metadata';
 END LOOP;
 RETURN jsonb_build_object('source',s,'definition',d,'metadata',m);
END $function$;

CREATE FUNCTION hotels_lineage_private.predecessor_definition_hash(p_oid oid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$ SELECT hotels_lineage_private.predecessor(p_oid)->>'definition' $function$;

CREATE FUNCTION hotels_lineage_private.predecessor_source_hash(p_oid oid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$ SELECT hotels_lineage_private.predecessor(p_oid)->>'source' $function$;

CREATE FUNCTION hotels_lineage_private.successor_boundary_is_exact(p_stage integer,p_after boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$
DECLARE signature text; pin jsonb; manifest jsonb; p pg_proc%rowtype;
BEGIN
 manifest:=hotels_lineage_private.successor_manifest(p_stage);
 IF manifest IS NULL OR manifest='{}'::jsonb THEN RETURN false; END IF;
 FOR signature,pin IN SELECT * FROM jsonb_each(manifest) LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(signature);
  IF encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') IS DISTINCT FROM
      pin->>(CASE WHEN p_after THEN 'after_source' ELSE 'before_source' END)
   OR public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(p.oid))) IS DISTINCT FROM
      pin->>(CASE WHEN p_after THEN 'after_definition' ELSE 'before_definition' END)
   OR hotels_lineage_private.successor_metadata(p.oid) IS DISTINCT FROM
     pin->(CASE WHEN p_after THEN 'after_metadata' ELSE 'before_metadata' END)
  THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN no_data_found OR too_many_rows THEN RETURN false;
END $function$;

-- Installation-only entry point; never reachable from scoped lineage. The
-- manifest is fixed source evidence, not supplied by a caller or inferred from
-- the live catalog. Any failed final anchor check rolls back the certificate.
CREATE FUNCTION hotels_lineage_private.seal_successor(p_stage integer)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$
DECLARE previous text; bindings jsonb;
BEGIN
 IF p_stage NOT IN(114450,114480) OR p_stage IS NULL
  OR (SELECT count(*) FROM hotels_lineage_private.successor_receipts)<>
    (CASE p_stage WHEN 114450 THEN 0 ELSE 1 END)
  OR EXISTS(SELECT 1 FROM hotels_lineage_private.successor_receipts WHERE stage>=p_stage)
  OR hotels_lineage_private.successor_boundary_is_exact(p_stage,true) IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114416_successor_after_boundary_mismatch:%',p_stage; END IF;
 IF p_stage=114450 THEN
  SELECT evidence_hash INTO STRICT previous FROM hotels_lineage_private.reconciliation_receipts WHERE id=1;
 ELSE
  SELECT receipt_hash INTO STRICT previous FROM hotels_lineage_private.successor_receipts WHERE stage=114450;
 END IF;
 bindings:=hotels_lineage_private.successor_manifest(p_stage);
 INSERT INTO hotels_lineage_private.successor_receipts VALUES(p_stage,previous,bindings,
  public.hotel_v2_h3_2b_hash(jsonb_build_object('stage',p_stage,'previous_hash',previous,'bindings',bindings)));
 IF hotels_lineage_private.current_anchor_is_exact() IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114416_successor_unapproved_catalog_difference:%',p_stage; END IF;
END $function$;

-- Preserve the exact 114415 relation/column/constraint/policy/trigger universe.
-- Only function-definition reads use the independently pinned predecessor
-- projection. This private projector never invokes a public composite.
DO $catalog_projector$
DECLARE src text;
BEGIN
 SELECT prosrc INTO STRICT src FROM pg_proc WHERE oid=
  'public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()'::regprocedure;
 IF encode(extensions.digest(convert_to(src,'UTF8'),'sha256'),'hex') IS DISTINCT FROM
   '9e9cc99a27d6397d4ec769df213b5a0344c5f0a7dcaf828a5b07683c09b7f932'
  OR (length(src)-length(replace(src,'public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(procedure_row.oid)))','')))/
      length('public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(procedure_row.oid)))')<>1
 THEN RAISE EXCEPTION 'hotels_114416_catalog_projector_source_mismatch'; END IF;
 src:=replace(src,'public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(procedure_row.oid)))',
  'hotels_lineage_private.predecessor_definition_hash(procedure_row.oid)');
 EXECUTE format('CREATE FUNCTION hotels_lineage_private.catalog_fingerprint() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS %L',src);
END $catalog_projector$;

-- Private evidence projector. NULL means any missing, ambiguous, unaudited or
-- semantically different transition. No role identity is inferred from a client.
CREATE FUNCTION hotels_lineage_private.permission_evidence()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $function$
DECLARE o public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
 p public.hotel_partner_hotel_permissions%rowtype;
 a public.hotel_activity_log%rowtype;
 r public.hotel_partner_action_receipts%rowtype;
 e public.hotel_partner_event_outbox%rowtype;
 live jsonb; previous jsonb; next_state jsonb;
BEGIN
 SELECT * INTO STRICT o FROM public.hotel_admin_availability_foundation_evolution_receipts WHERE id=1;
 SELECT * INTO STRICT p FROM public.hotel_partner_hotel_permissions WHERE hotel_id=o.hotel_id;
 IF o.hotel_id<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
   OR o.permission_version<>1 OR p.version<>2 OR p.partner_id<>o.partner_id
   OR p.assignment_id<>o.assignment_id OR NOT p.has_mutation_capability
   OR NOT EXISTS(SELECT 1 FROM public.partner_resources x JOIN public.hotels h
     ON h.id=x.resource_id AND h.owner_partner_id=x.partner_id
     WHERE x.id=o.assignment_id AND x.partner_id=o.partner_id
       AND x.resource_type='hotels' AND h.id=o.hotel_id)
   OR (SELECT encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)'))
       IS DISTINCT FROM 'aed6f0c7ae4d3590aa8b997d5d661790e42851e5ab1cf07d91e282117c532bc8'
 THEN RETURN NULL; END IF;
 live:=public.hotel_v2_h3_2a_permissions_snapshot(o.assignment_id);
 SELECT * INTO STRICT a FROM public.hotel_activity_log x
 WHERE x.hotel_id=o.hotel_id AND x.created_at>=o.created_at
   AND (x.before_state->>'assignment_id'=o.assignment_id::text
     OR x.after_state->>'assignment_id'=o.assignment_id::text)
   AND (x.before_state ? 'partner_permissions' OR x.after_state ? 'partner_permissions');
 previous:=a.before_state->'partner_permissions'; next_state:=a.after_state->'partner_permissions';
 IF a.source IS DISTINCT FROM 'hotels_v2_h3_2a_partner_permissions'
   OR a.entity_type IS DISTINCT FROM 'property' OR a.entity_id IS DISTINCT FROM o.hotel_id
   OR a.action IS DISTINCT FROM 'update' OR a.actor_type IS DISTINCT FROM 'admin'
   OR a.actor_id IS NULL OR a.actor_id IS DISTINCT FROM p.updated_by
   OR a.before_state->>'partner_id' IS DISTINCT FROM o.partner_id::text
   OR a.after_state->>'partner_id' IS DISTINCT FROM o.partner_id::text
   OR a.before_state->>'assignment_id' IS DISTINCT FROM o.assignment_id::text
   OR a.after_state->>'assignment_id' IS DISTINCT FROM o.assignment_id::text
   OR previous IS DISTINCT FROM o.after_permission
   OR previous->'version' IS DISTINCT FROM '1'::jsonb
   OR next_state->'version' IS DISTINCT FROM '2'::jsonb
   OR next_state-'updated_at' IS DISTINCT FROM live-'updated_at'
   OR NOT pg_input_is_valid(next_state->>'updated_at','timestamp with time zone')
   OR (next_state->>'updated_at')::timestamptz IS DISTINCT FROM p.updated_at
   OR previous#>'{capabilities,initiate_stripe_onboarding}' IS DISTINCT FROM 'false'::jsonb
   OR previous#>'{capabilities,request_booking_changes}' IS DISTINCT FROM 'false'::jsonb
   OR next_state->'capabilities' IS DISTINCT FROM
     (previous->'capabilities'||'{"initiate_stripe_onboarding":true,"request_booking_changes":true}'::jsonb)
 THEN RETURN NULL; END IF;
 SELECT * INTO STRICT r FROM public.hotel_partner_action_receipts x
 WHERE x.correlation_id=a.correlation_id AND x.action='apply_partner_hotel_permissions';
 IF r.hotel_id IS DISTINCT FROM o.hotel_id OR r.partner_id IS DISTINCT FROM o.partner_id
   OR r.actor_user_id IS DISTINCT FROM a.actor_id OR r.created_at<a.created_at
   OR r.request_hash!~'^[0-9a-f]{64}$'
   OR r.result IS DISTINCT FROM jsonb_build_object('ok',true,
     'contract_version','hotels_v2_h3_2a_partner_permissions_v1',
     'decision','apply_partner_hotel_permissions','hotel_id',o.hotel_id,
     'assignment_id',o.assignment_id,'partner_id',o.partner_id,'changed',true,
     'permission',next_state,'correlation_id',r.correlation_id,'idempotency_key',r.idempotency_key)
 THEN RETURN NULL; END IF;
 SELECT * INTO STRICT e FROM public.hotel_partner_event_outbox x
 WHERE x.dedupe_key='h3_2a:permission:'||r.id::text;
 IF e.hotel_id IS DISTINCT FROM o.hotel_id OR e.partner_id IS DISTINCT FROM o.partner_id
   OR e.aggregate_type IS DISTINCT FROM 'hotel_partner_permissions'
   OR e.aggregate_id IS DISTINCT FROM o.assignment_id
   OR e.event_type IS DISTINCT FROM 'hotel.partner_permissions.updated'
   OR e.payload IS DISTINCT FROM jsonb_build_object('hotel_id',o.hotel_id,
     'assignment_id',o.assignment_id,'partner_id',o.partner_id,'permission_version',2,
     'has_mutation_capability',true,'correlation_id',a.correlation_id)
 THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('hotel_id',o.hotel_id,'partner_id',o.partner_id,
   'assignment_id',o.assignment_id,'historical_permission',previous,
   'current_permission',next_state,'activity',jsonb_set(to_jsonb(a),'{created_at}',
     to_jsonb((extract(epoch from a.created_at)*1000000)::bigint)),
   'action_receipt',jsonb_set(to_jsonb(r),'{created_at}',
     to_jsonb((extract(epoch from r.created_at)*1000000)::bigint)),
   'outbox_identity',jsonb_build_object(
     'id',e.id,'dedupe_key',e.dedupe_key,'aggregate_type',e.aggregate_type,
     'aggregate_id',e.aggregate_id,'event_type',e.event_type,'payload',e.payload));
EXCEPTION WHEN no_data_found OR too_many_rows OR invalid_text_representation
 OR invalid_datetime_format THEN RETURN NULL;
END $function$;

CREATE FUNCTION hotels_lineage_private.function_map()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $function$
 SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(
   'source',hotels_lineage_private.predecessor_source_hash(p.oid),
   'definition',hotels_lineage_private.predecessor_definition_hash(p.oid),
   'owner',p.proowner::regrole::text,'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),
   'definer',p.prosecdef,'volatility',p.provolatile,'configuration',p.proconfig,
   'acl',p.proacl,'leakproof',p.proleakproof,'parallel',p.proparallel,
   'kind',p.prokind,'strict',p.proisstrict,
   'public_execute',has_function_privilege(0::oid,p.oid,'EXECUTE'),
   'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='hotels_lineage_private' OR p.oid IN (
   'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure,
   'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()'::regprocedure,
   'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure);
$function$;

CREATE FUNCTION hotels_lineage_private.current_anchor_is_exact()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $function$
DECLARE r hotels_lineage_private.reconciliation_receipts%rowtype;
BEGIN
 SELECT * INTO STRICT r FROM hotels_lineage_private.reconciliation_receipts;
 IF r.id<>1 OR r.contract_version<>'hotels_7a_lineage_reconciliation_v1'
   OR r.evidence_hash IS DISTINCT FROM public.hotel_v2_h3_2b_hash(r.evidence)
   OR hotels_lineage_private.successors_are_exact(r.evidence_hash) IS NOT TRUE
   OR r.evidence->'permission' IS DISTINCT FROM hotels_lineage_private.permission_evidence()
   OR r.evidence->'permission' IS NULL
   OR r.evidence->'functions_after' IS DISTINCT FROM hotels_lineage_private.function_map()
   OR r.evidence->>'catalog_after' IS DISTINCT FROM
     hotels_lineage_private.catalog_fingerprint()
   OR r.evidence->>'historical_owner_hash' IS DISTINCT FROM
     (SELECT public.hotel_v2_h3_2b_hash(to_jsonb(x)-'created_at')
      FROM public.hotel_admin_availability_foundation_evolution_receipts x WHERE id=1)
   OR r.evidence->>'historical_phase1_hash' IS DISTINCT FROM
     (SELECT public.hotel_v2_h3_2b_hash(to_jsonb(x)-'created_at')
      FROM public.hotel_seven_arches_independent_pricing_evolution_receipts x WHERE id=1)
   OR r.evidence->>'historical_reviewed_hash' IS DISTINCT FROM
     (SELECT public.hotel_v2_h3_2b_hash(to_jsonb(x)-'created_at')
      FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts x WHERE id=1)
   OR NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=
     'hotels_lineage_private.reconciliation_receipts'::regclass
     AND c.relowner='postgres'::regrole AND c.relrowsecurity AND NOT c.relforcerowsecurity
     AND c.relkind='r' AND c.relpersistence='p')
   OR EXISTS(SELECT 1 FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
     WHERE n.nspname='hotels_lineage_private' AND (n.nspowner<>'postgres'::regrole OR a.grantee<>n.nspowner))
   OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='hotels_lineage_private.reconciliation_receipts'::regclass AND NOT tgisinternal)<>2
   OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='hotels_lineage_private.reconciliation_receipts'::regclass
     AND tgname='reconciliation_immutable' AND tgtype=27 AND tgenabled='O'
     AND tgfoid='public.hotel_v2_h3_2b_immutable_row()'::regprocedure)
   OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='hotels_lineage_private.reconciliation_receipts'::regclass
     AND tgname='reconciliation_no_truncate' AND tgtype=34 AND tgenabled='O'
     AND tgfoid='public.hotel_v2_h3_2b_immutable_row()'::regprocedure)
   OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='hotels_lineage_private.reconciliation_receipts'::regclass)
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) x(privilege)
     WHERE has_table_privilege(0::oid,'hotels_lineage_private.reconciliation_receipts',x.privilege)
       OR has_table_privilege('anon','hotels_lineage_private.reconciliation_receipts',x.privilege)
       OR has_table_privilege('authenticated','hotels_lineage_private.reconciliation_receipts',x.privilege)
       OR has_table_privilege('service_role','hotels_lineage_private.reconciliation_receipts',x.privilege))
   OR EXISTS(SELECT 1 FROM pg_class c, LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
     WHERE c.oid='hotels_lineage_private.reconciliation_receipts'::regclass AND a.grantee<>c.relowner)
 THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN no_data_found OR too_many_rows THEN RETURN false;
END $function$;

CREATE FUNCTION hotels_lineage_private.lineage_matches_historical(live jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $function$
DECLARE historical jsonb; candidate jsonb:=live; i integer; j integer; a jsonb; b jsonb;
 c_signature constant text:='public.hotel_v2_seven_arches_pricing_scoped_lineage()';
BEGIN
 IF hotels_lineage_private.current_anchor_is_exact() IS NOT TRUE THEN RETURN false; END IF;
 SELECT historical_activation_lineage INTO STRICT historical
 FROM public.hotel_seven_arches_independent_pricing_evolution_receipts WHERE id=1;
 IF hotels_lineage_private.catalog_is_exact(live->'lower_catalog',historical->'lower_catalog') IS NOT TRUE
 THEN RETURN false; END IF;
 SELECT (n-1)::integer,v INTO STRICT i,a FROM jsonb_array_elements(live->'lower_function_security')
 WITH ORDINALITY x(v,n) WHERE v->>'signature'=c_signature;
 SELECT (n-1)::integer,v INTO STRICT j,b FROM jsonb_array_elements(historical->'lower_function_security')
 WITH ORDINALITY x(v,n) WHERE v->>'signature'=c_signature;
 IF i<>j OR a-'source_hash' IS DISTINCT FROM b-'source_hash'
   OR a->>'source_hash' IS DISTINCT FROM (hotels_lineage_private.function_map()#>>ARRAY[
       'hotel_v2_seven_arches_pricing_scoped_lineage()','source'])
   OR b->>'source_hash'<>'5d8e31185a165c555c2fcfcce2802fe569bb7cc201ddfb7ac91978acfa2e3141'
 THEN RAISE NOTICE 'RECONCILIATION_LINEAGE:SCOPED_SOURCE_METADATA'; RETURN false; END IF;
 -- Compare to the immutable predecessor only after independently proving the
 -- exact allowed difference. This is a comparison projection, not a write or
 -- a claim that the old historical state is still the current state.
 candidate:=jsonb_set(candidate,'{lower_catalog}',historical->'lower_catalog',false);
 candidate:=jsonb_set(candidate,ARRAY['lower_function_security',i::text],b,false);
 candidate:=jsonb_set(candidate,'{scoped_hotels_lineage_source_hash}',historical->'scoped_hotels_lineage_source_hash',false);
 candidate:=jsonb_set(candidate,'{lower_function_sources,scoped_hotels_lineage}',
   historical#>'{lower_function_sources,scoped_hotels_lineage}',false);
 IF candidate IS DISTINCT FROM historical THEN
   RAISE NOTICE 'RECONCILIATION_LINEAGE:UNAPPROVED_KEYS:%',
     (SELECT array_agg(k) FROM jsonb_object_keys(candidate||historical) k
       WHERE candidate->k IS DISTINCT FROM historical->k);
 END IF;
 RETURN candidate=historical;
EXCEPTION WHEN no_data_found OR too_many_rows THEN RETURN false;
END $function$;

-- Lexical canonicalizer ONLY for the named owner membership constraint.
-- String/quoted-identifier contents are never rewritten. Array/catalog order
-- and every field outside expression/definition remain byte/JSON exact.
CREATE FUNCTION hotels_lineage_private.owner_constraint_tokens(input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog
AS $function$
DECLARE t text; coverage text:=''; normalized text:='';
BEGIN
 FOR t IN SELECT m[1] FROM regexp_matches(input,
   $lex$'(?:[^']|'')*'|"(?:[^"]|"")*"|[[:space:]]+|[^[:space:]'"]+$lex$,'g') m
 LOOP
   coverage:=coverage||t;
   IF t~'^[[:space:]]+$' THEN CONTINUE; END IF;
   IF left(t,1) NOT IN ('''','"') THEN
     t:=replace(replace(t,'pg_catalog.',''),'extensions.digest','digest');
   END IF;
   normalized:=normalized||t;
 END LOOP;
 IF coverage IS DISTINCT FROM input THEN RETURN NULL; END IF;
 RETURN normalized;
END $function$;

CREATE FUNCTION hotels_lineage_private.catalog_is_exact(current_jsonb jsonb,historical_jsonb jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $function$
DECLARE ci integer; hi integer; cj integer; hj integer; c jsonb; h jsonb;
 rel jsonb; child jsonb; canonical text; dep oid;
BEGIN
 IF jsonb_typeof(current_jsonb) IS DISTINCT FROM 'array'
   OR jsonb_typeof(historical_jsonb) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 SELECT (i-1)::integer INTO STRICT ci FROM jsonb_array_elements(current_jsonb)
 WITH ORDINALITY x(v,i) WHERE v->>'relation'='availability_foundation_evolution_receipts';
 SELECT (i-1)::integer INTO STRICT hi FROM jsonb_array_elements(historical_jsonb)
 WITH ORDINALITY x(v,i) WHERE v->>'relation'='availability_foundation_evolution_receipts';
 SELECT (i-1)::integer,v INTO STRICT cj,c FROM jsonb_array_elements(current_jsonb->ci->'constraints')
 WITH ORDINALITY x(v,i) WHERE v->>'name'='hotel_admin_availability_evolution_owner_membership_exact';
 SELECT (i-1)::integer,v INTO STRICT hj,h FROM jsonb_array_elements(historical_jsonb->hi->'constraints')
 WITH ORDINALITY x(v,i) WHERE v->>'name'='hotel_admin_availability_evolution_owner_membership_exact';
 IF ci<>hi OR cj<>hj OR c-'expression'-'definition' IS DISTINCT FROM h-'expression'-'definition'
   OR c->'validated' IS DISTINCT FROM 'true'::jsonb OR c->>'type' IS DISTINCT FROM 'c'
 THEN RETURN false; END IF;
 FOREACH canonical IN ARRAY ARRAY['expression','definition'] LOOP
   IF hotels_lineage_private.owner_constraint_tokens(c->>canonical) IS NULL
     OR hotels_lineage_private.owner_constraint_tokens(c->>canonical) IS DISTINCT FROM
       hotels_lineage_private.owner_constraint_tokens(h->>canonical) THEN RETURN false; END IF;
 END LOOP;
 canonical:=regexp_replace(hotels_lineage_private.owner_constraint_tokens(c->>'expression'),
   $cast$('(?:[^']|'')*')::(?:text|name)$cast$,$replacement$\1$replacement$,'g');
 IF canonical !~ $pattern$^\(*owner_membership_fingerprint=encode\(digest\(convert_to\(\(*jsonb_build_object\('contract_version','hotels_v2_seven_arches_owner_membership_v1','hotel_id',hotel_id,'partner_id',partner_id,'assignment_id',assignment_id,'role','owner','owner_user_ids',to_jsonb\(owner_user_ids\)\)\)*::text,'UTF8'\),'sha256'\),'hex'\)\)*$$pattern$
 THEN RETURN false; END IF;
 SELECT oid INTO STRICT dep FROM pg_constraint WHERE conrelid=
   'public.hotel_admin_availability_foundation_evolution_receipts'::regclass
   AND conname='hotel_admin_availability_evolution_owner_membership_exact' AND convalidated AND contype='c';
 IF NOT EXISTS(SELECT 1 FROM pg_depend WHERE classid='pg_constraint'::regclass
     AND objid=dep AND refclassid='pg_proc'::regclass
     AND refobjid='extensions.digest(bytea,text)'::regprocedure)
   OR EXISTS(SELECT 1 FROM pg_depend d JOIN pg_proc p ON p.oid=d.refobjid
     JOIN pg_namespace n ON n.oid=p.pronamespace WHERE d.classid='pg_constraint'::regclass
       AND d.objid=dep AND d.refclassid='pg_proc'::regclass AND n.nspname<>'pg_catalog'
       AND p.oid<>'extensions.digest(bytea,text)'::regprocedure)
 THEN RETURN false; END IF;
 RETURN jsonb_set(current_jsonb,ARRAY[ci::text,'constraints',cj::text],h,false)=historical_jsonb;
EXCEPTION WHEN no_data_found OR too_many_rows THEN RETURN false;
END $function$;

-- Preserve all other function text, metadata and ACLs. Every replacement is
-- guarded by the exact accepted prosrc and by a one-occurrence assertion.
DO $evolve$
DECLARE spec record; src text; old_text text; new_text text; fn record;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
  ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',
   'or v_permission is distinct from v_owner.after_permission',
   'or hotels_lineage_private.current_anchor_is_exact() is not true'),
  ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',
   'and permission.assignment_id=v_owner.assignment_id and permission.version=1',
   'and permission.assignment_id=v_owner.assignment_id and permission.version=2'),
  ('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
   E'(select receipt.scoped_lineage_source_hash\n         from public.hotel_seven_arches_task2_stage2_compatibility_receipts receipt\n         where receipt.id=1)',
   E'(select evidence#>>''{functions_after,hotel_v2_seven_arches_pricing_scoped_lineage(),definition}''\n         from hotels_lineage_private.reconciliation_receipts where id=1)'),
  ('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
   E'or v_foundation.topology_source_after_hash is distinct from\n       public.hotel_v2_h3_2b_hash',
   E'or (select evidence#>>''{functions_after,hotel_v2_seven_arches_independent_pricing_topology_is_exact(),definition}''\n         from hotels_lineage_private.reconciliation_receipts where id=1) is distinct from\n       public.hotel_v2_h3_2b_hash'),
  ('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
   E'or v_foundation.catalog_fingerprint is distinct from\n       public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()',
   E'or hotels_lineage_private.current_anchor_is_exact() is not true'),
  ('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
   E'public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(\n         ''public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()''::regprocedure)))',
   E'hotels_lineage_private.predecessor_definition_hash(\n         ''public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()''::regprocedure)'),
  ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
   E'if public.hotel_v2_h3_2b_hash(v_lineage_normalized)\n       is distinct from v_phase1.historical_activation_lineage_fingerprint',
   E'if hotels_lineage_private.lineage_matches_historical(v_lineage_normalized) is not true')
 ) x(signature,needle,replacement)
 LOOP
  SELECT pg_get_functiondef(to_regprocedure(spec.signature)) INTO src;
  IF (length(src)-length(replace(src,spec.needle,'')))/length(spec.needle)<>1
  THEN RAISE EXCEPTION 'hotels_114416_replacement_cardinality:%',spec.signature; END IF;
  EXECUTE replace(src,spec.needle,spec.replacement);
 END LOOP;
 FOR fn IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='hotels_lineage_private'
 LOOP
   EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',fn.signature);
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',fn.signature);
 END LOOP;
END $evolve$;

DO $seal$
DECLARE evidence jsonb; permission jsonb;
BEGIN
 permission:=hotels_lineage_private.permission_evidence();
 IF permission IS NULL THEN RAISE EXCEPTION 'hotels_114416_permission_provenance_invalid'; END IF;
 evidence:=jsonb_build_object('permission',permission,
   'functions_after',hotels_lineage_private.function_map(),
   'catalog_after',public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint(),
   'historical_owner_hash',(SELECT public.hotel_v2_h3_2b_hash(to_jsonb(x)-'created_at')
      FROM public.hotel_admin_availability_foundation_evolution_receipts x WHERE id=1),
   'historical_phase1_hash',(SELECT public.hotel_v2_h3_2b_hash(to_jsonb(x)-'created_at')
      FROM public.hotel_seven_arches_independent_pricing_evolution_receipts x WHERE id=1),
   'historical_reviewed_hash',(SELECT public.hotel_v2_h3_2b_hash(to_jsonb(x)-'created_at')
      FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts x WHERE id=1));
 INSERT INTO hotels_lineage_private.reconciliation_receipts(id,contract_version,evidence,evidence_hash)
 VALUES(1,'hotels_7a_lineage_reconciliation_v1',evidence,public.hotel_v2_h3_2b_hash(evidence));
 IF hotels_lineage_private.current_anchor_is_exact() IS NOT TRUE
   OR public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NULL
   OR public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS NOT TRUE
   OR public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS NOT TRUE
   OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 THEN RAISE EXCEPTION USING MESSAGE='hotels_114416_postconditions_failed',
   DETAIL=jsonb_build_object('anchor',hotels_lineage_private.current_anchor_is_exact(),
     'scoped',public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NOT NULL,
     'chain',public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
     'topology',public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
     'catalog',hotels_lineage_private.catalog_is_exact(
       public.hotel_v2_seven_arches_independent_pricing_activation_lineage()->'lower_catalog',
       (SELECT historical_activation_lineage->'lower_catalog' FROM public.hotel_seven_arches_independent_pricing_evolution_receipts WHERE id=1)))::text;
 END IF;
END $seal$;
COMMIT;
