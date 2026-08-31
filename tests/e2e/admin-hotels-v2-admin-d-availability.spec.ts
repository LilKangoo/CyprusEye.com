import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = '22222222-2222-4222-8222-222222222222';
const PLAN_ID = '33333333-3333-4333-8333-333333333333';
const RATE_ID = '44444444-4444-4444-8444-444444444444';
const DAILY_ID = 'b25d21d6-a02f-595f-8636-80b6a3e78526';
const EXTERNAL_SOURCE_ID = '55555555-5555-4555-8555-555555555555';
const PARTNER_ID = '66666666-6666-4666-8666-666666666666';
const ASSIGNMENT_ID = '77777777-7777-4777-8777-777777777777';
const PROVIDER_PROPOSAL_ACCEPT_ID = '88888888-8888-4888-8888-888888888888';
const PROVIDER_PROPOSAL_REJECT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROVIDER_REVIEW_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UPDATED_AT = '2026-08-24T12:00:00.000Z';
const SNAPSHOT = 'a'.repeat(64);
const PLAN_FINGERPRINT = 'c'.repeat(64);

type BrowserIssues = {
  console: string[];
  page: string[];
  requests: string[];
};

const browserIssues = new WeakMap<Page, BrowserIssues>();

async function expectNoBrowserIssues(page: Page): Promise<void> {
  await page.waitForTimeout(20);
  expect(browserIssues.get(page)).toEqual({
    console: [],
    page: [],
    requests: [],
  });
}

