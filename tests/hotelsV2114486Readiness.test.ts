import fs from 'node:fs';
import vm from 'node:vm';

const rpcName = 'hotel_v2_admin_get_stripe_platform_readiness_114486';
const requestId = '86000000-0000-4000-8000-000000000010';
const contract = 'hotels_stripe_platform_readiness_admin_v1';

function readiness(state: 'MISSING' | 'NOT_READY' | 'STALE' | 'READY') {
  const observed_at = '2026-09-11T01:00:00.000Z';

  if (state === 'MISSING') {
    return {
      blocked_reason: 'attestation_missing',
      checked_at: null,
      contract_version: contract,
      expires_at: null,
      observed_at,
      ready: false,
      request_id: null,
      state,
    };
  }

  if (state === 'STALE') {
    return {
      blocked_reason: 'attestation_expired',
      checked_at: '2026-09-11T00:30:00.000Z',
      contract_version: contract,
      expires_at: '2026-09-11T00:45:00.000Z',
      observed_at,
      ready: false,
      request_id: requestId,
      state,
    };
  }

  if (state === 'READY') {
    return {
      blocked_reason: null,
      checked_at: '2026-09-11T00:50:00.000Z',
      contract_version: contract,
      expires_at: '2026-09-11T01:05:00.000Z',
      observed_at,
      ready: true,
      request_id: requestId,
      state,
    };
  }

  return {
    blocked_reason: 'attestation_invalid',
    checked_at: '2026-09-11T00:50:00.000Z',
    contract_version: contract,
    expires_at: '2026-09-11T01:05:00.000Z',
    observed_at,
    ready: false,
    request_id: requestId,
    state,
  };
}

function runtime(rpc: any = jest.fn()) {
  const context: any = {
    console,
    TextEncoder,
    URL,
    crypto: {
      randomUUID: () => '47000000-0000-4000-8000-000000000001',
    },
  };

  context.globalThis = context;
  context.window = context;
  context.getSupabase = () => ({ rpc });

  for (const path of [
    'admin/hotels-v2-workspace-core.js',
    'admin/hotels-v2-workspace-repository.js',
  ]) {
    vm.runInNewContext(fs.readFileSync(path, 'utf8'), context);
  }

  return context.HotelsV2WorkspaceRepository;
}

describe('114486 Admin Stripe platform readiness', () => {
  test.each([
    'MISSING',
    'NOT_READY',
    'STALE',
    'READY',
  ] as const)('accepts exact %s DTO from 114486', async state => {
    const dto = readiness(state);
    const rpc = jest.fn(async () => ({ data: dto, error: null }));

    await expect(runtime(rpc).getStripePlatformReadiness()).resolves.toEqual(dto);

    expect(rpc.mock.calls).toHaveLength(1);
    expect((rpc.mock.calls as any)[0][0]).toBe(rpcName);
    expect((rpc.mock.calls as any)[0][1]).toEqual({});
  });

  test('accepts NOT_READY with intentionally unavailable timestamps', async () => {
    const dto = {
      ...readiness('NOT_READY'),
      checked_at: null,
      expires_at: null,
    };

    await expect(
      runtime(async () => ({ data: dto, error: null }))
        .getStripePlatformReadiness(),
    ).resolves.toEqual(dto);
  });

  test.each([
    [
      'extra field',
      () => ({ ...readiness('READY'), account_id: 'acct_untrusted' }),
    ],
    [
      'missing field',
      () => {
        const value: any = readiness('READY');
        delete value.observed_at;
        return value;
      },
    ],
    [
      'wrong contract',
      () => ({
        ...readiness('READY'),
        contract_version: 'unsupported',
      }),
    ],
    [
      'unknown state',
      () => ({
        ...readiness('READY'),
        state: 'UNKNOWN',
      }),
    ],
    [
      'READY with ready=false',
      () => ({
        ...readiness('READY'),
        ready: false,
      }),
    ],
    [
      'invalid observed_at',
      () => ({
        ...readiness('READY'),
        observed_at: 'not-a-timestamp',
      }),
    ],
    [
      'wrong blocked reason',
      () => ({
        ...readiness('STALE'),
        blocked_reason: 'attestation_invalid',
      }),
    ],
    [
      'MISSING with request identity',
      () => ({
        ...readiness('MISSING'),
        request_id: requestId,
      }),
    ],
    [
      'non-missing invalid UUID',
      () => ({
        ...readiness('READY'),
        request_id: 'not-a-uuid',
      }),
    ],
    [
      'invalid TTL',
      () => ({
        ...readiness('READY'),
        expires_at: '2026-09-11T01:04:59.999Z',
      }),
    ],
    [
      'READY already expired',
      () => ({
        ...readiness('READY'),
        expires_at: '2026-09-11T01:00:00.000Z',
        checked_at: '2026-09-11T00:45:00.000Z',
      }),
    ],
    [
      'STALE not yet expired',
      () => ({
        ...readiness('STALE'),
        checked_at: '2026-09-11T00:50:00.000Z',
        expires_at: '2026-09-11T01:05:00.000Z',
      }),
    ],
    [
      'NOT_READY with only one timestamp',
      () => ({
        ...readiness('NOT_READY'),
        checked_at: null,
      }),
    ],
  ])('fails closed for %s', async (_name, makeValue) => {
    const value = makeValue();

    await expect(
      runtime(async () => ({ data: value, error: null }))
        .getStripePlatformReadiness(),
    ).rejects.toThrow();
  });

  test('RPC failure never produces readiness state', async () => {
    const rpc = jest.fn(async () => ({
      data: null,
      error: {
        code: '42501',
        message: 'denied',
      },
    }));

    await expect(
      runtime(rpc).getStripePlatformReadiness(),
    ).rejects.toThrow();

    expect(rpc.mock.calls).toHaveLength(1);
    expect((rpc.mock.calls as any)[0][0]).toBe(rpcName);
  });
});
