-- Add main image URL for POIs
alter table if exists public.pois
  add column if not exists main_image_url text;
