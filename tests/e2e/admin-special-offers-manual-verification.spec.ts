import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';
const OFFER_ID = '4c38a187-8a68-4eb0-9b46-1cd923e06d31';

async function prepareManualVerificationStub(page: Page) {
  await page.addInitScript(({ adminId, offerId }) => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();

        const adminProfile = {
          id: adminId,
          email: 'lilkangoomedia@gmail.com',
          name: 'CyprusEye Admin',
          username: 'cyadmin',
          is_admin: true,
          xp: 100,
          level: 5,
        };

        stub.seedUser({ email: adminProfile.email, password: 'secret', profile: adminProfile });
        stub.setSession({ id: adminId, email: adminProfile.email, user_metadata: { username: 'cyadmin' } });
        stub.seedTable('profiles', [adminProfile]);
        stub.seedTable('admin_users_overview', [{ ...adminProfile, created_at: '2026-07-01T12:00:00.000Z', updated_at: '2026-07-01T12:00:00.000Z', banned_until: null }]);
        stub.seedTable('admin_system_diagnostics', [{ metric: 'total_users', value: 1, description: 'Total users' }]);

        stub.seedTable('special_offers', [{
          id: offerId,
          slug: 'lefkara-giveaway-2026',
          type: 'contest',
          winner_selection_mode: 'manual_selection',
          status: 'draft',
          visibility: 'private',
          start_at: '2026-07-14T21:00:00.000Z',
          end_at: '2026-09-15T20:59:00.000Z',
          winner_announce_at: '2026-09-20T09:00:00.000Z',
          timezone: 'Asia/Nicosia',
          requires_login: true,
          requires_form: true,
          requires_manual_approval: true,
          allow_multiple_entries: false,
          max_entries_per_user: 1,
          allow_bonus_points: true,
          exclude_admins: true,
          exclude_partners: false,
          public_winner_display: false,
          response_deadline_days: 7,
          settings_json: {},
        }]);
        stub.seedTable('special_offer_translations', [{
          id: 'translation-pl',
          offer_id: offerId,
          lang: 'pl',
          title: 'Wygraj 3 dni w Lefkarze + auto na 3 dni',
          short_description: 'Konkurs Lefkara.',
          faq_json: [],
        }]);
        stub.seedTable('special_offer_prizes', []);
        stub.seedTable('special_offer_prize_translations', []);
        stub.seedTable('special_offer_links', []);
        stub.seedTable('special_offer_link_translations', []);
        stub.seedTable('special_offer_form_fields', []);
        stub.seedTable('special_offer_form_field_translations', []);

        stub.seedTable('special_offer_entries', [{
          id: 'entry-approved',
          offer_id: offerId,
          user_id: 'user-1',
          status: 'approved',
          submitted_lang: 'en',
          normalized_email: 'anna@example.com',
          first_name: 'Anna',
          last_name: 'Tester',
          phone: '+357 99123456',
          answers_json: {},
          form_snapshot_json: { fields: [] },
          client_submission_id: '00000000-0000-4000-8000-000000000001',
          reference: 'SO-LEF-0001',
          reviewed_at: '2026-07-20T11:00:00.000Z',
          reviewed_by: adminId,
          review_note: 'Accepted',
          rejection_reason: null,
          created_at: '2026-07-20T10:00:00.000Z',
          updated_at: '2026-07-20T11:00:00.000Z',
        }]);
        stub.seedTable('special_offer_entry_answers', []);

        stub.seedTable('special_offer_official_posts', [
          {
            id: 'post-1',
            offer_id: offerId,
            post_order: 1,
            week_number: 1,
            admin_title: 'Week 1 Facebook post',
            platform: 'facebook',
            official_url: 'https://facebook.com/cypruseye/posts/1',
            external_post_id: 'fb-1',
            published_at: '2026-07-20T10:00:00.000Z',
            comment_deadline_at: '2026-07-21T10:00:00.000Z',
            active: true,
            created_by: adminId,
            updated_by: adminId,
            created_at: '2026-07-20T09:00:00.000Z',
            updated_at: '2026-07-20T09:00:00.000Z',
          },
          {
            id: 'post-unused',
            offer_id: offerId,
            post_order: 9,
            week_number: 9,
            admin_title: 'Unused inactive test post',
            platform: 'facebook',
            official_url: 'https://facebook.com/cypruseye/posts/unused',
            external_post_id: 'fb-unused',
            published_at: '2026-07-20T10:00:00.000Z',
            comment_deadline_at: '2026-07-21T10:00:00.000Z',
            active: false,
            created_by: adminId,
            updated_by: adminId,
            created_at: '2026-07-20T09:00:00.000Z',
            updated_at: '2026-07-20T09:00:00.000Z',
          },
        ]);
        stub.seedTable('special_offer_entry_activities', [
          {
            id: 'activity-share',
            offer_id: offerId,
            entry_id: 'entry-approved',
            official_post_id: 'post-1',
            activity_type: 'share',
            evidence_url: 'https://facebook.com/share/1',
            evidence_text: 'Shared on profile',
            participant_reported_at: '2026-07-20T12:00:00.000Z',
            verified_activity_at: null,
            status: 'pending',
            points_awarded: 0,
            verified_at: null,
            verified_by: null,
            review_note: null,
            rejection_reason: null,
            created_by: 'user-1',
            client_submission_id: '11111111-1111-4111-8111-111111111111',
            created_at: '2026-07-20T12:00:00.000Z',
            updated_at: '2026-07-20T12:00:00.000Z',
          },
          {
            id: 'activity-comment',
            offer_id: offerId,
            entry_id: 'entry-approved',
            official_post_id: 'post-1',
            activity_type: 'comment',
            evidence_url: 'https://facebook.com/comment/1',
            evidence_text: 'A useful comment',
            participant_reported_at: '2026-07-20T12:30:00.000Z',
            verified_activity_at: null,
            status: 'pending',
            points_awarded: 0,
            verified_at: null,
            verified_by: null,
            review_note: null,
            rejection_reason: null,
            created_by: 'user-1',
            client_submission_id: '22222222-2222-4222-8222-222222222222',
            created_at: '2026-07-20T12:30:00.000Z',
            updated_at: '2026-07-20T12:30:00.000Z',
          },
        ]);
        stub.seedTable('special_offer_audit_log', [{
          id: 'audit-activity-claim',
          offer_id: offerId,
          actor_id: 'user-1',
          action: 'activity_claimed',
          entity_type: 'special_offer_entry_activity',
          entity_id: 'activity-share',
          old_value: null,
          new_value: { status: 'pending' },
          metadata: { entry_id: 'entry-approved', official_post_id: 'post-1', activity_type: 'share' },
          created_at: '2026-07-20T12:00:00.000Z',
        }]);

        const scoreSummary = () => {
          const activities = stub.getTableRows('special_offer_entry_activities');
          const approved = activities.filter((row: any) => row.entry_id === 'entry-approved' && row.status === 'approved' && row.points_awarded === 1);
          const sharePoints = approved.filter((row: any) => row.activity_type === 'share').length;
          const commentPoints = approved.filter((row: any) => row.activity_type === 'comment').length;
          return [{
            offer_id: offerId,
            entry_id: 'entry-approved',
            reference: 'SO-LEF-0001',
            entry_status: 'approved',
            base_points: 1,
            share_points: sharePoints,
            comment_points: commentPoints,
            bonus_points: sharePoints + commentPoints,
            total_points: 1 + sharePoints + commentPoints,
            approved_activity_count: approved.length,
          }];
        };

        stub.setRpcHandler('special_offer_entry_score_summary', () => ({ data: scoreSummary(), error: null }));

        stub.setRpcHandler('admin_upsert_special_offer_official_post', (params: any, helpers: any) => {
          const rows = helpers.getTableRows('special_offer_official_posts');
          if (!/^https?:\/\//i.test(params.p_official_url || '')) {
            return { data: null, error: { message: 'invalid_official_url' } };
          }
          const duplicate = rows.find((row: any) => row.offer_id === params.p_offer_id && row.official_url === params.p_official_url && row.id !== params.p_post_id);
          if (duplicate) return { data: null, error: { message: 'duplicate_official_url' } };
          const existingIndex = rows.findIndex((row: any) => row.id === params.p_post_id);
          const id = params.p_post_id || `post-${rows.length + 1}`;
          const payload = {
            id,
            offer_id: params.p_offer_id,
            post_order: params.p_post_order,
            week_number: params.p_week_number,
            admin_title: params.p_admin_title,
            platform: params.p_platform,
            official_url: params.p_official_url,
            external_post_id: params.p_external_post_id,
            published_at: params.p_published_at,
            comment_deadline_at: params.p_comment_deadline_at || '2026-07-21T10:00:00.000Z',
            active: params.p_active !== false,
            created_by: adminId,
            updated_by: adminId,
            created_at: '2026-07-22T10:00:00.000Z',
            updated_at: '2026-07-22T10:00:00.000Z',
          };
          if (existingIndex >= 0) rows[existingIndex] = { ...rows[existingIndex], ...payload };
          else rows.push(payload);
          helpers.setTableRows('special_offer_official_posts', rows);
          return { data: [{ official_post_id: id, offer_id: params.p_offer_id, post_order: params.p_post_order, active: payload.active, action: existingIndex >= 0 ? 'updated' : 'created' }], error: null };
        });

        stub.setRpcHandler('admin_deactivate_special_offer_official_post', (params: any, helpers: any) => {
          const rows = helpers.getTableRows('special_offer_official_posts');
          const post = rows.find((row: any) => row.id === params.p_post_id);
          if (!post) return { data: null, error: { message: 'official_post_not_found' } };
          const wasInactive = post.active === false;
          post.active = false;
          post.updated_at = '2026-07-22T11:00:00.000Z';
          helpers.setTableRows('special_offer_official_posts', rows);
          return { data: [{ official_post_id: post.id, offer_id: post.offer_id, active: false, idempotent: wasInactive }], error: null };
        });

        stub.setRpcHandler('admin_delete_special_offer_official_post', (params: any, helpers: any) => {
          const rows = helpers.getTableRows('special_offer_official_posts');
          const activities = helpers.getTableRows('special_offer_entry_activities');
          const post = rows.find((row: any) => row.id === params.p_official_post_id);
          if (!post) return { data: null, error: { message: 'official_post_not_found', code: 'P0001' } };
          if (!params.p_reason) return { data: null, error: { message: 'delete_reason_required', code: '23514' } };
          if (params.p_expected_admin_title !== post.admin_title) return { data: null, error: { message: 'official_post_title_mismatch', code: '23514' } };
          if (post.active) return { data: null, error: { message: 'official_post_must_be_inactive', code: '23514' } };
          const activityCount = activities.filter((activity: any) => activity.official_post_id === post.id).length;
          if (activityCount > 0) return { data: null, error: { message: 'official_post_has_activities', code: '23514' } };
          helpers.setTableRows('special_offer_official_posts', rows.filter((row: any) => row.id !== post.id));
          const audit = helpers.getTableRows('special_offer_audit_log');
          audit.unshift({
            id: `audit-post-delete-${audit.length + 1}`,
            offer_id: post.offer_id,
            actor_id: adminId,
            action: 'official_post_hard_deleted',
            entity_type: 'special_offer_official_post',
            entity_id: post.id,
            old_value: { active: post.active, post_order: post.post_order, week_number: post.week_number },
            new_value: { deleted: true },
            metadata: { official_post_id: post.id, post_order: post.post_order, week_number: post.week_number, activity_count: 0, reason_present: true },
            created_at: '2026-07-22T13:00:00.000Z',
          });
          helpers.setTableRows('special_offer_audit_log', audit);
          return { data: [{ official_post_id: post.id, deleted: true, activity_count: 0 }], error: null };
        });

        stub.setRpcHandler('review_special_offer_activity', (params: any, helpers: any) => {
          const rows = helpers.getTableRows('special_offer_entry_activities');
          const activity = rows.find((row: any) => row.id === params.p_activity_id);
          if (!activity) return { data: null, error: { message: 'activity_not_found' } };
          const previous = activity.status;
          if (previous !== params.p_new_status) {
            activity.status = params.p_new_status;
            activity.points_awarded = params.p_new_status === 'approved' ? 1 : 0;
            activity.verified_activity_at = params.p_verified_activity_at || null;
            activity.verified_at = '2026-07-22T12:00:00.000Z';
            activity.verified_by = adminId;
            activity.review_note = params.p_review_note || null;
            activity.rejection_reason = ['rejected', 'invalid'].includes(params.p_new_status) ? params.p_rejection_reason : null;
            helpers.setTableRows('special_offer_entry_activities', rows);
            const audit = helpers.getTableRows('special_offer_audit_log');
            audit.unshift({
              id: `audit-activity-${audit.length + 1}`,
              offer_id: activity.offer_id,
              actor_id: adminId,
              action: 'activity_reviewed',
              entity_type: 'special_offer_entry_activity',
              entity_id: activity.id,
              old_value: { status: previous, points_awarded: 0 },
              new_value: { status: activity.status, points_awarded: activity.points_awarded },
              metadata: {
                entry_id: activity.entry_id,
                official_post_id: activity.official_post_id,
                activity_type: activity.activity_type,
                review_note_present: Boolean(params.p_review_note),
                rejection_reason_present: Boolean(activity.rejection_reason),
              },
              created_at: '2026-07-22T12:00:00.000Z',
            });
            helpers.setTableRows('special_offer_audit_log', audit);
          }
          return { data: [{ activity_id: activity.id, previous_status: previous, status: activity.status, points_awarded: activity.points_awarded, verified_at: activity.verified_at, verified_by: activity.verified_by, idempotent: previous === params.p_new_status }], error: null };
        });
      },
    };
  }, { adminId: ADMIN_ID, offerId: OFFER_ID });
}

