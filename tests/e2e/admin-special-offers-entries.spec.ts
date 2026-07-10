import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';
const OFFER_ID = '4c38a187-8a68-4eb0-9b46-1cd923e06d31';

async function prepareAdminEntriesStub(page: Page) {
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
          settings_json: { partner: '7 Kamares' },
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

        const fieldSnapshot = (field_key: string, label: string, field_type = 'text', sort_order = 10) => ({
          field_id: `field-${field_key}`,
          field_key,
          field_type,
          required: true,
          sort_order,
          validation_json: {},
          lang: 'en',
          label,
          placeholder: '',
          help_text: '',
          options_json: [],
        });

        const entries = [
          {
            id: 'entry-pending',
            offer_id: offerId,
            user_id: 'user-1',
            status: 'pending_review',
            submitted_lang: 'en',
            normalized_email: 'anna@example.com',
            first_name: 'Anna',
            last_name: 'Tester',
            phone: '+357 99123456',
            answers_json: {},
            form_snapshot_json: { fields: [] },
            client_submission_id: '00000000-0000-4000-8000-000000000001',
            reference: 'SO-LEF-0001',
            reviewed_at: null,
            reviewed_by: null,
            review_note: null,
            rejection_reason: null,
            created_at: '2026-07-20T10:00:00.000Z',
            updated_at: '2026-07-20T10:00:00.000Z',
          },
          {
            id: 'entry-approved',
            offer_id: offerId,
            user_id: 'user-2',
            status: 'approved',
            submitted_lang: 'pl',
            normalized_email: 'jan@example.com',
            first_name: 'Jan',
            last_name: 'Approved',
            phone: '+48 501234567',
            answers_json: {},
            form_snapshot_json: { fields: [] },
            client_submission_id: '00000000-0000-4000-8000-000000000002',
            reference: 'SO-LEF-0002',
            reviewed_at: '2026-07-21T10:00:00.000Z',
            reviewed_by: adminId,
            review_note: 'Looks good',
            rejection_reason: null,
            created_at: '2026-07-19T10:00:00.000Z',
            updated_at: '2026-07-21T10:00:00.000Z',
          },
        ];
        stub.seedTable('special_offer_entries', entries);
        stub.seedTable('special_offer_entry_answers', [
          { id: 'answer-name', entry_id: 'entry-pending', field_id: 'field-first_name', field_key: 'first_name', value_text: 'Anna', value_json: 'Anna', field_snapshot_json: fieldSnapshot('first_name', 'First name', 'text', 10), created_at: '2026-07-20T10:00:00.000Z' },
          { id: 'answer-email', entry_id: 'entry-pending', field_id: 'field-email', field_key: 'email', value_text: 'anna@example.com', value_json: 'anna@example.com', field_snapshot_json: fieldSnapshot('email', 'Email', 'email', 20), created_at: '2026-07-20T10:00:01.000Z' },
          { id: 'answer-contest', entry_id: 'entry-pending', field_id: 'field-contest_answer', field_key: 'contest_answer', value_text: 'Lefkara is beautiful', value_json: 'Lefkara is beautiful', field_snapshot_json: fieldSnapshot('contest_answer', 'Contest answer', 'contest_answer', 30), created_at: '2026-07-20T10:00:02.000Z' },
          { id: 'answer-shared', entry_id: 'entry-pending', field_id: 'field-shared_post_url', field_key: 'shared_post_url', value_text: 'https://facebook.com/post/123', value_json: 'https://facebook.com/post/123', field_snapshot_json: fieldSnapshot('shared_post_url', 'Shared post URL', 'shared_post_url', 40), created_at: '2026-07-20T10:00:03.000Z' },
          { id: 'answer-danger', entry_id: 'entry-pending', field_id: 'field-facebook_profile_url', field_key: 'facebook_profile_url', value_text: 'javascript:alert(1)', value_json: 'javascript:alert(1)', field_snapshot_json: fieldSnapshot('facebook_profile_url', 'Facebook profile URL', 'facebook_profile_url', 50), created_at: '2026-07-20T10:00:04.000Z' },
          { id: 'answer-consent', entry_id: 'entry-pending', field_id: 'field-terms', field_key: 'terms_accepted', value_text: 'true', value_json: true, field_snapshot_json: fieldSnapshot('terms_accepted', 'I accept rules', 'consent', 60), created_at: '2026-07-20T10:00:05.000Z' },
        ]);
        stub.seedTable('special_offer_official_posts', [{
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
          active: false,
          created_by: adminId,
          updated_by: adminId,
          created_at: '2026-07-20T09:00:00.000Z',
          updated_at: '2026-07-20T09:00:00.000Z',
        }]);
        stub.seedTable('special_offer_entry_activities', [{
          id: 'activity-share',
          offer_id: offerId,
          entry_id: 'entry-pending',
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
        }]);
        stub.seedTable('special_offer_audit_log', [
          {
            id: 'audit-submit',
            offer_id: offerId,
            actor_id: 'user-1',
            action: 'special_offer.entry_submitted',
            entity_type: 'special_offer_entry',
            entity_id: 'entry-pending',
            old_value: null,
            new_value: { status: 'pending_review' },
            metadata: { entry_id: 'entry-pending', reference: 'SO-LEF-0001' },
            created_at: '2026-07-20T10:00:00.000Z',
          },
        ]);

        stub.setRpcHandler('review_special_offer_entry', (params: any, helpers: any) => {
          const rows = helpers.getTableRows('special_offer_entries');
          const entry = rows.find((row: any) => row.id === params.p_entry_id);
          if (!entry) return { data: null, error: { message: 'entry_not_found' } };
          const previous = entry.status;
          if (previous !== params.p_new_status) {
            entry.status = params.p_new_status;
            entry.reviewed_at = '2026-07-22T10:00:00.000Z';
            entry.reviewed_by = adminId;
            entry.review_note = params.p_review_note || null;
            entry.rejection_reason = ['rejected', 'disqualified'].includes(params.p_new_status) ? params.p_rejection_reason : null;
            helpers.setTableRows('special_offer_entries', rows);
            const audit = helpers.getTableRows('special_offer_audit_log');
            audit.unshift({
              id: `audit-${audit.length + 1}`,
              offer_id: entry.offer_id,
              actor_id: adminId,
              action: 'entry_status_reviewed',
              entity_type: 'special_offer_entry',
              entity_id: entry.id,
              old_value: { status: previous },
              new_value: { status: params.p_new_status },
              metadata: {
                entry_id: entry.id,
                reference: entry.reference,
                review_note_present: Boolean(params.p_review_note),
                rejection_reason_present: Boolean(entry.rejection_reason),
              },
              created_at: '2026-07-22T10:00:00.000Z',
            });
            helpers.setTableRows('special_offer_audit_log', audit);
          }
          return {
            data: [{
              entry_id: entry.id,
              reference: entry.reference,
              previous_status: previous,
              status: entry.status,
              reviewed_at: entry.reviewed_at,
              reviewed_by: entry.reviewed_by,
              idempotent: previous === params.p_new_status,
            }],
            error: null,
          };
        });

        stub.setRpcHandler('admin_delete_special_offer_entry', (params: any, helpers: any) => {
          const rows = helpers.getTableRows('special_offer_entries');
          const entry = rows.find((row: any) => row.id === params.p_entry_id);
          if (!entry) return { data: null, error: { message: 'entry_not_found', code: 'P0001' } };
          if (!params.p_reason) return { data: null, error: { message: 'delete_reason_required', code: '23514' } };
          if (params.p_expected_reference !== entry.reference) return { data: null, error: { message: 'entry_reference_mismatch', code: '23514' } };
          const answers = helpers.getTableRows('special_offer_entry_answers');
          const activities = helpers.getTableRows('special_offer_entry_activities');
          const answersDeleted = answers.filter((row: any) => row.entry_id === entry.id).length;
          const activitiesDeleted = activities.filter((row: any) => row.entry_id === entry.id).length;
          helpers.setTableRows('special_offer_entry_answers', answers.filter((row: any) => row.entry_id !== entry.id));
          helpers.setTableRows('special_offer_entry_activities', activities.filter((row: any) => row.entry_id !== entry.id));
          helpers.setTableRows('special_offer_entries', rows.filter((row: any) => row.id !== entry.id));
          return { data: [{ entry_id: entry.id, deleted: true, answers_deleted: answersDeleted, activities_deleted: activitiesDeleted }], error: null };
        });
      },
    };
  }, { adminId: ADMIN_ID, offerId: OFFER_ID });
}

