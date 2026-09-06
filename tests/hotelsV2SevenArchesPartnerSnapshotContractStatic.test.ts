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
  const snapshotName = 'hotel_v2_admin_c_pricing_control_snapshot';
  const oldSnapshotHash = 'd6cec06410e28b4138de5776b66f622ad8c9402662672862726e81ecb7ea613a';
  const currentSnapshotHash = '3f954c525277c771c3009e9ca1fbbf6c68776904f40bc70978d01f7f10a060b0';
  const originalSnapshotSql = read('supabase/migrations/20260811350000_hotels_v2_admin_c_pricing_control.sql');
  const hotfixSql = read('supabase/migrations/20260811370000_hotels_v2_pgcrypto_digest_schema_hotfix.sql');
  const bodyOf = (sql: string) => {
    const fn = definition(sql.replace(/create or replace function/g, 'create function'), snapshotName);
    return fn.slice(fn.indexOf('as $function$') + 13, fn.lastIndexOf('$function$;'));
  };

  test('pins the complete accepted 113700 snapshot body, not the historical 113500 body', () => {
    expect(sha(bodyOf(originalSnapshotSql))).toBe(oldSnapshotHash);
    expect(sha(bodyOf(hotfixSql))).toBe(currentSnapshotHash);
    expect(migration).toContain(`('public.${snapshotName}(uuid)',\n       '${currentSnapshotHash}','s',true,\n       array['search_path=pg_catalog, public']::text[])`);
    expect(migration).not.toContain(oldSnapshotHash);
  });

  test('the only accepted snapshot evolution is extensions.digest qualification', () => {
    const before = bodyOf(originalSnapshotSql);
    const after = bodyOf(hotfixSql);
    expect(before.match(/digest\(convert_to/g)).toHaveLength(1);
    expect(after).toBe(before.replace('digest(convert_to', 'extensions.digest(convert_to'));
    expect(after.match(/extensions\.digest\(convert_to/g)).toHaveLength(1);
    expect(after).not.toMatch(/(?<![\w.])digest\(/);
    expect(definition(hotfixSql.replace(/create or replace function/g, 'create function'), snapshotName))
      .toContain('set search_path=pg_catalog,public');
  });

  test('all dependency security and raw source equality checks remain fail-closed', () => {
    const guard = migration.slice(migration.indexOf('from (values'), migration.indexOf("message='hotels_v2_seven_arches_application_bridge_dependency_source_drift'"));
    for (const check of [
      'procedure_row.oid is null', "procedure_row.proowner<>'postgres'::regrole",
      'procedure_row.provolatile<>expected.volatility::"char"',
      'procedure_row.prosecdef<>expected.security_definer',
      'procedure_row.proconfig is distinct from expected.configuration',
      "encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')<>\n          expected.source_hash",
      "not has_function_privilege('postgres',procedure_row.oid,'EXECUTE')",
      "has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')",
      ...['anon', 'authenticated', 'service_role'].map(role => `has_function_privilege('${role}',procedure_row.oid,'EXECUTE')`),
    ]) expect(guard).toContain(check);
  });

  test('no later applied migration replaces the inherited Admin-C snapshot definition', () => {
    const laterApplied = fs.readdirSync('supabase/migrations').filter(name =>
      /^202608114(400|405|406|407|410|415)00_/.test(name));
    expect(laterApplied).toHaveLength(6);
    for (const name of laterApplied) {
      expect(read(`supabase/migrations/${name}`)).not.toMatch(
        /create\s+(?:or\s+replace\s+)?function\s+public\.hotel_v2_admin_c_pricing_control_snapshot\s*\(/i);
    }
  });

  // Optional artifact audit: the production preflight lives outside the repository.
  // Set this path explicitly when validating a regenerated manual handoff file.
  (process.env.HOTELS_114420_PREFLIGHT ? test : test.skip)(
    'regenerated preflight removes only stale-pin suppression from all twelve guarded leaves', () => {
      const preflight = read(process.env.HOTELS_114420_PREFLIGHT!);
      expect(preflight).toContain(`-- ${sha(migration)}`);
      expect(preflight).toContain(`('public.${snapshotName}(uuid)','${currentSnapshotHash}','s',true,ARRAY['search_path=pg_catalog, public']::text[],false)`);
      expect(preflight).not.toContain(oldSnapshotHash);
      expect(preflight).toContain('AND (cardinality(s.required_functions)=0\n      OR NOT EXISTS(SELECT 1 FROM pin_results WHERE exact IS NOT TRUE))');
      expect(preflight).toContain('CASE WHEN eligible THEN');
      expect(preflight).toContain('ELSE NULL END AS actual');
      const specs = [...preflight.matchAll(/\((\d+),'[^']+','([^']+)','[^']+',\s*ARRAY\[[^\]]*\]::text\[\],ARRAY\[([^\]]*)\]::text\[\],\s*\$read\d+\$/g)];
      expect(specs).toHaveLength(102);
      const guarded = specs.filter(spec => spec[3].length > 0);
      expect(guarded.map(spec => spec[2])).toEqual([
        'partner_pricing_snapshot_contract_compatible',
        'hotel_v2_seven_arches_independent_pricing_topology_is_exact',
        'hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact',
        'hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact',
        'hotel_v2_seven_arches_payment_policy_lineage_is_exact',
        'hotel_v2_seven_arches_pricing_activation_current_is_safe',
        'hotel_v2_7a_pricing_activation_transaction_is_preserved',
        'core_case_count', 'core_mismatch_count', 'guest_one_case_count',
        'guest_one_mismatch_count', 'scoped_lineage_present',
      ]);
      const expectedPin = preflight.match(/\('public\.hotel_v2_admin_c_pricing_control_snapshot\(uuid\)','([0-9a-f]{64})'/)![1];
      // Model only the source gate, holding all other prerequisites true. This
      // does not execute helpers or assert current production business results.
      for (const _leaf of guarded) {
        const gate = (actualHash: string, otherPinsExact: boolean) =>
          otherPinsExact && actualHash === expectedPin;
        expect(gate(sha(bodyOf(hotfixSql)), true)).toBe(true);
        expect(gate(sha(bodyOf(originalSnapshotSql)), true)).toBe(false);
        expect(gate(sha(bodyOf(hotfixSql)), false)).toBe(false);
      }
      expect(preflight.startsWith('BEGIN;\nSET TRANSACTION READ ONLY;')).toBe(true);
      expect(preflight.trimEnd().endsWith('ROLLBACK;')).toBe(true);
    });

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
