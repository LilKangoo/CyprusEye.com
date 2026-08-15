import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const LEGACY_PRICING_FINGERPRINT = '7208ab4ecc0e47abd64d87ca1ac53a03';
const UPPER_ROOM_ID = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND_ROOM_ID = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const ROOM_SCHEDULE_ID = 'b0a3104f-7b31-5265-a59f-c2d166f11a23';
const PARTY_SCHEDULE_ID = '443065c0-984a-5de3-a22a-d03042c41107';
const RATE_PLAN_ID = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
const UPPER_RATE_ID = '7e420964-9cbf-4f1b-abd3-09840af5240f';
const GROUND_RATE_ID = '3320590d-632d-423f-80d0-fd021cba7293';
const THRESHOLDS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const ORACLE_DURATIONS = [...THRESHOLDS, 14] as const;

const LEGACY_RATES: Record<number, readonly number[]> = {
  2: [100, 90, 88, 84, 80, 76, 74, 72, 70],
  3: [130, 113, 113, 104, 100, 95, 94, 90, 90],
  4: [155, 135, 135, 120, 118, 114, 111, 107, 107],
  5: [200, 180, 176, 168, 160, 152, 148, 144, 140],
  6: [260, 226, 226, 208, 200, 190, 188, 180, 180],
  7: [310, 270, 270, 240, 236, 228, 222, 214, 214],
  8: [310, 270, 270, 240, 236, 228, 222, 214, 214],
};

const LEGACY_RULES = Object.entries(LEGACY_RATES).flatMap(([guestCount, rates]) =>
  THRESHOLDS.map((thresholdNights, index) => ({
    guestCount: Number(guestCount),
    thresholdNights,
    nightlyRate: rates[index],
  })),
);

// H2B.1 deliberately copied only the 2-4 guest portion into the shared
// room_occupancy schedule. Both exact apartments currently reference it.
const ROOM_RULES = LEGACY_RULES.filter((rule) => rule.guestCount >= 2 && rule.guestCount <= 4);

const BUNDLE_SPLITS: Record<number, readonly [
  { roomTypeId: string; allocatedGuestCount: number; pricingGuestCount: number },
  { roomTypeId: string; allocatedGuestCount: number; pricingGuestCount: number },
]> = {
  5: [
    { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 2 },
    { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 2, pricingGuestCount: 2 },
  ],
  6: [
    { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 3 },
    { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 3 },
  ],
  7: [
    { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 4, pricingGuestCount: 4 },
    { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 4 },
  ],
  8: [
    { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 4, pricingGuestCount: 4 },
    { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 4, pricingGuestCount: 4 },
  ],
};

function selectedThreshold(nights: number): number {
  return Math.max(...THRESHOLDS.filter((threshold) => threshold <= nights));
}

function legacyNightlyRate(guestCount: number, nights: number): number {
  const threshold = selectedThreshold(nights);
  const match = LEGACY_RULES.find((rule) => (
    rule.guestCount === guestCount && rule.thresholdNights === threshold
  ));
  if (!match) throw new Error(`Missing legacy tier for ${guestCount} guests / ${nights} nights.`);
  return match.nightlyRate;
}

function exactRoomNightlyRate(allocatedGuests: number, nights: number): {
  requestedGuests: number;
  billedGuests: number;
  nightlyRate: number;
  fabricatedOneGuestTier: boolean;
} {
  // The reviewed H3.1 floor is two guests. A one-guest quote must select the
  // real two-guest tier; it must never fabricate or persist a guest_count=1 row.
  const billedGuests = Math.max(2, allocatedGuests);
  const threshold = selectedThreshold(nights);
  const match = ROOM_RULES.find((rule) => (
    rule.guestCount === billedGuests && rule.thresholdNights === threshold
  ));
  if (!match) throw new Error(`Missing room tier for ${billedGuests} billed guests / ${nights} nights.`);
  return {
    requestedGuests: allocatedGuests,
    billedGuests,
    nightlyRate: match.nightlyRate,
    fabricatedOneGuestTier: ROOM_RULES.some((rule) => rule.guestCount === 1),
  };
}

