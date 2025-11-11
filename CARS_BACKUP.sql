-- =====================================================
-- CARS BACKUP - STEP 1
-- Backup tabeli car_offers przed migracją
-- =====================================================

-- 1. Utwórz backup table
CREATE TABLE IF NOT EXISTS car_offers_backup AS 
SELECT * FROM car_offers;

-- 2. Sprawdź czy backup się udał
SELECT 
  (SELECT COUNT(*) FROM car_offers) as original_count,
  (SELECT COUNT(*) FROM car_offers_backup) as backup_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM car_offers) = (SELECT COUNT(*) FROM car_offers_backup)
    THEN '✅ Backup successful - counts match'
    ELSE '❌ Backup FAILED - counts do NOT match'
  END as status;

-- 3. Pokaż przykładowe dane z backupu
SELECT 
  id,
  location,
  car_type,
  car_model,
  LEFT(description, 50) as description_preview
FROM car_offers_backup
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- ВАЖНО! JEŚLI COS PÓJDZIE ŹLE, RESTORE Z:
-- =====================================================
-- DROP TABLE car_offers;
-- CREATE TABLE car_offers AS SELECT * FROM car_offers_backup;
-- =====================================================
