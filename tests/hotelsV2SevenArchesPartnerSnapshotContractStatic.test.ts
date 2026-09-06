import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (name: string) => fs.readFileSync(name, 'utf8');
const migration = read('supabase/migrations/20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql');
const workspaceMigration = read('supabase/migrations/20260811380000_hotels_v2_h3_2b_partner_hotel_workspace.sql');
const reviewed = read('supabase/migrations/20260811441500_hotels_v2_seven_arches_reviewed_pricing_evolution.sql');
const lineage = read('supabase/migrations/20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql');
const core = read('js/hotels-v2-partner-workspace-core.js');
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
function definition(sql: string, name: string): string {
  const start = sql.indexOf(`create function public.${name}(`);
  if (start < 0) throw new Error(`Missing ${name}`);
  const end = sql.indexOf('\n$function$;', start);
  if (end < 0) throw new Error(`Missing function boundary for ${name}`);
  return sql.slice(start, end + 12);
}
const get = definition(migration, 'hotel_v2_partner_get_seven_arches_reviewed_pricing');
const workspace = definition(workspaceMigration, 'hotel_v2_partner_get_workspace');
const preview = definition(reviewed, 'hotel_v2_partner_preview_seven_arches_pricing_proposal');
const submit = definition(reviewed, 'hotel_v2_partner_submit_seven_arches_pricing_proposal');

