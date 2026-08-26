import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HOTEL = '11111111-1111-4111-8111-111111111111';
const ROOM = '22222222-2222-4222-8222-222222222222';
const REMAP_ROOM = '23232323-2323-4232-8232-232323232323';
const SEVEN_ARCHES = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const UPPER_ROOM = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
const GROUND_ROOM = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
const SOURCE = '33333333-3333-4333-8333-333333333333';
const SECOND_SOURCE = '34343434-3434-4434-8434-343434343434';
const REVIEW = '44444444-4444-4444-8444-444444444444';
const CORRELATION = '55555555-5555-4555-8555-555555555555';
const IDEMPOTENCY = '66666666-6666-4666-8666-666666666666';
const ACTIVITY = '77777777-7777-4777-8777-777777777777';
const CREATED_SOURCE = '88888888-8888-4888-8888-888888888888';
const TOKEN = 'a'.repeat(64);
const NEXT_TOKEN = 'b'.repeat(64);
const ICAL_URL = 'https://calendar.example.test/private/feed.ics?token=secret';
const URL_FINGERPRINT = crypto.createHash('sha256').update(ICAL_URL).digest('hex');

function control(overrides: Record<string, unknown> = {}): any {
  return {
    contract_version: 'hotels_v2_external_calendar_control_v1', hotel_id: HOTEL,
    partner_id: null, assignment_id: null, permission_version: null, access_snapshot_token: null,
    snapshot_token: TOKEN, hotel_external_sync_enabled: false,
    rooms: [{ id: ROOM, name_i18n: { pl: 'Pokój', en: 'Room', he: 'חדר' }, status: 'active', version: 1 }],
    sources: [{
      id: SOURCE, hotel_id: HOTEL, room_type_id: ROOM, code: 'airbnb-upper', source_type: 'airbnb',
      is_enabled: false, review_status: 'reviewed', priority: 100, version: 1,
      updated_at: '2026-08-25T12:00:00Z', secret_configured: true, binding_version: 1,
      sync_interval_minutes: 60, units_per_event: 1,
      health: {
        status: 'healthy', last_attempt_at: '2026-08-25T11:55:00Z', last_success_at: '2026-08-25T11:55:02Z',
        last_failure_at: null, next_retry_at: null, consecutive_failures: 0, last_event_count: 4,
        last_active_event_count: 3, last_block_count: 6, last_error_code: null,
        last_error_message: null, state_version: 2,
      },
    }],
    public_change: false, ...overrides,
  };
}

function loadAdminCore(): any {
  const context: Record<string, any> = { console, URL: globalThis.URL, TextEncoder, crypto: crypto.webcrypto };
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace-core.js'), 'utf8'), context);
  return context.HotelsV2WorkspaceCore;
}

function rotateDraft(Core: any, snapshot = control()): any {
  return Core.buildExternalCalendarDraft(snapshot, {
    entity: 'ical_secret', action: 'rotate', id: SOURCE, expected_version: 1,
    payload: { source_id: SOURCE, ical_url: ICAL_URL }, reason: 'Rotate exact private calendar URL',
  });
}

function rotatePreview(Core: any, snapshot = control()): any {
  const draft = rotateDraft(Core, snapshot);
  return {
    draft,
    preview: {
      contract_version: 'hotels_v2_external_calendar_preview_v1', hotel_id: HOTEL, partner_id: null,
      changed: true, blocking_reasons: [],
      impacts: [{
        entity: 'ical_secret', action: 'rotate', id: SOURCE, changed: true,
        fields: ['secret_configured'], before: { secret_configured: true },
        after: { secret_configured: true }, affected_room_type_ids: [ROOM], from: null, to: null,
      }],
      reviewed_plan: {
        contract_version: 'hotels_v2_external_calendar_plan_v1', review_id: REVIEW, actor_type: 'admin',
        partner_id: null, hotel_id: HOTEL, assignment_id: null, permission_version: null,
        access_snapshot_token: null, snapshot_token: TOKEN, reviewed_at: '2026-08-25T12:01:00Z',
        expires_at: '2026-08-25T12:31:00Z', plan_fingerprint: NEXT_TOKEN,
        operations: [{
          entity: 'ical_secret', action: 'rotate', id: SOURCE, expected_version: 1,
          expected_original: { secret_configured: true, binding_version: 1 },
          payload: { source_id: SOURCE, url_fingerprint: URL_FINGERPRINT, secret_configured: true },
          reason: draft.intent.reason,
        }],
      },
    },
  };
}

