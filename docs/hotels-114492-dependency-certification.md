# 114492 Partner Workspace dependency certification — local candidate, NOT installed

Baseline: 4bf421807ad5f6bad5bc68e9d8803222ed2738aa. Catalog evidence collected 2026-09-22 from project daoohnbnnowmmcizgvrq using READ ONLY / REPEATABLE READ / ROLLBACK.

## Status and stop boundary

The real historical entrypoint's 48-function conservative closure is captured; adding the directly reused 114490 read paths yields 70 functions. All 70 returned raw sources were independently SHA-256 verified against the server. All 48 historical functions have matching source and definition hashes in the installed 114489 foundation certificate. No historical function was edited.

The subsequent recovered certificate closure completed the three certificate helpers' transitive graph: 116 executable dependencies, each with exact source/definition hashes, owner, security, sorted ACL and configuration. The authoritative machine-readable evidence is `tests/integration/fixtures/hotels-v2-114492-certificate-closure.json`. The 228-name conservative scan included names inside historical source literals; SQL-aware lexical inspection separated these from executable calls. Eight literal dynamic SELECT fragments (five plus three) are explicitly recorded. Catalog/deparse helpers' function-local search-path settings do not mutate business state. Static tests require every dependency edge to terminate within the 116-pin set and require identical pre/post pin sets. This completes dependency evidence; it does not replace rollback certification.

Exact recovered candidate SHA-256: `c7f1779bd859d54c3dca85918ba5d11fae5ba1787cb0fb86654fa810bcc4f171`. Recovered from Codex FileChange events, including their exact patch chain; not reconstructed to approximate the hash. Static tests PASS does not substitute for production rollback certification. Permanent installation, history repair, commit, push and deployment were not performed.

## Real root and successor bindings

`public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)`
→ access_snapshot → flags_off → predecessor_flag_exact → safe_state → chain_state
→ `hotels_lifecycle_catalog_drift`. The exact flags_off read-only production probe confirmed this exception chain. The historical access snapshot also requires Hotel architecture legacy.

| Area | Historical path | Candidate path / invariant |
|---|---|---|
| Membership | h3_2a_require_partner_membership | Unchanged active Partner membership, owner/staff and explicit staff Hotel scope |
| Access | h3_2a_require_partner_hotel_access + h3_2b_access_snapshot | Private exact-target successors; preserve twelve capability branches and permission version |
| Lifecycle | flags_off / predecessor_flag_exact / safe_state / chain_state | Installed safe_state_114490; flags rooms/external/stripe true, instant false; global legacy and public booking false |
| Permissions | h3_2a_permissions_snapshot | Unchanged; token still hashes exact assignment/role/version/mutation-capability/capabilities |
| Pricing | admin_c_pricing_control_snapshot | Internal snapshot_114490 under definer only after Partner access and manage_prices; no public Admin authorized RPC, no new Admin grants |
| Availability | admin_d_snapshot + snapshot_external_base | Internal _114490 read projection with require_admin=false, only after manage_availability |
| Stripe | lifecycle_private.partner_connection | Private copy with only access/lifecycle binding changed; owner authorization, actual account and readiness TTL retained |
| Commission | h3_2b_commission_policy | Unchanged gated policy; missing policy fails closed |
| Content/property/rooms/units/drafts/activity | Inline historical projection | Identical field allowlist, target joins, ordering and limits |
| Architecture | legacy-only access guard | Exact published rooms_v2 target, request_confirmation, immutable conversion receipt; no other Hotel accepted |

The nonexistent workspace_114489, workspace_read and architecture_evidence functions are neither reconstructed nor assumed. Architecture evidence is projected inline from the real Hotel and certified receipt. Public change remains false. No business writer is called; there is no raw-table browser fallback. The local client now routes only the exact target Hotel to 114492, requires its exact DTO, and fails closed without legacy retry if unavailable. Other Hotels retain historical routing. Both Partner entrypoints and the service-worker cache version are updated locally; no release or deployment is authorized.

## Closure method / caveats

Schema-qualified source calls plus pg_depend edges form a conservative graph; overloaded functions can both appear. The 70 sources were inspected for dynamic execution and unqualified application calls: none execute dynamic application SQL; unqualified callable names are builtins/SQL syntax. Admin-only helpers are conservative conditional dependencies, unreachable because the Partner call uses require_admin=false. The two historical r5k catalog views project catalog rows/literal historical metadata; function names inside stored source literals are not executed dependencies. Catalog introspection is distinct from function execution.

