\set ON_ERROR_STOP on
\set provider_install_external_enabled true
\ir hotels-v2-seven-arches-external-calendar-readiness-postgres-gate.sql
notify pgrst,'reload schema';
