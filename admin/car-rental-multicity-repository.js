(function registerCarRentalMulticityRepository(root) {
  'use strict';

  const TABLES = Object.freeze({
    offers: 'car_offers',
    cities: 'car_rental_cities',
    profiles: 'car_pricing_profiles',
    profileCities: 'car_pricing_profile_cities',
    availability: 'car_offer_city_availability',
    dailyRateTiers: 'car_offer_daily_rate_tiers',
    vehicleKinds: 'car_vehicle_kinds',
    partners: 'partners',
    partnerResources: 'partner_resources',
    siteSettings: 'site_settings',
    depositRules: 'service_deposit_rules',
    depositOverrides: 'service_deposit_overrides',
  });

  function normalizeId(value) {
    return String(value || '').trim();
  }

  function staleConflict(message, details = null) {
    const error = new Error(message || 'Data changed since Review. Refresh and review again.');
    error.code = 'car_multicity_stale_conflict';
    error.details = details;
    return error;
  }

  function internalError(message, details = null) {
    const error = new Error(message || 'Unexpected multi-city repository result.');
    error.code = 'car_multicity_internal_error';
    error.details = details;
    return error;
  }

  function rows(result) {
    if (Array.isArray(result?.data)) return result.data;
    if (result?.data && typeof result.data === 'object') return [result.data];
    return [];
  }

  function first(result) {
    return rows(result)[0] || null;
  }

  function assertResult(result) {
    if (result?.error) throw result.error;
    return result;
  }

  function assertAllowedPayload(payload, allowedFields, operation) {
    const allowed = new Set(allowedFields || []);
    const keys = Object.keys(payload || {});
    const forbidden = keys.filter((key) => !allowed.has(key));
    if (forbidden.length) {
      throw internalError(`${operation} contains forbidden fields: ${forbidden.join(', ')}`, { forbidden });
    }
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function create(options = {}) {
    const getClient = typeof options.getClient === 'function'
      ? options.getClient
      : () => options.client || null;
    const core = options.core || root.CarRentalMulticityCore;
    if (!core) throw new Error('CarRentalMulticityCore dependency is required');

    function client() {
      const value = getClient();
      if (!value || typeof value.from !== 'function') throw new Error('Database connection not available');
      return value;
    }

    async function listRows(table, select = '*', configure = null) {
      let query = client().from(table).select(select);
      if (typeof configure === 'function') query = configure(query);
      return rows(assertResult(await query));
    }

    async function getOfferById(offerId) {
      const id = normalizeId(offerId);
      if (!id) return null;
      const result = await client().from(TABLES.offers).select('*').eq('id', id).limit(1);
      return first(assertResult(result));
    }

    async function listCities() {
      return listRows(TABLES.cities, '*', (query) => query.order('sort_order', { ascending: true }).order('code', { ascending: true }));
    }

    async function listProfiles() {
      return listRows(TABLES.profiles, '*', (query) => query.order('code', { ascending: true }));
    }

    async function listProfileCities() {
      return listRows(TABLES.profileCities, '*', (query) => query.order('pricing_profile_id', { ascending: true }).order('city_id', { ascending: true }));
    }

    async function listVehicleKinds() {
      return listRows(TABLES.vehicleKinds, '*', (query) => query.order('sort_order', { ascending: true }).order('code', { ascending: true }));
    }

    async function listPartners() {
      return listRows(
        TABLES.partners,
        'id,name,status,can_manage_cars,cars_locations,updated_at',
        (query) => query.order('name', { ascending: true }),
      );
    }

    async function getSiteSetting() {
      const result = await client()
        .from(TABLES.siteSettings)
        .select('id,car_multi_city_mapped_enabled,car_threshold_daily_rates_enabled,updated_at')
        .order('id', { ascending: true })
        .limit(1);
      return first(assertResult(result));
    }

    async function listAvailabilityByOfferId(offerId) {
      const id = normalizeId(offerId);
      if (!id) return [];
      return listRows(TABLES.availability, '*', (query) => query.eq('offer_id', id).order('city_id', { ascending: true }));
    }

    async function listDailyRateTiersByOfferId(offerId) {
      const id = normalizeId(offerId);
      if (!id) return [];
      return listRows(
        TABLES.dailyRateTiers,
        '*',
        (query) => query.eq('offer_id', id).order('threshold_days', { ascending: true }),
      );
    }

    async function listPartnerResourcesByOfferId(offerId) {
      const id = normalizeId(offerId);
      if (!id) return [];
      return listRows(
        TABLES.partnerResources,
        'id,partner_id,resource_type,resource_id,created_at',
        (query) => query.eq('resource_type', 'cars').eq('resource_id', id).order('created_at', { ascending: true }),
      );
    }

    async function getCarsDepositDefault() {
      const matches = await listRows(
        TABLES.depositRules,
        'id,resource_type,mode,amount,currency,include_children,enabled,created_at,updated_at',
        (query) => query.eq('resource_type', 'cars').limit(2),
      );
      if (matches.length > 1) throw internalError('Multiple Cars deposit default rules detected.');
      return matches[0] || null;
    }

    async function getCarsDepositOverride(offerId) {
      const id = normalizeId(offerId);
      if (!id) return null;
      const matches = await listRows(
        TABLES.depositOverrides,
        'id,resource_type,resource_id,mode,amount,currency,include_children,enabled,created_at,updated_at',
        (query) => query.eq('resource_type', 'cars').eq('resource_id', id).limit(2),
      );
      if (matches.length > 1) throw internalError('Multiple exact Cars deposit overrides detected.', { offerId: id });
      return matches[0] || null;
    }

    function getStorageBucket() {
      const value = getClient();
      const bucket = value?.storage?.from?.(core.VEHICLE_IMAGE_BUCKET);
      if (!bucket || typeof bucket.upload !== 'function') {
        throw new Error('Car image storage is not available');
      }
      return bucket;
    }

    function safeImagePathPart(value) {
      return String(value || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'pending';
    }

    function buildVehicleImagePath(file, options = {}) {
      const validation = core.validateVehicleImageFile(file);
      if (!validation.valid) {
        const error = new Error(validation.errors[0]?.message || 'Invalid vehicle image');
        error.code = 'car_multicity_image_validation_failed';
        error.details = validation;
        throw error;
      }
      const exactId = normalizeId(options.offerId);
      const temporaryId = normalizeId(options.temporaryId);
      const identity = safeImagePathPart(exactId || temporaryId || `pending-${Date.now()}`);
      const nonce = safeImagePathPart(options.nonce || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      return `car-${identity}-${nonce}.${validation.metadata.extension}`;
    }

    async function uploadVehicleImage(request = {}) {
      const validation = core.validateVehicleImageFile(request.file);
      if (!validation.valid) {
        const error = new Error(validation.errors[0]?.message || 'Invalid vehicle image');
        error.code = 'car_multicity_image_validation_failed';
        error.details = validation;
        throw error;
      }
      const path = buildVehicleImagePath(request.file, request);
      request.onProgress?.({ percent: 10, status: 'validated', path });
      const bucket = getStorageBucket();
      const upload = assertResult(await bucket.upload(path, request.file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: validation.metadata.type,
      }));
      request.onProgress?.({ percent: 85, status: 'uploaded', path });
      const publicResult = bucket.getPublicUrl(path);
      const publicUrl = normalizeId(publicResult?.data?.publicUrl);
      if (!publicUrl) {
        try {
          await bucket.remove?.([path]);
        } catch (_error) {
          // The caller receives the exact path so cleanup can be retried safely.
        }
        throw internalError('Uploaded vehicle image has no public URL.', { path });
      }
      request.onProgress?.({ percent: 100, status: 'complete', path, publicUrl });
      return { bucket: core.VEHICLE_IMAGE_BUCKET, path: normalizeId(upload?.data?.path || path), publicUrl, metadata: validation.metadata };
    }

    async function removeVehicleImage(path) {
      const exactPath = normalizeId(path);
      if (!exactPath || exactPath.includes('..') || exactPath.startsWith('/')) {
        throw internalError('Exact uploaded image path is invalid.', { path: exactPath });
      }
      const bucket = getStorageBucket();
      if (typeof bucket.remove !== 'function') throw new Error('Car image cleanup is not available');
      const result = assertResult(await bucket.remove([exactPath]));
      return { bucket: core.VEHICLE_IMAGE_BUCKET, path: exactPath, removed: true, data: result?.data || null };
    }

    async function getCatalog() {
      const [cities, profiles, profileCities, vehicleKinds, partners, siteSetting] = await Promise.all([
        listCities(),
        listProfiles(),
        listProfileCities(),
        listVehicleKinds(),
        listPartners(),
        getSiteSetting(),
      ]);
      return { cities, profiles, profileCities, vehicleKinds, partners, siteSetting };
    }

    function assertCatalogContract(catalog) {
      const setting = catalog?.siteSetting;
      if (!setting
        || typeof setting.car_multi_city_mapped_enabled !== 'boolean'
        || typeof setting.car_threshold_daily_rates_enabled !== 'boolean') {
        throw staleConflict('Cars capability settings could not be verified from the fresh catalog.');
      }
    }

    async function getOfferContext(offerId) {
      const id = normalizeId(offerId);
      if (!id) throw new Error('Exact car offer ID is required');
      const [offer, catalog, availability, dailyRateTiers, partnerResources, depositRule, depositOverride] = await Promise.all([
        getOfferById(id),
        getCatalog(),
        listAvailabilityByOfferId(id),
        listDailyRateTiersByOfferId(id),
        listPartnerResourcesByOfferId(id),
        getCarsDepositDefault(),
        getCarsDepositOverride(id),
      ]);
      if (!offer) throw staleConflict('Exact car offer no longer exists.', { offerId: id });
      return { offer, ...catalog, availability, dailyRateTiers, partnerResources, depositRule, depositOverride, loadedAt: new Date().toISOString() };
    }

    async function getCreateContext() {
      const [catalog, depositRule] = await Promise.all([getCatalog(), getCarsDepositDefault()]);
      return { offer: null, availability: [], dailyRateTiers: [], partnerResources: [], depositRule, depositOverride: null, ...catalog, loadedAt: new Date().toISOString() };
    }

    async function getFleetPresentationContext(offerIds = []) {
      const exactOfferIds = Array.from(new Set((offerIds || []).map(normalizeId).filter(Boolean))).sort();
      const catalog = await getCatalog();
      if (!exactOfferIds.length) {
        return { ...catalog, availability: [], dailyRateTiers: [], partnerResources: [], depositOverrides: [], loadedAt: new Date().toISOString() };
      }
      const [availability, dailyRateTiers, partnerResources, depositOverrides] = await Promise.all([
        listRows(
          TABLES.availability,
          '*',
          (query) => query.in('offer_id', exactOfferIds).order('offer_id', { ascending: true }).order('city_id', { ascending: true }),
        ),
        listRows(
          TABLES.dailyRateTiers,
          '*',
          (query) => query.in('offer_id', exactOfferIds).order('offer_id', { ascending: true }).order('threshold_days', { ascending: true }),
        ),
        listRows(
          TABLES.partnerResources,
          'id,partner_id,resource_type,resource_id,created_at',
          (query) => query.eq('resource_type', 'cars').in('resource_id', exactOfferIds).order('resource_id', { ascending: true }),
        ),
        listRows(
          TABLES.depositOverrides,
          'id,resource_type,resource_id,mode,amount,currency,include_children,enabled,created_at,updated_at',
          (query) => query.eq('resource_type', 'cars').in('resource_id', exactOfferIds).order('resource_id', { ascending: true }),
        ),
      ]);
      return { ...catalog, availability, dailyRateTiers, partnerResources, depositOverrides, loadedAt: new Date().toISOString() };
    }

    async function applyFleetBulkOperation(plan) {
      if (!plan?.valid || !Array.isArray(plan.targets) || !plan.targets.length) {
        throw internalError('A current reviewed Fleet bulk plan is required.');
      }
      if (typeof client().rpc !== 'function') {
        throw internalError('Transactional Fleet bulk RPC is unavailable.');
      }
      const targets = plan.targets.map((target) => ({
        offer_id: normalizeId(target.offer_id),
        expected_updated_at: target.expected_updated_at || null,
        expected_availability: core.clone(target.expected_availability || []),
        expected_deposit_override: target.expected_deposit_override
          ? core.clone(target.expected_deposit_override)
          : null,
        desired_availability: Array.isArray(target.desired_availability)
          ? core.clone(target.desired_availability)
          : null,
        target_availability_mode: String(target.target_availability_mode || 'legacy'),
      }));
      const result = await client().rpc('admin_apply_car_fleet_bulk_operation', {
        p_targets: targets,
        p_operations: core.clone(plan.operations),
      });
      if (result?.error?.code === '40001') {
        throw staleConflict('One or more selected vehicles changed since Review. No changes were applied.', {
          exactOfferIds: targets.map((target) => target.offer_id),
        });
      }
      const asserted = assertResult(result);
      const receipt = asserted?.data;
      if (!receipt || Number(receipt.target_count) !== targets.length) {
        throw internalError('Fleet bulk transaction returned an unexpected receipt.', {
          expected: targets.length,
          received: receipt?.target_count,
        });
      }
      const returnedIds = Array.isArray(receipt.offer_ids) ? receipt.offer_ids.map(normalizeId).sort() : [];
      const expectedIds = targets.map((target) => target.offer_id).sort();
      if (core.stableSerialize(returnedIds) !== core.stableSerialize(expectedIds)) {
        throw internalError('Fleet bulk transaction returned unexpected exact offer IDs.', { expectedIds, returnedIds });
      }
      return receipt;
    }

    async function exactOfferUpdate(offerId, expectedUpdatedAt, payload, allowedFields, operation) {
      const id = normalizeId(offerId);
      if (!id || !expectedUpdatedAt) throw staleConflict('Exact offer ID and expectedUpdatedAt are required.', { offerId: id });
      assertAllowedPayload(payload, allowedFields, operation);
      let query = client().from(TABLES.offers).update(payload).eq('id', id).eq('updated_at', expectedUpdatedAt).select('*');
      const result = assertResult(await query);
      const matches = rows(result);
      if (matches.length === 0) throw staleConflict('Car offer changed since Review.', { offerId: id, expectedUpdatedAt });
      if (matches.length !== 1 || normalizeId(matches[0].id) !== id) {
        throw internalError('Exact offer update returned an unexpected number of rows.', { offerId: id, count: matches.length });
      }
      return matches[0];
    }

    async function updateVehicleDetails(request) {
      return exactOfferUpdate(
        request.offerId,
        request.expectedUpdatedAt,
        request.payload,
        core.VEHICLE_COLUMNS,
        'Vehicle update',
      );
    }

    async function validatePricingUpdateContract(request, currentOfferOverride = null) {
      const offerId = normalizeId(request.offerId);
      const currentOffer = currentOfferOverride || await getOfferById(offerId);
      if (!currentOffer || normalizeId(currentOffer.id) !== offerId) {
        throw staleConflict('Exact offer changed or is missing.', { offerId });
      }
      if (String(currentOffer.updated_at || '') !== String(request.expectedUpdatedAt || '')) {
        throw staleConflict('Car offer changed since Review.', {
          offerId,
          expectedUpdatedAt: request.expectedUpdatedAt,
        });
      }

      const currentStrategy = core.normalizeCode(currentOffer.pricing_strategy || 'legacy_compat') || 'legacy_compat';
      const targetStrategy = hasOwn(request.payload, 'pricing_strategy')
        ? core.normalizeCode(request.payload.pricing_strategy)
        : currentStrategy;
      if (!core.PRICING_STRATEGIES.includes(targetStrategy)) {
        throw internalError('Pricing save contains an unsupported strategy.', { offerId, targetStrategy });
      }
      if (request.reviewedPricingStrategy
        && core.normalizeCode(request.reviewedPricingStrategy) !== targetStrategy) {
        throw internalError('Pricing payload no longer matches the reviewed strategy.', {
          offerId,
          targetStrategy,
          reviewedPricingStrategy: request.reviewedPricingStrategy,
        });
      }
      if (currentStrategy !== targetStrategy && (
        request.explicitStrategyConversion !== true
        || core.normalizeCode(request.reviewedPricingStrategy) !== targetStrategy
      )) {
        throw internalError('Unexpected pricing strategy conversion blocked before any write.', {
          offerId,
          currentStrategy,
          targetStrategy,
        });
      }

      if (targetStrategy === 'threshold_daily_rate') {
        const forbiddenCompatibilityFields = [
          ...core.PROFILE_COLUMNS,
          ...core.PRICE_COLUMNS,
        ].filter((field) => hasOwn(request.payload, field));
        if (forbiddenCompatibilityFields.length) {
          throw internalError('Threshold pricing save cannot rewrite legacy compatibility metadata.', {
            offerId,
            forbiddenCompatibilityFields,
          });
        }
        return { currentOffer, currentStrategy, targetStrategy };
      }

      const profileId = normalizeId(hasOwn(request.payload, 'pricing_profile_id')
        ? request.payload.pricing_profile_id
        : currentOffer.pricing_profile_id);
      const location = core.normalizeCode(hasOwn(request.payload, 'location')
        ? request.payload.location
        : currentOffer.location);
      const profile = (await listProfiles()).find((row) => normalizeId(row.id) === profileId);
      if (!profile || core.profileLocation(profile) !== location) {
        throw staleConflict('Pricing profile no longer matches the legacy location.', {
          profileId,
          location,
        });
      }
      return { currentOffer, currentStrategy, targetStrategy, profile, location };
    }

    async function validatePricingPlanBeforeMutation(plan) {
      const offerId = normalizeId(plan?.exactOfferId);
      const currentOffer = await getOfferById(offerId);
      const offerSteps = (plan?.steps || []).filter((step) => (
        step?.type === 'car_offer' && step?.action === 'update'
      ));
      if (offerSteps.length > 1) {
        throw internalError('Pricing plan contains multiple exact-offer updates.', { offerId });
      }
      const offerStep = offerSteps[0] || null;
      const payload = offerStep?.payload || {};
      const expectedUpdatedAt = offerStep?.expectedUpdatedAt || plan?.expectedUpdatedAt;
      const reviewedStrategy = core.normalizeCode(plan?.reviewedPricingStrategy);
      const currentStrategy = core.normalizeCode(currentOffer?.pricing_strategy || 'legacy_compat') || 'legacy_compat';
      const explicitStrategyChange = currentStrategy !== reviewedStrategy;
      const reviewedChange = (offerStep?.changes || []).some((change) => (
        change.field === 'pricing_strategy'
        && core.normalizeCode(change.before || 'legacy_compat') === currentStrategy
        && core.normalizeCode(change.after) === reviewedStrategy
      ));
      if (!reviewedStrategy || !core.PRICING_STRATEGIES.includes(reviewedStrategy)) {
        throw internalError('Pricing plan is missing its reviewed strategy.', { offerId });
      }
      if (core.normalizeCode(plan?.originalPricingStrategy || currentStrategy) !== currentStrategy) {
        throw staleConflict('Pricing strategy changed since Review.', { offerId });
      }
      if (explicitStrategyChange
        && (plan?.explicitStrategyConversion !== true || !reviewedChange || !offerStep)) {
        throw internalError('Pricing strategy conversion was not explicitly reviewed.', {
          offerId,
          currentStrategy,
          reviewedStrategy,
        });
      }

      await validatePricingUpdateContract({
        offerId,
        expectedUpdatedAt,
        payload,
        reviewedPricingStrategy: reviewedStrategy,
        explicitStrategyConversion: explicitStrategyChange,
      }, currentOffer);

      const expectedTierRows = plan?.preflightSnapshot?.dailyRateTiers;
      if (!Array.isArray(expectedTierRows)) {
        throw internalError('Pricing plan is missing its reviewed tier snapshot.', { offerId });
      }
      const currentTierRows = await listDailyRateTiersByOfferId(offerId);
      const tierVersionContract = (rowsToProject) => (rowsToProject || []).map((tier) => ({
        id: normalizeId(tier?.id),
        offer_id: normalizeId(tier?.offer_id),
        threshold_days: Number(tier?.threshold_days),
        daily_rate: Number(tier?.daily_rate),
        is_active: tier?.is_active === true,
        updated_at: String(tier?.updated_at || ''),
      })).sort((left, right) => String(left.id).localeCompare(String(right.id)));
      if (JSON.stringify(tierVersionContract(currentTierRows))
        !== JSON.stringify(tierVersionContract(expectedTierRows))) {
        throw staleConflict('Daily-rate tiers changed since Review.', { offerId });
      }

      if (reviewedStrategy !== 'threshold_daily_rate') return;
      const reviewedTiers = Array.isArray(plan?.reviewedDailyRateTiers)
        ? plan.reviewedDailyRateTiers
        : null;
      if (!reviewedTiers) {
        throw internalError('Threshold pricing plan is missing its reviewed tier set.', { offerId });
      }
      const activeTiers = reviewedTiers.filter((tier) => tier?.is_active === true);
      const thresholds = new Set();
      for (const tier of reviewedTiers) {
        const thresholdDays = Number(tier.threshold_days);
        const dailyRate = Number(tier.daily_rate);
        if (!Number.isInteger(thresholdDays) || thresholdDays < 1
          || !Number.isFinite(dailyRate) || dailyRate <= 0
          || thresholds.has(thresholdDays)) {
          throw internalError('Threshold pricing plan contains an invalid or duplicate tier.', {
            offerId,
            thresholdDays,
          });
        }
        thresholds.add(thresholdDays);
      }
      if (!activeTiers.length) {
        throw internalError('Threshold pricing requires at least one active tier.', { offerId });
      }
      const effectiveMinimum = Math.min(...activeTiers.map((tier) => Number(tier.threshold_days)));
      if (Number(plan.effectiveMinRentalDays) !== effectiveMinimum) {
        throw internalError('Reviewed minimum does not match the lowest active tier.', {
          offerId,
          effectiveMinimum,
          reviewedMinimum: plan.effectiveMinRentalDays,
        });
      }
      const targetMaximum = hasOwn(payload, 'max_rental_days')
        ? payload.max_rental_days
        : currentOffer.max_rental_days;
      if (targetMaximum != null && Number(targetMaximum) < effectiveMinimum) {
        throw internalError('Maximum rental days are below the reviewed threshold minimum.', {
          offerId,
          effectiveMinimum,
          targetMaximum,
        });
      }
    }

    async function updatePricingProfile(request) {
      assertAllowedPayload(request.payload, core.PRICING_EDIT_COLUMNS, 'Pricing and profile update');
      await validatePricingUpdateContract(request);
      return exactOfferUpdate(
        request.offerId,
        request.expectedUpdatedAt,
        request.payload,
        core.PRICING_EDIT_COLUMNS,
        'Pricing and profile update',
      );
    }

    async function updatePartnerAssignment(request) {
      assertAllowedPayload(request.payload, core.PARTNER_COLUMNS, 'Partner update');
      const partnerId = normalizeId(request.payload.owner_partner_id);
      if (partnerId) {
        const partners = await listPartners();
        const partner = partners.find((row) => normalizeId(row.id) === partnerId);
        if (!partner || partner.status !== 'active' || partner.can_manage_cars !== true) {
          throw staleConflict('Selected partner is no longer active for Cars.', { partnerId });
        }
      }
      return exactOfferUpdate(
        request.offerId,
        request.expectedUpdatedAt,
        request.payload,
        core.PARTNER_COLUMNS,
        'Partner update',
      );
    }

    async function updateActivationState(request) {
      const offerId = normalizeId(request.offerId);
      if (!offerId || !request.expectedUpdatedAt) {
        throw staleConflict('Exact offer ID and expectedUpdatedAt are required for activation.', { offerId });
      }
      assertAllowedPayload(request.payload, core.ACTIVATION_COLUMNS, 'Exact offer activation update');
      const keys = Object.keys(request.payload || {}).sort();
      const activate = request.payload?.availability_mode === 'mapped'
        && request.payload?.is_available === true
        && request.payload?.is_published === true
        && request.payload?.submission_status === 'approved'
        && keys.join(',') === ['availability_mode', 'is_available', 'is_published', 'submission_status'].sort().join(',');
      const unpublish = request.payload?.is_published === false
        && keys.length === 1
        && keys[0] === 'is_published';
      if (!activate && !unpublish) {
        throw internalError('Activation request does not match the reviewed exact-offer contract.');
      }
      if (typeof client().rpc !== 'function') throw internalError('Transactional activation RPC is unavailable.');
      const result = await client().rpc('admin_set_car_threshold_offer_activation_state', {
        p_offer_id: offerId,
        p_expected_updated_at: request.expectedUpdatedAt,
        p_activate: activate,
      });
      if (result?.error?.code === '40001') {
        throw staleConflict('Car offer changed since Review.', { offerId, expectedUpdatedAt: request.expectedUpdatedAt });
      }
      const matches = rows(assertResult(result));
      if (matches.length !== 1 || normalizeId(matches[0]?.id) !== offerId) {
        throw internalError('Transactional activation returned an unexpected exact offer.', {
          offerId,
          count: matches.length,
        });
      }
      if (activate && (
        matches[0].availability_mode !== 'mapped'
        || matches[0].is_available !== true
        || matches[0].is_published !== true
        || matches[0].submission_status !== 'approved'
      )) {
        throw internalError('Transactional activation postcondition failed.', { offerId });
      }
      if (unpublish && matches[0].is_published !== false) {
        throw internalError('Transactional unpublish postcondition failed.', { offerId });
      }
      return matches[0];
    }

    async function getAvailabilityRow(offerId, cityId) {
      const result = await client().from(TABLES.availability).select('*')
        .eq('offer_id', normalizeId(offerId))
        .eq('city_id', normalizeId(cityId))
        .limit(2);
      const matches = rows(assertResult(result));
      if (matches.length > 1) throw internalError('Duplicate offer-city availability rows detected.', { offerId, cityId });
      return matches[0] || null;
    }

    async function insertAvailability(request) {
      assertAllowedPayload(request.payload, core.AVAILABILITY_COLUMNS, 'Availability insert');
      const existing = await getAvailabilityRow(request.payload.offer_id, request.payload.city_id);
      if (existing) throw staleConflict('Availability row appeared since Review.', { offerId: request.payload.offer_id, cityId: request.payload.city_id });
      const result = assertResult(await client().from(TABLES.availability).insert(request.payload).select('*').single());
      if (!result.data) throw internalError('Availability insert did not return exactly one row.');
      return result.data;
    }

    async function updateAvailability(request) {
      assertAllowedPayload(request.payload, core.AVAILABILITY_COLUMNS, 'Availability update');
      const offerId = normalizeId(request.offerId || request.payload.offer_id);
      const cityId = normalizeId(request.cityId || request.payload.city_id);
      if (!offerId || !cityId || !request.expectedUpdatedAt) throw staleConflict('Availability exact key or timestamp is missing.');
      const updatePayload = { ...request.payload };
      delete updatePayload.offer_id;
      delete updatePayload.city_id;
      let query = client().from(TABLES.availability).update(updatePayload)
        .eq('offer_id', offerId)
        .eq('city_id', cityId)
        .eq('updated_at', request.expectedUpdatedAt)
        .select('*');
      const updated = rows(assertResult(await query));
      if (updated.length === 0) throw staleConflict('Availability row changed since Review.', { offerId, cityId });
      if (updated.length !== 1) throw internalError('Availability update returned multiple rows.', { offerId, cityId, count: updated.length });
      return updated[0];
    }

    async function deleteAvailability(request) {
      const offerId = normalizeId(request.offerId);
      const cityId = normalizeId(request.cityId);
      if (!offerId || !cityId || !request.expectedUpdatedAt) throw staleConflict('Availability exact key or timestamp is missing.');
      const result = await client().from(TABLES.availability).delete()
        .eq('offer_id', offerId)
        .eq('city_id', cityId)
        .eq('updated_at', request.expectedUpdatedAt)
        .select('*');
      const removed = rows(assertResult(result));
      if (removed.length === 0) throw staleConflict('Availability row changed or disappeared since Review.', { offerId, cityId });
      if (removed.length !== 1) throw internalError('Availability delete returned multiple rows.', { offerId, cityId, count: removed.length });
      return removed[0];
    }

    async function saveAvailabilityBatch(plan) {
      const offerId = normalizeId(plan?.exactOfferId);
      if (!offerId) throw staleConflict('Exact offer ID is required for the availability batch.');
      const result = assertResult(await client().rpc('admin_save_car_offer_city_availability_batch', {
        p_offer_id: offerId,
        p_expected_rows: core.clone(plan.expectedAvailabilityRows || []),
        p_desired_rows: core.clone(plan.desiredAvailabilityRows || []),
      }));
      if (!result || result.data === null || result.data === undefined) {
        throw internalError('Availability batch did not return a receipt.', { offerId });
      }
      return result.data;
    }

    async function insertDailyRateTier(request) {
      assertAllowedPayload(request.payload, core.DAILY_RATE_TIER_COLUMNS.slice(1), 'Daily-rate tier insert');
      const offerId = normalizeId(request.payload.offer_id);
      if (!offerId) throw staleConflict('Exact offer ID is required for a daily-rate tier.');
      const existing = await listRows(
        TABLES.dailyRateTiers,
        'id,offer_id,threshold_days,updated_at',
        (query) => query.eq('offer_id', offerId).eq('threshold_days', request.payload.threshold_days).limit(2),
      );
      if (existing.length) throw staleConflict('A tier with this exact threshold appeared since Review.', { offerId, thresholdDays: request.payload.threshold_days });
      const result = assertResult(await client().from(TABLES.dailyRateTiers).insert(request.payload).select('*').single());
      if (!result.data || normalizeId(result.data.offer_id) !== offerId) throw internalError('Daily-rate tier insert returned an unexpected row.');
      return result.data;
    }

    async function updateDailyRateTier(request) {
      const id = normalizeId(request.tierId);
      const offerId = normalizeId(request.offerId);
      if (!id || !offerId || !request.expectedUpdatedAt) throw staleConflict('Exact tier ID, offer ID and timestamp are required.');
      assertAllowedPayload(request.payload, core.DAILY_RATE_TIER_COLUMNS.slice(1), 'Daily-rate tier update');
      const payload = { ...request.payload };
      delete payload.offer_id;
      const result = await client().from(TABLES.dailyRateTiers).update(payload)
        .eq('id', id)
        .eq('offer_id', offerId)
        .eq('updated_at', request.expectedUpdatedAt)
        .select('*');
      const updated = rows(assertResult(result));
      if (updated.length === 0) throw staleConflict('Daily-rate tier changed since Review.', { tierId: id, offerId });
      if (updated.length !== 1) throw internalError('Daily-rate tier update returned multiple rows.', { tierId: id, count: updated.length });
      return updated[0];
    }

    async function deleteDailyRateTier(request) {
      const id = normalizeId(request.tierId);
      const offerId = normalizeId(request.offerId);
      if (!id || !offerId || !request.expectedUpdatedAt) throw staleConflict('Exact tier ID, offer ID and timestamp are required.');
      const result = await client().from(TABLES.dailyRateTiers).delete()
        .eq('id', id)
        .eq('offer_id', offerId)
        .eq('updated_at', request.expectedUpdatedAt)
        .select('*');
      const removed = rows(assertResult(result));
      if (removed.length === 0) throw staleConflict('Daily-rate tier changed or disappeared since Review.', { tierId: id, offerId });
      if (removed.length !== 1) throw internalError('Daily-rate tier delete returned multiple rows.', { tierId: id, count: removed.length });
      return removed[0];
    }

    async function insertOffer(payload) {
      assertAllowedPayload(payload, core.CREATE_COLUMNS, 'Vehicle create');
      if (payload.availability_mode !== 'legacy') throw internalError('New offers must remain in legacy mode.');
      const result = assertResult(await client().from(TABLES.offers).insert(payload).select('*').single());
      if (!result.data || !normalizeId(result.data.id)) {
        throw internalError('Vehicle create did not return exactly one exact ID.');
      }
      return result.data;
    }

    async function executeStep(step, execution = {}) {
      if (!step || step.status === 'success') return step?.result || null;
      if (step.type === 'car_offer' && step.action === 'insert') {
        return insertOffer(step.payload);
      }
      if (step.type === 'car_offer' && step.action === 'update') {
        if (execution.planKind === 'create' && step.entityId === '$created_offer_id') {
          const createdOfferId = normalizeId(execution.createdOfferId);
          const currentOffer = await getOfferById(createdOfferId);
          if (!currentOffer) {
            throw staleConflict('Created exact offer disappeared before threshold finalization.', { offerId: createdOfferId });
          }
          return exactOfferUpdate(
            createdOfferId,
            currentOffer.updated_at,
            step.payload,
            ['pricing_strategy', 'min_rental_days', 'max_rental_days', 'is_available'],
            'Created threshold offer finalization',
          );
        }
        let expectedUpdatedAt = step.expectedUpdatedAt;
        if (execution.planKind === 'pricing_profile' && execution.tierMutated) {
          const currentOffer = await getOfferById(step.entityId);
          const expected = execution.plan?.preflightSnapshot?.offerContract || {};
          if (!currentOffer) throw staleConflict('Exact offer disappeared after tier save.', { offerId: step.entityId });
          const mutableByTierTrigger = new Set(['min_rental_days', 'updated_at']);
          const changedOutsideTierSync = Object.keys(expected).some((field) => (
            !mutableByTierTrigger.has(field)
            && JSON.stringify(currentOffer[field] ?? null) !== JSON.stringify(expected[field] ?? null)
          ));
          if (changedOutsideTierSync) {
            throw staleConflict('Car offer changed while daily-rate tiers were being saved.', { offerId: step.entityId });
          }
          if (Number(currentOffer.min_rental_days) !== Number(execution.plan?.effectiveMinRentalDays)) {
            throw staleConflict('Server minimum does not match the lowest active tier.', { offerId: step.entityId });
          }
          expectedUpdatedAt = currentOffer.updated_at;
        }
        const request = {
          offerId: step.entityId,
          expectedUpdatedAt,
          payload: step.payload,
          reviewedPricingStrategy: execution.plan?.reviewedPricingStrategy,
          explicitStrategyConversion: execution.plan?.explicitStrategyConversion === true,
        };
        if (execution.planKind === 'vehicle') return updateVehicleDetails(request);
        if (execution.planKind === 'pricing_profile') return updatePricingProfile(request);
        if (execution.planKind === 'partner') return updatePartnerAssignment(request);
        if (execution.planKind === 'activation') return updateActivationState(request);
        throw internalError(`Unsupported car offer plan kind: ${execution.planKind}`);
      }
      if (step.type === 'car_offer_city_availability') {
        const createdOfferId = normalizeId(execution.createdOfferId);
        const payload = { ...step.payload };
        if (payload.offer_id === '$created_offer_id') payload.offer_id = createdOfferId;
        if (!payload.offer_id) throw internalError('Created offer ID is unavailable for availability insert.');
        if (step.action === 'insert') return insertAvailability({ payload });
        const cityId = normalizeId(payload.city_id || step.entityId?.split(':').pop());
        const offerId = normalizeId(payload.offer_id || step.entityId?.split(':')[0]);
        if (step.action === 'update') return updateAvailability({ offerId, cityId, expectedUpdatedAt: step.expectedUpdatedAt, payload });
        if (step.action === 'delete') return deleteAvailability({ offerId, cityId, expectedUpdatedAt: step.expectedUpdatedAt });
      }
      if (step.type === 'car_offer_city_availability_batch') {
        if (execution.planKind !== 'availability') throw internalError('Availability batch belongs to an unexpected plan.');
        return saveAvailabilityBatch(execution.plan);
      }
      if (step.type === 'car_offer_daily_rate_tier') {
        const payload = { ...(step.payload || {}) };
        if (payload.offer_id === '$created_offer_id') payload.offer_id = normalizeId(execution.createdOfferId);
        const offerId = normalizeId(payload.offer_id || execution.plan?.exactOfferId);
        if (step.action === 'insert') return insertDailyRateTier({ payload });
        if (step.action === 'update') return updateDailyRateTier({
          tierId: step.entityId,
          offerId,
          expectedUpdatedAt: step.expectedUpdatedAt,
          payload,
        });
        if (step.action === 'delete') return deleteDailyRateTier({
          tierId: step.entityId,
          offerId,
          expectedUpdatedAt: step.expectedUpdatedAt,
        });
      }
      throw internalError(`Unsupported save step: ${step.type}/${step.action}`);
    }

    async function executePlan(plan, options = {}) {
      if (!plan
        || plan.globalMappedFlagChanges !== 0
        || plan.globalThresholdFlagChanges !== 0
        || plan.bookingChanges !== 0
        || plan.priceCalculationChanges !== 0
        || plan.depositRuleChanges !== 0) {
        throw internalError('Unsafe or missing Stage 2C save plan.');
      }
      const working = core.clone(plan);
      if (working.kind === 'pricing_profile') {
        await validatePricingPlanBeforeMutation(working);
      }
      const pendingImageSteps = working.steps.filter((step) => step?.payload?.image_url === core.PENDING_IMAGE_URL);
      if (pendingImageSteps.length) {
        const uploadedImageUrl = normalizeId(options.uploadedImageUrl);
        if (!uploadedImageUrl) throw internalError('Reviewed image upload is missing before the exact-ID write.');
        pendingImageSteps.forEach((step) => {
          step.payload.image_url = uploadedImageUrl;
          (step.changes || []).forEach((change) => {
            if (change.field === 'image_url' && change.after === core.PENDING_IMAGE_URL) change.after = uploadedImageUrl;
          });
        });
        if (working.media) working.media.uploadedUrl = uploadedImageUrl;
      }
      working.status = 'running';
      let createdOfferId = null;
      const executionState = { planKind: working.kind, createdOfferId: null, tierMutated: false, plan: working };
      for (const step of working.steps) {
        const dependencyFailed = (step.dependsOn || []).some((key) => {
          const dependency = working.steps.find((candidate) => candidate.key === key);
          return dependency?.status !== 'success';
        });
        if (dependencyFailed) {
          step.status = 'skipped';
          step.error = { message: 'Dependency failed.' };
          options.onProgress?.(core.clone(working), core.clone(step));
          continue;
        }
        step.status = 'running';
        step.attempts += 1;
        options.onProgress?.(core.clone(working), core.clone(step));
        try {
          executionState.createdOfferId = createdOfferId;
          const result = await executeStep(step, executionState);
          step.status = 'success';
          step.result = core.clone(result);
          step.error = null;
          if (step.key === 'create_offer') {
            createdOfferId = normalizeId(result?.id);
            working.exactOfferId = createdOfferId;
          }
          if (step.type === 'car_offer_daily_rate_tier') executionState.tierMutated = true;
        } catch (error) {
          step.status = 'error';
          step.error = { code: error?.code || null, message: String(error?.message || error) };
        }
        options.onProgress?.(core.clone(working), core.clone(step));
      }
      const failures = working.steps.filter((step) => step.status === 'error' || step.status === 'skipped');
      working.status = failures.length ? (working.steps.some((step) => step.status === 'success') ? 'partial' : 'error') : 'success';
      working.completedAt = new Date().toISOString();
      return working;
    }

    async function createCity(draft) {
      const catalog = await getCatalog();
      assertCatalogContract(catalog);
      const validation = core.validateCityDraft(draft, catalog.cities);
      if (!validation.valid) {
        const error = new Error(validation.errors[0]?.message || 'Invalid city draft.');
        error.code = 'car_multicity_validation_failed';
        error.details = validation;
        throw error;
      }
      const payload = {
        code: core.normalizeCode(draft.code),
        name_i18n: core.clone(draft.name_i18n),
        place_types: core.clone(draft.place_types),
        sort_order: Number(draft.sort_order),
        is_active: false,
      };
      const result = assertResult(await client().from(TABLES.cities).insert(payload).select('*').single());
      if (!result.data || result.data.is_active !== false) throw internalError('City create must return one inactive city.');
      return result.data;
    }

    async function updateCity(draft) {
      const id = normalizeId(draft.id);
      if (!id || !draft.expectedUpdatedAt) throw staleConflict('Exact city ID and timestamp are required.');
      const catalog = await getCatalog();
      assertCatalogContract(catalog);
      const current = (catalog.cities || []).find((city) => normalizeId(city.id) === id);
      if (!current || String(current.updated_at || '') !== String(draft.expectedUpdatedAt)) {
        throw staleConflict('City changed since Review.', { cityId: id });
      }
      const validation = core.validateCityDraft(draft, catalog.cities);
      if (!validation.valid) {
        const error = new Error(validation.errors[0]?.message || 'Invalid city draft.');
        error.code = 'car_multicity_validation_failed';
        error.details = validation;
        throw error;
      }
      const payload = {
        code: core.normalizeCode(draft.code),
        name_i18n: core.clone(draft.name_i18n),
        place_types: core.clone(draft.place_types),
        sort_order: Number(draft.sort_order),
        is_active: draft.is_active === true,
      };
      const result = await client().from(TABLES.cities).update(payload).eq('id', id).eq('updated_at', draft.expectedUpdatedAt).select('*');
      const updated = rows(assertResult(result));
      if (updated.length === 0) throw staleConflict('City changed since Review.', { cityId: id });
      if (updated.length !== 1) throw internalError('City update returned multiple rows.', { cityId: id, count: updated.length });
      return updated[0];
    }

    async function listMappingImpact(pricingProfileId, cityId, proposedMapping = null) {
      const profileId = normalizeId(pricingProfileId);
      const exactCityId = normalizeId(cityId);
      const availability = await listRows(TABLES.availability, 'offer_id,city_id,pickup_enabled,return_enabled,is_active,fee_mode,fee_per_direction,fee_note,updated_at', (query) => query.eq('city_id', exactCityId));
      const offerIds = Array.from(new Set(availability.map((row) => normalizeId(row.offer_id)).filter(Boolean)));
      if (!offerIds.length) return { count: 0, offerIds: [], readyOfferIds: [], readyAfterOfferIds: [], readinessInvalidatedOfferIds: [] };
      const [offers, allAvailability, catalog] = await Promise.all([
        listRows(TABLES.offers, 'id,pricing_profile_id,location,availability_mode,is_available,is_published', (query) => query.in('id', offerIds)),
        listRows(TABLES.availability, 'offer_id,city_id,pickup_enabled,return_enabled,is_active,fee_mode,fee_per_direction,fee_note,updated_at', (query) => query.in('offer_id', offerIds)),
        getCatalog(),
      ]);
      const matching = offers.filter((offer) => normalizeId(offer.pricing_profile_id) === profileId);
      const currentMappings = catalog.profileCities || [];
      const nextMappings = proposedMapping ? [
        ...currentMappings.filter((row) => !(
          normalizeId(row.pricing_profile_id) === profileId
          && normalizeId(row.city_id) === exactCityId
        )),
        {
          pricing_profile_id: profileId,
          city_id: exactCityId,
          pickup_supported: proposedMapping.pickup_supported === true,
          return_supported: proposedMapping.return_supported === true,
          legacy_pricing_city_key: core.normalizeCode(proposedMapping.legacy_pricing_city_key),
          is_active: proposedMapping.is_active === true,
        },
      ] : currentMappings;
      const readyIds = (mappings) => matching.filter((offer) => core.getMappedReadiness({
        pricing: { profileId, location: core.normalizeCode(offer.location) },
        availability: allAvailability.filter((row) => normalizeId(row.offer_id) === normalizeId(offer.id)),
      }, { ...catalog, profileCities: mappings }).ready).map((offer) => normalizeId(offer.id)).sort();
      const readyOfferIds = readyIds(currentMappings);
      const readyAfterOfferIds = readyIds(nextMappings);
      const readyAfterSet = new Set(readyAfterOfferIds);
      return {
        count: matching.length,
        offerIds: matching.map((offer) => normalizeId(offer.id)).sort(),
        readyOfferIds,
        readyAfterOfferIds,
        readinessInvalidatedOfferIds: readyOfferIds.filter((offerId) => !readyAfterSet.has(offerId)),
      };
    }

    async function saveProfileCityMapping(draft) {
      const validationContext = await getCatalog();
      assertCatalogContract(validationContext);
      const validation = core.validateProfileCityDraft(draft, validationContext);
      if (!validation.valid) {
        const error = new Error(validation.errors[0]?.message || 'Invalid profile-city mapping.');
        error.code = 'car_multicity_validation_failed';
        error.details = validation;
        throw error;
      }
      const payload = {
        pricing_profile_id: normalizeId(draft.pricing_profile_id),
        city_id: normalizeId(draft.city_id),
        pickup_supported: draft.pickup_supported === true,
        return_supported: draft.return_supported === true,
        legacy_pricing_city_key: core.normalizeCode(draft.legacy_pricing_city_key),
        is_active: draft.is_active === true,
      };
      const existing = (validationContext.profileCities || []).find((row) => (
        normalizeId(row.pricing_profile_id) === payload.pricing_profile_id
        && normalizeId(row.city_id) === payload.city_id
      ));
      if (!existing) {
        const result = assertResult(await client().from(TABLES.profileCities).insert(payload).select('*').single());
        if (!result.data) throw internalError('Profile-city insert returned an unexpected result.');
        return result.data;
      }
      if (!draft.expectedUpdatedAt || String(existing.updated_at || '') !== String(draft.expectedUpdatedAt)) {
        throw staleConflict('Profile-city mapping changed since Review.', { profileId: payload.pricing_profile_id, cityId: payload.city_id });
      }
      const updatePayload = { ...payload };
      delete updatePayload.pricing_profile_id;
      delete updatePayload.city_id;
      const result = await client().from(TABLES.profileCities).update(updatePayload)
        .eq('pricing_profile_id', payload.pricing_profile_id)
        .eq('city_id', payload.city_id)
        .eq('updated_at', draft.expectedUpdatedAt)
        .select('*');
      const updated = rows(assertResult(result));
      if (updated.length === 0) throw staleConflict('Profile-city mapping changed since Review.');
      if (updated.length !== 1) throw internalError('Profile-city update returned multiple rows.');
      return updated[0];
    }

    return Object.freeze({
      TABLES,
      createCity,
      executePlan,
      getCarsDepositDefault,
      getCarsDepositOverride,
      getCatalog,
      getCreateContext,
      getFleetPresentationContext,
      getOfferById,
      getOfferContext,
      getSiteSetting,
      applyFleetBulkOperation,
      insertAvailability,
      insertDailyRateTier,
      insertOffer,
      buildVehicleImagePath,
      listAvailabilityByOfferId,
      listDailyRateTiersByOfferId,
      listCities,
      listMappingImpact,
      listPartnerResourcesByOfferId,
      listPartners,
      listProfileCities,
      listProfiles,
      listVehicleKinds,
      removeVehicleImage,
      saveAvailabilityBatch,
      saveProfileCityMapping,
      updateAvailability,
      updateActivationState,
      updateDailyRateTier,
      deleteDailyRateTier,
      updateCity,
      updatePartnerAssignment,
      updatePricingProfile,
      updateVehicleDetails,
      uploadVehicleImage,
    });
  }

  const api = Object.freeze({ TABLES, create, internalError, staleConflict });
  Object.defineProperty(root, 'CarRentalMulticityRepository', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(typeof window !== 'undefined' ? window : globalThis);
