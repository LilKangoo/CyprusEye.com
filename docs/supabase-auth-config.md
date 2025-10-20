# Supabase Auth configuration

The front-end auth flows expect the Supabase project to use the following Auth → URL Configuration settings.

## Authorized redirect URLs

Add these production origins so password reset and email confirmation links land back on the CyprusEye experience:

- `https://cypruseye.com`
- `https://www.cypruseye.com`

For local development, include a wildcard entry to cover ports used by the dev server:

- `http://localhost:*`

## Session behaviour

Enable the following Supabase Auth options so the browser clients can restore the session automatically:

- **PKCE** (public client flow)
- **persistSession** (keeps the session across reloads)

These flags are required because the site relies exclusively on the Supabase JavaScript client for session management.

## Security expectations

The web app relies on Supabase Row Level Security (RLS) and the auth client to enforce the rules below. Make sure any tooling or follow-up work keeps them intact:

- Never put passwords or emails into query strings; form submissions are fully handled in JavaScript.
- Profile records are created by the `public.handle_new_user` trigger—do not insert from the front-end. Updates must target `profiles` with `id = auth.uid()`.
- XP events in `user_xp_events` must always use `auth.uid()` for `user_id`; guest mode stores progress locally instead of inserting rows.

Following these settings keeps the live site aligned with the scripted auth flows and automated tests in this repository.