async function openManualVerification(page: Page) {
  await prepareManualVerificationStub(page);
  await page.goto('/admin/dashboard.html');
  await waitForSupabaseStub(page);
  await page.click('button.admin-nav-item[data-view="specialOffers"]');
  await expect(page.locator('#viewSpecialOffers')).toBeVisible();
  await page.getByRole('button', { name: 'Open manual verification' }).click();
  await expect(page.locator('#specialOffersManualVerificationModal')).toBeVisible();
}

test.describe('Admin Special Offers manual verification', () => {
  test('opens official posts and activity queue with manual-selection notice', async ({ page }) => {
    await openManualVerification(page);
    const modal = page.locator('#specialOffersManualVerificationModal');

    await expect(modal).toContainText('Manual selection remains active');
    await expect(modal).toContainText('Week 1 Facebook post');
    await expect(modal).toContainText('SO-LEF-0001');
    await expect(modal).toContainText('Share');
    await expect(modal).toContainText('Comment');
    await expect(modal).toContainText('Pending');
  });

  test('adds, edits, deactivates and safely deletes unused inactive official posts through RPC only', async ({ page }) => {
    await openManualVerification(page);
    const modal = page.locator('#specialOffersManualVerificationModal');

    await expect(modal).toContainText('Unused inactive test post');
    await expect(modal.locator('[data-special-offers-post-delete="post-unused"]')).toBeVisible();

    await modal.locator('[data-special-offers-post-new]').click();
    await modal.locator('[name="admin_title"]').fill('Week 2 Facebook post');
    await modal.locator('[name="official_url"]').fill('https://facebook.com/cypruseye/posts/2');
    await modal.locator('[name="post_order"]').fill('2');
    await modal.locator('[name="week_number"]').fill('2');
    await modal.locator('[name="published_at"]').fill('2026-07-27T10:00');
    await modal.locator('[name="comment_deadline_at"]').fill('2026-07-28T10:00');
    await modal.locator('[data-special-offers-post-form]').getByRole('button', { name: 'Save official post' }).click();
    await expect(modal).toContainText('Week 2 Facebook post');

    page.once('dialog', (dialog) => dialog.accept());
    await modal.locator('[data-special-offers-post-deactivate="post-1"]').click();
    await expect(modal).toContainText('Delete unavailable');

    await modal.locator('[data-special-offers-post-delete="post-unused"]').click();
    const deleteModal = page.locator('#specialOfferOfficialPostDeleteModal');
    await expect(deleteModal).toBeVisible();
    await deleteModal.getByRole('button', { name: 'Close official post delete' }).click();
    await expect(deleteModal).toBeHidden();

    await modal.locator('[data-special-offers-post-delete="post-unused"]').click();
    await deleteModal.locator('[name="delete_reason"]').fill('Cleanup unused test post');
    await deleteModal.locator('[name="expected_admin_title"]').fill('Unused inactive test post');
    page.once('dialog', (dialog) => dialog.accept());
    await deleteModal.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(deleteModal).toBeHidden();
    await expect(modal).not.toContainText('Unused inactive test post');

    const rpcCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    expect(rpcCalls.some((call: any) => call.name === 'admin_upsert_special_offer_official_post')).toBeTruthy();
    expect(rpcCalls.some((call: any) => call.name === 'admin_deactivate_special_offer_official_post')).toBeTruthy();
    expect(rpcCalls.some((call: any) => call.name === 'admin_delete_special_offer_official_post')).toBeTruthy();

    const source = await page.evaluate(async () => (await fetch('/admin/special-offers.js')).text());
    expect(source).not.toMatch(/from\(['"]special_offer_official_posts['"]\)\.(insert|update|delete|upsert)/);
    expect(source).not.toMatch(/from\(['"]special_offer_entry_activities['"]\)\.(insert|update|delete|upsert)/);
  });

  test('blocks invalid comment timing and approves share through review RPC with score refresh', async ({ page }) => {
    await openManualVerification(page);
    await page.locator('[data-special-offers-activity-detail="activity-comment"]').click();
    const detail = page.locator('#specialOfferActivityDetailModal');

    await expect(detail).toBeVisible();
    await expect(detail).toContainText('A useful comment');
    await detail.getByRole('button', { name: 'Approve' }).click();
    await detail.locator('[name="verified_activity_at"]').fill('');
    await detail.locator('[data-special-offers-activity-review-submit="approved"]').click();
    await expect(detail.locator('[data-special-offers-activity-review-form]')).toBeVisible();

    await detail.locator('[name="verified_activity_at"]').fill('2026-07-22T11:00');
    await detail.locator('[data-special-offers-activity-review-submit="approved"]').click();
    await expect(detail.locator('[data-special-offers-activity-review-form]')).toBeVisible();

    await page.locator('button[data-special-offers-activity-detail-close]').click();
    await page.locator('[data-special-offers-activity-detail="activity-share"]').click();
    await expect(detail).toContainText('Shared on profile');
    await detail.getByRole('button', { name: 'Approve' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await detail.locator('[data-special-offers-activity-review-submit="approved"]').click();

    await expect(detail).toContainText('Approved');
    await expect(detail).toContainText('Share points');
    await expect(detail).toContainText('Total points');
    await expect(detail).toContainText('activity_reviewed');

    const rpcCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    const reviewCalls = rpcCalls.filter((call: any) => call.name === 'review_special_offer_activity');
    expect(reviewCalls).toHaveLength(1);
    expect(reviewCalls[0].params).toMatchObject({
      p_activity_id: 'activity-share',
      p_new_status: 'approved',
    });
  });

  test('entry details show activity score and open activity detail', async ({ page }) => {
    await openManualVerification(page);
    await page.locator('[data-special-offers-activity-detail="activity-share"]').click();
    await expect(page.locator('#specialOfferActivityDetailModal')).toBeVisible();

    await page.locator('button[data-special-offers-activity-detail-close]').click();
    await page.locator('button[data-special-offers-manual-close]').click();
    await page.getByRole('button', { name: 'Open entries' }).click();
    await page.locator('[data-special-offers-entry-detail="entry-approved"]').click();
    const entryDetail = page.locator('#specialOfferEntryDetailsModal');
    await expect(entryDetail).toContainText('Activity & Points');
    await expect(entryDetail).toContainText('Base points');
    await expect(entryDetail).toContainText('Week 1 Facebook post');
    await entryDetail.locator('[data-special-offers-activity-detail="activity-share"]').click();
    await expect(page.locator('#specialOfferActivityDetailModal')).toBeVisible();
  });
});
