-- ============================================================================
-- STORAGE BUCKET FOR IMAGES
-- Bucket dla zdjęć rekomendacji, POI, etc.
-- ============================================================================

-- Utworzenie bucketu 'images' jeśli nie istnieje
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images',
  'images',
  true, -- public bucket
  5242880, -- 5MB limit
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ============================================================================
-- POLICIES DLA BUCKETU 'images'
-- ============================================================================

-- Polityka: Wszyscy mogą czytać (public bucket)
create policy "Public read access"
on storage.objects for select
to public
using (bucket_id = 'images');

-- Polityka: Tylko admini mogą uploadować
create policy "Admin upload access"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'images' 
  and exists (
    select 1 from public.profiles 
    where profiles.id = auth.uid() 
    and profiles.is_admin = true
  )
);

-- Polityka: Tylko admini mogą usuwać
create policy "Admin delete access"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'images' 
  and exists (
    select 1 from public.profiles 
    where profiles.id = auth.uid() 
    and profiles.is_admin = true
  )
);

-- Polityka: Tylko admini mogą aktualizować
create policy "Admin update access"
on storage.objects for update
to authenticated
using (
  bucket_id = 'images' 
  and exists (
    select 1 from public.profiles 
    where profiles.id = auth.uid() 
    and profiles.is_admin = true
  )
)
with check (
  bucket_id = 'images' 
  and exists (
    select 1 from public.profiles 
    where profiles.id = auth.uid() 
    and profiles.is_admin = true
  )
);
