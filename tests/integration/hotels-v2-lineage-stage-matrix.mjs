import assert from 'node:assert/strict';
export function stageMatrix(sql,stage){
 const result=JSON.parse(sql(`BEGIN READ ONLY;
 SELECT jsonb_build_object('stage',${stage},
 'scoped_lineage',public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NOT NULL,
 'reconciliation_anchor',hotels_lineage_private.current_anchor_is_exact(),
 'reviewed_receipt_chain',public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
 'topology',public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
 'activation_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
 'oracle',public.hotel_v2_seven_arches_reviewed_pricing_oracle()-'fingerprint',
 'allocation',public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact(),
 'payment_lineage',public.hotel_v2_seven_arches_payment_policy_lineage_is_exact(),
 'commission_exact',EXISTS(SELECT 1 FROM public.hotel_commission_policies WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
 AND commission_mode='per_allocated_room_per_night' AND amount=10 AND currency='EUR' AND is_active AND review_status='reviewed'),
 'flags', (SELECT jsonb_build_array(hotel_rooms_v2_enabled,hotel_external_sync_enabled,hotel_instant_booking_enabled,hotel_stripe_connect_enabled) FROM public.site_settings WHERE id=1),
 'architecture',(SELECT architecture_version FROM public.hotels WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
 'authority_count',(SELECT count(*) FROM public.hotel_seven_arches_independent_pricing_authority),
 'successor_count',(SELECT count(*) FROM hotels_lineage_private.successor_receipts));ROLLBACK;`));
 for(const key of ['scoped_lineage','reconciliation_anchor','reviewed_receipt_chain','topology','activation_safe','allocation','payment_lineage','commission_exact'])assert.equal(result[key],true,`${stage}:${key}`);
 assert.equal(result.oracle.core_case_count,100);assert.equal(result.oracle.core_mismatch_count,0);
 assert.equal(result.oracle.guest_one_case_count,20);assert.equal(result.oracle.guest_one_mismatch_count,0);
 assert.equal(result.authority_count,54);assert.equal(result.architecture,'legacy');
 assert.deepEqual(result.flags,[false,true,false,false]);
 assert.equal(result.successor_count,stage<114450?0:stage<114480?1:2);
 console.log('STAGE_MATRIX='+JSON.stringify(result));return result;
}
