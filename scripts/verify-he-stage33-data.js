#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../js/config.js';

const TRIP_IDS = [
  '47fd4793-647b-45fd-a2ce-1ecaa4b95922',
  '2d937b4f-3da7-4fed-bc06-bdc66eb25612',
  'b0a24297-89f9-4f60-a1d6-b59d84bee877',
];

const CAR_IDS = [
  '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca',
  '5ba581c3-08c6-47cd-ab29-4d2b9213cebc',
  '64981eb1-e9a3-41a4-bd93-1fd4c78581d7',
  '8a1158af-6b05-4723-b2eb-93b130d22f24',
  'b4f784d3-22d2-421a-829f-2394e3a72a76',
];

const POI_IDS = [
  'larnaca-beach',
  'limassol-marina',
  'nicosia-old-town',
  'Love-Bridge',
  'konnos-bay-beach',
  'cape-greco-sea-caves',
  'Cyclops-Cave',
  'saint-lazarus-church',
  'famagusta-old-town',
  'larnaca-castle',
];

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasHeText(value) {
  return Boolean(value && typeof value === 'object' && hasText(value.he));
}

function hasHeArray(value) {
  return Boolean(
    value
      && typeof value === 'object'
      && Array.isArray(value.he)
      && value.he.some(hasText),
  );
}

function pickTextLabel(...values) {
  for (const value of values) {
    if (hasText(value)) return value.trim();
    if (value && typeof value === 'object') {
      for (const key of ['he', 'en', 'pl', 'el']) {
        if (hasText(value[key])) return value[key].trim();
      }
      const first = Object.values(value).find(hasText);
      if (first) return first.trim();
    }
  }
  return '';
}

async function fetchByIds(table, select, ids) {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .in('id', ids);

  if (error) {
    throw new Error(`${table}: ${error.message || String(error)}`);
  }

  return Array.isArray(data) ? data : [];
}

function summarizeRows({ name, ids, rows, isReady, describe }) {
  const readyRows = rows.filter(isReady);
  const foundIds = new Set(rows.map((row) => String(row.id)));
  const missingIds = ids.filter((id) => !foundIds.has(id));
  const notReadyRows = rows.filter((row) => !isReady(row));

  console.log(`\n${name}`);
  console.log(`selected=${ids.length} found=${rows.length} ready=${readyRows.length}`);
  for (const row of rows) {
    console.log(`- ${describe(row)} => ${isReady(row) ? 'he_ready' : 'missing_he'}`);
  }

  if (missingIds.length > 0) {
    console.error(`missing ids: ${missingIds.join(', ')}`);
  }
  if (notReadyRows.length > 0) {
    console.error(`not ready ids: ${notReadyRows.map((row) => row.id).join(', ')}`);
  }

  return {
    selected: ids.length,
    found: rows.length,
    ready: readyRows.length,
    ok: missingIds.length === 0 && notReadyRows.length === 0 && readyRows.length === ids.length,
  };
}

const trips = await fetchByIds('trips', 'id, slug, title, description', TRIP_IDS);
const cars = await fetchByIds(
  'car_offers',
  'id, car_model, car_type, car_model_new, car_type_new, features',
  CAR_IDS,
);
const pois = await fetchByIds('pois', 'id, name_i18n, description_i18n, badge_i18n', POI_IDS);

const summaries = [
  summarizeRows({
    name: 'stage33_trips_top3',
    ids: TRIP_IDS,
    rows: trips,
    isReady: (row) => hasHeText(row.title) && hasHeText(row.description),
    describe: (row) => `${row.id} ${row.slug || ''} title=${row.title?.he || ''}`,
  }),
  summarizeRows({
    name: 'stage33_cars_top5',
    ids: CAR_IDS,
    rows: cars,
    isReady: (row) => hasHeArray(row.features),
    describe: (row) => {
      const label = pickTextLabel(row.car_model, row.car_type, row.car_model_new, row.car_type_new, row.id);
      const featureCount = Array.isArray(row.features?.he) ? row.features.he.length : 0;
      return `${row.id} ${label} features_he=${featureCount}`;
    },
  }),
  summarizeRows({
    name: 'stage33_poi_top10',
    ids: POI_IDS,
    rows: pois,
    isReady: (row) => (
      hasHeText(row.name_i18n)
      && hasHeText(row.description_i18n)
      && hasHeText(row.badge_i18n)
    ),
    describe: (row) => `${row.id} name=${row.name_i18n?.he || ''}`,
  }),
];

const passed = summaries.every((summary) => summary.ok);
console.log(`\nStage33 data verify ${passed ? 'passed' : 'failed'}.`);

if (!passed) {
  process.exitCode = 1;
}
