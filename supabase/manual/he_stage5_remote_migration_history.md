# Stage 5 Remote Migration History Notes

Date: 2026-05-28

## Commands Run

Read-only/safe commands:

```bash
supabase --version
supabase migration repair --help
supabase migration list --help
supabase db push --dry-run
supabase db lint --linked
```

No destructive command was run. `supabase db push --include-all`, remote reset,
and mass migration application were not run.

## Observed Supabase CLI State

- Supabase CLI version: `2.67.1`.
- Local `supabase db lint` cannot run because local Postgres is not running on
  `127.0.0.1:54322`.
- Local diff cannot run because Docker daemon is not available.
- `supabase migration list` needs an access token in this environment.
- `supabase db push --dry-run` can reach remote and reports migration history
  drift.

## Remote Migration Drift

`supabase db push --dry-run` reports these local migrations would need to be
inserted before the last remote migration:

- `095_partner_push_subscriptions.sql` through
  `152_security_stage3_views_invoker_and_grants.sql`
- `172_pois_google_maps_url_canonical_backfill.sql`
- `173_email_template_catalog_foundation.sql`
- `174_profiles_preferred_language.sql`
- `175_hotel_booking_admin_manual_adjustment.sql`
- `176_profiles_email_username_referral_sync.sql`
- `177_profiles_preferred_language_he.sql`
- `178_he_internal_content_fields.sql`

The dry-run list did not include `153` through `171`, which suggests remote has
some later migrations registered while older local files are not registered.
This means the remote migration history is drifted and should not be repaired
blindly.

## HE Rollout Decision

Do not run:

```bash
supabase db push --include-all
```

for the HE rollout. That would attempt to apply a large backlog unrelated to HE.

Safe HE path:

1. Apply `supabase/manual/manual_he_rollout_177_178.sql` manually in SQL Editor.
2. Run `supabase/manual/he_stage4_schema_checks.sql`.
3. If checks pass, optionally repair only HE migration history:

```bash
supabase migration repair 177 178 --status applied --linked
```

This marks only `177` and `178` as applied. It does not solve the older backlog
`095-176`, which must be handled as a separate database maintenance task.

## Remote Lint Errors

`supabase db lint --linked` returns existing unrelated errors/warnings in remote
schema/functions. Examples include:

- PostGIS helper warnings/errors (`st_findextent`, `populate_geometry_columns`,
  `postgis_full_version`).
- Existing ambiguous function variables, for example comment/report/admin XP
  helpers.
- Existing missing/renamed columns in older RPC functions.
- Existing `format()` specifier issues in coupon quote functions.

These are not part of the HE rollout and should not be fixed in this stage
unless a new HE-specific lint error appears after applying 177/178.
