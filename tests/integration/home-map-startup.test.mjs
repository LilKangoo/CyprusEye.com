import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = name => readFileSync(new URL(`../../js/${name}.js`, import.meta.url), 'utf8');
function setup(hasMap = true) {
  const requests = [], pending = new Map();
  const client = { from(table) {
    requests.push(table);
    let finish;
    const promise = new Promise(resolve => { finish = resolve; });
    pending.set(table, finish);
    const query = { select(){return query;}, eq(){return query;}, not(){return query;}, order(){return query;}, then: promise.then.bind(promise) };
    return query;
  }};
  const window = { sb:client, setTimeout, addEventListener(){}, dispatchEvent(){} };
  const context = vm.createContext({window, document:{getElementById:()=>hasMap ? {} : null,documentElement:{lang:'pl'}}, console:{log(){},warn(){}}, setTimeout, CustomEvent:class {} });
  vm.runInContext(source('map-recommendations'),context);
  vm.runInContext(source('map-hotels'),context);
  return {window,requests,pending};
}
test('both public catalogs start before map initialization, independently and only once', async () => {
  const {window,requests,pending} = setup();
  await Promise.resolve();
  assert.deepEqual(requests.sort(), ['hotels','recommendations']);
  const rec = window.initMapRecommendations({});
  const hotels = window.initMapHotels(null);
  pending.get('hotels')({data:[{id:'h',latitude:35,longitude:33}],error:null});
  await hotels;
  assert.equal(window.getMapHotelsData().length,1);
  // Hotel can finish while recommendations are still pending.
  assert.equal(window.getMapRecommendationsData().length,0);
  pending.get('recommendations')({data:[{id:'r'}],error:null});
  await rec;
  assert.equal(window.getMapRecommendationsData().length,1);
  await window.initMapRecommendations({});
  await window.initMapHotels(null);
  assert.equal(requests.length,2);
});
test('pages without a map do not prefetch map catalogs', async () => {
  const {requests} = setup(false);
  await Promise.resolve();
  assert.deepEqual(requests,[]);
});
test('catalog errors do not reject map initialization', async () => {
  const {window,pending} = setup();
  await Promise.resolve();
  pending.get('recommendations')({data:null,error:{message:'offline'}});
  pending.get('hotels')({data:null,error:{message:'offline'}});
  await Promise.all([window.initMapRecommendations({}),window.initMapHotels(null)]);
  assert.equal(window.getMapRecommendationsData().length,0);
  assert.equal(window.getMapHotelsData().length,0);
});