function bundleNightlyRate(guestCount: number, nights: number): number {
  const split = BUNDLE_SPLITS[guestCount];
  if (!split) throw new Error(`Missing exact bundle split for ${guestCount} guests.`);
  return split.reduce((sum, item) => (
    sum + exactRoomNightlyRate(item.pricingGuestCount, nights).nightlyRate
  ), 0);
}

function unsafePhysicalOccupancyFallbackNightlyRate(guestCount: number, nights: number): number {
  const split = BUNDLE_SPLITS[guestCount];
  if (!split) throw new Error(`Missing exact bundle split for ${guestCount} guests.`);
  return split.reduce((sum, item) => (
    sum + exactRoomNightlyRate(item.allocatedGuestCount, nights).nightlyRate
  ), 0);
}

function loadCore(): any {
  const filename = path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js');
  const context: Record<string, any> = {
    console,
    crypto: { randomUUID: () => '31000000-0000-4000-8000-000000000001' },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.HotelsV2WorkspaceCore;
}

function loadRepository(client: any): { Core: any; Repository: any } {
  const context: Record<string, any> = {
    console,
    crypto: { randomUUID: () => '31000000-0000-4000-8000-000000000001' },
    window: { getSupabase: () => client },
  };
  for (const relative of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js']) {
    const filename = path.join(process.cwd(), relative);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return {
    Core: context.HotelsV2WorkspaceCore,
    Repository: context.HotelsV2WorkspaceRepository,
  };
}

function promotionComparison(
  requestedGuestCount: number,
  pricingItems: readonly {
    roomTypeId: string;
    roomRateId: string;
    pricingGuestCount: number;
  }[],
  nights: number,
): Record<string, any> {
  const expectedLegacyGuestCount = Math.max(2, requestedGuestCount);
  const roomNightlyRates = pricingItems.map((item) => ({
    room_type_id: item.roomTypeId,
    room_rate_id: item.roomRateId,
    pricing_guest_count: item.pricingGuestCount,
    nightly_rate: exactRoomNightlyRate(item.pricingGuestCount, nights).nightlyRate,
  }));
  const roomRateSum = roomNightlyRates.reduce((total, rate) => total + rate.nightly_rate, 0);
  const legacyNightlyRateForStay = legacyNightlyRate(expectedLegacyGuestCount, nights);
  return {
    nights,
    threshold_nights: selectedThreshold(nights),
    requested_guest_count: requestedGuestCount,
    priced_occupancy: pricingItems.length === 1 ? pricingItems[0].pricingGuestCount : null,
    room_nightly_rates: roomNightlyRates,
    legacy_nightly_rate: legacyNightlyRateForStay,
    room_rate_sum: roomRateSum,
    stay_total: roomRateSum * nights,
    delta_from_legacy: roomRateSum - legacyNightlyRateForStay,
    currency: 'EUR',
  };
}

function pricingPromotionPreview(): any {
  const choicePreview = [1, 2, 3, 4].map((guestCount) => ({
    guest_count: guestCount,
    allocation_mode: 'customer_choice',
    options: [UPPER_ROOM_ID, GROUND_ROOM_ID].map((roomTypeId) => ({
      allocation: [{
        room_type_id: roomTypeId,
        room_rate_id: roomTypeId === UPPER_ROOM_ID ? UPPER_RATE_ID : GROUND_RATE_ID,
        allocated_guest_count: null,
        pricing_guest_count: null,
        units_required: 1,
      }],
      nightly_comparisons: ORACLE_DURATIONS.map((nights) => (
        promotionComparison(guestCount, [{
          roomTypeId,
          roomRateId: roomTypeId === UPPER_ROOM_ID ? UPPER_RATE_ID : GROUND_RATE_ID,
          pricingGuestCount: Math.max(2, guestCount),
        }], nights)
      )),
    })),
  }));
  const bundlePreview = [5, 6, 7, 8].map((guestCount) => ({
    guest_count: guestCount,
    allocation_mode: 'required_bundle',
    options: [{
      allocation: BUNDLE_SPLITS[guestCount].map((item) => ({
        room_type_id: item.roomTypeId,
        room_rate_id: item.roomTypeId === UPPER_ROOM_ID ? UPPER_RATE_ID : GROUND_RATE_ID,
        allocated_guest_count: item.allocatedGuestCount,
        pricing_guest_count: item.pricingGuestCount,
        units_required: 1,
      })),
      nightly_comparisons: ORACLE_DURATIONS.map((nights) => (
        promotionComparison(
          guestCount,
          BUNDLE_SPLITS[guestCount].map((item) => ({
            roomTypeId: item.roomTypeId,
            roomRateId: item.roomTypeId === UPPER_ROOM_ID ? UPPER_RATE_ID : GROUND_RATE_ID,
            pricingGuestCount: item.pricingGuestCount,
          })),
          nights,
        )
      )),
    }],
  }));
  return {
    hotel_id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    contract_version: 'seven_kamares_legacy_to_h3_pricing_v1',
    supported: true,
    public_change: false,
    property: {
      id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      architecture_version: 'legacy',
      updated_at: '2026-08-15T12:00:00.000Z',
    },
    flags: {
      hotel_rooms_v2_enabled: false,
      hotel_external_sync_enabled: false,
      hotel_instant_booking_enabled: false,
      hotel_stripe_connect_enabled: false,
    },
    source: {
      pricing_model: 'tiered_by_nights',
      currency: 'EUR',
      rule_count: 63,
      pricing_fingerprint: LEGACY_PRICING_FINGERPRINT,
      tier_fingerprint: 'source-tier-fingerprint',
      tiers: LEGACY_RULES.map((tier) => ({
        guest_count: tier.guestCount,
        threshold_nights: tier.thresholdNights,
        nightly_rate: tier.nightlyRate,
      })),
      property_party_preview: {
        id: PARTY_SCHEDULE_ID,
        tier_count: 63,
        tier_fingerprint: 'party-tier-fingerprint',
        tiers: LEGACY_RULES.map((tier) => ({
          guest_count: tier.guestCount,
          threshold_nights: tier.thresholdNights,
          nightly_rate: tier.nightlyRate,
        })),
      },
    },
    target: {
      rate_plan: { id: RATE_PLAN_ID, code: 'standard', is_active: false },
      rooms: [{ id: UPPER_ROOM_ID }, { id: GROUND_ROOM_ID }],
      room_rates: [
        {
          id: UPPER_RATE_ID,
          room_type_id: UPPER_ROOM_ID,
          rate_plan_id: RATE_PLAN_ID,
          pricing_schedule_id: ROOM_SCHEDULE_ID,
          is_active: false,
        },
        {
          id: GROUND_RATE_ID,
          room_type_id: GROUND_ROOM_ID,
          rate_plan_id: RATE_PLAN_ID,
          pricing_schedule_id: ROOM_SCHEDULE_ID,
          is_active: false,
        },
      ],
      room_schedule: {
        id: ROOM_SCHEDULE_ID,
        is_active: false,
        review_status: 'requires_review',
        tier_count: 27,
        tier_fingerprint: 'room-tier-fingerprint',
        tiers: ROOM_RULES.map((tier) => ({
          guest_count: tier.guestCount,
          threshold_nights: tier.thresholdNights,
          nightly_rate: tier.nightlyRate,
        })),
      },
      allocation_fingerprint: 'allocation-fingerprint',
      target_fingerprint: 'target-fingerprint',
    },
    allocation_previews: [...choicePreview, ...bundlePreview],
    pricing_occupancy_mapping_fingerprint: 'pricing-occupancy-mapping-fingerprint',
    parity: {
      threshold_case_count: 63,
      threshold_mismatch_count: 0,
      long_stay_case_count: 7,
      long_stay_mismatch_count: 0,
      total_case_count: 70,
      total_mismatch_count: 0,
      fingerprint: 'parity-fingerprint',
    },
    expected: {
      property_updated_at: '2026-08-15T12:00:00.000Z',
      room_schedule_version: 4,
      allocation_fingerprint: 'allocation-fingerprint',
    },
    snapshot_token: 'snapshot-v4',
    promotion: { decision: 'promote_room_schedule_to_reviewed' },
    safety: { legacy_unchanged: true, public_change: false },
    blockers: [],
  };
}

describe('Hotels V2 H3.1P 7 Kamares legacy pricing-promotion parity audit', () => {
  test('pins the accepted source and the exact 63-to-27 shadow derivation', () => {
    expect(LEGACY_PRICING_FINGERPRINT).toBe('7208ab4ecc0e47abd64d87ca1ac53a03');
    expect(LEGACY_RULES).toHaveLength(63);
    expect(ROOM_RULES).toHaveLength(27);
    expect(new Set(ROOM_RULES.map((rule) => rule.guestCount))).toEqual(new Set([2, 3, 4]));

    const migration = fs.readFileSync(
      'supabase/migrations/20260811240000_hotels_v2_h2b1_children_shadow_rooms.sql',
      'utf8',
    );
    expect(migration).toContain("continue when (v_rule->>'persons')::integer>4");
    expect(migration).toContain("'guest_counts',jsonb_build_array(2,3,4)");
    expect(migration).toContain("v_price_fingerprint:=md5(v_hotel.pricing_tiers::text)");

    const legacyVerify = fs.readFileSync(
      'supabase/manual/hotels_v2_h2a_legacy_price_visibility_verify.sql',
      'utf8',
    );
    expect(legacyVerify).toContain(
      "hotel.id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid",
    );
    expect(legacyVerify).toContain(`md5(hotel.pricing_tiers::text) = '${LEGACY_PRICING_FINGERPRINT}'`);
    expect(legacyVerify).toContain(
      "hotel.id = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid",
    );
    expect(legacyVerify).toContain("md5(hotel.pricing_tiers::text) = 'e272ec40b78069a1e2e49ac6b0956f11'");
  });

  test('keeps one guest on the real two-guest floor and preserves 2-4 guest customer-choice prices', () => {
    expect(ROOM_RULES.some((rule) => rule.guestCount === 1)).toBe(false);

    for (const nights of ORACLE_DURATIONS) {
      const oneGuest = exactRoomNightlyRate(1, nights);
      expect(oneGuest).toEqual({
        requestedGuests: 1,
        billedGuests: 2,
        nightlyRate: legacyNightlyRate(2, nights),
        fabricatedOneGuestTier: false,
      });
    }

    const choiceCases = [2, 3, 4].flatMap((guestCount) =>
      THRESHOLDS.map((nights) => ({ guestCount, nights })),
    );
    expect(choiceCases).toHaveLength(27);
    expect(choiceCases.filter(({ guestCount, nights }) => (
      exactRoomNightlyRate(guestCount, nights).nightlyRate !== legacyNightlyRate(guestCount, nights)
    ))).toEqual([]);
  });

  test('separates physical allocation from reviewed pricing occupancy and reproduces all 63 legacy tiers', () => {
    expect(BUNDLE_SPLITS).toEqual({
      5: [
        { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 2 },
        { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 2, pricingGuestCount: 2 },
      ],
      6: [
        { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 3 },
        { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 3 },
      ],
      7: [
        { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 4, pricingGuestCount: 4 },
        { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 4 },
      ],
      8: [
        { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 4, pricingGuestCount: 4 },
        { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 4, pricingGuestCount: 4 },
      ],
    });

    const tierComparisons = [5, 6, 7, 8].flatMap((guestCount) =>
      THRESHOLDS.map((nights) => ({
        guestCount,
        nights,
        split: BUNDLE_SPLITS[guestCount],
        legacyNightly: legacyNightlyRate(guestCount, nights),
        allocatedRoomNightlySum: bundleNightlyRate(guestCount, nights),
      })),
    );
    const reviewedMappingMismatches = tierComparisons.filter((entry) => (
      entry.legacyNightly !== entry.allocatedRoomNightlySum
    ));

    expect(tierComparisons).toHaveLength(36);
    expect(reviewedMappingMismatches).toEqual([]);
    expect(tierComparisons).toEqual(expect.arrayContaining([
      {
        guestCount: 5,
        nights: 2,
        split: [
          { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 2 },
          { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 2, pricingGuestCount: 2 },
        ],
        legacyNightly: 200,
        allocatedRoomNightlySum: 200,
      },
      {
        guestCount: 7,
        nights: 2,
        split: [
          { roomTypeId: UPPER_ROOM_ID, allocatedGuestCount: 4, pricingGuestCount: 4 },
          { roomTypeId: GROUND_ROOM_ID, allocatedGuestCount: 3, pricingGuestCount: 4 },
        ],
        legacyNightly: 310,
        allocatedRoomNightlySum: 310,
      },
    ]));

    const allLegacyCases = [2, 3, 4, 5, 6, 7, 8].flatMap((guestCount) =>
      ORACLE_DURATIONS.map((nights) => ({ guestCount, nights })),
    );
    expect(allLegacyCases).toHaveLength(70);
    expect(allLegacyCases.filter(({ guestCount, nights }) => {
      const h3Rate = guestCount <= 4
        ? exactRoomNightlyRate(guestCount, nights).nightlyRate
        : bundleNightlyRate(guestCount, nights);
      return h3Rate !== legacyNightlyRate(guestCount, nights);
    })).toEqual([]);
  });

  test('fails closed instead of silently pricing bundles from physical occupancy', () => {
    const physicalFallbackComparisons = [5, 6, 7, 8].flatMap((guestCount) =>
      THRESHOLDS.map((nights) => ({
        guestCount,
        nights,
        legacyNightly: legacyNightlyRate(guestCount, nights),
        unsafeFallbackNightly: unsafePhysicalOccupancyFallbackNightlyRate(guestCount, nights),
      })),
    );
    const mismatches = physicalFallbackComparisons.filter((entry) => (
      entry.legacyNightly !== entry.unsafeFallbackNightly
    ));
    expect(mismatches).toHaveLength(18);
    expect(new Set(mismatches.map((entry) => entry.guestCount))).toEqual(new Set([5, 7]));
    expect(mismatches).toEqual(expect.arrayContaining([
      { guestCount: 5, nights: 2, legacyNightly: 200, unsafeFallbackNightly: 230 },
      { guestCount: 7, nights: 2, legacyNightly: 310, unsafeFallbackNightly: 285 },
    ]));
  });

  test('shows why the current zero-mismatch verifier is not an allocation-price oracle', () => {
    const verify = fs.readFileSync(
      'supabase/manual/hotels_v2_h3_1_seven_kamares_configuration_verify.sql',
      'utf8',
    );
    expect(verify).toContain('room_schedule_mismatch as');
    expect(verify).toContain('party_schedule_mismatch as');
    expect(verify).toContain('room_parity.mismatch_count=0 and party_parity.mismatch_count=0');
    expect(verify).not.toContain('allocation_price_replay as');
    expect(verify).not.toContain('allocation_sum_price_mismatch');

    const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
    expect(ui).toContain('Future customer pricing is the sum of exact allocated Room Rates');
    expect(ui).toContain('property_booking_party schedule is legacy preview only and never customer pricing');
  });

  test('keeps the legacy source locked and fingerprinted rather than accepting browser-supplied money', () => {
    const migration = fs.readFileSync(
      'supabase/migrations/20260811240000_hotels_v2_h2b1_children_shadow_rooms.sql',
      'utf8',
    );
    expect(migration).toContain('select * into v_hotel from public.hotels where id=c_hotel for update');
    expect(migration).toContain("message='hotels_v2_h2b1_stale_legacy_pricing'");
    expect(migration).toContain("message='hotels_v2_h2b1_correlation_id_already_used'");
    expect(migration).toContain('Money is copied only from the freshly locked legacy source');
    expect(migration).not.toMatch(/set\s+pricing_tiers\s*=/i);
  });

  test('validates the frozen Admin preview contract and builds only an explicitly acknowledged exact plan', () => {
    const Core = loadCore();
    const preview = pricingPromotionPreview();
    const validated = Core.validateLegacyPricingPromotionPreview(preview);

    expect(Core.SEVEN_KAMARES_LEGACY_PRICING_FINGERPRINT).toBe(LEGACY_PRICING_FINGERPRINT);
    expect(validated.parity_mismatch_count).toBe(0);
    expect(validated.allocation_previews).toHaveLength(8);
    expect(() => Core.buildLegacyPricingPromotionPlan(validated, false)).toThrow(
      'Explicitly acknowledge the reviewed physical-allocation and pricing-occupancy mapping.',
    );

    const plan = Core.buildLegacyPricingPromotionPlan(validated, true);
    expect(plan).toMatchObject({
      hotel_id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      snapshot_token: 'snapshot-v4',
      decision: 'promote_room_schedule_to_reviewed',
      acknowledge_pricing_occupancy_mapping: true,
      expected: {
        room_schedule_version: 4,
        allocation_fingerprint: 'allocation-fingerprint',
      },
    });
  });

  test('rejects a physical-occupancy fallback, fabricated one-person tier, or any nonzero parity delta', () => {
    const Core = loadCore();

    const physicalFallback = pricingPromotionPreview();
    physicalFallback.allocation_previews.find((entry: any) => entry.guest_count === 5)
      .options[0].allocation[0].pricing_guest_count = 3;
    expect(() => Core.validateLegacyPricingPromotionPreview(physicalFallback)).toThrow(
      'The 5-guest allocation preview does not match the reviewed two-apartment bundle.',
    );

    const fabricatedOneGuest = pricingPromotionPreview();
    fabricatedOneGuest.allocation_previews.find((entry: any) => entry.guest_count === 1)
      .options[0].nightly_comparisons[0].priced_occupancy = 1;
    expect(() => Core.validateLegacyPricingPromotionPreview(fabricatedOneGuest)).toThrow(
      'The 1-guest customer-choice replay returned a different pricing occupancy.',
    );

    const fabricatedTier = pricingPromotionPreview();
    fabricatedTier.source.tiers[0].guest_count = 1;
    expect(() => Core.validateLegacyPricingPromotionPreview(fabricatedTier)).toThrow(
      'The legacy source must contain every exact 2–8 guest × 2–10 night threshold once.',
    );

    const priceMismatch = pricingPromotionPreview();
    const comparison = priceMismatch.allocation_previews.find((entry: any) => entry.guest_count === 7)
      .options[0].nightly_comparisons[0];
    comparison.room_rate_sum -= 25;
    comparison.delta_from_legacy = -25;
    priceMismatch.parity_mismatch_count = 1;
    expect(() => Core.validateLegacyPricingPromotionPreview(priceMismatch)).toThrow(
      'The pricing occupancy mapping does not reproduce the legacy 70-case totals exactly.',
    );
  });

  test('rejects wrong source identity, partial replay coverage, or an activated target', () => {
    const Core = loadCore();

    const wrongSource = pricingPromotionPreview();
    wrongSource.source.pricing_fingerprint = 'e272ec40b78069a1e2e49ac6b0956f11';
    expect(() => Core.validateLegacyPricingPromotionPreview(wrongSource)).toThrow(
      'The legacy pricing source no longer matches the accepted 7 Kamares fingerprint.',
    );

    const missingGuest = pricingPromotionPreview();
    missingGuest.allocation_previews.splice(6, 1);
    expect(() => Core.validateLegacyPricingPromotionPreview(missingGuest)).toThrow(
      'The allocation replay must contain each exact requested party size from 1 through 8 in order.',
    );

    const missingLongStay = pricingPromotionPreview();
    missingLongStay.allocation_previews[0].options[0].nightly_comparisons.pop();
    expect(() => Core.validateLegacyPricingPromotionPreview(missingLongStay)).toThrow(
      'The 1-guest allocation option must replay exact stays 2–10 nights and 14 nights.',
    );

    const activated = pricingPromotionPreview();
    activated.target.room_rates[0].is_active = true;
    expect(() => Core.validateLegacyPricingPromotionPreview(activated)).toThrow(
      'The reviewed Rate Plan, Room Rates and shared Room schedule must remain inactive.',
    );
  });

  test('rebases harmless version-only drift onto fresh optimistic tokens but blocks changed pricing fingerprints', () => {
    const Core = loadCore();
    const original = pricingPromotionPreview();
    const versionOnly = pricingPromotionPreview();
    versionOnly.expected.room_schedule_version = 5;
    versionOnly.expected.property_updated_at = '2026-08-15T12:05:00.000Z';
    versionOnly.snapshot_token = 'snapshot-v5';

    expect(Core.reconcileLegacyPricingPromotion(original, versionOnly)).toMatchObject({
      safe: true,
      conflicts: [],
    });
    expect(Core.buildLegacyPricingPromotionPlan(versionOnly, true)).toMatchObject({
      snapshot_token: 'snapshot-v5',
      expected: { room_schedule_version: 5 },
    });

    const conflicting = pricingPromotionPreview();
    conflicting.source.pricing_fingerprint = 'changed-source-fingerprint';
    const reconciliation = Core.reconcileLegacyPricingPromotion(original, conflicting);
    expect(reconciliation.safe).toBe(false);
    expect(reconciliation.conflicts).toContain('source_pricing_fingerprint');
  });

  test('uses only exact Admin RPCs and never retries a controlled stale pricing save', async () => {
    const calls: Array<{ name: string; payload: any }> = [];
    const preview = pricingPromotionPreview();
    const correlationId = '31000000-0000-4000-8000-000000000099';
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        if (name === 'hotel_v2_admin_get_legacy_pricing_promotion_preview') {
          return { data: preview, error: null };
        }
        if (name === 'hotel_v2_admin_apply_legacy_pricing_promotion') {
          return {
            data: null,
            error: { code: 'PT409', message: 'hotels_v2_h3_pricing_promotion_stale_review' },
          };
        }
        throw new Error(`Unexpected RPC ${name}`);
      },
      from() { throw new Error('Raw table fallback is forbidden.'); },
    };
    const { Core, Repository } = loadRepository(client);
    const fresh = await Repository.getLegacyPricingPromotionPreview(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    );
    const plan = Core.buildLegacyPricingPromotionPlan(fresh, true);

    await expect(Repository.applyLegacyPricingPromotion(plan, correlationId)).rejects.toMatchObject({
      code: 'PT409',
      diagnosticReason: 'hotels_v2_h3_pricing_promotion_stale_review',
      isStale: true,
      isDefinitiveFailure: true,
      isAmbiguousOutcome: false,
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      name: 'hotel_v2_admin_get_legacy_pricing_promotion_preview',
      payload: { p_hotel_id: '9b6d99a0-923a-4fbc-be54-c066e856e6ca' },
    });
    expect(calls[1]).toEqual({
      name: 'hotel_v2_admin_apply_legacy_pricing_promotion',
      payload: { p_plan: plan, p_correlation_id: correlationId },
    });
  });

  test('keeps the Admin preparation review-first, explicit, inactive and public-inert', () => {
    const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
    const repository = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
    const core = fs.readFileSync('admin/hotels-v2-workspace-core.js', 'utf8');

    expect(repository).toContain("legacyPricingPromotionPreview: 'hotel_v2_admin_get_legacy_pricing_promotion_preview'");
    expect(repository).toContain("applyLegacyPricingPromotion: 'hotel_v2_admin_apply_legacy_pricing_promotion'");
    expect(core).toContain(`const SEVEN_KAMARES_LEGACY_PRICING_FINGERPRINT = '${LEGACY_PRICING_FINGERPRINT}'`);
    expect(ui).toContain('I reviewed the physical allocation and Pricing occupancy mapping.');
    expect(ui).toContain('Save reviewed pricing preparation');
    expect(ui).toContain('Nothing was retried; inspect this Review and click Save explicitly again.');
    expect(ui).toContain('Legacy pricing, public pages, booking payloads, bookings and fulfillments are not mutation targets.');
    expect(ui).toContain('Pricing occupancy mapping');
    expect(ui).toContain('70-case parity replay');
    expect(ui).toContain('No · unchanged');
    expect((ui.match(/Repository\.applyLegacyPricingPromotion\(plan\)/g) || [])).toHaveLength(1);
  });
});
