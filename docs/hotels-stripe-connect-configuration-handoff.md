# Hotels Stripe Connect: configuration handoff (not an authorization)

Local baseline: `bee91f5912ab88b76752aa66aefe35f532fdd06a`.
No website deployment, secret update, readiness invocation, migration installation,
Partner grant, account connection or payment change is authorized by this document.

## Fixed Connect origin

Use `HOTELS_CONNECT_ORIGIN=https://cypruseye.com` (no trailing slash).
This is a **Connect-only contract**, aligned with `js/config.js` `URLS.base` and
the operational Site URL in `docs/special-offers-lefkara-soft-launch-checklist.md`.
Auth permits both hosts; SEO sometimes uses www. Neither is changed here, and this
document does not claim the missing production environment value is already set.

The exact www entry routes normalize to apex before SDK import. Only validated
Partner/Hotel IDs and supported language are forwarded. Browser sessions are not
transferred: an operator signed in only on www may need to sign in on apex.
Callbacks on www scrub credentials and fail closed; credentials never cross hosts.
Both apex callback path forms work after Cloudflare strips `.html`.

The OAuth redirect URI to register is exactly:

`https://cypruseye.com/partners/stripe-connect-return.html`

Do not register www, an arbitrary browser-selected origin, or a Preview URL for
this production Connect contract. Keep the Edge origin comparison and frontend
`unsafe_redirect` checks exact.

## First: identify the existing Stripe key mode locally

Do not extract the deployed secret, print it, paste it into chat, or replace it.
An authorized operator can use their securely held copy of the **same existing
production `STRIPE_SECRET_KEY`** with this local-only check. No network call occurs.
If that copy is unavailable, stop; do not infer mode from the production hostname.
The check establishes a prefix/mode only, not key validity or deployed-byte identity.

```bash
bash --noprofile --norc <<'CONNECT_MODE_ONLY'
set +xv
set -euo pipefail
trap 'unset connect_key_probe connect_mode' EXIT
IFS= read -r -s -p 'Existing production STRIPE_SECRET_KEY (hidden): ' connect_key_probe </dev/tty
printf '\n' >/dev/tty
if [[ "$connect_key_probe" =~ ^sk_live_[A-Za-z0-9]+$ ]]; then
  connect_mode=live
elif [[ "$connect_key_probe" =~ ^sk_test_[A-Za-z0-9]+$ ]]; then
  connect_mode=test
else
  printf 'STRIPE_KEY_MODE=INVALID\n'
  exit 1
fi
unset connect_key_probe
printf 'STRIPE_KEY_MODE=%s\n' "$connect_mode"
CONNECT_MODE_ONLY
```

## Stripe Dashboard values — manual, separate authorization before changes

Use the platform account and the **same live/test mode** established above.
`ca_...` does not itself identify its mode. Do not use synthetic IDs from tests.

1. Settings → Connect → Onboarding options → OAuth settings. Confirm/enable
   **Standard OAuth** and obtain that mode's real `ca_...` Client ID. Do not create
   Express/Custom accounts or replace the approved connection model. If Standard
   OAuth is unavailable for this platform, stop rather than redesigning onboarding.
2. Register the single exact apex OAuth redirect URI above.
3. Workbench → Webhooks → Add destination. Create a **separate** Connect endpoint;
   select events from **Connected accounts**, snapshot/v1 events, and the existing
   handler's API contract `2023-10-16` where the Dashboard offers version selection.
4. Select only `account.updated` and `account.application.deauthorized`.
5. Endpoint URL:
   `https://daoohnbnnowmmcizgvrq.supabase.co/functions/v1/hotels-stripe-connect/webhook`
6. Obtain this endpoint's signing secret `whsec_...` using Reveal. Keep it in the
   operator's secret manager. Never reuse the existing platform payment
   `STRIPE_WEBHOOK_SECRET`, a Stripe CLI listener secret, or the other mode's secret.

Do not send test events to production or connect an account during this preparation.

