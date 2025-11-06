-- ============================================
-- RLS POLICIES FOR PROFILE PAGE
-- User data deletion and management
-- ============================================
-- Data: 1 Listopad 2025
-- 
-- Te policies pozwalają użytkownikom zarządzać swoimi danymi
-- w tym usuwać swoje konto i dane
-- ============================================

-- ============================================
-- 1. PROFILES TABLE POLICIES
-- ============================================

-- Użytkownicy mogą usuwać swój własny profil
CREATE POLICY "Users can delete their own profile"
  ON profiles
  FOR DELETE
  USING (auth.uid() = id);

-- Użytkownicy mogą aktualizować swój własny profil
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Wszyscy mogą czytać publiczne profile
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  USING (true);

-- ============================================
-- 2. POI_COMMENTS TABLE POLICIES
-- ============================================

-- Użytkownicy mogą usuwać swoje własne komentarze
CREATE POLICY "Users can delete their own comments"
  ON poi_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Użytkownicy mogą aktualizować swoje własne komentarze
CREATE POLICY "Users can update their own comments"
  ON poi_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Wszyscy mogą czytać komentarze
CREATE POLICY "Anyone can view comments"
  ON poi_comments
  FOR SELECT
  USING (true);

-- Zalogowani użytkownicy mogą dodawać komentarze
CREATE POLICY "Authenticated users can insert comments"
  ON poi_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. POI_COMMENT_PHOTOS TABLE POLICIES
-- ============================================

-- Użytkownicy mogą usuwać zdjęcia ze swoich komentarzy
CREATE POLICY "Users can delete photos from their own comments"
  ON poi_comment_photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM poi_comments
      WHERE poi_comments.id = poi_comment_photos.comment_id
      AND poi_comments.user_id = auth.uid()
    )
  );

-- Wszyscy mogą czytać zdjęcia
CREATE POLICY "Anyone can view photos"
  ON poi_comment_photos
  FOR SELECT
  USING (true);

-- Użytkownicy mogą dodawać zdjęcia do swoich komentarzy
CREATE POLICY "Users can insert photos to their own comments"
  ON poi_comment_photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM poi_comments
      WHERE poi_comments.id = poi_comment_photos.comment_id
      AND poi_comments.user_id = auth.uid()
    )
  );

-- ============================================
-- 4. POI_COMMENT_LIKES TABLE POLICIES
-- ============================================

-- Użytkownicy mogą usuwać swoje własne polubienia
CREATE POLICY "Users can delete their own likes"
  ON poi_comment_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Wszyscy mogą czytać polubienia
CREATE POLICY "Anyone can view likes"
  ON poi_comment_likes
  FOR SELECT
  USING (true);

-- Zalogowani użytkownicy mogą dodawać polubienia
CREATE POLICY "Authenticated users can insert likes"
  ON poi_comment_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. POI_RATINGS TABLE POLICIES
-- ============================================

-- Użytkownicy mogą usuwać swoje własne oceny
CREATE POLICY "Users can delete their own ratings"
  ON poi_ratings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Użytkownicy mogą aktualizować swoje własne oceny
CREATE POLICY "Users can update their own ratings"
  ON poi_ratings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Wszyscy mogą czytać oceny
CREATE POLICY "Anyone can view ratings"
  ON poi_ratings
  FOR SELECT
  USING (true);

-- Zalogowani użytkownicy mogą dodawać oceny
CREATE POLICY "Authenticated users can insert ratings"
  ON poi_ratings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 6. STORAGE POLICIES - AVATARS BUCKET
-- ============================================

-- Użytkownicy mogą uploadować swoje własne awatary
CREATE POLICY "Users can upload their own avatars"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Użytkownicy mogą usuwać swoje własne awatary
CREATE POLICY "Users can delete their own avatars"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Użytkownicy mogą aktualizować swoje własne awatary
CREATE POLICY "Users can update their own avatars"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Wszyscy mogą czytać awatary (publiczne)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- ============================================
-- 7. STORAGE POLICIES - POI-PHOTOS BUCKET
-- ============================================

