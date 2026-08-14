\set ON_ERROR_STOP on

-- Disposable local-only production-shaped graph. Reconstruct the reviewed
-- H2B.1 shadow package, preserve the H2B.2 property policy, install inert
-- H3.1, then apply only the deferred trigger authorization repair.
\ir hotels-v2-h2b1-reviewed-save-postgrest-base.sql
\ir ../../supabase/migrations/20260811280000_hotels_v2_h2b2_shadow_property_policy_preservation.sql
\ir ../../supabase/migrations/20260811290000_hotels_v2_h3_1_inert_admin_configuration.sql
\ir ../../supabase/migrations/20260811300000_hotels_v2_h3_1_deferred_room_inventory_trigger_auth_fix.sql

notify pgrst, 'reload schema';