function updatePreview(Core: any, snapshot = control(), targetRoomId = ROOM): any {
  const payload = {
    room_type_id: targetRoomId, code: 'airbnb-upper-reviewed', source_type: 'airbnb', sync_interval_minutes: 120,
    units_per_event: 1, priority: 90,
  };
  const draft = Core.buildExternalCalendarDraft(snapshot, {
    entity: 'calendar_source', action: 'update', id: SOURCE, expected_version: 1,
    payload, reason: 'Update exact reviewed source fields',
  });
  const original = JSON.parse(JSON.stringify(snapshot.sources[0]));
  return {
    draft,
    preview: {
      contract_version: 'hotels_v2_external_calendar_preview_v1', hotel_id: HOTEL, partner_id: null,
      changed: true, blocking_reasons: [],
      impacts: [{
        entity: 'calendar_source', action: 'update', id: SOURCE, changed: true,
        fields: ['code', 'priority', 'room_type_id', 'source_type', 'sync_interval_minutes', 'units_per_event'],
        before: {
          code: original.code, priority: original.priority, room_type_id: original.room_type_id,
          source_type: original.source_type,
          sync_interval_minutes: original.sync_interval_minutes, units_per_event: original.units_per_event,
        },
        after: payload, affected_room_type_ids: [...new Set([original.room_type_id, targetRoomId])].sort(), from: null, to: null,
      }],
      reviewed_plan: {
        contract_version: 'hotels_v2_external_calendar_plan_v1', review_id: REVIEW, actor_type: 'admin',
        partner_id: null, hotel_id: HOTEL, assignment_id: null, permission_version: null,
        access_snapshot_token: null, snapshot_token: TOKEN, reviewed_at: '2026-08-25T12:01:00Z',
        expires_at: '2026-08-25T12:31:00Z', plan_fingerprint: NEXT_TOKEN,
        operations: [{
          entity: 'calendar_source', action: 'update', id: SOURCE, expected_version: 1,
          expected_original: original, payload, reason: draft.intent.reason,
        }],
      },
    },
  };
}

function createPreview(Core: any, snapshot = control()): any {
  const payload = {
    room_type_id: ROOM, code: 'booking-upper-reviewed', source_type: 'booking_com', sync_interval_minutes: 180,
    units_per_event: 1, priority: 80,
  };
  const draft = Core.buildExternalCalendarDraft(snapshot, {
    entity: 'calendar_source', action: 'create', id: null, expected_version: 0,
    payload, reason: 'Create exact reviewed source',
  });
  return {
    draft,
    preview: {
      contract_version: 'hotels_v2_external_calendar_preview_v1', hotel_id: HOTEL, partner_id: null,
      changed: true, blocking_reasons: [],
      impacts: [{
        entity: 'calendar_source', action: 'create', id: CREATED_SOURCE, changed: true,
        fields: ['code', 'priority', 'room_type_id', 'source_type', 'sync_interval_minutes', 'units_per_event'],
        before: null, after: payload, affected_room_type_ids: [ROOM], from: null, to: null,
      }],
      reviewed_plan: {
        contract_version: 'hotels_v2_external_calendar_plan_v1', review_id: REVIEW, actor_type: 'admin',
        partner_id: null, hotel_id: HOTEL, assignment_id: null, permission_version: null,
        access_snapshot_token: null, snapshot_token: TOKEN, reviewed_at: '2026-08-25T12:01:00Z',
        expires_at: '2026-08-25T12:31:00Z', plan_fingerprint: NEXT_TOKEN,
        operations: [{
          entity: 'calendar_source', action: 'create', id: CREATED_SOURCE, expected_version: 0,
          expected_original: null, payload, reason: draft.intent.reason,
        }],
      },
    },
  };
}