Official references: [Standard OAuth setup](https://docs.stripe.com/connect/oauth-standard-accounts),
[exact OAuth redirect matching](https://docs.stripe.com/connect/oauth-reference),
[Workbench event destinations](https://docs.stripe.com/workbench/overview).

## Prepared Supabase command — DO NOT RUN without explicit approval

Requires separate authorization to update exactly four settings in project
`daoohnbnnowmmcizgvrq`. It does not upload/change `STRIPE_SECRET_KEY` or the existing
platform webhook secret. It creates no `.env` file; values are passed through a
pipe, not command-line arguments or shell history. Keep CLI v2.67.1; do not enable
debug output or terminal recording. `/dev/stdin` is used as the env-file input.

The confirmation below is an additional operator safeguard, not a replacement for
explicit approval of the production secret mutation.

```bash
bash --noprofile --norc <<'CONNECT_SECRETS_AFTER_APPROVAL'
set +xv
set -euo pipefail
trap 'unset connect_key_probe connect_mode connect_dashboard_mode connect_client_id connect_webhook_secret connect_approval' EXIT
IFS= read -r -s -p 'Existing production STRIPE_SECRET_KEY (mode check only, hidden): ' connect_key_probe </dev/tty
printf '\n' >/dev/tty
if [[ "$connect_key_probe" =~ ^sk_live_[A-Za-z0-9]+$ ]]; then
  connect_mode=live
elif [[ "$connect_key_probe" =~ ^sk_test_[A-Za-z0-9]+$ ]]; then
  connect_mode=test
else
  printf 'STRIPE_KEY_MODE=INVALID\n'
  exit 1
fi
unset connect_key_probe
printf 'STRIPE_KEY_MODE=%s\n' "$connect_mode"
IFS= read -r -p 'Dashboard mode used for BOTH OAuth client and Connect endpoint (live/test): ' connect_dashboard_mode </dev/tty
[[ "$connect_dashboard_mode" == "$connect_mode" ]] || { printf 'MODE_MISMATCH\n'; exit 1; }
IFS= read -r -s -p 'Real matching-mode ca_ Client ID (hidden): ' connect_client_id </dev/tty
printf '\n' >/dev/tty
[[ "$connect_client_id" =~ ^ca_[A-Za-z0-9]+$ ]] || { printf 'INVALID_CLIENT_ID\n'; exit 1; }
IFS= read -r -s -p 'Separate Connect endpoint whsec_ secret (hidden): ' connect_webhook_secret </dev/tty
printf '\n' >/dev/tty
[[ "$connect_webhook_secret" =~ ^whsec_[A-Za-z0-9]+$ ]] || { printf 'INVALID_WEBHOOK_SECRET\n'; exit 1; }
IFS= read -r -p 'After explicit approval, type AUTHORIZE_CONNECT_SECRETS_daoohnbnnowmmcizgvrq: ' connect_approval </dev/tty
[[ "$connect_approval" == AUTHORIZE_CONNECT_SECRETS_daoohnbnnowmmcizgvrq ]] || exit 1
printf 'HOTELS_CONNECT_ORIGIN=https://cypruseye.com\nHOTELS_CONNECT_MODE=%s\nSTRIPE_CONNECT_CLIENT_ID=%s\nSTRIPE_CONNECT_WEBHOOK_SECRET=%s\n' \
  "$connect_mode" "$connect_client_id" "$connect_webhook_secret" \
  | supabase secrets set --project-ref daoohnbnnowmmcizgvrq --env-file /dev/stdin
CONNECT_SECRETS_AFTER_APPROVAL
```

CLI env-file support was inspected locally using `supabase secrets set --help`.
The upload command has **not** been executed or tested against Supabase. Regex
checks cannot prove client ownership, endpoint selection or secret validity.

## Remaining independently approved gates

1. Review/checkpoint the local frontend patch; no automatic commit/push.
2. Separately authorize website deployment. Verify exact deployed assets, apex/www
   entry behavior, both callback routes, effective `no-store` / `no-referrer`, and
   normal Partner PWA update activation. The new cache version purges the old
   Partner cache only when the worker activates; it does not force activation.
   [Cloudflare header matching/detachment](https://developers.cloudflare.com/pages/configuration/headers/)
   is distinct from the fully mocked browser tests.
3. Separately authorize/configure the four Connect settings above. Existing Edge
   source must remain identical to the accepted deployed identity:
   - index.ts: `1c90f5732a67a7cf2d02c20ed440d20979f0822109bcf5a50ddbda18e7817164`
   - service.mjs: `371463ef538ce57e2ea590b8567f938d06135e4ed04a101b924dba05b755b7ed`
4. Separately authorize authenticated Admin configuration verification. The
   `verify_platform_configuration` action writes readiness attestation; it is NOT
   a harmless read and is not authorized here. It validates configuration shape,
   key-mode prefix and Admin access, not live OAuth credentials through a Stripe
   account connection. Successful local tests do not establish production readiness.
5. Only then reassess the fresh 114486 preactivation gate and obtain separate SQL
   installation authorization. Do not install 114486 automatically.
6. Stripe capability, Partner onboarding authorization and actual account connection
   remain separate explicit decisions. Keep public booking and instant booking OFF;
   do not change Rooms V2, External sync, EUR10 commission or payment routing.

Current external dependency: real matching-mode OAuth client and separate webhook
secret/configuration, followed by the separate production approvals above.
