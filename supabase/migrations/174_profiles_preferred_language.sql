-- Store a signed-in user's preferred UI/email language.
-- This is additive and does not alter any existing profile fields or auth flow.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_chk
  CHECK (
    preferred_language IS NULL
    OR preferred_language IN ('pl', 'en')
  );

COMMENT ON COLUMN public.profiles.preferred_language IS
  'Preferred language selected by the signed-in user. Supported values: pl, en.';