describe('114420 canonical Partner workspace snapshot contract (no RPC execution)', () => {
  test('Get reuses precisely the workspace and date range used by 114415 Preview', () => {
    expect(get).toContain('v_workspace:=public.hotel_v2_partner_get_workspace(\n    p_partner_id,p_hotel_id,current_date,current_date+30);');
    expect(preview).toContain('v_workspace:=public.hotel_v2_partner_get_workspace(\n    v_partner,c_hotel,current_date,current_date+30);');
    expect(get).toContain("'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}'");
    expect(preview).toContain("p_draft->>'pricing_snapshot_token' is distinct from\n       v_workspace#>>'{pricing,snapshot_token}'");
    expect(submit).toContain("p_reviewed_plan->>'pricing_snapshot_token'<>\n       v_workspace#>>'{pricing,snapshot_token}'");
    expect(core).toContain('value.pricing_snapshot_token !== workspace.pricing?.snapshot_token');
    expect(get).not.toContain('v_pricing');
    expect(get).not.toContain('public.hotel_v2_admin_c_pricing_control_snapshot(');
  });

  test('canonical constructor includes commission and exact-date state in deterministic order', () => {
    expect(workspace).toContain("v_pricing_token:=public.hotel_v2_h3_2b_hash(jsonb_build_object(\n      'admin_c_snapshot_token',v_pricing->>'snapshot_token','commission_policy',v_commission,\n      'exact_date_prices',v_exact_prices));");
    expect(workspace).toContain('v_commission:=public.hotel_v2_h3_2b_commission_policy(p_hotel_id);');
    expect(workspace).toContain("coalesce(jsonb_agg(public.hotel_v2_h3_2b_exact_price_projection(override_row.id)\n      order by override_row.stay_date,override_row.id),'[]'::jsonb)");
    expect(workspace).toContain('where override_row.hotel_id=p_hotel_id;');
    expect(workspaceMigration).toContain("convert_to(p_value::text,'UTF8'),'sha256'");
    expect(workspace).toContain("'snapshot_token',v_pricing_token");
    // Reuse, not a JavaScript reimplementation of PostgreSQL JSONB serialization.
    expect(get).not.toContain('v_pricing_token:=');
    expect(get).not.toContain("'exact_date_prices'");
  });

  test('all canonical commission and exact-date projection fields remain unchanged', () => {
    const policy = definition(workspaceMigration, 'hotel_v2_h3_2b_commission_policy');
    for (const field of ['id', 'code', 'commission_mode', 'amount', 'currency', 'version', 'updated_at', 'fingerprint', 'read_only']) {
      expect(policy).toContain(`'${field}'`);
    }
    const projection = definition(workspaceMigration, 'hotel_v2_h3_2b_exact_price_projection');
    const body = projection.slice(projection.indexOf('as $function$') + 13, projection.lastIndexOf('$function$;'));
    expect(sha(body)).toBe('41f8609b712906301ef93e0eb438188ce1989e1114ccea1dcf3f55e1775f438b');
    expect(migration).toContain("'41f8609b712906301ef93e0eb438188ce1989e1114ccea1dcf3f55e1775f438b','s',true");
    for (const field of ['id', 'hotel_id', 'room_rate_id', 'stay_date', 'nightly_rate_mode', 'nightly_rate', 'minimum_stay_mode', 'minimum_stay', 'maximum_stay_mode', 'maximum_stay', 'pricing_reason', 'pricing_expires_at', 'pricing_version', 'pricing_updated_at']) {
      expect(projection).toContain(`'${field}'`);
    }
  });

  test('new dependency is source-pinned and checks immutable workspace lineage before installation', () => {
    const fn = definition(lineage, 'hotel_v2_partner_workspace_function_lineage_is_exact');
    const body = fn.slice(fn.indexOf('as $function$') + 13, fn.lastIndexOf('$function$;'));
    expect(sha(body)).toBe('dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85');
    expect(migration).toContain("'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85','s',true");
    expect(migration).toContain('if public.hotel_v2_partner_workspace_function_lineage_is_exact() is not true');
    expect(fn).toContain('v_receipt.partner_workspace_source_after_hash=');
    expect(fn).toContain('public.hotel_v2_external_calendar_worker_hash(to_jsonb(v_source))');
    expect(migration).toContain("message='hotels_v2_seven_arches_application_bridge_partner_workspace_drift'");
  });

  test('authorization, all output fields and isolation are byte-preserved apart from token acquisition', () => {
    const reverted = get
      .replace('declare v_access jsonb; v_workspace jsonb;', 'declare v_access jsonb; v_pricing jsonb;')
      .replace('  -- Match the exact workspace used by the existing 114415 Partner Preview.\n  -- Do not reconstruct or substitute the raw Admin-C snapshot token here.\n  v_workspace:=public.hotel_v2_partner_get_workspace(\n    p_partner_id,p_hotel_id,current_date,current_date+30);', '  v_pricing:=public.hotel_v2_admin_c_pricing_control_snapshot(p_hotel_id);')
      .replace("'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}'", "'pricing_snapshot_token',v_pricing->>'snapshot_token'");
    expect(sha(reverted)).toBe('1e660e46dd03a10ee67471c5605770db18557960c653aed56382549c283fdbd1');
    expect(get).toContain("p_partner_id,p_hotel_id,'manage_prices'");
    expect(get).toContain('where proposal.partner_id=p_partner_id\n        and proposal.assignment_id=');
    expect(reviewed).toContain('partner_id is null');
    expect(get).toContain('p_hotel_id is distinct from');
  });

  test('Get security and authenticated-only ACL remain exact', () => {
    expect(get).toContain('p_partner_id uuid,p_hotel_id uuid\n) returns jsonb language plpgsql stable security definer\nset search_path=pg_catalog,public,auth');
    expect(migration).toContain('alter function public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)\n  owner to postgres;');
    expect(migration).toContain('revoke all on function\n  public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)\n  from public,anon,authenticated,service_role;');
    expect(migration).toContain('grant execute on function\n  public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)\n  to authenticated;');
    expect((migration.match(/grant execute on function\s+public\.hotel_v2_partner_get_seven_arches_reviewed_pricing/g) || [])).toHaveLength(1);
  });

  test('no business writes or mutation RPC invocation were introduced in Get', () => {
    const sql = get.replace(/--[^\n]*/g, '');
    expect(sql).not.toMatch(/\b(insert|update|delete|merge|truncate)\b/i);
    expect(sql).not.toMatch(/public\.hotel_v2_\w*(?:preview|submit|apply)\w*\s*\(/i);
    expect(migration.startsWith('begin;\nset transaction isolation level repeatable read;')).toBe(true);
    expect(migration.trimEnd().endsWith("notify pgrst,'reload schema';\ncommit;")).toBe(true);
  });

  test('114425 and 114450 remain byte-identical; 114450 pins unaffected public helpers only', () => {
    const m425 = read('supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql');
    const m450 = read('supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql');
    expect(sha(m425)).toBe('d72c244840bd21a5c5e7e46f654c8b3a7466f80f1d18ebac3ca938ab43163ee5');
    expect(sha(m450)).toBe('b679b8f65200d345ce154ef99343f1488dbb93394b65dab9fbf1d17c16688c84');
    for (const downstream of [m425, m450]) expect(downstream).not.toContain('hotel_v2_partner_get_seven_arches_reviewed_pricing');
    for (const [name, hash] of [
      ['hotel_v2_public_quote_seven_arches_core', '5265e97e8971d06e95e27db72ebc2f5e006eac8cb17779f1cff6ab519f9e6559'],
      ['hotel_v2_seven_arches_public_booking_receipt_chain_is_exact', '6c6f107b2d90abd7d9216cbd10c5d3817661250cdc35d52858c9ba923cfda258'],
    ]) {
      const fn = definition(migration, name);
      expect(sha(fn.slice(fn.indexOf('as $function$') + 13, fn.lastIndexOf('$function$;')))).toBe(hash);
      expect(m450).toContain(hash);
    }
  });
});
