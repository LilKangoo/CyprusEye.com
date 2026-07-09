# Special Offers Lefkara Soft Launch Checklist

Use this checklist after the release candidate is deployed. Do not promote the
campaign publicly until every blocker is resolved.

## 1. Before Deploy

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Confirm all release files are included in the deploy branch. | Public, admin, dist, tests and manual SQL files are present. |  |  |  |
| Confirm no service role key is exposed in frontend files. | Only the public anon key is bundled. |  |  |  |
| Confirm Lefkara dates are final. | `start_at=2025-07-15 00:00:00 Europe/Nicosia` and `end_at=2026-09-15 23:59:59 Europe/Nicosia` are owner-approved. |  |  |  |
| Confirm legal/rules/privacy links. | Rules, privacy policy and organizer details are visible and approved by owner. |  |  |  |

## 2. Deploy

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Deploy the release candidate. | Cloudflare Pages deploy succeeds. |  |  |  |
| Open `/special-offers/lefkara-giveaway-2026?lang=pl`. | Draft/private campaign is not publicly joinable before activation. |  |  |  |
| Open admin Special Offers. | Entries and Manual Verification panels load. |  |  |  |

## 3. Supabase Auth Config

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Set Site URL. | `https://cypruseye.com` is configured. |  |  |  |
| Add auth callback URL. | `https://cypruseye.com/auth/callback` is allowed. |  |  |  |
| Add campaign return URLs. | Exact Lefkara PL/EN/HE clean URLs are allowed, or a confirmed safe Supabase glob is used. |  |  |  |
| Confirm email confirmation is enabled. | Signup requires email confirmation. |  |  |  |
| Confirm production email template. | Confirmation link points back to the production origin, not localhost. |  |  |  |

## 4. Preflight SQL

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Run `supabase/manual/special_offer_lefkara_launch_preflight.sql`. | Query is read-only and returns one row. |  |  |  |
| Check `safe_to_activate`. | `true`. |  |  |  |
| Check `activation_structure_ready`. | `true`. |  |  |  |
| Check `dates_present_and_valid`. | `true`; owner confirms these dates are final. |  |  |  |
| Check `entry_collection_currently_ready`. | Usually `false` before activation; must become `true` after activation and inside date window. |  |  |  |
| Check `activity_claims_currently_ready`. | Can be `false` until at least one active official post exists. |  |  |  |
| Check manual gates. | Auth Redirect URLs and legal/privacy/rules are confirmed outside SQL. |  |  |  |
| If not yet applied, run activity date guard patch and verify. | `special_offer_activity_claim_date_guard_stage1_verify.sql` returns `overall_pass=true`. |  |  |  |

## 5. Admin Activation

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Open Lefkara in Admin Special Offers. | Campaign editor shows status, visibility, start and end fields. |  |  |  |
| Set final dates. | Start is `2025-07-15 00:00`; end is `2026-09-15 23:59` in Cyprus local time after reopening the editor. |  |  |  |
| Set status and visibility. | `status=active`, `visibility=public`; publish confirmation is shown before save. |  |  |  |
| Save campaign. | Campaign starts accepting main entries immediately because the current date is inside the configured window. |  |  |  |
| Optional fallback only. | `special_offer_lefkara_activate_stage1.sql` is not required when Admin activation succeeds; use only as reviewed emergency fallback. |  |  |  |

## 6. Activation Verify

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Run `supabase/manual/special_offer_lefkara_activate_stage1_verify.sql`. | `overall_pass=true`. |  |  |  |
| Confirm configured activation. | `activation_configured=true`. |  |  |  |
| Confirm entry collection readiness. | `entry_collection_currently_ready=true`. |  |  |  |
| Confirm activity readiness. | `activity_claims_currently_ready=true` only after at least one active official post exists. |  |  |  |
| Confirm full promotion readiness. | `full_promotion_ready=false` is acceptable until official posts and activity smoke tests are complete. |  |  |  |
| Confirm no draw/winner tables exist. | `no_winner_draw_tables=true`. |  |  |  |

