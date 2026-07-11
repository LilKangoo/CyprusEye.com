import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const ADMIN_ID = '15f3d442-092d-4eb8-9627-db90da0283eb';
const OFFER_ID = '4c38a187-8a68-4eb0-9b46-1cd923e06d31';

async function prepareManualWinnerStub(page: Page) {
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
          status: 'ended',
          visibility: 'public',
          start_at: '2026-07-14T21:00:00.000Z',
          end_at: '2026-07-20T20:59:59.000Z',
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

        stub.seedTable('special_offer_entries', [
          {
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
            correction_count: 0,
            corrected_at: null,
            correction_client_submission_id: null,
            created_at: '2026-07-20T10:00:00.000Z',
            updated_at: '2026-07-20T11:00:00.000Z',
          },
          {
            id: 'entry-pending',
            offer_id: offerId,
            user_id: 'user-2',
            status: 'pending_review',
            submitted_lang: 'en',
            normalized_email: 'pending@example.com',
            first_name: 'Pending',
            last_name: 'User',
            reference: 'SO-LEF-0002',
            created_at: '2026-07-20T10:30:00.000Z',
          },
        ]);
        stub.seedTable('special_offer_entry_answers', []);
        stub.seedTable('special_offer_entry_activities', []);
        stub.seedTable('special_offer_official_posts', []);
        stub.seedTable('special_offer_winner_workflows', []);
        stub.seedTable('special_offer_winner_shortlist', []);
        stub.seedTable('special_offer_winner_contact_events', []);
        stub.seedTable('special_offer_winner_publications', []);
        stub.seedTable('special_offer_winner_committee_notes', []);
        stub.seedTable('special_offer_audit_log', []);

        const scoreForEntry = (entryId: string) => [{
          offer_id: offerId,
          entry_id: entryId,
          reference: entryId === 'entry-approved' ? 'SO-LEF-0001' : 'SO-LEF-0002',
          entry_status: entryId === 'entry-approved' ? 'approved' : 'pending_review',
          base_points: entryId === 'entry-approved' ? 1 : 0,
          share_points: 1,
          comment_points: 1,
          bonus_points: 2,
          total_points: entryId === 'entry-approved' ? 3 : 2,
          approved_activity_count: 2,
        }];

        const snapshot = (entryId: string) => ({
          base_points: scoreForEntry(entryId)[0].base_points,
          share_points: 1,
          comment_points: 1,
          bonus_points: 2,
          total_points: scoreForEntry(entryId)[0].total_points,
          approved_activity_count: 2,
          snapshot_at: '2026-07-21T10:00:00.000Z',
        });

        const readiness = () => {
          const entries = stub.getTableRows('special_offer_entries');
          const activities = stub.getTableRows('special_offer_entry_activities');
          const workflows = stub.getTableRows('special_offer_winner_workflows');
          const pendingReviews = entries.filter((row: any) => ['submitted', 'pending_review'].includes(row.status)).length;
          const pendingActivities = activities.filter((row: any) => row.status === 'pending').length;
          const activeWorkflowExists = workflows.some((row: any) => row.offer_id === offerId && row.status !== 'cancelled');
          const blocking = pendingReviews > 0
            ? 'pending_entry_reviews'
            : pendingActivities > 0
              ? 'pending_activity_reviews'
              : activeWorkflowExists
                ? 'active_workflow_exists'
                : null;
          return [{
            offer_id: offerId,
            winner_selection_mode: 'manual_selection',
            campaign_status: 'ended',
            campaign_end_at: '2026-07-20T20:59:59.000Z',
            campaign_ended: true,
            approved_entries_count: entries.filter((row: any) => row.status === 'approved').length,
            pending_review_entries_count: pendingReviews,
            pending_activities_count: pendingActivities,
            approved_activities_count: activities.filter((row: any) => row.status === 'approved').length,
            active_workflow_exists: activeWorkflowExists,
            can_start_workflow: blocking == null,
            blocking_reason: blocking,
          }];
        };

        stub.setRpcHandler('special_offer_entry_score_summary', (params: any) => ({ data: scoreForEntry(params.p_entry_id), error: null }));
        stub.setRpcHandler('special_offer_winner_workflow_readiness', () => ({ data: readiness(), error: null }));
        stub.setRpcHandler('admin_start_special_offer_winner_workflow', (params: any, helpers: any) => {
          if (!params.p_reason) return { data: null, error: { message: 'workflow_reason_required' } };
          const workflow = {
            id: 'workflow-1',
            offer_id: params.p_offer_id,
            status: 'shortlisting',
            started_by: adminId,
            started_at: '2026-07-21T10:00:00.000Z',
            decision_reason: params.p_reason,
            confirmed_entry_id: null,
            confirmed_at: null,
            published_at: null,
            cancelled_at: null,
            cancelled_by: null,
            created_at: '2026-07-21T10:00:00.000Z',
            updated_at: '2026-07-21T10:00:00.000Z',
          };
          helpers.setTableRows('special_offer_winner_workflows', [workflow]);
          return { data: [{ workflow_id: workflow.id, offer_id: workflow.offer_id, status: workflow.status }], error: null };
        });
        stub.setRpcHandler('admin_add_special_offer_shortlist_entry', (params: any, helpers: any) => {
          const rows = helpers.getTableRows('special_offer_winner_shortlist');
          rows.push({
            id: 'shortlist-1',
            workflow_id: params.p_workflow_id,
            offer_id: offerId,
            entry_id: params.p_entry_id,
            status: 'active',
            role: 'shortlisted',
            backup_rank: null,
            score_snapshot_json: snapshot(params.p_entry_id),
            entry_status_snapshot: 'approved',
            added_by: adminId,
            added_at: '2026-07-21T10:05:00.000Z',
            rechecked_by: null,
            rechecked_at: null,
            removed_by: null,
            removed_at: null,
            created_at: '2026-07-21T10:05:00.000Z',
            updated_at: '2026-07-21T10:05:00.000Z',
          });
          helpers.setTableRows('special_offer_winner_shortlist', rows);
          return { data: [{ shortlist_id: 'shortlist-1', workflow_id: params.p_workflow_id, entry_id: params.p_entry_id, status: 'active', role: 'shortlisted' }], error: null };
        });
        stub.setRpcHandler('admin_set_special_offer_primary_candidate', (params: any, helpers: any) => {
          const rows = helpers.getTableRows('special_offer_winner_shortlist').map((row: any) => row.id === params.p_shortlist_id ? { ...row, role: 'primary', backup_rank: null } : row);
          helpers.setTableRows('special_offer_winner_shortlist', rows);
          helpers.setTableRows('special_offer_winner_workflows', helpers.getTableRows('special_offer_winner_workflows').map((row: any) => ({ ...row, status: 'candidate_selected' })));
          return { data: [{ shortlist_id: params.p_shortlist_id, workflow_id: 'workflow-1', entry_id: 'entry-approved', role: 'primary' }], error: null };
        });
        stub.setRpcHandler('admin_start_special_offer_winner_contact', (params: any, helpers: any) => {
          const contacts = helpers.getTableRows('special_offer_winner_contact_events');
          contacts.unshift({
            id: 'contact-1',
            workflow_id: 'workflow-1',
            shortlist_id: params.p_shortlist_id,
            entry_id: 'entry-approved',
            status: 'contact_started',
            contact_started_at: '2026-07-21T11:00:00.000Z',
            response_deadline_at: params.p_response_deadline_at,
            accepted_at: null,
            declined_at: null,
            no_response_at: null,
            replaced_at: null,
            note_text: params.p_note_text || null,
            created_by: adminId,
            created_at: '2026-07-21T11:00:00.000Z',
          });
          helpers.setTableRows('special_offer_winner_contact_events', contacts);
          helpers.setTableRows('special_offer_winner_workflows', helpers.getTableRows('special_offer_winner_workflows').map((row: any) => ({ ...row, status: 'contacting' })));
          return { data: [{ contact_event_id: 'contact-1', workflow_id: 'workflow-1', status: 'contact_started' }], error: null };
        });
        stub.setRpcHandler('admin_record_special_offer_winner_response', (params: any, helpers: any) => {
          const contacts = helpers.getTableRows('special_offer_winner_contact_events').map((row: any) => row.id === params.p_contact_event_id
            ? { ...row, status: params.p_response_status, accepted_at: params.p_response_status === 'accepted' ? '2026-07-21T12:00:00.000Z' : null, declined_at: params.p_response_status === 'declined' ? '2026-07-21T12:00:00.000Z' : null, no_response_at: params.p_response_status === 'no_response' ? '2026-07-21T12:00:00.000Z' : null }
            : row);
          helpers.setTableRows('special_offer_winner_contact_events', contacts);
          return { data: [{ contact_event_id: params.p_contact_event_id, workflow_id: 'workflow-1', status: params.p_response_status }], error: null };
        });
        stub.setRpcHandler('admin_confirm_special_offer_winner', (params: any, helpers: any) => {
          helpers.setTableRows('special_offer_winner_workflows', helpers.getTableRows('special_offer_winner_workflows').map((row: any) => ({ ...row, status: 'winner_confirmed', confirmed_entry_id: 'entry-approved', confirmed_at: '2026-07-21T12:30:00.000Z' })));
          return { data: [{ workflow_id: 'workflow-1', entry_id: 'entry-approved', status: 'winner_confirmed' }], error: null };
        });
        stub.setRpcHandler('admin_publish_special_offer_winner', (params: any, helpers: any) => {
          const publications = helpers.getTableRows('special_offer_winner_publications');
          publications.unshift({
            id: 'publication-1',
            workflow_id: params.p_workflow_id,
            offer_id: offerId,
            entry_id: 'entry-approved',
            public_name: params.p_public_name,
            publication_consent_confirmed: params.p_publication_consent_confirmed,
            consent_confirmed_by: adminId,
            consent_confirmed_at: '2026-07-21T13:00:00.000Z',
            published_by: adminId,
            published_at: '2026-07-21T13:00:00.000Z',
            unpublished_at: null,
            unpublish_reason_present: false,
            created_at: '2026-07-21T13:00:00.000Z',
          });
          helpers.setTableRows('special_offer_winner_publications', publications);
          helpers.setTableRows('special_offer_winner_workflows', helpers.getTableRows('special_offer_winner_workflows').map((row: any) => ({ ...row, status: 'published', published_at: '2026-07-21T13:00:00.000Z' })));
          return { data: [{ publication_id: 'publication-1', workflow_id: params.p_workflow_id, entry_id: 'entry-approved', published_at: '2026-07-21T13:00:00.000Z' }], error: null };
        });
      },
    };
  }, { adminId: ADMIN_ID, offerId: OFFER_ID });
}

