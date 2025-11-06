-- =====================================================
-- ADD MESSAGE_SENT STATUS TO CAR BOOKINGS
-- =====================================================
-- Migration to add new statuses to car_bookings table
-- =====================================================

-- Drop old constraint
ALTER TABLE car_bookings DROP CONSTRAINT IF EXISTS valid_status;

-- Add new constraint with additional statuses
ALTER TABLE car_bookings ADD CONSTRAINT valid_status 
  CHECK (status IN ('pending', 'message_sent', 'confirmed', 'active', 'completed', 'cancelled'));

-- Update comment
COMMENT ON COLUMN car_bookings.status IS 'pending: new booking | message_sent: confirmation sent | confirmed: admin confirmed | active: rental in progress | completed: rental finished | cancelled: booking cancelled';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Added message_sent and active statuses to car_bookings table';
END $$;