describe('Hotels V2 external calendar Stage 2D strict client contract', () => {
  const Core = loadAdminCore();

  test('accepts only the redacted exact control and fails closed on private/raw fields or inconsistent activation', () => {
    const normalized = Core.normalizeExternalCalendarControl(control(), { actorType: 'admin', hotelId: HOTEL });
    expect(normalized.sources[0].health.last_block_count).toBe(6);
    expect(normalized.sources[0].source_type).toBe('airbnb');
    const leaked = control(); leaked.sources[0].ical_url = ICAL_URL;
    expect(() => Core.normalizeExternalCalendarControl(leaked, { actorType: 'admin' })).toThrow('unsupported or private fields');
    const raw = control(); raw.sources[0].configuration = { url: ICAL_URL };
    expect(() => Core.normalizeExternalCalendarControl(raw, { actorType: 'admin' })).toThrow('unsupported or private fields');
    const activated = control(); activated.sources[0].is_enabled = true;
    expect(() => Core.normalizeExternalCalendarControl(activated, { actorType: 'admin' })).toThrow('inconsistent with activation');
    const unconfigured = control(); unconfigured.sources[0].secret_configured = false; unconfigured.sources[0].binding_version = null;
    expect(Core.normalizeExternalCalendarControl(unconfigured).sources[0].binding_version).toBeNull();
    const foreignProvider = control(); foreignProvider.sources[0].source_type = 'booking';
    expect(() => Core.normalizeExternalCalendarControl(foreignProvider)).toThrow('invalid, foreign');
  });

  test('accepts both exact 7 Arches Room mappings with honest EN-only names and no fabricated translations', () => {
    const sourceFixture = control().sources[0];
    const sevenArches = control({
      hotel_id: SEVEN_ARCHES,
      rooms: [
        { id: UPPER_ROOM, name_i18n: { en: 'Upper Floor Apartment' }, status: 'active', version: 21 },
        { id: GROUND_ROOM, name_i18n: { en: 'Ground Floor Apartment' }, status: 'active', version: 20 },
      ],
      sources: [
        { ...sourceFixture, hotel_id: SEVEN_ARCHES, room_type_id: UPPER_ROOM, source_type: 'booking_com', code: 'booking-upper' },
        { ...sourceFixture, id: SECOND_SOURCE, hotel_id: SEVEN_ARCHES, room_type_id: GROUND_ROOM, source_type: 'airbnb', code: 'airbnb-ground' },
      ],
    });
    const normalized = Core.normalizeExternalCalendarControl(sevenArches, { actorType: 'admin', hotelId: SEVEN_ARCHES });
    expect(normalized.rooms.map((room: any) => room.id)).toEqual([UPPER_ROOM, GROUND_ROOM]);
    expect(normalized.rooms[0].name_i18n).toEqual({ en: 'Upper Floor Apartment' });
    expect(normalized.rooms[1].name_i18n).toEqual({ en: 'Ground Floor Apartment' });
    expect(normalized.sources.map((source: any) => [source.source_type, source.room_type_id])).toEqual([
      ['booking_com', UPPER_ROOM], ['airbnb', GROUND_ROOM],
    ]);
  });

  test('builds exact review-first drafts, redacts/fingerprint-binds URL plans, and supports disabled-source secret clear', () => {
    const { draft, preview } = rotatePreview(Core);
    const reviewed = Core.validateExternalCalendarPreview(preview, draft, control());
    expect(JSON.stringify(reviewed.reviewed_plan)).not.toContain(ICAL_URL);
    expect(reviewed.reviewed_plan.operations[0].payload.url_fingerprint).toBe(URL_FINGERPRINT);
    expect(() => Core.buildExternalCalendarDraft(control(), {
      entity: 'calendar_source', action: 'enable', id: SOURCE, expected_version: 1,
      payload: {}, reason: 'Enable exact source',
    })).toThrow('not activated');
    const clear = Core.buildExternalCalendarDraft(control(), {
      entity: 'ical_secret', action: 'clear', id: SOURCE, expected_version: 1,
      payload: { source_id: SOURCE }, reason: 'Clear exact private binding',
    });
    expect(clear.intent.payload).toEqual({ source_id: SOURCE });
    const providerDraft = Core.buildExternalCalendarDraft(control(), {
      entity: 'calendar_source', action: 'update', id: SOURCE, expected_version: 1,
      payload: {
        room_type_id: ROOM, code: 'airbnb-upper', source_type: 'airbnb',
        sync_interval_minutes: 60, units_per_event: 1, priority: 100,
      },
      reason: 'Keep exact Airbnb provider and Room mapping',
    });
    expect(Object.keys(providerDraft.intent.payload).sort()).toEqual([
      'code', 'priority', 'room_type_id', 'source_type', 'sync_interval_minutes', 'units_per_event',
    ]);
  });

  test('binds action-specific originals and every exact impact key and value to the loaded control', () => {
    const { draft, preview } = updatePreview(Core);
    expect(Core.validateExternalCalendarPreview(preview, draft, control()).reviewed_plan.operations[0].id).toBe(SOURCE);

    const extraOriginal = JSON.parse(JSON.stringify(preview));
    extraOriginal.reviewed_plan.operations[0].expected_original.unreviewed = true;
    expect(() => Core.validateExternalCalendarPreview(extraOriginal, draft, control())).toThrow('differs from the explicit Review');

    const extraImpact = JSON.parse(JSON.stringify(preview));
    extraImpact.impacts[0].before.binding_version = 1;
    expect(() => Core.validateExternalCalendarPreview(extraImpact, draft, control())).toThrow('impact is invalid');

    const wrongImpactValue = JSON.parse(JSON.stringify(preview));
    wrongImpactValue.impacts[0].after.priority = 91;
    expect(() => Core.validateExternalCalendarPreview(wrongImpactValue, draft, control())).toThrow('impact is invalid');

    const remapControl = control();
    remapControl.rooms.push({
      id: REMAP_ROOM, name_i18n: { pl: 'Drugi pokój', en: 'Second room', he: 'חדר שני' },
      status: 'active', version: 1,
    });
    const remap = updatePreview(Core, remapControl, REMAP_ROOM);
    expect(Core.validateExternalCalendarPreview(remap.preview, remap.draft, remapControl).impacts[0].affected_room_type_ids)
      .toEqual([ROOM, REMAP_ROOM].sort());

    const created = createPreview(Core);
    expect(Core.validateExternalCalendarPreview(created.preview, created.draft, control()).reviewed_plan.operations[0].id)
      .toBe(CREATED_SOURCE);
    const wrongCreateOriginal = JSON.parse(JSON.stringify(created.preview));
    wrongCreateOriginal.reviewed_plan.operations[0].expected_original = {};
    expect(() => Core.validateExternalCalendarPreview(wrongCreateOriginal, created.draft, control()))
      .toThrow('differs from the explicit Review');
  });

  test('requires create and update Save controls to match every reviewed source business field', () => {
    const update = updatePreview(Core);
    const updatePlan = Core.validateExternalCalendarPreview(update.preview, update.draft, control()).reviewed_plan;
    const savedUpdate = control({ snapshot_token: NEXT_TOKEN });
    Object.assign(savedUpdate.sources[0], updatePlan.operations[0].payload, { version: 2 });
    const updateReceipt = {
      contract_version: 'hotels_v2_external_calendar_apply_result_v1', hotel_id: HOTEL, partner_id: null,
      correlation_id: CORRELATION, idempotency_key: IDEMPOTENCY, replayed: false, changed: true,
      activity: [{ id: ACTIVITY, hotel_id: HOTEL, entity_type: 'calendar_source', entity_id: SOURCE,
        action: 'update', actor_type: 'admin', source: 'hotels_v2_external_calendar_control',
        correlation_id: CORRELATION, created_at: '2026-08-25T12:02:00Z' }], control: savedUpdate,
    };
    expect(Core.validateExternalCalendarApplyResult(updateReceipt, {
      plan: updatePlan, correlationId: CORRELATION, idempotencyKey: IDEMPOTENCY,
    }).control.sources[0].code).toBe('airbnb-upper-reviewed');
    const wrongUpdate = JSON.parse(JSON.stringify(updateReceipt));
    wrongUpdate.control.sources[0].priority = 91;
    expect(() => Core.validateExternalCalendarApplyResult(wrongUpdate, {
      plan: updatePlan, correlationId: CORRELATION, idempotencyKey: IDEMPOTENCY,
    })).toThrow('exact reviewed source fields');

    const created = createPreview(Core);
    const createPlan = Core.validateExternalCalendarPreview(created.preview, created.draft, control()).reviewed_plan;
    const savedCreate = control({ snapshot_token: NEXT_TOKEN });
    savedCreate.sources.push({
      ...JSON.parse(JSON.stringify(savedCreate.sources[0])), ...createPlan.operations[0].payload,
      id: CREATED_SOURCE, code: 'booking-upper-reviewed', version: 1, is_enabled: false,
      secret_configured: false, binding_version: null,
    });
    const createReceipt = {
      ...updateReceipt, control: savedCreate,
      activity: [{ ...updateReceipt.activity[0], entity_id: CREATED_SOURCE, action: 'create' }],
    };
    expect(Core.validateExternalCalendarApplyResult(createReceipt, {
      plan: createPlan, correlationId: CORRELATION, idempotencyKey: IDEMPOTENCY,
    }).control.sources.find((source: any) => source.id === CREATED_SOURCE).priority).toBe(80);
    const wrongCreate = JSON.parse(JSON.stringify(createReceipt));
    wrongCreate.control.sources.find((source: any) => source.id === CREATED_SOURCE).units_per_event = 2;
    expect(() => Core.validateExternalCalendarApplyResult(wrongCreate, {
      plan: createPlan, correlationId: CORRELATION, idempotencyKey: IDEMPOTENCY,
    })).toThrow('exact reviewed source fields');
  });

  test('rejects noncanonical identifiers, unsanitized health, and unsupported health enums', () => {
    const upper = control({ hotel_id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' });
    expect(() => Core.normalizeExternalCalendarControl(upper)).toThrow('canonical UUID');
    const message = control(); message.sources[0].health.last_error_message = 'bad\nsecret';
    expect(() => Core.normalizeExternalCalendarControl(message)).toThrow('sanitized exact projection');
    const leakedUrl = control(); leakedUrl.sources[0].health.last_error_message = 'Failed https://secret.example/feed.ics';
    expect(() => Core.normalizeExternalCalendarControl(leakedUrl)).toThrow('sanitized exact projection');
    const status = control(); status.sources[0].health.status = 'unknown';
    expect(() => Core.normalizeExternalCalendarControl(status)).toThrow('sanitized exact projection');
  });
});

describe('Hotels V2 external calendar Stage 2D repository and static security', () => {
  test('binds transient URL to SHA-256 Review, burns the plan, and makes one Apply call with no retry', async () => {
    const calls: Array<{ name: string; payload: any }> = [];
    const coreContext: Record<string, any> = {
      console, URL: globalThis.URL, TextEncoder, crypto: crypto.webcrypto,
      window: { getSupabase: () => client },
    };
    const Core = loadAdminCore();
    const { preview } = rotatePreview(Core);
    const savedControl = control({ snapshot_token: NEXT_TOKEN });
    savedControl.sources[0].binding_version = 2;
    const client = {
      async rpc(name: string, payload: any) {
        calls.push({ name, payload });
        if (name === 'hotel_v2_admin_get_external_calendar_control') return { data: control(), error: null };
        if (name === 'hotel_v2_admin_preview_external_calendar_plan') return { data: preview, error: null };
        if (name === 'hotel_v2_admin_apply_external_calendar_plan') return { data: {
          contract_version: 'hotels_v2_external_calendar_apply_result_v1', hotel_id: HOTEL, partner_id: null,
          correlation_id: CORRELATION, idempotency_key: IDEMPOTENCY, replayed: false, changed: true,
          activity: [{ id: ACTIVITY, hotel_id: HOTEL, entity_type: 'calendar_source', entity_id: SOURCE,
            action: 'update', actor_type: 'admin', source: 'hotels_v2_external_calendar_control',
            correlation_id: CORRELATION, created_at: '2026-08-25T12:02:00Z' }], control: savedControl,
        }, error: null };
        throw new Error(`unexpected ${name}`);
      },
    };
    for (const relative of ['admin/hotels-v2-workspace-core.js', 'admin/hotels-v2-workspace-repository.js']) {
      vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), relative), 'utf8'), coreContext, { filename: relative });
    }
    const Repository = coreContext.HotelsV2WorkspaceRepository;
    const loaded = await Repository.getExternalCalendarControl(HOTEL);
    const reviewed = await Repository.previewExternalCalendarPlan(rotateDraft(coreContext.HotelsV2WorkspaceCore, loaded), loaded);
    expect(JSON.stringify(reviewed.reviewed_plan)).not.toContain(ICAL_URL);
    const receipt = await Repository.applyExternalCalendarPlan(reviewed.reviewed_plan, CORRELATION, IDEMPOTENCY, ICAL_URL);
    expect(receipt.activity).toHaveLength(1);
    await expect(Repository.applyExternalCalendarPlan(reviewed.reviewed_plan, CORRELATION, IDEMPOTENCY, ICAL_URL))
      .rejects.toThrow('exact unchanged server-reviewed plan');
    expect(calls.filter((call) => call.name === 'hotel_v2_admin_apply_external_calendar_plan')).toHaveLength(1);
    expect(calls.at(-1)?.payload.p_ical_url).toBe(ICAL_URL);
  });

  test('uses only the six reviewed Admin/Partner RPCs and never browser Vault/private/worker access', () => {
    const files = [
      'admin/hotels-v2-workspace-repository.js', 'admin/hotels-v2-workspace.js',
      'js/hotels-v2-partner-workspace-repository.js', 'js/hotels-v2-partner-workspace.js',
    ].map((relative) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8')).join('\n');
    for (const name of [
      'hotel_v2_admin_get_external_calendar_control', 'hotel_v2_admin_preview_external_calendar_plan',
      'hotel_v2_admin_apply_external_calendar_plan', 'hotel_v2_partner_get_external_calendar_control',
      'hotel_v2_partner_preview_external_calendar_plan', 'hotel_v2_partner_apply_external_calendar_plan',
    ]) expect(files).toContain(name);
    expect(files).not.toMatch(/hotel_v2_admin_set_external_calendar_ical_secret/);
    expect(files).not.toMatch(/hotels-v2-external-calendar-sync/);
    expect(files).not.toMatch(/\.from\s*\(\s*['"](?:vault\.|hotel_external_calendar_private|hotel_external_calendar_sync_jobs)/);
    expect(files).toContain("type=\"password\"");
    expect(files).toContain("state.root.dir = state.language === 'he' ? 'rtl' : 'ltr'");
    expect(files).toContain('Kalendarze zewnętrzne');
    expect(files).toContain('יומנים חיצוניים');
    expect(files).toContain('Ogólny iCal');
    expect(files).toContain('iCal כללי');
    expect(files).toContain('externalCalendarText(source.health.status)');
    expect(files).toContain("workspace.assignment.capabilities.manage_availability !== true");
  });

  test('wires both responsive reviewed UIs with masked secrets, disabled activation and no direct mutation retry', () => {
    const admin = fs.readFileSync(path.join(process.cwd(), 'admin/hotels-v2-workspace.js'), 'utf8');
    const partner = fs.readFileSync(path.join(process.cwd(), 'js/hotels-v2-partner-workspace.js'), 'utf8');
    for (const marker of [
      'data-external-calendar-create', 'data-external-calendar-edit', 'data-external-calendar-secret',
      'data-external-calendar-lifecycle', 'data-external-calendar-sync',
    ]) expect(admin).toContain(marker);
    for (const marker of [
      'data-phw-external-create', 'data-phw-external-source-form', 'data-phw-external-secret',
      'data-phw-external-lifecycle', 'data-phw-external-sync',
    ]) expect(partner).toContain(marker);
    expect(admin).toContain("source.is_enabled && control.hotel_external_sync_enabled ? '' : 'disabled'");
    expect(partner).toContain("source.is_enabled && control.hotel_external_sync_enabled ? '' : 'disabled'");
    for (const sourceType of ['booking_com', 'airbnb', 'ical']) {
      expect(admin).toContain(`[\'${sourceType}\'`);
      expect(partner).toContain(`[\'${sourceType}\'`);
    }
    expect(admin).toContain('name="source_type"');
    expect(partner).toContain('name="source_type"');
    expect(admin).toContain("source_type: String(fd.get('source_type') || '')");
    expect(partner).toContain("source_type: String(data.get('source_type') || '')");
    expect(admin).toContain('externalCalendarProviderLabel(source.source_type)');
    expect(partner).toContain('externalCalendarProviderLabel(source.source_type)');
    expect(admin).toContain("onClose: () => Repository.clearExternalCalendarReviewedPlan()");
    expect(partner).toContain("if (state.pending?.domain === 'external_calendar') Repository.clearReviewedPlans()");
    expect(admin).not.toMatch(/ical_url[^\n]{0,120}(?:value=|textContent|innerHTML)/);
    expect(partner).not.toMatch(/ical_url[^\n]{0,120}(?:value=|textContent|innerHTML)/);
  });
});
