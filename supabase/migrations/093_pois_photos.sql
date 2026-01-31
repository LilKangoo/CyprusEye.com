-- Add photos gallery for POIs
alter table if exists public.pois
  add column if not exists photos jsonb default '[]'::jsonb;