## 7. Incognito Test

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Open clean PL URL in incognito. | Public page is visible. |  |  |  |
| Check canonical. | Canonical uses `/special-offers/lefkara-giveaway-2026?lang=pl`. |  |  |  |
| Check form locked state. | Anonymous user sees CTA/auth gate, not active form fields. |  |  |  |

## 8. User A Test

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Register User A. | Confirmation email is sent. |  |  |  |
| Confirm email. | User returns to the campaign and session is established. |  |  |  |
| Submit entry. | Success state shows a reference; no raw SQL errors are visible. |  |  |  |
| Refresh page. | User remains signed in and sees own activity section. |  |  |  |

## 9. Admin Test

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Open Entries. | User A entry is visible. |  |  |  |
| Open full form. | Snapshot labels and answers are read-only. |  |  |  |
| Approve entry. | Review RPC succeeds and audit row appears. |  |  |  |
| Add official post if missing. | Official post RPC succeeds. |  |  |  |
| Confirm entry collection is not blocked by missing posts. | Entries can be collected even when no official post exists. |  |  |  |

## 10. User B Isolation Test

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Register/confirm User B. | User B has separate authenticated session. |  |  |  |
| Open activity section. | User B cannot see User A entry, activity or score. |  |  |  |
| Attempt foreign entry claim manually. | Backend rejects ownership violation. |  |  |  |

## 11. Activity Claim Test

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| User A submits share evidence. | Claim is pending and saved through RPC. |  |  |  |
| User A submits comment evidence. | Claim is pending; UI explains manual verification. |  |  |  |
| Double-click submit. | Only one RPC result/claim is created. |  |  |  |
| No official posts state. | User sees a friendly message that bonus tasks will appear later; it is not treated as an entry form error. |  |  |  |

## 12. Score Test

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Admin approves share. | User score gains 1 share point. |  |  |  |
| Admin approves comment within deadline. | User score gains 1 comment point. |  |  |  |
| Check public page. | User sees own total only; no public ranking appears. |  |  |  |

## 13. Logout / Session Test

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Logout. | Private entry/activity/score data disappear from the DOM. |  |  |  |
| Try claim while logged out. | Auth modal opens and RPC is not called. |  |  |  |

## 14. SEO / Canonical Test

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Inspect canonical. | Clean route canonical is present. |  |  |  |
| Inspect hreflang. | PL/EN/HE alternates are present on page. |  |  |  |
| Check sitemap after activation. | Active/public campaign appears only when within launch window and global sitemap language rollout permits it. |  |  |  |

## 15. Mobile PL/EN/HE Test

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Test PL mobile. | No horizontal overflow. |  |  |  |
| Test EN mobile. | No horizontal overflow. |  |  |  |
| Test HE mobile. | RTL layout works. |  |  |  |

## 16. Monitoring First Entries

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Check new entries. | Entries have `user_id` and confirmed-email ownership. |  |  |  |
| Check pending reviews. | Admin queue shows pending entries/activities. |  |  |  |
| Check score anomalies. | No participant has duplicate points for one activity type/post. |  |  |  |
| Check auth errors. | No repeated confirmation or redirect failures. |  |  |  |

## 17. Emergency Pause

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Run `supabase/manual/special_offer_lefkara_emergency_pause.sql` only if needed. | Campaign becomes `locked/private`; data remains. |  |  |  |
| Run pause verify. | `overall_pass=true`. |  |  |  |
| Confirm admin review. | Existing entries and activities remain reviewable. |  |  |  |

## 18. GO / NO-GO

| Step | Expected result | Actual result | Pass/Fail | Blocker |
|---|---|---|---|---|
| Soft launch decision. | No critical blockers remain. |  |  |  |
| Public promotion decision. | Several real entries and reviews completed successfully. |  |  |  |