async function openManualWinner(page: Page) {
  await prepareManualWinnerStub(page);
  await page.goto('/admin/dashboard.html');
  await waitForSupabaseStub(page);
  await page.click('button.admin-nav-item[data-view="specialOffers"]');
  await expect(page.locator('#viewSpecialOffers')).toBeVisible();
  await page.getByRole('button', { name: 'Open manual winner selection' }).click();
  await expect(page.locator('#specialOffersManualWinnerModal')).toBeVisible();
}

test.describe('Admin Special Offers manual winner selection', () => {
  test('shows manual panel without draw, ranking, messages or committee UI', async ({ page }) => {
    await openManualWinner(page);
    const modal = page.locator('#specialOffersManualWinnerModal');

    await expect(modal).toContainText('The winner is selected manually by the administrator');
    await expect(modal).toContainText('Pending entry reviews');
    await expect(modal).toContainText('Selection is currently blocked');
    await expect(modal).not.toContainText('committee');
    await expect(modal).not.toContainText('Send email');
    await expect(modal).not.toContainText('ranking');
    await expect(page.getByText('Disabled for manual selection campaigns')).toBeVisible();

    await page.locator('button[data-special-offers-winner-close]').press('Escape');
    await expect(modal).toBeHidden();
  });

  test('runs shortlist, manual contact, confirmation and publication through RPC only', async ({ page }) => {
    await openManualWinner(page);
    const modal = page.locator('#specialOffersManualWinnerModal');

    await page.evaluate(() => {
      const rows = (window as any).__supabaseStub.getTableRows('special_offer_entries');
      (window as any).__supabaseStub.seedTable('special_offer_entries', rows.filter((row: any) => row.id !== 'entry-pending'));
      (window as any).__supabaseStub.clearRpcCalls();
    });
    await modal.getByRole('button', { name: 'Refresh' }).click();
    await expect(modal).toContainText('Can start workflow');

    await modal.getByRole('button', { name: 'Start manual selection' }).click();
    await modal.locator('[data-special-offers-winner-action-form="start"] [name="reason"]').fill('Manual selection after campaign close');
    page.once('dialog', (dialog) => dialog.accept());
    await modal.locator('[data-special-offers-winner-action-form="start"]').getByRole('button', { name: 'Confirm start' }).click();
    await expect(modal).toContainText('Shortlisting');

    await modal.locator('[data-special-offers-winner-add-shortlist="entry-approved"]').click();
    await expect(modal).toContainText('Saved score snapshot');
    await expect(modal).toContainText('Current score');

    await modal.locator('[data-special-offers-winner-action="primary"]').click();
    await modal.locator('[data-special-offers-winner-action-form="primary"] [name="reason"]').fill('Best manual candidate');
    page.once('dialog', (dialog) => dialog.accept());
    await modal.locator('[data-special-offers-winner-action-form="primary"]').getByRole('button', { name: 'Confirm' }).click();
    await expect(modal).toContainText('Primary');

    await modal.locator('[data-special-offers-winner-action="contact"]').click();
    await modal.locator('[data-special-offers-winner-action-form="contact"] [name="response_deadline_at"]').fill('2026-07-25T10:00');
    await modal.locator('[data-special-offers-winner-action-form="contact"] [name="note_text"]').fill('Called outside the platform');
    page.once('dialog', (dialog) => dialog.accept());
    await modal.locator('[data-special-offers-winner-action-form="contact"]').getByRole('button', { name: 'Save contact start' }).click();
    await expect(modal).toContainText('Contact started');
    await expect(modal).toContainText('The system does not send messages automatically');

    await modal.locator('[data-special-offers-winner-action="response"]').click();
    await modal.locator('[data-special-offers-winner-action-form="response"] [name="response_status"]').selectOption('accepted');
    page.once('dialog', (dialog) => dialog.accept());
    await modal.locator('[data-special-offers-winner-action-form="response"]').getByRole('button', { name: 'Save contact result' }).click();
    await expect(modal).toContainText('Accepted');

    await modal.locator('[data-special-offers-winner-action="confirm"]').click();
    await modal.locator('[data-special-offers-winner-action-form="confirm"] [name="reason"]').fill('Winner accepted manual contact');
    page.once('dialog', (dialog) => dialog.accept());
    await modal.locator('[data-special-offers-winner-action-form="confirm"]').getByRole('button', { name: 'Confirm' }).click();
    await expect(modal).toContainText('Winner confirmed');

    await modal.locator('[data-special-offers-winner-action="publish"]').click();
    await modal.locator('[data-special-offers-winner-action-form="publish"] [name="public_name"]').fill('A. Tester');
    await modal.locator('[data-special-offers-winner-action-form="publish"] [name="publication_consent_confirmed"]').check();
    await modal.locator('[data-special-offers-winner-action-form="publish"] [name="reason"]').fill('Consent confirmed manually');
    page.once('dialog', (dialog) => dialog.accept());
    await modal.locator('[data-special-offers-winner-action-form="publish"]').getByRole('button', { name: 'Publish winner' }).click();
    await expect(modal).toContainText('Winner result is published as');

    const rpcCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    expect(rpcCalls.map((call: any) => call.name)).toEqual(expect.arrayContaining([
      'special_offer_winner_workflow_readiness',
      'admin_start_special_offer_winner_workflow',
      'admin_add_special_offer_shortlist_entry',
      'admin_set_special_offer_primary_candidate',
      'admin_start_special_offer_winner_contact',
      'admin_record_special_offer_winner_response',
      'admin_confirm_special_offer_winner',
      'admin_publish_special_offer_winner',
    ]));
    expect(rpcCalls.some((call: any) => /send|message|gmail/i.test(call.name))).toBeFalsy();

    const source = await page.evaluate(async () => (await fetch('/admin/special-offers.js')).text());
    expect(source).not.toMatch(/from\(['"]special_offer_winner_(workflows|shortlist|committee_notes|contact_events|publications)['"]\)\.(insert|update|delete|upsert)/);
    expect(source).not.toMatch(/admin_add_special_offer_committee_note|admin_archive_special_offer_committee_note/);
  });
});
