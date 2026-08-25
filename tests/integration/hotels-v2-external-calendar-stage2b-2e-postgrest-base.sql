\set ON_ERROR_STOP on
\ir hotels-v2-h3-2b-partner-workspace-postgrest-base.sql
create extension if not exists supabase_vault;
create extension if not exists pg_net;
\ir ../../supabase/migrations/20260811390000_hotels_v2_external_calendar_sync_foundation.sql
\ir ../../supabase/migrations/20260811400000_hotels_v2_external_calendar_worker_runtime.sql
\ir ../../supabase/migrations/20260811410000_hotels_v2_external_calendar_availability_projection.sql
\ir ../../supabase/migrations/20260811420000_hotels_v2_external_calendar_reviewed_control.sql
\ir ../../supabase/migrations/20260811430000_hotels_v2_external_calendar_scheduler.sql
\ir ../../supabase/migrations/20260811435000_hotels_v2_external_calendar_activation_compatibility.sql
