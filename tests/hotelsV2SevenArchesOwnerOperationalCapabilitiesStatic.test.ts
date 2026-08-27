import fs from 'node:fs';

const read = (filename: string): string => fs.readFileSync(filename, 'utf8');

function sliceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function quotedNames(source: string): string[] {
  return [...source.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);
}

describe('Hotels V2 7 Arches owner live-baseline lock boundary', () => {
  test('locks the exact frozen fingerprint dependency union before any protected read', () => {
    const adminD = read(
      'supabase/migrations/20260811360000_hotels_v2_admin_d_availability_inventory_control.sql',
    );
    const h32b = read(
      'supabase/migrations/20260811380000_hotels_v2_h3_2b_partner_hotel_workspace.sql',
    );
    const externalCalendar = read(
      'supabase/migrations/20260811420000_hotels_v2_external_calendar_reviewed_control.sql',
    );
    const owner = read(
      'supabase/migrations/20260811436000_hotels_v2_seven_arches_owner_operational_capabilities.sql',
    );

    const adminHelper = sliceBetween(
      adminD,
      'create function public.hotel_v2_admin_d_protected_fingerprints()',
      'create table public.hotel_admin_availability_foundation_receipts',
    );
    const adminRelations = new Set<string>();
    for (const match of adminHelper.matchAll(
      /\('([a-z0-9_]+)',(?:'\{\}'::text\[\]|array\[)/g,
    )) {
      adminRelations.add(`public.${match[1]}`);
    }
    for (const match of adminHelper.matchAll(/from public\.([a-z0-9_]+)/g)) {
      adminRelations.add(`public.${match[1]}`);
    }
    expect(adminRelations.size).toBe(46);

    const h32bHelper = sliceBetween(
      h32b,
      'create function public.hotel_v2_h3_2b_protected_fingerprints()',
      'create table public.hotel_partner_workspace_foundation_receipts',
    );
    const loopRelations = h32bHelper.match(
      /foreach v_relation in array array\[([\s\S]*?)\] loop/,
    );
    expect(loopRelations).not.toBeNull();
    const h32bRelations = new Set<string>(
      quotedNames(loopRelations?.[1] ?? '').map((name) => `public.${name}`),
    );
    for (const match of h32bHelper.matchAll(/from public\.([a-z0-9_]+)/g)) {
      h32bRelations.add(`public.${match[1]}`);
    }
    expect(h32bRelations.size).toBe(50);

    const externalHelper = sliceBetween(
      externalCalendar,
      'create function public.hotel_v2_external_calendar_protected_fingerprints()',
      'create table hotels_v2_private.hotel_external_calendar_foundation_receipts',
    );
    expect(externalHelper).toContain('public.hotel_v2_h3_2b_protected_fingerprints()');
    for (const match of externalHelper.matchAll(/from public\.([a-z0-9_]+)/g)) {
      expect(h32bRelations.has(`public.${match[1]}`)).toBe(true);
    }

    const helperUnion = new Set([...adminRelations, ...h32bRelations]);
    expect(helperUnion.size).toBe(54);
    const receiptLocks = [
      'hotels_v2_private.hotel_external_calendar_activation_receipts',
      'hotels_v2_private.hotel_external_calendar_foundation_receipts',
      'public.hotel_partner_workspace_foundation_receipts',
    ];
    const expectedLocks = [...new Set([...helperUnion, ...receiptLocks])].sort();
    expect(expectedLocks).toHaveLength(57);

    const lockMatch = owner.match(
      /\nlock table\n([\s\S]*?)\nin share row exclusive mode;/,
    );
    expect(lockMatch).not.toBeNull();
    const lockedRelations = [
      ...(lockMatch?.[1] ?? '').matchAll(
        /(?:hotels_v2_private|public)\.[a-z0-9_]+/g,
      ),
    ].map((match) => match[0]);
    expect(lockedRelations).toEqual([...lockedRelations].sort());
    expect(lockedRelations).toEqual(expectedLocks);

    const apply = sliceBetween(
      owner,
      'do $seven_arches_owner_apply$',
      '$seven_arches_owner_apply$;',
    );
    const mutationTargets = new Set<string>();
    for (const expression of [
      /\binsert\s+into\s+public\.([a-z0-9_]+)/gi,
      /\bupdate\s+public\.([a-z0-9_]+)/gi,
      /\bdelete\s+from\s+public\.([a-z0-9_]+)/gi,
    ]) {
      for (const match of apply.matchAll(expression)) {
        mutationTargets.add(`public.${match[1]}`);
      }
    }
    const transactionPrivateReceipt =
      'public.hotel_admin_availability_foundation_evolution_receipts';
    expect(mutationTargets.has(transactionPrivateReceipt)).toBe(true);
    mutationTargets.delete(transactionPrivateReceipt);
    for (const target of mutationTargets) {
      expect(lockedRelations).toContain(target);
    }

    const lockBoundary = owner.indexOf(lockMatch?.[0] ?? 'missing lock');
    expect(owner).toMatch(/^begin;\nset transaction isolation level read committed;/);
    expect(lockBoundary).toBeGreaterThan(owner.indexOf("set local statement_timeout='180s';"));
    expect(lockBoundary).toBeLessThan(owner.indexOf('do $seven_arches_owner_prerequisites$'));
    expect(owner).not.toContain('do $seven_arches_owner_lock$');
    expect(owner).not.toContain('v_lock_sql');
  });

  test('binds the exact canonical Partner-owner set without inventing a primary owner', () => {
    const owner = read(
      'supabase/migrations/20260811436000_hotels_v2_seven_arches_owner_operational_capabilities.sql',
    );
    const preflight = read(
      'supabase/manual/hotels_v2_seven_arches_owner_operational_capabilities_preflight.sql',
    );
    const verifier = read(
      'supabase/manual/hotels_v2_seven_arches_owner_operational_capabilities_verify.sql',
    );
    const postgresGate = read(
      'tests/integration/hotels-v2-seven-arches-owner-operational-capabilities-postgres-gate.sql',
    );
    const concurrencyGate = read(
      'tests/integration/hotels-v2-seven-arches-owner-operational-capabilities-concurrency-gate.mjs',
    );
    const h32aBase = read(
      'tests/integration/hotels-v2-h3-2a-partner-access-postgrest-base.sql',
    );
    const h32aGate = read(
      'tests/integration/hotels-v2-h3-2a-partner-access-postgrest-gate.mjs',
    );
    const h32bGate = read(
      'tests/integration/hotels-v2-h3-2b-partner-workspace-postgrest-gate.mjs',
    );

    expect(owner).toContain('owner_user_ids uuid[] not null');
    expect(owner).toContain('owner_membership_fingerprint text not null');
    expect(owner).toContain('hotels_v2_seven_arches_owner_membership_v1');
    expect(owner).toMatch(/array_agg\(member\.user_id order by member\.user_id\)/);
    expect(owner).toContain("'owner_user_ids',to_jsonb(v_owner_user_ids)");
    expect(owner).toContain("'00000000-0000-0000-0000-000000000000'");
    expect(owner).not.toMatch(/\bowner_user_id\b/);
    expect(owner).not.toMatch(/order by member\.user_id[\s\S]{0,80}\blimit 1\b/i);

    expect(preflight).toContain('owner_count');
    expect(preflight).toContain('v_owner_count<1');
    expect(preflight).toContain('owner_membership.owner_count');
    expect(verifier).toContain('owner_user_ids');
    expect(verifier).toContain('owner_membership_fingerprint');
    expect(verifier).toContain('seven_arches_owner_membership_exact');

    for (const sentinel of [
      'seven_arches_three_owner_snapshot_failed',
      'seven_arches_duplicate_owner_membership_was_allowed',
      'seven_arches_orphan_owner_membership_was_allowed',
      'seven_arches_owner_addition_drift_accepted',
      'seven_arches_owner_demotion_drift_accepted',
      'seven_arches_owner_removal_drift_accepted',
      'seven_arches_zero_owner_drift_accepted',
    ]) expect(postgresGate).toContain(sentinel);
    expect(concurrencyGate).toContain('one-owner receipt membership fingerprint mismatch');
    expect(concurrencyGate).toContain('zero-owner preflight');
    expect(concurrencyGate).toContain('zero-owner migration');

    expect(h32aBase).toContain('co-owner-a@example.test');
    expect(h32aBase).toContain('co-owner-b@example.test');
    for (const gate of [h32aGate, h32bGate]) {
      expect(gate).toContain('TOKENS.coOwnerA');
      expect(gate).toContain('TOKENS.coOwnerB');
      expect(gate).toContain('legitimate_owner_count: 3');
    }
  });
});
