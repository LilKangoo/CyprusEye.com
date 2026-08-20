\set ON_ERROR_STOP on

-- Disposable production-shaped ADMIN-B fixture. The production assignment
-- trigger/form-snapshot fixture fills only contracts omitted by the compact
-- H3.2A base; it is never deployed.
\ir hotels-v2-admin-a-room-gallery-post-promotion-postgrest-base.sql
\ir hotels-v2-admin-b-production-assignment-trigger-fixture.sql
\ir ../../supabase/migrations/20260811340000_hotels_v2_admin_b_content_room_assignment_control.sql

notify pgrst, 'reload schema';
