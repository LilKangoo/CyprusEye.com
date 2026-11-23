import { test, expect } from '@playwright/test';

// Pure browser-contract tests. No live Supabase data, quotes or bookings are written.
// They DO NOT replace real DB JWT, inventory and concurrency acceptance.
const HOTEL = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const ROOM_A = '11111111-1111-4111-8111-111111111111';
const ROOM_B = '22222222-2222-4222-8222-222222222222';
const ORDER = '33333333-3333-4333-8333-333333333333';

async function mountMock(page: import('@playwright/test').Page, options: {
  lang?: string;
  available?: boolean;
  beginFails?: boolean;
  childAge?: number;
} = {}) {
  await page.setContent('<!doctype html><html><body><main id="mount"></main></body></html>');
  await page.addScriptTag({ path: 'js/hotels-v2-public-request-114497.js' });
  await page.evaluate(({ hotelId, roomA, roomB, order, params }) => {
    const win = window as typeof window & {
      __rpcCalls?: string[];
      HotelsV2PublicRequest114497?: any;
      __mountResult?: unknown;
    };
    win.__rpcCalls = [];
    const context = {
      contract_version: 'hotels_v2_public_request_context_114497_v1',
      hotel_id: hotelId, can_submit: true, minimum_stay_nights: 2,
      maximum_stay_nights: 365, currency: 'EUR',
      children_policy: 'minimum_age', minimum_child_age: 15,
      rooms: [
        { id: roomA, code:'ground-floor-apartment',
          name_i18n: { en:'Ground Floor Apartment',pl:'Apartament na parterze',he:'דירת קרקע' },
          max_occupancy:4 },
        { id: roomB, code:'upper-floor-apartment',
          name_i18n: { en:'Upper Floor Apartment',pl:'Apartament na piętrze',he:'דירה עליונה' },
          max_occupancy:4 }
      ],
      allocation_rules:[
        {min_guest_count:1,max_guest_count:4,allocation_mode:'customer_choice'},
        {min_guest_count:5,max_guest_count:8,allocation_mode:'required_bundle'}
      ],extras:[]
    };
    const quote = {
      hotel_id:hotelId,mode:'A',can_submit:true,available:params.available !== false,
      currency:'EUR',gross:200,due_now:0,allocation:[{room_type_id:roomA}]
    };
    const client = {
      rpc: async (name: string) => {
        win.__rpcCalls!.push(name);
        switch(name) {
          case 'hotel_v2_public_request_context_114497':
            return { data: context, error: null };
          case 'hotel_v2_public_get_request_options_114497':
            return { data: quote, error: null };
          case 'hotel_v2_public_create_request_quote_114497':
            return { data: { quote_id:order,lookup_token:'a'.repeat(64),quote:{
              mode:'A',currency:'EUR',due_now:0,gross:200
            } }, error:null };
          case 'hotel_v2_public_begin_request_114497':
            if (params.beginFails) return { data:null,error:{code:'PGRST_ERROR',message:'network timeout'} };
            return { data:{ order_id:order, mode:'A',status:'request_pending',
              payment_required:false }, error:null };
          case 'hotel_v2_public_booking_status_114494':
            return { data:{ order_id:order, mode:'A',status:'request_pending',
              payment_required:false }, error:null };
          default:
            return { data:null,error:{code:'PGRST202',message:'unsupported test RPC'} };
        }
      }
    };
    win.HotelsV2PublicRequest114497.mount({
      hotelId,target:document.querySelector('#mount'),client,lang:params.lang||'pl'
    }).then(result => { win.__mountResult=result; });
  }, { hotelId:HOTEL,roomA:ROOM_A,roomB:ROOM_B,order:ORDER,params:options });
  await expect(page.locator('[data-hotel-request-only-114497]')).toHaveCount(1);
}

async function enterDates(page: import('@playwright/test').Page) {
  await page.locator('[name="name"]').fill('Jan Kowalski');
  await page.locator('[name="email"]').fill('test@example.invalid');
  await page.locator('[name="arrival_date"]').fill('2027-04-10');
  await page.locator('[name="departure_date"]').fill('2027-04-12');
}

test('7 Kamares A-only quote, submit, reference and duplicate-submit protection', async ({ page }) => {
  await mountMock(page);
  await enterDates(page);
  await page.locator('[data-request-preview]').click();
  await expect(page.locator('[data-request-feedback]')).toContainText('200');
  await page.locator('[data-request-submit]').click();
  await expect(page.locator('[data-request-feedback]')).toContainText(ORDER);
  await expect(page.locator('[data-request-submit]')).toBeDisabled();
  const names = await page.evaluate(() => (window as any).__rpcCalls as string[]);
  expect(names.filter(name=>name==='hotel_v2_public_begin_request_114497')).toHaveLength(1);
});

test('unavailable stay blocks quote issuance and begin', async ({ page }) => {
  await mountMock(page,{available:false});
  await enterDates(page);
  await page.locator('[data-request-preview]').click();
  await expect(page.locator('[data-request-submit]')).toBeDisabled();
  const names = await page.evaluate(() => (window as any).__rpcCalls as string[]);
  expect(names).not.toContain('hotel_v2_public_create_request_quote_114497');
  expect(names).not.toContain('hotel_v2_public_begin_request_114497');
});

test('ambiguous request result uses read-only status and never replays begin', async ({ page }) => {
  await mountMock(page,{beginFails:true});
  await enterDates(page);
  await page.locator('[data-request-preview]').click();
  await page.locator('[data-request-submit]').click();
  await expect(page.locator('[data-request-feedback]')).toContainText(ORDER);
  const names = await page.evaluate(() => (window as any).__rpcCalls as string[]);
  expect(names.filter(name=>name==='hotel_v2_public_begin_request_114497')).toHaveLength(1);
  expect(names.filter(name=>name==='hotel_v2_public_booking_status_114494')).toHaveLength(1);
});

test('Hebrew view is RTL and child minimum age follows server policy', async ({ page }) => {
  await mountMock(page,{lang:'he'});
  await expect(page.locator('[data-hotel-request-only-114497]')).toHaveAttribute('dir','rtl');
  await expect(page.locator('[data-request-form]')).toContainText('15');
  await page.locator('[name="children"]').fill('1');
  await expect(page.locator('[data-request-child-age]')).toHaveAttribute('min','15');
  await page.locator('[data-request-child-age]').fill('14');
  await enterDates(page);
  await page.locator('[data-request-preview]').click();
  await expect(page.locator('[data-request-submit]')).toBeDisabled();
});
