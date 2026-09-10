// Synthetic read DTO; no production response or identity material.
export const HOTEL_114485 = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
export function content114485(Core: any): any {
  const flags = { hotel_rooms_v2_enabled: true, hotel_external_sync_enabled: true,
    hotel_instant_booking_enabled: false, hotel_stripe_connect_enabled: false };
  return {
    contract_version: 'hotels_v2_admin_b_content_control_v1', hotel_id: HOTEL_114485,
    property_updated_at: '2026-09-11T00:00:00Z', architecture_version: 'legacy',
    feature_flags: { ...flags }, commercial_owner: null,
    operational_profile: { exists: false, version: 0, updated_at: null,
      maximum_stay_nights: null, guest_instructions_i18n: {}, check_in_instructions_i18n: {},
      check_out_instructions_i18n: {}, internal_operational_notes: null },
    assignment_snapshot: {
      contract_version: 'hotels_v2_h3_2a_partner_permissions_v1',
      property: { id: HOTEL_114485, updated_at: '2026-09-11T00:00:00Z', architecture_version: 'legacy', status: 'active', is_published: false },
      feature_flags: { ...flags }, capability_catalog: [...Core.HOTEL_PARTNER_CAPABILITIES],
      snapshot_token: 'synthetic-snapshot', assignment_fingerprint: 'synthetic-assignment',
      permissions_fingerprint: 'synthetic-permissions', assignments: [],
    },
  };
}
