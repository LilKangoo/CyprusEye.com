\set ON_ERROR_STOP on
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql
\ir ../../supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql
\ir ../../supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql
notify pgrst,'reload schema';
