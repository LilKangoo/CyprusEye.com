-- Add total_price column to trip_bookings

ALTER TABLE trip_bookings 
ADD COLUMN IF NOT EXISTS total_price numeric(10,2);

COMMENT ON COLUMN trip_bookings.total_price IS 'Calculated total price at time of booking';
