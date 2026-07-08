import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures';
import { waitForSupabaseStub } from './utils/supabase';
import type { Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicSource = readFileSync(path.resolve(__dirname, '../../js/special-offer.js'), 'utf8');

const OFFER_ID = 'activity-offer-1';
const ENTRY_ID = 'activity-entry-1';
const USER_ID = 'activity-user-1';
const POST_ID = 'activity-post-1';
const SECOND_POST_ID = 'activity-post-2';

async function prepareActivityStub(page: Page, options: {
  session?: 'confirmed' | 'unconfirmed' | 'anonymous';
  entryStatus?: 'submitted' | 'pending_review' | 'approved' | 'rejected' | 'disqualified' | 'withdrawn';
  seedExistingActivity?: 'pending' | 'approved' | 'rejected' | 'invalid';
  unsafePostUrl?: boolean;
  noEntry?: boolean;
} = {}) {
  await page.addInitScript(({ offerId, entryId, userId, postId, secondPostId, session, entryStatus, seedExistingActivity, unsafePostUrl, noEntry }) => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        stub.seedUser({
          email: 'activity@example.com',
          password: 'super-secret',
          profile: {
            id: userId,
            email: 'activity@example.com',
            name: 'Activity User',
            username: 'activity-user',
            confirmed_at: session === 'unconfirmed' ? null : new Date().toISOString(),
          },
        });
        if (session === 'confirmed') {
          stub.setSession({ id: userId, email: 'activity@example.com', user_metadata: { username: 'activity-user' } });
        } else if (session === 'unconfirmed') {
          stub.setSession({ id: userId, email: 'activity@example.com', confirmed_at: null, email_confirmed_at: null });
        } else {
          stub.setSession(null);
        }

        stub.seedTable('special_offers', [{
          id: offerId,
          slug: 'activity-campaign-2026',
          type: 'contest',
          winner_selection_mode: 'manual_selection',
          status: 'active',
          visibility: 'public',
          start_at: '2026-08-01T09:00:00.000Z',
          end_at: '2026-09-01T20:59:00.000Z',
          winner_announce_at: '2026-09-05T09:00:00.000Z',
          timezone: 'Asia/Nicosia',
          requires_form: false,
          allow_bonus_points: true,
        }]);
        stub.seedTable('special_offer_translations', [
          {
            id: 'activity-en',
            offer_id: offerId,
            lang: 'en',
            title: 'Activity claim campaign',
            short_description: 'Claim shares and comments.',
            full_description: 'Public campaign activity claim test.',
            rules_html: '<section><h3>Rules</h3><p>Manual selection.</p></section>',
            faq_json: [],
          },
          {
            id: 'activity-pl',
            offer_id: offerId,
            lang: 'pl',
            title: 'Kampania aktywności',
            short_description: 'Zgłaszaj udostępnienia i komentarze.',
            full_description: 'Test zgłaszania aktywności.',
            rules_html: '<section><h3>Zasady</h3><p>Wybór ręczny.</p></section>',
            faq_json: [],
          },
          {
            id: 'activity-he',
            offer_id: offerId,
            lang: 'he',
            title: 'קמפיין פעילות',
            short_description: 'דווחו שיתופים ותגובות.',
            full_description: 'בדיקת דיווח פעילות.',
            rules_html: '<section><h3>כללים</h3><p>בחירה ידנית.</p></section>',
            faq_json: [],
          },
        ]);
        stub.seedTable('special_offer_prizes', []);
        stub.seedTable('special_offer_links', []);
        stub.seedTable('special_offer_official_posts', [
          {
            id: postId,
            offer_id: offerId,
            post_order: 1,
            week_number: 1,
            admin_title: 'Week 1 Facebook post',
            platform: 'facebook',
            official_url: unsafePostUrl ? 'javascript:alert(1)' : 'https://facebook.com/cypruseye/posts/1',
            published_at: '2026-08-02T09:00:00.000Z',
            comment_deadline_at: '2026-08-03T09:00:00.000Z',
            active: true,
            created_at: '2026-08-02T09:00:00.000Z',
            updated_at: '2026-08-02T09:00:00.000Z',
          },
          {
            id: secondPostId,
            offer_id: offerId,
            post_order: 2,
            week_number: 2,
            admin_title: 'Week 2 Facebook post',
            platform: 'facebook',
            official_url: 'https://facebook.com/cypruseye/posts/2',
            published_at: '2026-08-09T09:00:00.000Z',
            comment_deadline_at: '2026-08-10T09:00:00.000Z',
            active: false,
            created_at: '2026-08-09T09:00:00.000Z',
            updated_at: '2026-08-09T09:00:00.000Z',
          },
        ]);
        stub.seedTable('special_offer_entries', noEntry ? [] : [{
          id: entryId,
          offer_id: offerId,
          user_id: userId,
          reference: 'SO-ACTIVITY-1',
          status: entryStatus,
          submitted_lang: 'en',
          created_at: '2026-08-02T10:00:00.000Z',
        }]);
        stub.seedTable('special_offer_entry_activities', seedExistingActivity ? [{
          id: 'activity-existing-1',
          offer_id: offerId,
          entry_id: entryId,
          official_post_id: postId,
          activity_type: 'share',
          status: seedExistingActivity,
          points_awarded: seedExistingActivity === 'approved' ? 1 : 0,
          participant_reported_at: null,
          verified_activity_at: seedExistingActivity === 'approved' ? '2026-08-02T11:00:00.000Z' : null,
          created_at: '2026-08-02T11:00:00.000Z',
          updated_at: '2026-08-02T11:00:00.000Z',
        }] : []);

        stub.setRpcHandler('special_offer_entry_score_summary', (params: any, helpers: any) => {
          const activities = helpers.getTableRows('special_offer_entry_activities')
            .filter((row: any) => row.entry_id === params.p_entry_id && row.status === 'approved');
          const sharePoints = activities.filter((row: any) => row.activity_type === 'share').length;
          const commentPoints = activities.filter((row: any) => row.activity_type === 'comment').length;
          return {
            data: [{
              offer_id: offerId,
              entry_id: params.p_entry_id,
              reference: 'SO-ACTIVITY-1',
              entry_status: entryStatus || 'approved',
              base_points: entryStatus === 'approved' ? 1 : 0,
              share_points: sharePoints,
              comment_points: commentPoints,
              bonus_points: sharePoints + commentPoints,
              total_points: (entryStatus === 'approved' ? 1 : 0) + sharePoints + commentPoints,
              approved_activity_count: activities.length,
            }],
            error: null,
          };
        });
        stub.setRpcHandler('submit_special_offer_activity_claim', (params: any, helpers: any) => {
          if (params.p_entry_id !== entryId) {
            return { data: null, error: { message: 'activity_claim_not_allowed' } };
          }
          if (!/^https?:\/\//i.test(params.p_evidence_url || '')) {
            return { data: null, error: { message: 'invalid_evidence_url' } };
          }
          const rows = helpers.getTableRows('special_offer_entry_activities');
          const duplicate = rows.find((row: any) => row.entry_id === entryId && row.official_post_id === params.p_official_post_id && row.activity_type === params.p_activity_type);
          if (duplicate) {
            return {
              data: [{ activity_id: duplicate.id, status: duplicate.status, points_awarded: duplicate.points_awarded, idempotent: false, duplicate: true }],
              error: null,
            };
          }
          const id = `activity-${rows.length + 1}`;
          helpers.setTableRows('special_offer_entry_activities', [...rows, {
            id,
            offer_id: offerId,
            entry_id: entryId,
            official_post_id: params.p_official_post_id,
            activity_type: params.p_activity_type,
            evidence_url: params.p_evidence_url,
            evidence_text: params.p_evidence_text,
            participant_reported_at: params.p_participant_reported_at,
            status: 'pending',
            points_awarded: 0,
            created_by: userId,
            client_submission_id: params.p_client_submission_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
          return {
            data: [{ activity_id: id, status: 'pending', points_awarded: 0, idempotent: false, duplicate: false }],
            error: null,
          };
        });
      },
    };
  }, {
    offerId: OFFER_ID,
    entryId: ENTRY_ID,
    userId: USER_ID,
    postId: POST_ID,
    secondPostId: SECOND_POST_ID,
    session: options.session || 'anonymous',
    entryStatus: options.entryStatus ?? 'approved',
    seedExistingActivity: options.seedExistingActivity || null,
    unsafePostUrl: options.unsafePostUrl || false,
    noEntry: options.noEntry || false,
  });
}

test.describe('Special Offer public activity claims', () => {
  test('shows locked activity section for anonymous users and opens auth modal', async ({ page }) => {
    await prepareActivityStub(page, { session: 'anonymous', entryStatus: 'approved' });
    await page.goto('/special-offers/activity-campaign-2026?lang=en');
    await waitForSupabaseStub(page);

    const section = page.locator('[data-special-offer-activity-placeholder]');
    await expect(section).toBeVisible();
    await expect(section.getByRole('heading', { name: 'Sign in to claim activity' })).toBeVisible();
    await section.getByRole('button', { name: 'Sign in or register' }).click();
    await expect(page.locator('#auth-modal')).toHaveClass(/is-open/);
    const rpcCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    expect(rpcCalls).toHaveLength(0);
  });

  test('renders own entry, own score and current campaign official posts for confirmed users', async ({ page }) => {
    await prepareActivityStub(page, { session: 'confirmed', entryStatus: 'approved', seedExistingActivity: 'approved' });
    await page.goto('/special-offers/activity-campaign-2026?lang=en');
    await waitForSupabaseStub(page);

    const section = page.locator('[data-special-offer-activity-placeholder]');
    await expect(section.getByRole('heading', { name: 'My Activity' })).toBeVisible();
    await expect(section).toContainText('SO-ACTIVITY-1');
    await expect(section).toContainText('Week 1 Facebook post');
    await expect(section).not.toContainText('Week 2 Facebook post');
    await expect(section).toContainText('Approved');
    await expect(section).toContainText('Total');
    await expect(section).toContainText('Points are a supporting criterion');
    await expect(section.getByRole('link', { name: 'Open post' })).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(section.getByRole('link', { name: 'Open post' })).toHaveAttribute('target', '_blank');
  });

  test('submits share evidence through RPC once and refreshes activity status', async ({ page }) => {
    await prepareActivityStub(page, { session: 'confirmed', entryStatus: 'approved' });
    await page.goto('/special-offers/activity-campaign-2026?lang=en');
    await waitForSupabaseStub(page);

    await page.getByRole('button', { name: 'Add proof' }).first().click();
    const modal = page.locator('[data-special-offer-claim-modal]');
    await expect(modal.getByRole('heading', { name: 'Share proof' })).toBeVisible();
    await modal.locator('input[name="evidence_url"]').fill('https://facebook.com/activity-proof-1');
    await modal.getByRole('button', { name: 'Submit evidence' }).dblclick();

    await expect(page.locator('[data-special-offer-claim-modal]')).toHaveCount(0);
    await expect(page.locator('[data-special-offer-activity-placeholder]')).toContainText('Pending');

    const rpcCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    const claimCalls = rpcCalls.filter((call: any) => call.name === 'submit_special_offer_activity_claim');
    expect(claimCalls).toHaveLength(1);
    expect(claimCalls[0].params).toMatchObject({
      p_entry_id: ENTRY_ID,
      p_official_post_id: POST_ID,
      p_activity_type: 'share',
      p_evidence_url: 'https://facebook.com/activity-proof-1',
    });
    expect(claimCalls[0].params.p_client_submission_id).toMatch(/[0-9a-f-]{36}/i);
  });

  test('blocks invalid URLs and does not perform direct activity writes', async ({ page }) => {
    await prepareActivityStub(page, { session: 'confirmed', entryStatus: 'approved' });
    await page.goto('/special-offers/activity-campaign-2026?lang=en');
    await waitForSupabaseStub(page);

    await page.getByRole('button', { name: 'Add proof' }).first().click();
    const modal = page.locator('[data-special-offer-claim-modal]');
    await modal.locator('input[name="evidence_url"]').fill('javascript:alert(1)');
    await modal.getByRole('button', { name: 'Submit evidence' }).click();
    await expect(modal).toContainText('Enter a valid link starting with http:// or https://.');
    const rpcCalls = await page.evaluate(() => (window as any).__supabaseStub.getRpcCalls());
    expect(rpcCalls.filter((call: any) => call.name === 'submit_special_offer_activity_claim')).toHaveLength(0);

    expect(publicSource).not.toMatch(/from\(['"]special_offer_entry_activities['"]\)\.(insert|update|delete|upsert)/);
    expect(publicSource).not.toMatch(/from\(['"]special_offer_entries['"]\)\.(insert|update|delete|upsert)/);
    expect(publicSource).toContain("submit_special_offer_activity_claim");
  });

  test('shows blocked states for rejected entries', async ({ page }) => {
    await prepareActivityStub(page, { session: 'confirmed', entryStatus: 'rejected' });
    await page.goto('/special-offers/activity-campaign-2026?lang=en');
    await waitForSupabaseStub(page);
    await expect(page.locator('[data-special-offer-activity-placeholder]')).toContainText('Activities are locked for this entry');
    await expect(page.locator('[data-special-offer-activity-open]').first()).toBeDisabled();
  });

  test('shows no-entry state for users without a campaign entry', async ({ page }) => {
    await prepareActivityStub(page, { session: 'confirmed', noEntry: true });
    await page.goto('/special-offers/activity-campaign-2026?lang=en');
    await waitForSupabaseStub(page);
    await expect(page.locator('[data-special-offer-activity-placeholder]')).toContainText('Submit the main entry first');
  });

  test('does not allow rejected activity resubmission', async ({ page }) => {
    await prepareActivityStub(page, { session: 'confirmed', entryStatus: 'approved', seedExistingActivity: 'rejected' });
    await page.goto('/special-offers/activity-campaign-2026?lang=en');
    await waitForSupabaseStub(page);
    await expect(page.locator('[data-special-offer-claim="share"]')).toContainText('Rejected');
    await expect(page.locator('[data-special-offer-claim="share"] [data-special-offer-activity-open]')).toHaveCount(0);
  });

  test('shows confirm-email state for unconfirmed users', async ({ page }) => {
    await prepareActivityStub(page, { session: 'unconfirmed', entryStatus: 'approved' });
    await page.goto('/special-offers/activity-campaign-2026?lang=en');
    await waitForSupabaseStub(page);
    await expect(page.locator('[data-special-offer-activity-placeholder]')).toContainText('Confirm your email address');
    await expect(page.locator('[data-special-offer-activity-open]')).toHaveCount(0);
  });

  test('keeps HE RTL and renders unsafe official URLs as text', async ({ page }) => {
    await prepareActivityStub(page, { session: 'confirmed', entryStatus: 'approved', unsafePostUrl: true });
    await page.goto('/special-offers/activity-campaign-2026?lang=he');
    await waitForSupabaseStub(page);

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const section = page.locator('[data-special-offer-activity-placeholder]');
    await expect(section).toHaveAttribute('dir', 'rtl');
    await expect(section.getByRole('heading', { name: 'הפעילות שלי' })).toBeVisible();
    await expect(section.getByRole('link', { name: 'פתיחת הפוסט' })).toHaveCount(0);
    await expect(section).toContainText('javascript:alert(1)');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(overflow).toBeFalsy();
  });
});
