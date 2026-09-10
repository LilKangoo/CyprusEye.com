import fs from 'node:fs';
import vm from 'node:vm';

const partner = '0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
const getName = 'hotel_v2_admin_get_partner_stripe_onboarding_authorization';
const setName = 'hotel_v2_admin_set_partner_stripe_onboarding_authorization';
const control = () => ({ contract_version: 'hotels_v2_partner_stripe_authorization_control_v1', partner_id: partner, version: 0, enabled: false, platform_enabled: false, account_exists: false, account_status: 'NOT_CONNECTED' });
const draft = () => ({ partnerId: partner, enabled: true, expectedVersion: 0, reason: 'Explicit local mocked authorization test', confirmed: true });
function runtime(rpc: any = jest.fn()) {
  const context: any = { console, TextEncoder, URL, crypto: { randomUUID: () => '47000000-0000-4000-8000-000000000001' } };
  context.globalThis = context; context.window = context; context.getSupabase = () => ({ rpc });
  for (const path of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js', 'js/hotels-v2-partner-workspace-core.js']) vm.runInNewContext(fs.readFileSync(path, 'utf8'), context);
  return { repo: context.HotelsV2WorkspaceRepository, partnerCore: context.HotelsV2PartnerWorkspaceCore };
}
describe('Audited Partner Stripe UI repository', () => {
  test('Get reads the exact safe account projection without secrets', async () => {
    const rpc = jest.fn(async () => ({ data: control(), error: null }));
    expect(await runtime(rpc).repo.getPartnerStripeAuthorization(partner)).toEqual(control());
    expect(rpc.mock.calls).toHaveLength(1);
    expect((rpc.mock.calls as any)[0][0]).toBe(getName);
  });
  test.each([
    {account_exists: true, account_status: 'NOT_CONNECTED'},
    {account_exists: false, account_status: 'CONNECTED'},
    {account_exists: 'false', account_status: 'NOT_CONNECTED'},
    {account_exists: false, account_status: 'UNKNOWN'},
    {account_exists: null, account_status: null},
  ])('inconsistent account state fails closed: %j', async extra => {
    await expect(runtime(async () => ({data: {...control(), ...extra}, error:null})).repo.getPartnerStripeAuthorization(partner)).rejects.toThrow();
  });
  test('old DTO stays explicitly unknown rather than inventing account state', async () => {
    const value: any=control(); delete value.account_exists; delete value.account_status;
    expect(await runtime(async () => ({data:value,error:null})).repo.getPartnerStripeAuthorization(partner)).toEqual(value);
  });
  test.each(['foreign', 'version', 'enabled', 'missing', 'extra', 'contract'])('invalid Get %s fails closed', async kind => {
    const value: any = control();
    if (kind === 'foreign') value.partner_id = '00000000-0000-4000-8000-000000000001';
    if (kind === 'version') value.version = '0';
    if (kind === 'enabled') value.enabled = 0;
    if (kind === 'missing') delete value.platform_enabled;
    if (kind === 'extra') value.account_id = 'must_not_be_trusted';
    if (kind === 'contract') value.contract_version = 'unsupported';
    const rpc = jest.fn(async () => ({ data: value, error: null }));
    await expect(runtime(rpc).repo.getPartnerStripeAuthorization(partner)).rejects.toThrow();
  });
  test('fresh Get then one Set, exact target, no replay of same decision object', async () => {
    const rpc = jest.fn(async (name: string, args: any) => ({ error: null, data: name === getName ? control() : {
      contract_version: 'hotels_v2_partner_stripe_authorization_result_v1', partner_id: args.p_partner_id,
      version: 1, current_version: 1, enabled: true, current_enabled: true, replayed: false,
    } }));
    const { repo } = runtime(rpc), intent = draft();
    await repo.setPartnerStripeAuthorization(intent);
    await expect(repo.setPartnerStripeAuthorization(intent)).rejects.toThrow();
    expect(rpc.mock.calls.map(c => c[0])).toEqual([getName, setName]);
    expect(rpc.mock.calls[1][1]).toEqual({ p_partner_id: partner, p_enabled: true, p_expected_version: 0,
      p_request_id: '47000000-0000-4000-8000-000000000001', p_reason: intent.reason });
  });
  test.each(['confirmation', 'reason', 'version', 'same', 'changed'])('%s stops before mutation', async kind => {
    const intent: any = draft(), current: any = control();
    if (kind === 'confirmation') intent.confirmed = false;
    if (kind === 'reason') intent.reason = 'short';
    if (kind === 'version') intent.expectedVersion = -1;
    if (kind === 'same') current.enabled = true;
    if (kind === 'changed') current.version = 1;
    const rpc = jest.fn(async () => ({ data: current, error: null }));
    await expect(runtime(rpc).repo.setPartnerStripeAuthorization(intent)).rejects.toThrow();
    expect(rpc.mock.calls.every((c: any) => c[0] === getName)).toBe(true);
  });
  test.each(['network', 'malformed'])('ambiguous %s outcome never retries Set', async kind => {
    const rpc = jest.fn(async (name: string) => {
      if (name === getName) return { data: control(), error: null };
      if (kind === 'network') throw new Error('transport_failed');
      return { data: {}, error: null };
    });
    const { repo } = runtime(rpc), intent = draft();
    await expect(repo.setPartnerStripeAuthorization(intent)).rejects.toThrow();
    await expect(repo.setPartnerStripeAuthorization(intent)).rejects.toThrow();
    expect(rpc.mock.calls.map(c => c[0])).toEqual([getName, setName]);
  });
  test.each([401, 403, 404, 500])('HTTP %s errors do not grant', async status => {
    const rpc = jest.fn(async () => ({ error: { code: String(status), message: 'failure' }, data: null }));
    await expect(runtime(rpc).repo.setPartnerStripeAuthorization(draft())).rejects.toThrow();
    expect(rpc.mock.calls).toHaveLength(1);
  });
});
describe('Partner truthful Stripe states', () => {
  test.each([
    [false, false, 'NOT_CONNECTED', false, 'NOT_AUTHORIZED'],
    [true, false, 'NOT_CONNECTED', false, 'PLATFORM_DISABLED'],
    [true, true, 'NOT_CONNECTED', true, 'READY_TO_CONNECT'],
    [true, true, 'ONBOARDING_INCOMPLETE', true, 'ONBOARDING_INCOMPLETE'],
    [true, true, 'CONNECTED', false, 'CONNECTED'],
    [true, true, 'RESTRICTED', false, 'RESTRICTED'],
    [true, true, 'ACTION_REQUIRED', false, 'ACTION_REQUIRED'],
    [true, true, 'DISABLED', false, 'DISABLED'],
  ])('authorization=%s platform=%s account=%s', (authorized, platform, account, canConnect, expected) => {
    const value = runtime().partnerCore.stripeConnectionPresentation({ onboarding_authorized: authorized, platform_enabled: platform, account_status: account, can_connect: canConnect, platform_ready: true, attestation_status: 'READY' });
    expect(value.state).toBe(expected); expect(value.canConnect).toBe(canConnect);
    expect(value.readiness).toBe('READY');
  });
  test.each(['MISSING','NOT_READY','STALE'])('attestation %s disables Connect', status => {
    const value=runtime().partnerCore.stripeConnectionPresentation({onboarding_authorized:true,platform_enabled:true,account_status:'NOT_CONNECTED',can_connect:true,platform_ready:false,attestation_status:status});
    expect(value.state).toBe('PLATFORM_NOT_READY'); expect(value.canConnect).toBe(false); expect(value.readiness).toBe(status);
  });
  test.each([{}, {platform_ready:true}, {platform_ready:true,attestation_status:'STALE'}, {platform_ready:'true',attestation_status:'READY'}])('unknown/inconsistent readiness never enables Connect: %j', extra => {
    const value=runtime().partnerCore.stripeConnectionPresentation({onboarding_authorized:true,platform_enabled:true,account_status:'NOT_CONNECTED',can_connect:true,...extra});
    expect(value.state).toBe('UNAVAILABLE');expect(value.canConnect).toBe(false);expect(value.readiness).toBe('UNKNOWN');
  });
  test('missing DTO never connects', () => expect(runtime().partnerCore.stripeConnectionPresentation(null).canConnect).toBe(false));
});
