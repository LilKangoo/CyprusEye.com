begin;

-- Stage 9: keep system inserts, but replace unrestricted true checks.
--
-- Referrals are created by referral/profile automation; notifications are
-- system/community records. These policies preserve insert capability while
-- requiring the minimum valid shape instead of WITH CHECK (true).

drop policy if exists "System can insert referrals" on public.referrals;
create policy "System can insert referrals"
  on public.referrals
  for insert
  with check (
    referrer_id is not null
    and referred_id is not null
    and referrer_id <> referred_id
    and status in ('pending', 'confirmed')
  );

drop policy if exists notifs_insert_any on public.poi_notifications;
create policy notifs_insert_any
  on public.poi_notifications
  for insert
  with check (
    user_id is not null
    and trigger_user_id is not null
    and comment_id is not null
    and user_id <> trigger_user_id
    and notification_type in ('like', 'reply')
    and coalesce(is_read, false) = false
  );

commit;
