-- Allow Hebrew as an internal/hidden preferred language value.
-- Public UI exposure remains controlled by the frontend language registry.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_chk
  CHECK (
    preferred_language IS NULL
    OR preferred_language IN ('pl', 'en', 'he')
  );

COMMENT ON COLUMN public.profiles.preferred_language IS
  'Preferred language selected by the signed-in user. Supported values: pl, en, he. Hebrew is internal/hidden until public rollout.';
