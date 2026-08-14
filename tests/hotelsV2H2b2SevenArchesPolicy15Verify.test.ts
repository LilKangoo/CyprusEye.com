import fs from 'node:fs';

const verify = fs.readFileSync(
  'supabase/manual/hotels_v2_h2b2_seven_arches_policy_15_verify.sql',
  'utf8',
);

describe('Hotels H2B.2 final 7 Arches age-15 verifier', () => {
  test('is a read-only, exact-property one-row audit', () => {
    expect(verify).toContain('READ ONLY');
    expect(verify).not.toMatch(/^\s*(insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/im);
    expect(verify).toContain("'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id");
    expect(verify).toContain('hotels_v2_h2b2_seven_arches_policy_15_safe');
  });

  test('requires exactly the two reviewed shadow rooms with inherited effective age 15', () => {
    for (const id of [
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
    ]) expect(verify).toContain(id);

    expect(verify).toContain("hotel.children_policy='minimum_age'");
    expect(verify).toContain('hotel.minimum_child_age=15');
    expect(verify).toContain('coalesce(room.children_policy_override,hotel.children_policy) effective_children_policy');
    expect(verify).toContain('coalesce(room.minimum_child_age_override,hotel.minimum_child_age)');
    expect(verify).toContain('room.children_policy_override is null');
    expect(verify).toContain('room.minimum_child_age_override is null');
    expect(verify).toContain("room.effective_children_policy='minimum_age'");
    expect(verify).toContain('room.effective_minimum_child_age=15');
    expect(verify).toContain('rooms.upper_policy_override,rooms.upper_minimum_age_override');
    expect(verify).toContain('rooms.upper_effective_policy,rooms.upper_effective_minimum_age');
    expect(verify).toContain('rooms.ground_policy_override,rooms.ground_minimum_age_override');
    expect(verify).toContain('rooms.ground_effective_policy,rooms.ground_effective_minimum_age');
    expect(verify).toContain('rooms.room_count=2');
    expect(verify).toContain('rooms.exact_id_count=2');
    expect(verify).toContain('rooms.unexpected_room_count=0');
  });

  test('requires canonical room amenities and property-owned non-empty galleries', () => {
    expect(verify).toContain("array['air_conditioning','balcony','terrace']::text[] upper_amenities");
    expect(verify).toContain("array['air_conditioning','terrace']::text[] ground_amenities");
    expect(verify).toContain('constants.upper_amenities @> room.amenities');
    expect(verify).toContain('constants.ground_amenities @> room.amenities');
    expect(verify).toContain('and jsonb_array_length(room.gallery)>0');
    expect(verify).toContain('rooms.upper_gallery_count=6 and rooms.ground_gallery_count=5');
    expect(verify).toContain('property_photo.value=room_photo.photo');
    expect(verify).toContain('gallery.foreign_photo_count=0');
    expect(verify).toContain('gallery.duplicate_photo_count=0');
    expect(verify).toContain('property_state.property_gallery_count=9');
  });

  test('pins the accepted inactive pricing graph without rewriting reviewed policy', () => {
    for (const id of [
      '22e47a63-a630-4fb6-8f43-816f2d3fdc17',
      '7e420964-9cbf-4f1b-abd3-09840af5240f',
      '3320590d-632d-423f-80d0-fd021cba7293',
      'b0a3104f-7b31-5265-a59f-c2d166f11a23',
      '443065c0-984a-5de3-a22a-d03042c41107',
    ]) expect(verify).toContain(id);

    expect(verify).toContain("'{\"type\":\"non_refundable\"}'::jsonb accepted_cancellation_policy");
    expect(verify).toContain('and not plan.is_active');
    expect(verify).toContain('and plan.version=2');
    expect(verify).toContain('plan.cancellation_policy=constants.accepted_cancellation_policy');
    expect(verify).toContain('rate_plan.policy_fingerprint=md5(constants.accepted_cancellation_policy::text)');
    expect(verify).toContain('room_rates.rate_count=2');
    expect(verify).toContain('schedules.schedule_count=2');
    expect(verify).toContain('tiers.total_tier_count=90');
    expect(verify).toContain('tiers.room_tier_count=27');
    expect(verify).toContain('tiers.party_tier_count=63');
    expect(verify).toContain('tiers.unexpected_or_inactive_tier_count=0');
  });

  test('fails closed on flags, protected history and every parity counter', () => {
    for (const flag of [
      'hotel_rooms_v2_enabled',
      'hotel_external_sync_enabled',
      'hotel_instant_booking_enabled',
      'hotel_stripe_connect_enabled',
    ]) expect(verify).toContain(flag);

    for (const fingerprint of [
      'fb5a4c508b0df32afbffe5b1594c7a50',
      '1e01541853d87d26adccb8172074934b',
      '42b5e1dc9726890e90014c3e89c2329d',
      'd41d8cd98f00b204e9800998ecf8427e',
    ]) expect(verify).toContain(fingerprint);

    for (const counter of [
      'HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH',
      'HOTEL_LEGACY_PRICE_MISMATCH',
      'HOTEL_LEGACY_PUBLIC_MISMATCH',
      'HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE',
    ]) {
      expect(verify).toContain(counter);
      expect(verify).toContain(`oracle.${counter.toLowerCase()}`);
    }
    expect(verify).toContain('flags.settings_count=1 and flags.flags_off_count=1');
  });
});