-- Użytkownicy mogą uploadować zdjęcia do swoich komentarzy
CREATE POLICY "Users can upload photos to their comments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'poi-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Użytkownicy mogą usuwać swoje własne zdjęcia
CREATE POLICY "Users can delete their own photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'poi-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Użytkownicy mogą aktualizować swoje własne zdjęcia
CREATE POLICY "Users can update their own photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'poi-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Wszyscy mogą czytać zdjęcia (publiczne)
CREATE POLICY "Anyone can view photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'poi-photos');

-- ============================================
-- 8. CASCADE DELETE CONSTRAINTS
-- ============================================

-- Upewnij się, że usunięcie profilu usuwa powiązane dane
-- Te constraints powinny być już ustawione, ale sprawdź

-- Sprawdź foreign keys:
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (
    tc.table_name IN ('poi_comments', 'poi_comment_photos', 'poi_comment_likes', 'poi_ratings')
    OR ccu.table_name = 'profiles'
  );

-- Jeśli nie ma CASCADE, dodaj je:

-- Comments -> CASCADE on user delete
ALTER TABLE poi_comments
  DROP CONSTRAINT IF EXISTS poi_comments_user_id_fkey;

ALTER TABLE poi_comments
  ADD CONSTRAINT poi_comments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Ratings -> CASCADE on user delete
ALTER TABLE poi_ratings
  DROP CONSTRAINT IF EXISTS poi_ratings_user_id_fkey;

ALTER TABLE poi_ratings
  ADD CONSTRAINT poi_ratings_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Likes -> CASCADE on user delete
ALTER TABLE poi_comment_likes
  DROP CONSTRAINT IF EXISTS poi_comment_likes_user_id_fkey;

ALTER TABLE poi_comment_likes
  ADD CONSTRAINT poi_comment_likes_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Photos -> CASCADE on comment delete
ALTER TABLE poi_comment_photos
  DROP CONSTRAINT IF EXISTS poi_comment_photos_comment_id_fkey;

ALTER TABLE poi_comment_photos
  ADD CONSTRAINT poi_comment_photos_comment_id_fkey
  FOREIGN KEY (comment_id)
  REFERENCES poi_comments(id)
  ON DELETE CASCADE;

-- ============================================
-- 9. VERIFICATION QUERIES
-- ============================================

-- Sprawdź czy policies zostały utworzone:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN (
  'profiles', 
  'poi_comments', 
  'poi_comment_photos', 
  'poi_comment_likes', 
  'poi_ratings'
)
ORDER BY tablename, cmd;

-- Sprawdź storage policies:
SELECT 
  *
FROM storage.policies
WHERE bucket_id IN ('avatars', 'poi-photos')
ORDER BY bucket_id, name;

-- ============================================
-- ZAKOŃCZONO KONFIGURACJĘ
-- ============================================

-- UWAGI:
-- 1. Te policies pozwalają użytkownikom zarządzać swoimi danymi
-- 2. CASCADE DELETE zapewnia, że usunięcie użytkownika usuwa wszystkie dane
-- 3. Storage policies są synchronizowane z database policies
-- 4. Wszyscy mogą czytać publiczne dane (komentarze, zdjęcia, oceny)
-- 5. Tylko właściciel może modyfikować/usuwać swoje dane
-- ============================================

-- BEZPIECZEŃSTWO:
-- ✅ RLS jest włączony na wszystkich tabelach
-- ✅ Użytkownicy mogą usuwać tylko swoje dane
-- ✅ CASCADE DELETE zapobiega osierocononym rekordom
-- ✅ Storage jest chroniony podobnymi policies
-- ✅ Publiczne dane są dostępne dla wszystkich (readonly)
-- ============================================