UNCHANGED_READ_DEPENDENCY below means reusable only in the existing scoped/guarded call context, not a new public grant. REPLACE_STALE_PATH means bypass via additive successor, never edit the frozen function. UNREACHABLE_WITH_REQUIRE_ADMIN_FALSE is not a Partner API. The installed foundation remains authoritative.

## Current production function identities

| Signature | Current production prosrc SHA-256 | Frozen/protection | Post-conversion use |
|---|---|---|---|
| `auth.uid()` | `9ab5ea099e74ec09e83b1505c51a3647791195aed7c742dcc3f257dfc7d2f300` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `extensions.digest(bytea, text)` | `dab440e06d2ec1df36f3287fec02eac12a47a62063938e1aac6648560f8a6f3e` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `extensions.digest(text, text)` | `dab440e06d2ec1df36f3287fec02eac12a47a62063938e1aac6648560f8a6f3e` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotel_stripe_connect_private.authorization_receipt_hash(jsonb)` | `64aef185af0ffbecf4fdf378b36414d6e2f7da32dd70cb25c4ae0a2f8ea9c052` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotel_stripe_connect_private.authorization_state(uuid)` | `23d55b3b97ee8893d2b464d9ea688af47827dbd9dd6570cea585346291e96fcb` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotels_guest_policy_private.original_source(oid)` | `e9989350cadedab22bb961f825314885210bee91f55a0178762c656761a09545` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotels_guest_policy_private.raw_metadata(oid)` | `65e9d9a19c19f1e8281861752f6f7be2dcba7720fda4810a435a750ad14531b0` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotels_lifecycle_private.actual_flags()` | `ecd751821530611bfe8b925fa5bb73c408def4823acc1d794b70d6e5bb89fb59` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotels_lifecycle_private.catalog_snapshot()` | `a9daaad29c3561c8191707fcef258d3fb734705058c4b15ec857ef2e554f5aa7` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `hotels_lifecycle_private.chain_state()` | `a9bafdb21a9cce7007e14a25686a1c17606eaf2586b9778368aa9be25eba4c24` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `hotels_lifecycle_private.hash(jsonb)` | `0efcedbc625bdd5c0e6dc3f27a59e846460fe328880fd562d3f0de352c913b5a` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotels_lifecycle_private.metadata(oid)` | `2b49509d355fc1078aafed91f4f9307c3d55413169d7e514cab68f9e1faf760d` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotels_lifecycle_private.partner_connection(uuid, uuid)` | `f46e6a3fb6e534739c91a61abeec102c32b67500b7d597d954ea01e57a3dedbc` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `hotels_lifecycle_private.predecessor_flag_exact(text, boolean)` | `9b1a2be02f556e7797922aceeb61211355dd576501598206b93bf0796612f11e` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `hotels_lifecycle_private.safe_state()` | `780d8fd7853a49d3cab639d8590a786fe88302b6f254c44b9d68b85932a0da7e` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `hotels_post_114489_private.predecessor_flag_exact_114490(text, boolean)` | `01ed5f17f625016ff3e1b684a71c938eed07272d12888105737751263c922b1f` | Installed 114490; pinned, not editable | UNCHANGED_READ_DEPENDENCY |
| `hotels_post_114489_private.safe_state_114490()` | `827a607a09a6d982cd1345342b58a2e7abf9961a93fd9ce8bd598c7a49fb77a7` | Installed 114490; pinned, not editable | UNCHANGED_READ_DEPENDENCY |
| `hotels_stripe_dto_private.assert_exact()` | `27a6557461c65b339d4bc4aee6c9faf8f83748fe134d4b852c9e5f4dfb99287c` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotels_stripe_dto_private.helper_catalog()` | `95c4c33e0d17c6c9e175aa3b621dca32da8830691ab761eff6a4e9552cf0c21f` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotels_stripe_dto_private.predecessor_source(oid)` | `199d181264570cba6dd5eb0c370bd19c6da613dfd5d76717f3a1ac71d20ba78a` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `hotels_stripe_dto_private.relation_catalog()` | `d7955b8131b837f37fece6afa3dc8e9e8b2a91aed90f787b1e4e10db2fed1b44` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_allocation_items_fingerprint(uuid)` | `ccbe8150dae1b9aa1d973f7cb6c1065933e9f6acb344bc96d2b6f7a9b3b6b9d7` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_cancellation_policy_is_valid(jsonb)` | `986704ae01fc5c2e22ac88213d1258a59c209dde8e887260e1c5283e9050f7db` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_enforce_graph_limits(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer)` | `44570d9e23af259bc8cc4b4f68dfbbdbd45cf222f295818b6cf6a68d67130e90` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_https_url_is_valid(text)` | `c4a3bbe6837f5c9827f992ecb1c23f70f9eae3420ea91ab8cc065ac3679918c9` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_i18n_is_valid(jsonb, boolean, integer, boolean)` | `3d0eb69f24c1ea01f5801620ca2b329d60b6daf71a7fad481410cfcb817eeccd` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_immutable_contract(uuid, text, uuid)` | `db46ee490fa9fb8cd82d5433d9207cde3a3a96693ab05859b500e308f38251f1` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_is_promotion_entity(uuid, text, uuid)` | `a9fd1c33c724e2f59e7a33b0c5cb8852669a077dce3354dc0e8c0f5e8fdd5f59` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_lifecycle(boolean, text)` | `55b9a9d32714a22e1d58581c2b99e91a8f7bd6561c5d192c08eff43bb8a07278` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_pricing_control_snapshot(uuid)` | `5d40f4475e8bbda75d3f44820ba90cca32fbb57cc405191e2c1369d1fc5a01c3` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `public.hotel_v2_admin_c_pricing_control_snapshot_114490(uuid)` | `f96398bdeb3e2b6ed3da1bd66372429e021d20d3cd3c44ea1595abc7137b7189` | Installed 114490; pinned, not editable | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_room_tiers_fingerprint(uuid)` | `ee26c41eec7084e69e087e872e9647da40cfe7677b4fc05de481c3a6a733aa3b` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_schedule_link_fingerprint(uuid)` | `96c6f32ffa32ae360019d1cd742fd3c6e93a74f64fbde3b78c3c099810784572` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_schedule_source_summary(text, jsonb)` | `67a0f1e32364a83db130aafefcd9381ce825ca76884c510368f9551b407b72c0` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_c_schedule_tiers_fingerprint(uuid)` | `914eaad5d7ab853758e1027480a1a113b5b64ffcbb9532b5a0125bbef1585891` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_d_hash(jsonb)` | `d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_d_snapshot(uuid, date, date, boolean)` | `7f665d523ae4cd0ecd9183645e50b2898426e1e62fd1bd74b652b87a227c1e7b` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `public.hotel_v2_admin_d_snapshot_114490(uuid, date, date, boolean)` | `70b2094358da5cd73ed9580b79d3e338323dadf4e2869f8999a4658652c614f1` | Installed 114490; pinned, not editable | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_admin_d_snapshot_external_base(uuid, date, date, boolean)` | `0d8e57d5bb06811f3ad39f6d4a638783d4517bf6c0b660a64a551790059e625c` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `public.hotel_v2_admin_d_snapshot_external_base_114490(uuid, date, date, boolean)` | `5d009e628ec2fcc23daa193e16e09417bf561677c6dd78907ef83aa4a21492d4` | Installed 114490; pinned, not editable | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_external_calendar_ics_source_type_is_supported(text)` | `36b05e8b654ae203ddd889c817464322e134cec638e1802acf8ae2092105c5d8` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_h2a_require_admin()` | `2f1cc975916dbc86a63d348135a2ff83de50d9f31c20e70219257d476296fa3d` | 114489.foundation_certificate | UNREACHABLE_WITH_REQUIRE_ADMIN_FALSE |
| `public.hotel_v2_h3_2a_capability_catalog()` | `a01f1e7484b1c8253fef8d8baf6d4f705497cacd3473c45de4bdf015821f68fe` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_h3_2a_permissions_snapshot(uuid)` | `2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_h3_2a_require_partner_hotel_access(uuid, uuid, text, boolean)` | `2b5702a60866205e56c6ecb7492581cf1b262098f5142b39559de5c6feb012cf` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `public.hotel_v2_h3_2a_require_partner_membership(uuid)` | `90ad483c8ae6c061d69f9b05e2a7b205219a7dbf37047e750a0a507835814b50` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_h3_2b_access_snapshot(uuid, uuid, text)` | `7f8cb70e2c7034d17f03377cf7ffe3d5648e47dc27800e9ac3542bc95e2bb5b4` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `public.hotel_v2_h3_2b_commission_policy(uuid)` | `533a819b7903a4247196955a555a32c4a26b4bea4450814017334c83903ace77` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_h3_2b_exact_price_projection(uuid)` | `41f8609b712906301ef93e0eb438188ce1989e1114ccea1dcf3f55e1775f438b` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_h3_2b_flags_off()` | `c4866c37cc2a4c5569e9efee957db4f13cc641290e2b2ea4b96f6265e9a2691f` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `public.hotel_v2_h3_2b_hash(jsonb)` | `d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `public.hotel_v2_partner_get_workspace(uuid, uuid, date, date)` | `ae51c6ed5516fe7c37b684ac843572af0d2b23b08ca28759b58c926c97df9798` | 114489.foundation_certificate | REPLACE_STALE_PATH |
| `public.is_current_user_admin()` | `6073f31ba6e068173a607ef60e3ec41cde6f2c9125571dacd1b2fd2c074bae9c` | 114489.foundation_certificate | UNREACHABLE_WITH_REQUIRE_ADMIN_FALSE |
| `r5k_catalog_proof.collation_text(oid)` | `e00c8886282426943fa820877533085abb587fb478bf4b1b91ab58319592a17d` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_3590b4e257042f09fe59()` | `a97db1b56d741e41fc7753b660886daef7b2ed41c4d566ae82377c4c406938a4` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_4595c3a6733f4eab16ff()` | `1fef2cdd0491e3e9866c535e840f07e49c81fa8cbbfb080863bdaf6e19f8c497` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_5b3fdcb3e5733f2ea8dd(oid)` | `81dc5ee4eeecfd7f28fd7d044a04f138adb604de2717f525fb443be0f258c7d4` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_63e67309c0eb62b8fdb1()` | `6434a6186d811c5046fa334a7f9be7e27c53eb9a2e49bcb5cf5e80420e893c2c` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_8143856008c9a6d63d31()` | `e5ef9330948a6e3796fef25a6cccc439978de0364cd65f05d2bd1abdf99a2226` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_9f36b3d93778206cdd79(oid)` | `4c1407ad8a9874a6806c25b7160252652dd76307f6e98a1012d6565ef7b8a977` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_b8213e04befe7b524baf(oid)` | `e165a47c5daca7c3a4759f13c5d93ba6bac85b407b1a2aadd0e29cc93d7b89d4` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_bff8d2a3fa74580f9a97(jsonb)` | `0efcedbc625bdd5c0e6dc3f27a59e846460fe328880fd562d3f0de352c913b5a` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_ca545b0d7f6eff9930d8(oid)` | `9878cad1f25471dbeb3a5fb165285b02302500f89dd9c02afb8a6bba0f8e7b3d` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.executor_dfbc6217b32ff0fc9d47()` | `dadaf2f87de4c0dedae41d9e7c9ae718ab8844e1c98b451dcddec890e571c3fd` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.pg_get_constraintdef(oid, boolean)` | `a1f50a2f2f43df08d9a4154bb48c3ae2b0f270945f1efc2bd0f59da85e496ae5` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.pg_get_expr(pg_node_tree, oid, boolean)` | `499cfe4d1ca93d8df607b372df4763ab6d3decaebd062efad683fd5b3e337c34` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.pg_get_functiondef(oid)` | `2ca8217843a7e61fe3b9029fe7e94ad272d52ebcd18e6873106123a146d5407c` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.pg_get_triggerdef(oid, boolean)` | `cbd891e89fafc417ce675d3e4d031b41e12dbeb52fd9c044c6a3bfcab85e29fa` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.procedure_text(oid)` | `a77a6c0102c029a16e9c3ed2e51445ec658e678c574e46cf1212f842164d457c` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |
| `r5k_catalog_proof.type_text(oid)` | `0f60b827e23f9d297f2b2199935a0324ca2a4c0d1d5898d8139d4489db97e387` | 114489.foundation_certificate | UNCHANGED_READ_DEPENDENCY |

### Direct certificate helper pins (transitive extension closed in the 116-pin fixture)

| Signature | Current production prosrc SHA-256 |
|---|---|
| `hotels_post_114489_private.calendar_provider_lineage_bridge_114490()` | `72fab6a14a74bc74a0531ed795053fc7d904e4798a7ab6753449b68c5d236c56` |
| `hotels_published_architecture_private.assert_receipt_exact()` | `24d24a3fcceef85d72fc7ec42bf98638d550367323b41156ee15c750e7109eba` |
| `r5k_catalog_proof.payment_catalog_is_exact()` | `c1969d855f3bc048b59a3fc8fb803177f11d244e870a416e9c83df6e93d763ef` |

## Full conservative call adjacency (70-function frontier)

- `auth.uid()` → no application-function edge
- `extensions.digest(bytea, text)` → no application-function edge
- `extensions.digest(text, text)` → no application-function edge
- `hotel_stripe_connect_private.authorization_receipt_hash(jsonb)` → `extensions.digest(text, text)`, `extensions.digest(bytea, text)`
- `hotel_stripe_connect_private.authorization_state(uuid)` → `hotel_stripe_connect_private.authorization_receipt_hash(jsonb)`
- `hotels_guest_policy_private.original_source(oid)` → `hotels_guest_policy_private.raw_metadata(oid)`
- `hotels_guest_policy_private.raw_metadata(oid)` → no application-function edge
- `hotels_lifecycle_private.actual_flags()` → no application-function edge
- `hotels_lifecycle_private.catalog_snapshot()` → `extensions.digest(text, text)`, `extensions.digest(bytea, text)`, `hotels_lifecycle_private.hash(jsonb)`, `hotels_lifecycle_private.metadata(oid)`, `hotels_stripe_dto_private.assert_exact()`, `hotels_stripe_dto_private.predecessor_source(oid)`
- `hotels_lifecycle_private.chain_state()` → `hotels_lifecycle_private.hash(jsonb)`, `hotels_lifecycle_private.catalog_snapshot()`
- `hotels_lifecycle_private.hash(jsonb)` → `extensions.digest(text, text)`, `extensions.digest(bytea, text)`
- `hotels_lifecycle_private.metadata(oid)` → no application-function edge
- `hotels_lifecycle_private.partner_connection(uuid, uuid)` → `auth.uid()`, `public.hotel_v2_h3_2a_require_partner_hotel_access(uuid, uuid, text, boolean)`, `hotel_stripe_connect_private.authorization_state(uuid)`, `hotels_lifecycle_private.safe_state()`, `hotels_lifecycle_private.partner_connection(uuid, uuid)`, `hotels_stripe_dto_private.assert_exact()`, `hotels_stripe_dto_private.predecessor_source(oid)`
- `hotels_lifecycle_private.predecessor_flag_exact(text, boolean)` → `hotels_lifecycle_private.safe_state()`
- `hotels_lifecycle_private.safe_state()` → `hotels_lifecycle_private.actual_flags()`, `hotels_lifecycle_private.chain_state()`
- `hotels_post_114489_private.predecessor_flag_exact_114490(text, boolean)` → `hotels_post_114489_private.safe_state_114490()`
- `hotels_post_114489_private.safe_state_114490()` → `hotels_lifecycle_private.actual_flags()`, `r5k_catalog_proof.executor_63e67309c0eb62b8fdb1()`
- `hotels_stripe_dto_private.assert_exact()` → `hotels_lifecycle_private.metadata(oid)`, `hotels_stripe_dto_private.helper_catalog()`, `hotels_stripe_dto_private.relation_catalog()`, `hotels_guest_policy_private.original_source(oid)`
- `hotels_stripe_dto_private.helper_catalog()` → `hotels_lifecycle_private.metadata(oid)`, `hotels_guest_policy_private.original_source(oid)`
- `hotels_stripe_dto_private.predecessor_source(oid)` → `hotels_lifecycle_private.metadata(oid)`, `hotels_stripe_dto_private.assert_exact()`, `hotels_guest_policy_private.original_source(oid)`
- `hotels_stripe_dto_private.relation_catalog()` → no application-function edge
- `public.hotel_v2_admin_c_allocation_items_fingerprint(uuid)` → no application-function edge
- `public.hotel_v2_admin_c_cancellation_policy_is_valid(jsonb)` → no application-function edge
- `public.hotel_v2_admin_c_enforce_graph_limits(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer)` → no application-function edge
- `public.hotel_v2_admin_c_https_url_is_valid(text)` → no application-function edge
- `public.hotel_v2_admin_c_i18n_is_valid(jsonb, boolean, integer, boolean)` → no application-function edge
- `public.hotel_v2_admin_c_immutable_contract(uuid, text, uuid)` → `public.hotel_v2_admin_c_is_promotion_entity(uuid, text, uuid)`
- `public.hotel_v2_admin_c_is_promotion_entity(uuid, text, uuid)` → no application-function edge
- `public.hotel_v2_admin_c_lifecycle(boolean, text)` → no application-function edge
- `public.hotel_v2_admin_c_pricing_control_snapshot(uuid)` → `extensions.digest(text, text)`, `extensions.digest(bytea, text)`, `public.hotel_v2_admin_c_lifecycle(boolean, text)`, `public.hotel_v2_admin_c_is_promotion_entity(uuid, text, uuid)`, `public.hotel_v2_admin_c_immutable_contract(uuid, text, uuid)`, `public.hotel_v2_admin_c_schedule_tiers_fingerprint(uuid)`, `public.hotel_v2_admin_c_room_tiers_fingerprint(uuid)`, `public.hotel_v2_admin_c_schedule_link_fingerprint(uuid)`, `public.hotel_v2_admin_c_allocation_items_fingerprint(uuid)`, `public.hotel_v2_admin_c_i18n_is_valid(jsonb, boolean, integer, boolean)`, `public.hotel_v2_admin_c_cancellation_policy_is_valid(jsonb)`, `public.hotel_v2_admin_c_https_url_is_valid(text)`, `public.hotel_v2_admin_c_schedule_source_summary(text, jsonb)`, `public.hotel_v2_admin_c_enforce_graph_limits(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer)`, `hotels_lifecycle_private.safe_state()`
- `public.hotel_v2_admin_c_pricing_control_snapshot_114490(uuid)` → `extensions.digest(text, text)`, `extensions.digest(bytea, text)`, `public.hotel_v2_admin_c_lifecycle(boolean, text)`, `public.hotel_v2_admin_c_is_promotion_entity(uuid, text, uuid)`, `public.hotel_v2_admin_c_immutable_contract(uuid, text, uuid)`, `public.hotel_v2_admin_c_schedule_tiers_fingerprint(uuid)`, `public.hotel_v2_admin_c_room_tiers_fingerprint(uuid)`, `public.hotel_v2_admin_c_schedule_link_fingerprint(uuid)`, `public.hotel_v2_admin_c_allocation_items_fingerprint(uuid)`, `public.hotel_v2_admin_c_i18n_is_valid(jsonb, boolean, integer, boolean)`, `public.hotel_v2_admin_c_cancellation_policy_is_valid(jsonb)`, `public.hotel_v2_admin_c_https_url_is_valid(text)`, `public.hotel_v2_admin_c_schedule_source_summary(text, jsonb)`, `public.hotel_v2_admin_c_enforce_graph_limits(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer)`, `hotels_post_114489_private.safe_state_114490()`
- `public.hotel_v2_admin_c_room_tiers_fingerprint(uuid)` → no application-function edge
- `public.hotel_v2_admin_c_schedule_link_fingerprint(uuid)` → no application-function edge
- `public.hotel_v2_admin_c_schedule_source_summary(text, jsonb)` → no application-function edge
- `public.hotel_v2_admin_c_schedule_tiers_fingerprint(uuid)` → no application-function edge
- `public.hotel_v2_admin_d_hash(jsonb)` → `extensions.digest(text, text)`, `extensions.digest(bytea, text)`
- `public.hotel_v2_admin_d_snapshot(uuid, date, date, boolean)` → `public.hotel_v2_admin_d_hash(jsonb)`, `public.hotel_v2_admin_d_snapshot_external_base(uuid, date, date, boolean)`, `public.hotel_v2_external_calendar_ics_source_type_is_supported(text)`
- `public.hotel_v2_admin_d_snapshot_114490(uuid, date, date, boolean)` → `public.hotel_v2_admin_d_hash(jsonb)`, `public.hotel_v2_external_calendar_ics_source_type_is_supported(text)`, `public.hotel_v2_admin_d_snapshot_external_base_114490(uuid, date, date, boolean)`
- `public.hotel_v2_admin_d_snapshot_external_base(uuid, date, date, boolean)` → `public.hotel_v2_h2a_require_admin()`, `public.hotel_v2_admin_d_hash(jsonb)`, `hotels_lifecycle_private.predecessor_flag_exact(text, boolean)`
- `public.hotel_v2_admin_d_snapshot_external_base_114490(uuid, date, date, boolean)` → `public.hotel_v2_h2a_require_admin()`, `public.hotel_v2_admin_d_hash(jsonb)`, `hotels_post_114489_private.predecessor_flag_exact_114490(text, boolean)`
- `public.hotel_v2_external_calendar_ics_source_type_is_supported(text)` → no application-function edge
- `public.hotel_v2_h2a_require_admin()` → `public.is_current_user_admin()`
- `public.hotel_v2_h3_2a_capability_catalog()` → no application-function edge
- `public.hotel_v2_h3_2a_permissions_snapshot(uuid)` → no application-function edge
- `public.hotel_v2_h3_2a_require_partner_hotel_access(uuid, uuid, text, boolean)` → `public.hotel_v2_h3_2a_capability_catalog()`, `public.hotel_v2_h3_2a_require_partner_membership(uuid)`, `hotels_lifecycle_private.predecessor_flag_exact(text, boolean)`
- `public.hotel_v2_h3_2a_require_partner_membership(uuid)` → `auth.uid()`
- `public.hotel_v2_h3_2b_access_snapshot(uuid, uuid, text)` → `public.hotel_v2_h3_2a_permissions_snapshot(uuid)`, `public.hotel_v2_h3_2a_require_partner_membership(uuid)`, `public.hotel_v2_h3_2a_require_partner_hotel_access(uuid, uuid, text, boolean)`, `public.hotel_v2_h3_2b_flags_off()`
- `public.hotel_v2_h3_2b_commission_policy(uuid)` → `public.hotel_v2_h3_2b_hash(jsonb)`
- `public.hotel_v2_h3_2b_exact_price_projection(uuid)` → no application-function edge
- `public.hotel_v2_h3_2b_flags_off()` → `hotels_lifecycle_private.predecessor_flag_exact(text, boolean)`
- `public.hotel_v2_h3_2b_hash(jsonb)` → `extensions.digest(text, text)`, `extensions.digest(bytea, text)`
- `public.hotel_v2_partner_get_workspace(uuid, uuid, date, date)` → `public.hotel_v2_admin_c_pricing_control_snapshot(uuid)`, `public.hotel_v2_admin_d_snapshot(uuid, date, date, boolean)`, `public.hotel_v2_h3_2b_exact_price_projection(uuid)`, `public.hotel_v2_h3_2b_hash(jsonb)`, `public.hotel_v2_h3_2b_access_snapshot(uuid, uuid, text)`, `public.hotel_v2_h3_2b_commission_policy(uuid)`, `hotels_lifecycle_private.actual_flags()`, `hotels_lifecycle_private.safe_state()`, `hotels_lifecycle_private.partner_connection(uuid, uuid)`
- `public.is_current_user_admin()` → `auth.uid()`
- `r5k_catalog_proof.collation_text(oid)` → no application-function edge
- `r5k_catalog_proof.executor_3590b4e257042f09fe59()` → `hotels_stripe_dto_private.helper_catalog()`, `hotels_stripe_dto_private.relation_catalog()`, `r5k_catalog_proof.executor_ca545b0d7f6eff9930d8(oid)`, `r5k_catalog_proof.executor_b8213e04befe7b524baf(oid)`, `r5k_catalog_proof.executor_8143856008c9a6d63d31()`, `r5k_catalog_proof.executor_4595c3a6733f4eab16ff()`
- `r5k_catalog_proof.executor_4595c3a6733f4eab16ff()` → `r5k_catalog_proof.pg_get_constraintdef(oid, boolean)`, `r5k_catalog_proof.pg_get_triggerdef(oid, boolean)`
- `r5k_catalog_proof.executor_5b3fdcb3e5733f2ea8dd(oid)` → `hotels_stripe_dto_private.assert_exact()`, `r5k_catalog_proof.executor_ca545b0d7f6eff9930d8(oid)`, `r5k_catalog_proof.executor_b8213e04befe7b524baf(oid)`
- `r5k_catalog_proof.executor_63e67309c0eb62b8fdb1()` → `r5k_catalog_proof.executor_dfbc6217b32ff0fc9d47()`, `r5k_catalog_proof.executor_bff8d2a3fa74580f9a97(jsonb)`
- `r5k_catalog_proof.executor_8143856008c9a6d63d31()` → `r5k_catalog_proof.procedure_text(oid)`, `r5k_catalog_proof.executor_ca545b0d7f6eff9930d8(oid)`, `r5k_catalog_proof.executor_b8213e04befe7b524baf(oid)`
- `r5k_catalog_proof.executor_9f36b3d93778206cdd79(oid)` → `r5k_catalog_proof.pg_get_functiondef(oid)`
- `r5k_catalog_proof.executor_b8213e04befe7b524baf(oid)` → no application-function edge
- `r5k_catalog_proof.executor_bff8d2a3fa74580f9a97(jsonb)` → `extensions.digest(text, text)`, `extensions.digest(bytea, text)`
- `r5k_catalog_proof.executor_ca545b0d7f6eff9930d8(oid)` → `r5k_catalog_proof.pg_get_functiondef(oid)`, `r5k_catalog_proof.executor_9f36b3d93778206cdd79(oid)`
- `r5k_catalog_proof.executor_dfbc6217b32ff0fc9d47()` → `extensions.digest(text, text)`, `extensions.digest(bytea, text)`, `r5k_catalog_proof.procedure_text(oid)`, `r5k_catalog_proof.type_text(oid)`, `r5k_catalog_proof.collation_text(oid)`, `r5k_catalog_proof.pg_get_constraintdef(oid, boolean)`, `r5k_catalog_proof.pg_get_triggerdef(oid, boolean)`, `r5k_catalog_proof.pg_get_expr(pg_node_tree, oid, boolean)`, `r5k_catalog_proof.executor_bff8d2a3fa74580f9a97(jsonb)`, `r5k_catalog_proof.executor_b8213e04befe7b524baf(oid)`, `r5k_catalog_proof.executor_3590b4e257042f09fe59()`, `r5k_catalog_proof.executor_5b3fdcb3e5733f2ea8dd(oid)`
- `r5k_catalog_proof.pg_get_constraintdef(oid, boolean)` → no application-function edge
- `r5k_catalog_proof.pg_get_expr(pg_node_tree, oid, boolean)` → no application-function edge
- `r5k_catalog_proof.pg_get_functiondef(oid)` → `auth.uid()`, `public.is_current_user_admin()`
- `r5k_catalog_proof.pg_get_triggerdef(oid, boolean)` → no application-function edge
- `r5k_catalog_proof.procedure_text(oid)` → no application-function edge
- `r5k_catalog_proof.type_text(oid)` → no application-function edge

## Recovery validation (2026-09-22)

- Static contract: 11/11 PASS. Four additive functions, 116 source/security pins checked before and after; no historical replacements; exact projection equivalence with binding/tag/architecture-evidence delta.
- Local PostgreSQL 16: 29/29 PASS. Two explicitly identified certificate-boundary doubles are used in the disposable clone (immutable receipt assertion and frozen lifecycle executor). This is NOT a full historical installation proof. Real membership, permissions, pricing, availability and exact candidate runtime bodies are tested. Clone removed; source business fingerprint unchanged. All pre-existing function sources/security are unchanged.
- The actual shipped `validateWorkspace114492` validates the real local DTO without rewriting its tag or substituting its schema. A synthetic 31-day DTO is generated for browser tests; it is not a production response.
- Full Jest: 144 suites PASS, 1544 tests passed, 1 skipped (fresh recovery run).
- Full E2E: required gate is running/under review. No production certification is permitted while it is not green. An inherited Admin Pricing assertion at `admin-hotels-v2-admin-c-pricing.spec.ts:1157` has independently failed on the clean accepted base; no unrelated Admin implementation/test fix is included here.
- Lint PASS (0 errors; 915 inherited warnings), i18n PASS, normal build PASS. Dist is generated, not edited manually.
- Fresh typecheck comparison against an isolated clean export of the accepted base: 158 identical diagnostics on both sides; zero current-only or baseline-only errors.
- Migration freeze 114489/114490/114491 PASS. The 114492 migration itself remains byte-identical to the recovered candidate.
- Historical pre-loss logs are not substituted for these fresh results. Final test status is retained in the persistent recovery artifact report.

## Rollback-only certificate design

Generator: tests/integration/hotels-v2-114492-rollback-package.mjs. It embeds the exact candidate body, excluding only the candidate's outer BEGIN/COMMIT. An inner exception subtransaction intentionally rolls back all candidate DDL after owner/cross-Partner/unauthenticated checks. It compares business, lifecycle, function catalog, namespace ACLs, ledger, foundation, conversion receipt and property history BEFORE/AFTER, then the outer transaction ends with ROLLBACK. No permanent-install path is available in this package.

This package has NOT been executed on production. Its live full-workspace projection checks and historical certificate checks remain pending. No release-complete or retry-ready claim is made.

## Evidence retained locally

Persistent worktree: `/Users/kangur/Documents/GitHub/CyprusEye.com/CyprusEye-114492-recovery`.

Persistent artifacts: `/Users/kangur/Documents/GitHub/CyprusEye.com/CyprusEye-114492-recovery-artifacts`. `exact-recovery.json` records the source event history, replayed patches and every recovered file hash. The recovered SQL diagnostic sources and analysis scripts are in `recovered/`; their former `/private/tmp` input locations are historical, not active evidence paths. Production metadata pins and the four original function bodies are retained in the repository fixtures. Raw vanished production response files are not claimed to have been recovered.

Fresh reports include `postgres.log`, `jest.log`, `e2e.log`, `e2e-114492.log`, `e2e-baseline-proof.log`, `lint.log`, `i18n.log`, `build.log`, and both typecheck logs. `hotels-114492-rollback-certification.sql` is generated from the final exact candidate and has not been executed on production.