async function openSpecialOffers(page: Page) {
  await prepareAdminEntriesStub(page);
  await page.goto('/admin/dashboard.html');
  await waitForSupabaseStub(page);
  await page.click('button.admin-nav-item[data-view="specialOffers"]');
  await expect(page.locator('#viewSpecialOffers')).toBeVisible();
}

test.describe('Admin Special Offers entries', () => {
  test('opens entries list with counts, filters, search and pagination', async ({ page }) => {
    await openSpecialOffers(page);

    await expect(page.locator('[data-special-offers-stat="entries"]')).toHaveText('1');
    await page.getByRole('button', { name: 'Open entries' }).click();

    const modal = page.locator('#specialOffersEntriesModal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('SO-LEF-0001');
    await expect(modal).toContainText('SO-LEF-0002');
    await expect(modal).toContainText('Pending review');
    await expect(modal).toContainText('Approved');

    await modal.locator('[data-special-offers-entry-status]').selectOption('pending_review');
    await expect(modal).toContainText('SO-LEF-0001');
    await expect(modal).not.toContainText('SO-LEF-0002');

    await modal.locator('[data-special-offers-entry-search]').fill('missing-reference');
    await expect(modal).toContainText('No entries match');
  });

  test('shows entry details, safe answers, audit log and review actions', async ({ page }) => {
    await openSpecialOffers(page);
    await page.getByRole('button', { name: 'Open entries' }).click();
    await page.locator('[data-special-offers-entry-detail="entry-pending"]').click();

    const detail = page.locator('#specialOfferEntryDetailsModal');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('SO-LEF-0001');
    await expect(detail).toContainText('Contest answer');
    await expect(detail).toContainText('Lefkara is beautiful');
    await expect(detail).toContainText('I accept rules');
    await expect(detail.locator('a[href="https://facebook.com/post/123"]')).toBeVisible();
    await expect(detail.locator('a[href^="javascript:"]')).toHaveCount(0);
    await expect(detail).toContainText('special_offer.entry_submitted');

    await expect(detail.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Reject' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Disqualify' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Back to pending review' })).toHaveCount(0);
  });

  test('review decisions use RPC and refresh counts without direct entry update', async ({ page }) => {
    await openSpecialOffers(page);
    await page.getByRole('button', { name: 'Open entries' }).click();
    await page.locator('[data-special-offers-entry-detail="entry-pending"]').click();
    const detail = page.locator('#specialOfferEntryDetailsModal');

    await detail.getByRole('button', { name: 'Reject' }).click();
    await detail.locator('[data-special-offers-review-submit="rejected"]').click();
    await expect(detail.locator('[data-special-offers-review-form]')).toBeVisible();

    await detail.locator('[name="rejection_reason"]').fill('Missing valid proof');
    page.once('dialog', (dialog) => dialog.accept());
    await detail.locator('[data-special-offers-review-submit="rejected"]').click();

    await expect(detail).toContainText('Rejected');
    await expect(detail).toContainText('Missing valid proof');
    await expect(page.locator('#specialOffersEntriesModal')).toContainText('Rejected');

    const rpcCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    const reviewCalls = rpcCalls.filter((call: any) => call.name === 'review_special_offer_entry');
    expect(reviewCalls).toHaveLength(1);
    expect(reviewCalls[0].params).toMatchObject({
      p_entry_id: 'entry-pending',
      p_new_status: 'rejected',
      p_rejection_reason: 'Missing valid proof',
    });

    const source = await page.evaluate(async () => (await fetch('/admin/special-offers.js')).text());
    expect(source).not.toMatch(/from\(['"]special_offer_entries['"]\)\.update/);
    expect(source).not.toMatch(/from\(['"]special_offer_entry_answers['"]\)\.(insert|update|delete|upsert)/);
    expect(source).not.toContain('special_offer_tasks');
    expect(source).not.toContain('special_offer_draws');
    expect(source).not.toContain('special_offer_winners');
  });

  test('hard delete uses RPC, removes linked entry data and avoids direct table delete', async ({ page }) => {
    await openSpecialOffers(page);
    await page.getByRole('button', { name: 'Open entries' }).click();
    await page.locator('[data-special-offers-entry-detail="entry-pending"]').click();
    const detail = page.locator('#specialOfferEntryDetailsModal');

    await detail.getByRole('button', { name: 'Delete entry permanently' }).click();
    await detail.locator('[name="delete_reason"]').fill('Lifecycle smoke cleanup');
    await detail.locator('[name="expected_reference"]').fill('SO-LEF-0001');
    page.once('dialog', (dialog) => dialog.accept());
    await detail.getByRole('button', { name: 'Delete permanently' }).click();

    await expect(detail).toBeHidden();
    await expect(page.locator('#specialOffersEntriesModal')).not.toContainText('SO-LEF-0001');

    const state = await page.evaluate(() => ({
      rpcCalls: (window as any).__supabaseStub.getRpcCalls(),
      entries: (window as any).__supabaseStub.getTableRows('special_offer_entries'),
      answers: (window as any).__supabaseStub.getTableRows('special_offer_entry_answers'),
      activities: (window as any).__supabaseStub.getTableRows('special_offer_entry_activities'),
      posts: (window as any).__supabaseStub.getTableRows('special_offer_official_posts'),
      profiles: (window as any).__supabaseStub.getTableRows('profiles'),
    }));
    expect(state.rpcCalls.some((call: any) => call.name === 'admin_delete_special_offer_entry')).toBeTruthy();
    expect(state.entries.some((row: any) => row.id === 'entry-pending')).toBeFalsy();
    expect(state.answers.some((row: any) => row.entry_id === 'entry-pending')).toBeFalsy();
    expect(state.activities.some((row: any) => row.entry_id === 'entry-pending')).toBeFalsy();
    expect(state.posts.some((row: any) => row.id === 'post-1')).toBeTruthy();
    expect(state.profiles.some((row: any) => row.id === ADMIN_ID)).toBeTruthy();

    const source = await page.evaluate(async () => (await fetch('/admin/special-offers.js')).text());
    expect(source).not.toMatch(/from\(['"]special_offer_entries['"]\)\.delete/);
    expect(source).not.toMatch(/from\(['"]special_offer_entry_answers['"]\)\.delete/);
    expect(source).not.toMatch(/from\(['"]special_offer_entry_activities['"]\)\.delete/);
  });
});
