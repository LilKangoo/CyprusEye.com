// Synthetic values, exact committed ADMIN-C DTO keys and 114410 identities.
// No production response, authentication material or live snapshot is stored.
export function independentPricingControl(includeHistorical = false): any {
  const hotel = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  const plan = '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  const updated = '2026-08-30T10:00:00.000Z';
  const immutable = { locked: true, contract_version: 'seven_kamares_legacy_to_h3_pricing_v1', reason: 'accepted_h3_1p_hotel_pricing_graph' };
  const rooms = [
    ['upper', 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94', '7e420964-9cbf-4f1b-abd3-09840af5240f', 'aec20731-7a56-35f0-334e-92b363351f02'],
    ['ground', '825c01b7-9f82-492a-9c81-9b1d5cd7acd3', '3320590d-632d-423f-80d0-fd021cba7293', '9d109336-64f3-3c57-4684-968b59c94c3b'],
  ];
  const schedules: any[] = rooms.map(([key, , rate, id], roomIndex) => ({
    id, hotel_id: hotel, code: `${key}-independent`, name_i18n: { pl: key, en: key, he: key },
    application_scope: 'room_occupancy', currency: 'EUR', maximum_party_size: 4,
    minimum_billable_occupancy: 2, is_active: true, review_status: 'reviewed',
    lifecycle_status: 'active', source: 'system', source_reference: {
      kind: 'system', cloned_from_schedule_id: null, pricing_model: null,
      pricing_fingerprint: null, rule_count: null, guest_counts: null, migration_blocker: null,
    }, sharing_mode: 'independent', linked_room_rate_ids: [rate],
    tiers: Array.from({ length: 27 }, (_, i) => ({
      id: `10000000-0000-0000-0000-${String(roomIndex * 27 + i + 1).padStart(12, '0')}`,
      schedule_id: id, guest_count: 2 + Math.floor(i / 9), threshold_nights: 2 + i % 9,
      nightly_rate: 100 + Math.floor(i / 9), is_active: true, version: 1, updated_at: updated,
    })), tiers_fingerprint: 'b'.repeat(32), link_fingerprint: 'b'.repeat(32),
    immutable_contract: immutable, activation_blockers: [], version: 1, updated_at: updated,
  }));
  if (includeHistorical) {
    for (const [i, id] of ['b0a3104f-7b31-5265-a59f-c2d166f11a23', '443065c0-984a-5de3-a22a-d03042c41107'].entries()) {
      const base = JSON.parse(JSON.stringify(schedules[0]));
      Object.assign(base, { id, code: `historical-${i}`, sharing_mode: 'shared', linked_room_rate_ids: [],
        is_active: i === 0, review_status: i === 0 ? 'reviewed' : 'requires_review',
        lifecycle_status: i === 0 ? 'active' : 'inactive',
        application_scope: i === 0 ? 'room_occupancy' : 'property_booking_party', maximum_party_size: i === 0 ? 4 : 8 });
      base.tiers = Array.from({ length: i === 0 ? 27 : 63 }, (_, j) => ({ ...base.tiers[j % 27],
        id: `20000000-0000-0000-0000-${String(i * 100 + j).padStart(12, '0')}`,
        schedule_id: id, guest_count: 2 + Math.floor(j / 9), threshold_nights: 2 + j % 9 }));
      schedules.push(base);
    }
  }
  return {
    contract_version: 'hotels_v2_admin_c_pricing_control_v1', hotel_id: hotel,
    property: { id: hotel, updated_at: updated, architecture_version: 'legacy', currency: 'EUR',
      minimum_stay_nights: 2, maximum_stay_nights: 30, children_policy: 'allowed', minimum_child_age: null, booking_mode: 'request_confirmation' },
    feature_flags: { hotel_rooms_v2_enabled: false, hotel_external_sync_enabled: true, hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false },
    legacy_safety: { architecture_version: 'legacy', legacy_pricing_authoritative: true,
      legacy_pricing_rule_count: 63, legacy_pricing_fingerprint: '7208ab4ecc0e47abd64d87ca1ac53a03', public_change: false },
    snapshot_token: 'a'.repeat(64),
    rate_plans: [{ id: plan, hotel_id: hotel, code: 'standard', name_i18n: { pl: 'Standard', en: 'Standard', he: 'סטנדרטי' },
      description_i18n: { pl: 'Standard', en: 'Standard', he: 'Standard' }, meal_plan_code: null,
      cancellation_policy: { type: 'non_refundable' }, booking_mode_override: null, price_inclusions: ['cleaning', 'taxes'],
      is_active: true, review_status: 'reviewed', lifecycle_status: 'active', review_basis: 'h3_1p_promotion',
      sort_order: 100, version: 4, updated_at: updated, immutable_contract: immutable, activation_blockers: [] }],
    room_types: rooms.map(([code, id]) => ({ id, hotel_id: hotel, code, name_i18n: { pl: code, en: code, he: code },
      status: 'active', max_occupancy: 4, capacity_adults: null, capacity_children: null, children_policy_override: null,
      minimum_child_age_override: null, inventory_mode: 'pooled', base_inventory_count: 1, active_unit_count: 0, version: 1, updated_at: updated })),
    room_rates: rooms.map(([, room, id, schedule]) => ({ id, hotel_id: hotel, room_type_id: room, rate_plan_id: plan,
      pricing_schedule_id: schedule, base_nightly_rate: 100, currency: 'EUR', external_redirect_url: null,
      is_active: true, review_status: 'reviewed', lifecycle_status: 'active', review_basis: 'h3_1p_promotion', sort_order: 100,
      version: 6, updated_at: updated, pricing_source: 'pricing_schedule', base_nightly_rate_authoritative: false,
      independent_tiers: [], independent_tiers_fingerprint: 'b'.repeat(32), immutable_contract: immutable, activation_blockers: [] })),
    pricing_schedules: schedules, rate_rules: [], exact_date_prices: [], allocation_rules: [],
    property_pricing_default: null, recent_activity: [],
  };
}

export function independentActivationSnapshot(sharedSnapshot: any): any {
  return { ...sharedSnapshot, status: 'active', blocking_reasons: [], legacy_authoritative: false,
    pricing_authority: 'independent_room_schedules', independent_topology: {
      contract_version: 'hotels_v2_seven_arches_independent_pricing_topology_v1',
      upper_schedule_id: 'aec20731-7a56-35f0-334e-92b363351f02',
      ground_schedule_id: '9d109336-64f3-3c57-4684-968b59c94c3b', authority_row_count: 54,
    } };
}
