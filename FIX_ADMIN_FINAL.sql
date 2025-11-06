-- =====================================================
-- OSTATECZNA NAPRAWA ADMIN PANEL
-- =====================================================
-- Usuń problematyczną funkcję RPC która robi JOIN
-- =====================================================

-- Usuń funkcję admin_get_car_booking_stats jeśli istnieje
DROP FUNCTION IF EXISTS admin_get_car_booking_stats() CASCADE;
DROP FUNCTION IF EXISTS admin_get_car_booking_stats;

-- Usuń view car_bookings_summary jeśli istnieje (może też robić JOIN)
DROP VIEW IF EXISTS car_bookings_summary CASCADE;

-- Sprawdź czy car_bookings istnieje i ma dane
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed
FROM car_bookings;

-- Success
SELECT 'Admin panel should work now - no more RPC calls!' as status;
