import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const sb = createClient(
  'https://daoohnbnnowmmcizgvrq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb29obmJubm93bW1jaXpndnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjkwNDksImV4cCI6MjA3NjM0NTA0OX0.AJrmxrk18yWxL1_Ejk_SZ1-X04YxN4C8LXCn9c3yFSM',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
)
