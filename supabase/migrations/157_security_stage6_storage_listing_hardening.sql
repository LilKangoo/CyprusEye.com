begin;

-- Stage 6: block broad public listing on public storage buckets.
--
-- Buckets remain public, so existing object URLs continue to work. These drops
-- only remove broad SELECT policies on storage.objects that allow clients to
-- enumerate files. The app only needs listing for a signed-in user's own avatar
-- folder during avatar replacement/cleanup.

drop policy if exists "avatars_public_read 1oj01fe_0" on storage.objects;
drop policy if exists "Public can view car images" on storage.objects;
drop policy if exists "Public read access" on storage.objects;
drop policy if exists "poi-photos public read" on storage.objects;
drop policy if exists "poi_photos_public_read" on storage.objects;
drop policy if exists "Public can view trip images" on storage.objects;

drop policy if exists avatars_owner_folder_read on storage.objects;
create policy avatars_owner_folder_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