async function installAvailabilityHarness(
  page: Page,
  options: { failApply?: boolean } = {},
): Promise<void> {
  const issues: BrowserIssues = {
    console: [],
    page: [],
    requests: [],
  };

  browserIssues.set(page, issues);

  page.on('console', (message) => {
    if (message.type() === 'error') issues.console.push(message.text());
  });

  page.on('pageerror', (error) => {
    issues.page.push(error.message);
  });

  page.on('requestfailed', (request) => {
    issues.requests.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`,
    );
  });

  await page.setViewportSize({ width: 1366, height: 900 });

  await page.setContent(`<!doctype html>
<html lang="en" dir="ltr">
<head></head>
<body>
  <section id="hotelPropertyDirectory"></section>
  <section id="hotelPropertyWorkspace"></section>

  <input id="hotelPropertySearch">

  <select id="hotelPropertyArchitectureFilter">
    <option value="all">all</option>
  </select>

  <select id="hotelPropertyReadinessFilter">
    <option value="all">all</option>
  </select>

  <button id="btnAddHotel"></button>
</body>
</html>`);

  await page.evaluate(() => {
    let sequence = 100;

    Object.defineProperty(window.crypto, 'randomUUID', {
      configurable: true,
      value: () =>
        `99999999-9999-4999-8999-${String(sequence++).padStart(12, '0')}`,
    });
  });

  await page.addStyleTag({
    path: path.join(process.cwd(), 'admin/admin.css'),
  });

  await page.addScriptTag({
    path: path.join(
      process.cwd(),
      'admin/hotels-v2-workspace-core.js',
    ),
  });

  await page.evaluate(
    (fixture) => {
      const root = window as any;
      const Core = root.HotelsV2WorkspaceCore;
      const clone = (value: any) =>
        JSON.parse(JSON.stringify(value));

      const flags = {
        hotel_rooms_v2_enabled: false,
        hotel_external_sync_enabled: false,
        hotel_instant_booking_enabled: false,
        hotel_stripe_connect_enabled: false,
      };

      const room = {
        id: fixture.roomId,
        hotel_id: fixture.hotelId,
        code: 'upper',
        name_i18n: {
          pl: 'Górny apartament',
          en: 'Upper Apartment',
          he: 'דירה עליונה',
        },
        description_i18n: {
          pl: 'Apartament',
          en: 'Apartment',
          he: 'דירה',
        },
        status: 'active',
        max_occupancy: 4,
        capacity_adults: 4,
        capacity_children: 0,
        children_policy_override: null,
        minimum_child_age_override: null,
        gallery: [],
        bed_configuration: [],
        bathrooms: null,
        size_sqm: null,
        floor_label_i18n: {},
        amenities: [],
        inventory_mode: 'pooled',
        base_inventory_count: 1,
        active_unit_count: 0,
        sort_order: 10,
        version: 3,
        created_at: fixture.updatedAt,
        updated_at: fixture.updatedAt,
      };

      const ratePlan = {
        id: fixture.planId,
        hotel_id: fixture.hotelId,
        code: 'standard',
        name_i18n: {
          pl: 'Standard',
          en: 'Standard',
          he: 'סטנדרט',
        },
        description_i18n: {
          pl: 'Plan standardowy',
          en: 'Standard plan',
          he: 'תוכנית סטנדרטית',
        },
        meal_plan_code: null,
        cancellation_policy: { type: 'flexible' },
        booking_mode_override: null,
        price_inclusions: ['taxes'],
        is_active: false,
        review_status: 'reviewed',
        lifecycle_status: 'inactive',
        review_basis: 'stored',
        sort_order: 100,
        version: 3,
        updated_at: fixture.updatedAt,
        immutable_contract: null,
        activation_blockers: [],
      };

      const roomRate = {
        id: fixture.rateId,
        hotel_id: fixture.hotelId,
        room_type_id: fixture.roomId,
        rate_plan_id: fixture.planId,
        pricing_schedule_id: null,
        base_nightly_rate: 0,
        currency: 'EUR',
        external_redirect_url: null,
        is_active: false,
        review_status: 'reviewed',
        lifecycle_status: 'inactive',
        review_basis: 'stored',
        sort_order: 100,
        version: 2,
        updated_at: fixture.updatedAt,
        pricing_source: 'property_default',
        base_nightly_rate_authoritative: false,
        independent_tiers: [],
        independent_tiers_fingerprint: 'b'.repeat(32),
        immutable_contract: null,
        activation_blockers: [],
      };

      const workspace = Core.normalizeWorkspace({
        property: {
          id: fixture.hotelId,
          slug: 'admin-d-e2e',
          architecture_version: 'legacy',
          title: {
            pl: 'Hotel testowy',
            en: 'ADMIN-D Hotel',
            he: 'מלון',
          },
          title_i18n: {
            pl: 'Hotel testowy',
            en: 'ADMIN-D Hotel',
            he: 'מלון',
          },
          description: { en: 'Description' },
          description_i18n: { en: 'Description' },
          city: 'Lefkara',
          timezone: 'Europe/Nicosia',
          currency: 'EUR',
          booking_mode: 'request_confirmation',
          children_policy: 'allowed',
          pricing_tiers: { rules: [] },
          room_types: [],
          photos: [],
          amenities: [],
          status: 'draft',
          is_published: false,
          updated_at: fixture.updatedAt,
        },
        room_types: [room],
        units: [],
        rate_plans: [ratePlan],
        room_rates: [roomRate],
        pricing_schedules: [],
        pricing_schedule_tiers: [],
        amenities_catalog: [],
        partners: [],
        operational_partners: [],
        payment_due: {},
        counts: {
          upcoming_bookings: 0,
          daily_inventory_by_room: {},
        },
        flags: clone(flags),
        activity: [],
      });

      const control = {
        contract_version:
          'hotels_v2_admin_d_availability_control_v1',
        hotel_id: fixture.hotelId,
        from: '2026-08-31',
        to: '2026-09-06',
        snapshot_token: fixture.snapshot,
        snapshot_as_of: fixture.updatedAt,
        snapshot_valid_until: null,

        property: {
          id: fixture.hotelId,
          name_i18n: {
            pl: 'Hotel testowy',
            en: 'ADMIN-D Hotel',
            he: 'מלון',
          },
          architecture_version: 'legacy',
          timezone: 'Europe/Nicosia',
          currency: 'EUR',
          booking_mode: 'request_confirmation',
          minimum_stay_nights: 2,
          maximum_stay_nights: null,
          updated_at: fixture.updatedAt,
        },

        room_types: [{
          id: fixture.roomId,
          hotel_id: fixture.hotelId,
          code: 'upper',
          name_i18n: clone(room.name_i18n),
          inventory_mode: 'pooled',
          base_inventory_count: 1,
          status: 'active',
          sort_order: 10,
          max_occupancy: 4,
          capacity_adults: 4,
          capacity_children: 0,
          version: 3,
          updated_at: fixture.updatedAt,
        }],

        room_rates: [{
          id: fixture.rateId,
          hotel_id: fixture.hotelId,
          room_type_id: fixture.roomId,
          rate_plan_id: fixture.planId,
          is_active: false,
          review_status: 'reviewed',
          sort_order: 10,
          version: 2,
          updated_at: fixture.updatedAt,
        }],

        units: [],

        cells: [
          '2026-08-31',
          '2026-09-01',
          '2026-09-02',
          '2026-09-03',
          '2026-09-04',
          '2026-09-05',
          '2026-09-06',
        ].map((stayDate) => ({
          room_type_id: fixture.roomId,
          stay_date: stayDate,
          inventory_mode: 'pooled',
          physical_capacity: 1,
          configured_sellable_units: 1,
          blocked_unit_count: 0,
          blocked_unit_ids: [],
          operational_closed: false,
          safety_closed: false,
          held_units: 0,
          booked_units: 0,
          committed_units: 0,
          available_units: 1,
          requestable: false,
          blocking_reasons: ['public_activation_off'],
          earliest_hold_expiry: null,
          provenance: {
            capacity: 'room_type_or_active_units',
            inventory: 'hotel_daily_inventory',
            commitments: 'server_authoritative',
          },
          inventory_version: 0,
        })),

        product_cells: [
          '2026-08-31',
          '2026-09-01',
          '2026-09-02',
          '2026-09-03',
          '2026-09-04',
          '2026-09-05',
          '2026-09-06',
        ].map((stayDate) => ({
          room_type_id: fixture.roomId,
          room_rate_id: fixture.rateId,
          rate_plan_id: fixture.planId,
          stay_date: stayDate,
          operational_closed: false,
          closed_to_arrival: false,
          closed_to_departure: false,
          safety_closed: false,
          requestable: false,
          blocking_reasons: [
            'room_rate_inactive',
            'public_activation_off',
          ],
          provenance: {
            exact_override_id: null,
            daily_rate: false,
            availability_version: null,
          },
        })),

        daily_inventory: [],
        unit_calendar_blocks: [],
        operational_overrides: [],
        rate_rule_operational_restrictions: [],
        booking_allocations: [],
        holds: [],
        unmapped_booking_blockers: [],
        recent_activity: [],
        public_change: false,
      };

      const store: any = {
        workspace,
        control,
        externalControl: {
          contract_version: 'hotels_v2_external_calendar_control_v2',
          hotel_id: fixture.hotelId,
          partner_id: null,
          assignment_id: null,
          permission_version: null,
          access_snapshot_token: null,
          snapshot_token: fixture.snapshot,
          hotel_external_sync_enabled: false,
          provider_capability: {
            contract_version: 'hotels_v2_external_calendar_provider_capability_v1',
            stage: 'provider_types_active',
            supported_providers: ['booking_com', 'airbnb', 'ical'],
            source_review_available: true,
            private_url_management_available: true,
            activation_available: false,
            manual_sync_available: false,
            worker_scheduler_ready: true,
          },
          provider_proposals: [fixture.providerProposalAcceptId, fixture.providerProposalRejectId].map((proposalId, index) => ({
            proposal_id: proposalId,
            hotel_id: fixture.hotelId,
            partner_id: fixture.partnerId,
            assignment_id: fixture.assignmentId,
            entity: 'calendar_source',
            action: 'update',
            source_id: fixture.externalSourceId,
            source_type: 'booking_com',
            room_type_id: fixture.roomId,
            reason: index === 0 ? 'Partner requests reviewed provider update' : 'Partner requests provider priority change',
            plan_fingerprint: index === 0 ? 'e'.repeat(64) : 'f'.repeat(64),
            status: 'pending_admin_review',
            submitted_at: fixture.updatedAt,
            expires_at: '2026-08-24T12:30:00.000Z',
            is_fresh: true,
            reviewed_at: null,
            reviewed_by: null,
            admin_reason: null,
          })),
          rooms: [{ id: fixture.roomId, name_i18n: clone(room.name_i18n), status: 'active', version: room.version }],
          sources: [{
            id: fixture.externalSourceId,
            hotel_id: fixture.hotelId,
            room_type_id: fixture.roomId,
            code: 'booking-upper',
            source_type: 'booking_com',
            is_enabled: false,
            review_status: 'reviewed',
            priority: 100,
            version: 1,
            updated_at: fixture.updatedAt,
            secret_configured: false,
            binding_version: null,
            sync_interval_minutes: 60,
            units_per_event: 1,
            health: {
              status: 'never_synced', last_attempt_at: null, last_success_at: null,
              last_failure_at: null, next_retry_at: null, consecutive_failures: 0,
              last_event_count: 0, last_active_event_count: 0, last_block_count: 0,
              last_error_code: null, last_error_message: null, state_version: 0,
            },
          }],
          public_change: false,
        },
        previewCalls: [],
        applyCalls: [],
        toasts: [],
        failApply: fixture.failApply,
        reviewedPlan: null,
      };

      store.providerReviews = {
        contract_version: 'hotels_v2_external_calendar_provider_review_list_v1',
        hotel_id: fixture.hotelId,
        proposals: clone(store.externalControl.provider_proposals),
      };

      root.__adminD = store;

      root.CE_HOTEL_PRICING = {
        normalizeHotelRoomTypes: () => [],
        getHotelMinPricePerNight: () => null,
      };

      root.showToast = (message: string, type: string) => {
        store.toasts.push({ message, type });
      };

      root.HotelsV2WorkspaceRepository = {
        listProperties: async () => [],

        getAvailabilityControl: async () =>
          clone(store.control),

        previewAvailabilityPlan: async (draft: any) => {
          store.previewCalls.push(clone(draft));

          const intent = clone(draft.intents[0]);

          const reviewedPlan = {
            contract_version:
              'hotels_v2_admin_d_availability_plan_v1',
            hotel_id: fixture.hotelId,
            from: draft.from,
            to: draft.to,
            snapshot_token: draft.snapshot_token,
            reviewed_at: fixture.updatedAt,
            operations: [{
              ...intent,
              id: fixture.dailyId,
              expected_version: 0,
              expected_original: {},
            }],
            plan_fingerprint: fixture.planFingerprint,
          };

          store.reviewedPlan = clone(reviewedPlan);

          return {
            contract_version:
              'hotels_v2_admin_d_availability_plan_preview_v1',
            hotel_id: fixture.hotelId,
            changed: true,
            blocking_reasons: [],
            plan_fingerprint: fixture.planFingerprint,
            reviewed_plan: reviewedPlan,
            impacts: [{
              entity: 'daily_inventory',
              action: 'upsert',
              id: fixture.dailyId,
              changed: true,
              affected_room_type_ids: [fixture.roomId],
              affected_room_rate_ids: [],
              from: '2026-09-01',
              to: '2026-09-01',
            }],
            current_control: clone(store.control),
          };
        },

        applyAvailabilityControlPlan: async (
          plan: any,
          correlationId: string,
          idempotencyKey: string,
        ) => {
          store.applyCalls.push({
            plan: clone(plan),
            correlationId,
            idempotencyKey,
          });

          if (store.failApply) {
            const error: any =
              new Error('Availability changed after Review.');
            error.userMessage =
              'Availability changed after Review.';
            error.isStale = true;
            error.isAmbiguousOutcome = false;
            throw error;
          }

          const refreshed = clone(store.control);
          refreshed.snapshot_token = 'd'.repeat(64);

          refreshed.daily_inventory = [{
            room_type_id: fixture.roomId,
            stay_date: '2026-09-01',
            sellable_units: 0,
            sellable_units_mode: 'set',
            closed: false,
            closed_mode: 'clear',
            reason: 'Reviewed inventory',
            expires_at: null,
            version: 1,
            updated_at: fixture.updatedAt,
          }];

          const refreshedCell = refreshed.cells.find(
            (cell: any) => cell.stay_date === '2026-09-01',
          );

          if (!refreshedCell) {
            throw new Error(
              'ADMIN-D E2E fixture lost the reviewed inventory day.',
            );
          }

          Object.assign(refreshedCell, {
            configured_sellable_units: 0,
            available_units: 0,
            blocking_reasons: [
              'inventory_exhausted',
              'public_activation_off',
            ],
            inventory_version: 1,
          });

          store.control = clone(refreshed);

          return {
            contract_version:
              'hotels_v2_admin_d_availability_apply_result_v1',
            hotel_id: fixture.hotelId,
            correlation_id: correlationId,
            idempotency_key: idempotencyKey,
            replayed: false,
            changed: true,
            activity: [],
            availability_control: refreshed,
          };
        },

        previewAvailabilityStay: async () => {
          throw new Error(
            'Stay preview is not part of this focused E2E.',
          );
        },

        previewExternalCalendarPlan: async () => {
          throw new Error('Provider Review stopped by the focused fixture.');
        },

        getExternalCalendarControl: async () => clone(store.externalControl),

        getExternalCalendarProviderReviews: async () => clone(store.providerReviews),

        previewExternalCalendarPartnerProposal: async (proposalValue: any, adminReason: string) => {
          const proposal = store.providerReviews.proposals.find(
            (row: any) => row.proposal_id === proposalValue.proposal_id,
          );
          if (!proposal) throw new Error('Provider proposal missing.');
          return {
            contract_version: 'hotels_v2_external_calendar_provider_admin_preview_v1',
            proposal: clone(proposal),
            preview: {
              contract_version: 'hotels_v2_external_calendar_preview_v1',
              hotel_id: fixture.hotelId,
              partner_id: null,
              changed: true,
              blocking_reasons: [],
              impacts: [{
                entity: 'calendar_source', action: 'update', id: fixture.externalSourceId,
                changed: true, fields: ['priority'], before: { priority: 100 }, after: { priority: 90 },
                affected_room_type_ids: [fixture.roomId], from: null, to: null,
              }],
              reviewed_plan: {
                contract_version: 'hotels_v2_external_calendar_plan_v1',
                review_id: fixture.providerReviewId,
                actor_type: 'admin', partner_id: null, hotel_id: fixture.hotelId,
                assignment_id: null, permission_version: null, access_snapshot_token: null,
                snapshot_token: fixture.snapshot, reviewed_at: fixture.updatedAt,
                expires_at: '2026-08-24T12:30:00.000Z',
                operations: [{
                  entity: 'calendar_source', action: 'update', id: fixture.externalSourceId,
                  expected_version: 1, expected_original: {}, payload: { priority: 90 }, reason: adminReason,
                }],
                plan_fingerprint: fixture.planFingerprint,
              },
            },
          };
        },

        applyExternalCalendarPartnerProposal: async (preview: any) => {
          const row = store.providerReviews.proposals.find((proposal: any) => proposal.proposal_id === preview.proposal.proposal_id);
          Object.assign(row, {
            status: 'accepted', is_fresh: false, reviewed_at: fixture.updatedAt,
            reviewed_by: fixture.providerReviewId, admin_reason: 'Accept exact Partner provider proposal',
          });
          store.externalControl.provider_proposals = clone(store.providerReviews.proposals);
          return { contract_version: 'hotels_v2_external_calendar_provider_admin_apply_v1', proposal: clone(row), apply: {}, replayed: false };
        },

        rejectExternalCalendarPartnerProposal: async (proposalValue: any, adminReason: string) => {
          const row = store.providerReviews.proposals.find(
            (proposal: any) => proposal.proposal_id === proposalValue.proposal_id,
          );
          Object.assign(row, {
            status: 'rejected', is_fresh: false, reviewed_at: fixture.updatedAt,
            reviewed_by: fixture.providerReviewId, admin_reason: adminReason,
          });
          store.externalControl.provider_proposals = clone(store.providerReviews.proposals);
          return { contract_version: 'hotels_v2_external_calendar_provider_admin_apply_v1', proposal: clone(row), apply: null, replayed: false };
        },

        clearExternalCalendarReviewedPlan: () => {},
      };
    },
    {
      hotelId: HOTEL_ID,
      roomId: ROOM_ID,
      planId: PLAN_ID,
      rateId: RATE_ID,
      dailyId: DAILY_ID,
      updatedAt: UPDATED_AT,
      snapshot: SNAPSHOT,
      planFingerprint: PLAN_FINGERPRINT,
      externalSourceId: EXTERNAL_SOURCE_ID,
      partnerId: PARTNER_ID,
      assignmentId: ASSIGNMENT_ID,
      providerProposalAcceptId: PROVIDER_PROPOSAL_ACCEPT_ID,
      providerProposalRejectId: PROVIDER_PROPOSAL_REJECT_ID,
      providerReviewId: PROVIDER_REVIEW_ID,
      failApply: Boolean(options.failApply),
    },
  );

  await page.addScriptTag({
    path: path.join(
      process.cwd(),
      'admin/hotels-v2-workspace.js',
    ),
  });

  await page.evaluate(() => {
    const root = window as any;
    const api = root.HotelsV2Workspace;

    api.state.workspace = root.__adminD.workspace;
    api.state.pricingControl = null;
    api.state.pricingControlError = null;
    api.state.pricingControlLoading = false;
    api.state.activeTab = 'calendar';

    api.state.calendar = {
      loading: false,
      error: null,
      anchor_date: '2026-09-01',
      view: 'week',
      data: root.__adminD.control,
      selected_product_ids: [],
      mobile_product_id: null,
      selection_start: null,
      selection_end: null,
      selection_anchor: null,
      drag_active: false,
      external_calendar: root.__adminD.externalControl,
      external_calendar_error: null,
      external_calendar_provider_reviews: root.__adminD.providerReviews,
      external_calendar_provider_reviews_error: null,
    };

    api.init();
    api.renderWorkspace();
  });
}

async function openReviewedInventoryChange(
  page: Page,
): Promise<void> {
  await expect(
    page.locator(
      '[data-hotel-workspace-tab="calendar"]',
    ),
  ).toHaveAttribute('aria-selected', 'true');

  const cell = page.locator(
    `[data-availability-cell][data-target-id="${ROOM_ID}"][data-date="2026-09-01"]`,
  );

  await expect(cell).toBeVisible();
  await cell.click();

  const editRange =
    page.locator('[data-calendar-edit-range]');

  await expect(editRange).toBeEnabled();
  await editRange.click();

  const form =
    page.locator('#hotelAvailabilityRangeForm');

  await expect(form).toBeVisible();

  await form
    .locator('[name="sellable_units_mode"]')
    .selectOption('set');

  await form
    .locator('[name="sellable_units"]')
    .fill('0');

  await form
    .locator('[name="reason"]')
    .fill('Reviewed inventory');

  await page
    .locator(
      'button[type="submit"][form="hotelAvailabilityRangeForm"]',
    )
    .click();

  const review =
    page.locator('.hotel-workspace-modal--review');

  await expect(review).toBeVisible();
  await expect(review).toContainText(
    'The server built the only plan eligible for Save.',
  );
  await expect(review).toContainText('daily inventory');
  await expect(review).toContainText('No prices');
  await expect(
    review.locator('[data-availability-confirm]'),
  ).toBeVisible();
}

test(
  'ADMIN-D Calendar inventory uses server Review and applies only the exact reviewed plan while V2 flags stay OFF',
  async ({ page }) => {
    await installAvailabilityHarness(page);

    await openReviewedInventoryChange(page);

    const beforeSave = await page.evaluate(() => {
      const root = window as any;

      return {
        previewCalls: root.__adminD.previewCalls,
        reviewedPlan: root.__adminD.reviewedPlan,
        flags:
          root.HotelsV2Workspace.state.workspace.flags,
      };
    });

    expect(beforeSave.previewCalls).toHaveLength(1);

    expect(beforeSave.previewCalls[0]).toMatchObject({
      contract_version:
        'hotels_v2_admin_d_availability_draft_v1',
      hotel_id: HOTEL_ID,
      snapshot_token: SNAPSHOT,
      intents: [{
        entity: 'daily_inventory',
        action: 'upsert',
        id: null,
        payload: {
          room_type_id: ROOM_ID,
          stay_date: '2026-09-01',
          sellable_units: 0,
          sellable_units_mode: 'set',
          reason: 'Reviewed inventory',
        },
      }],
    });

    expect(
      beforeSave.reviewedPlan.operations[0],
    ).toMatchObject({
      entity: 'daily_inventory',
      action: 'upsert',
      id: DAILY_ID,
      expected_version: 0,
      expected_original: {},
    });

    expect(
      Object.values(beforeSave.flags).every(
        (value) => value === false,
      ),
    ).toBe(true);

    await page
      .locator(
        '.hotel-workspace-modal--review [data-availability-confirm]',
      )
      .click();

    await expect(
      page.locator('.hotel-workspace-modal--review'),
    ).toHaveCount(0);

    const afterSave = await page.evaluate(() => {
      const root = window as any;

      return {
        applyCalls: root.__adminD.applyCalls,
        reviewedPlan: root.__adminD.reviewedPlan,
        flags:
          root.HotelsV2Workspace.state.workspace.flags,
        architecture:
          root.HotelsV2Workspace.state.workspace.property
            .architecture_version,
      };
    });

    expect(afterSave.applyCalls).toHaveLength(1);

    expect(afterSave.applyCalls[0].plan).toEqual(
      afterSave.reviewedPlan,
    );

    expect(
      afterSave.applyCalls[0].idempotencyKey,
    ).toMatch(/^availability:/);

    expect(
      afterSave.applyCalls[0].correlationId,
    ).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const payload =
      afterSave.applyCalls[0].plan.operations[0]
        .payload;

    expect(payload).not.toHaveProperty('nightly_rate');
    expect(payload).not.toHaveProperty('price');
    expect(payload).not.toHaveProperty('payment');
    expect(payload).not.toHaveProperty('partner_id');

    expect(afterSave.architecture).toBe('legacy');

    expect(
      Object.values(afterSave.flags).every(
        (value) => value === false,
      ),
    ).toBe(true);

    await expectNoBrowserIssues(page);
  },
);

test(
  'ADMIN provider control uses exact capability, Room mapping and clears a failed private URL Review',
  async ({ page }) => {
    await installAvailabilityHarness(page);
    const control = page.locator('[data-external-calendar-control]');
    await expect(control).toHaveAttribute('data-provider-stage', 'provider_types_active');
    await expect(control).toContainText('Booking.com');
    await expect(control).toContainText('Upper Apartment');
    await expect(control).toContainText('A private export URL is required before activation.');
    await expect(control.locator('[data-external-calendar-secret="set"]')).toBeEnabled();
    await expect(control.locator('[data-external-calendar-lifecycle="enable"]')).toBeDisabled();
    await expect(control.locator('[data-external-calendar-sync]')).toBeDisabled();

    await control.locator('[data-external-calendar-create]').click();
    const create = page.locator('#externalCalendarSourceForm');
    await expect(create.locator('select[name="source_type"] option')).toHaveText([
      'Booking.com', 'Airbnb', 'Generic iCal',
    ]);
    await expect(create.locator('select[name="room_type_id"] option')).toHaveCount(1);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    const transientUrl = 'https://provider-fixture.invalid/private-admin-feed.ics';
    await control.locator('[data-external-calendar-secret="set"]').click();
    const action = page.locator('#externalCalendarActionForm');
    await action.locator('input[name="ical_url"]').fill(transientUrl);
    await action.locator('input[name="reason"]').fill('Review private provider binding');
    await page.locator('button[type="submit"][form="externalCalendarActionForm"]').click();
    await expect(page.locator('#externalCalendarActionForm')).toHaveCount(0);
    await expect.poll(async () => page.evaluate(() => (window as any).__adminD.toasts.length)).toBeGreaterThan(0);
    expect(await page.locator('html').evaluate((node) => node.outerHTML)).not.toContain(transientUrl);
    await expectNoBrowserIssues(page);
  },
);

test(
  'ADMIN previews and accepts or rejects exact redacted Partner provider proposals',
  async ({ page }) => {
    await installAvailabilityHarness(page);
    const acceptCard = page.locator(`[data-external-calendar-proposal="${PROVIDER_PROPOSAL_ACCEPT_ID}"]`);
    await expect(acceptCard).toContainText('Partner provider proposal');
    await expect(acceptCard).toContainText('Booking.com');
    await expect(acceptCard).toContainText('Upper Apartment');
    await acceptCard.locator('[data-external-calendar-proposal-preview]').click();

    const reviewForm = page.locator('#externalCalendarProviderReviewForm');
    await expect(reviewForm).toBeVisible();
    await reviewForm.locator('input[name="admin_reason"]').fill('Accept exact Partner provider proposal');
    await page.locator('button[type="submit"][form="externalCalendarProviderReviewForm"]').click();
    await expect(page.locator('[data-external-calendar-proposal-accept]')).toBeVisible();
    await expect(page.locator('.hotel-workspace-modal--review')).toContainText('No private URL is exposed');
    await page.locator('[data-external-calendar-proposal-accept]').click();
    await expect(page.locator(`[data-external-calendar-proposal="${PROVIDER_PROPOSAL_ACCEPT_ID}"]`))
      .toHaveAttribute('data-proposal-status', 'accepted');

    const rejectCard = page.locator(`[data-external-calendar-proposal="${PROVIDER_PROPOSAL_REJECT_ID}"]`);
    await rejectCard.locator('[data-external-calendar-proposal-reject]').click();
    const rejectForm = page.locator('#externalCalendarProviderRejectForm');
    await rejectForm.locator('input[name="admin_reason"]').fill('Reject exact Partner provider proposal');
    await page.locator('button[type="submit"][form="externalCalendarProviderRejectForm"]').click();
    await expect(page.locator(`[data-external-calendar-proposal="${PROVIDER_PROPOSAL_REJECT_ID}"]`))
      .toHaveAttribute('data-proposal-status', 'rejected');

    expect(await page.locator('[data-external-calendar-control]').textContent()).not.toMatch(/vault_secret|ical_url|https:\/\/provider/i);
    await expectNoBrowserIssues(page);
  },
);

test(
  'ADMIN-D stale Calendar save stays on Review and never retries the mutation automatically',
  async ({ page }) => {
    await installAvailabilityHarness(page, {
      failApply: true,
    });

    await openReviewedInventoryChange(page);

    const confirm = page.locator(
      '.hotel-workspace-modal--review [data-availability-confirm]',
    );

    await confirm.click();

    await expect(
      page.locator('.hotel-workspace-modal--review'),
    ).toBeVisible();

    await expect(confirm).toBeEnabled();

    await page.waitForTimeout(50);

    const result = await page.evaluate(() => {
      const root = window as any;

      return {
        previewCount:
          root.__adminD.previewCalls.length,
        applyCount:
          root.__adminD.applyCalls.length,
        toasts: root.__adminD.toasts,
        flags:
          root.HotelsV2Workspace.state.workspace.flags,
      };
    });

    expect(result.previewCount).toBe(1);
    expect(result.applyCount).toBe(1);

    expect(
      result.toasts.some((entry: any) =>
        /changed after Review/i.test(entry.message),
      ),
    ).toBe(true);

    expect(
      Object.values(result.flags).every(
        (value) => value === false,
      ),
    ).toBe(true);

    await expectNoBrowserIssues(page);
  },
);
