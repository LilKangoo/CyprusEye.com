(function attachHotelsV2PublicRequest114497(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HotelsV2PublicRequest114497 = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2PublicRequest114497(root) {
  'use strict';

  const PILOT = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  const RPC = Object.freeze({
    context: 'hotel_v2_public_request_context_114497',
    options: 'hotel_v2_public_get_request_options_114497',
    quote: 'hotel_v2_public_create_request_quote_114497',
    begin: 'hotel_v2_public_begin_request_114497',
    status: 'hotel_v2_public_booking_status_114494',
  });
  const COPY = Object.freeze({
    en: {
      heading: 'Request a stay', notice: 'No payment now. The Hotel Partner must confirm your dates.',
      name: 'Full name', email: 'Email', arrival: 'Check-in', departure: 'Check-out',
      adults: 'Adults', children: 'Children', age: 'Child age',
      room: 'Apartment', bundle: 'Both apartments (group booking)',
      price: 'Estimated total', preview: 'Check availability and price',
      submit: 'Send request to the Hotel Partner', pending: 'Your request was received and awaits Partner confirmation.',
      confirmed: 'Your request is confirmed.', unavailable: 'These dates are not currently available.',
      needPreview: 'Check the price and dates first.', quoteChanged: 'Price or availability changed. Review your dates.',
      disabled: 'Request booking is currently unavailable.', network: 'The submission result is uncertain. Do not retry automatically.',
      reference: 'Request reference', extras: 'Optional extras', error: 'Unable to complete the request.',
      guestError: 'Choose a valid guest count and provide each child’s age.',
    },
    pl: {
      heading: 'Zapytanie o pobyt', notice: 'Teraz nie płacisz. Partner hotelu musi potwierdzić wybrane terminy.',
      name: 'Imię i nazwisko', email: 'Email', arrival: 'Przyjazd', departure: 'Wyjazd',
      adults: 'Dorośli', children: 'Dzieci', age: 'Wiek dziecka',
      room: 'Apartament', bundle: 'Oba apartamenty (rezerwacja grupowa)',
      price: 'Szacunkowa suma', preview: 'Sprawdź dostępność i cenę',
      submit: 'Wyślij zapytanie do Partnera', pending: 'Zapytanie zostało przyjęte i oczekuje na potwierdzenie Partnera.',
      confirmed: 'Twoje zapytanie zostało potwierdzone.', unavailable: 'Te terminy nie są obecnie dostępne.',
      needPreview: 'Najpierw sprawdź cenę i daty.', quoteChanged: 'Zmieniła się cena lub dostępność. Sprawdź daty ponownie.',
      disabled: 'Wysyłanie zapytań jest obecnie niedostępne.', network: 'Nie znamy wyniku wysłania. Nie ponawiaj automatycznie.',
      reference: 'Numer zapytania', extras: 'Dodatkowe opcje', error: 'Nie udało się wysłać zapytania.',
      guestError: 'Podaj poprawną liczbę gości i wiek każdego dziecka.',
    },
    he: {
      heading: 'בקשה להזמנת שהייה', notice: 'אין תשלום בשלב הזה. שותף המלון חייב לאשר את התאריכים.',
      name: 'שם מלא', email: 'דוא״ל', arrival: 'צ׳ק-אין', departure: 'צ׳ק-אאוט',
      adults: 'מבוגרים', children: 'ילדים', age: 'גיל הילד',
      room: 'דירה', bundle: 'שתי הדירות (הזמנה לקבוצה)',
      price: 'מחיר משוער', preview: 'בדיקת זמינות ומחיר',
      submit: 'שליחת בקשה לשותף המלון', pending: 'הבקשה התקבלה וממתינה לאישור השותף.',
      confirmed: 'הבקשה אושרה.', unavailable: 'התאריכים אינם זמינים כעת.',
      needPreview: 'בדקו תחילה את התאריכים והמחיר.', quoteChanged: 'המחיר או הזמינות השתנו. בדקו שוב.',
      disabled: 'שליחת בקשות אינה זמינה כעת.', network: 'תוצאת השליחה אינה ידועה. אין לשלוח שוב באופן אוטומטי.',
      reference: 'מספר בקשה', extras: 'תוספות', error: 'לא ניתן לשלוח את הבקשה.',
      guestError: 'הזינו מספר אורחים תקין וגיל לכל ילד.',
    }
  });

  function language(value) {
    const key = String(value || 'en').slice(0,2).toLowerCase();
    return COPY[key] ? key : 'en';
  }
  function exactUUID(value) {
    return typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
  }
  function safeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }
  function exactDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed=new Date(value+'T12:00:00Z');
    return !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0,10) === value;
  }
  async function call(client, name, args) {
    if (!client || typeof client.rpc !== 'function') throw new Error('No database client');
    const { data, error } = await client.rpc(name,args);
    if (error) {
      const e = new Error('Booking service rejected the request.');
      e.code = String(error.code || '');
      e.isNetworkAmbiguous = /fetch|network|timeout|gateway|abort/i.test(
        String(error.message || '')
      );
      throw e;
    }
    return Array.isArray(data) && data.length===1 ? data[0] : data;
  }
  function validateContext(data) {
    if (!data || data.contract_version!=='hotels_v2_public_request_context_114497_v1'
      || data.hotel_id!==PILOT || !Array.isArray(data.rooms)
      || !Array.isArray(data.allocation_rules) || !Array.isArray(data.extras)
      || typeof data.can_submit !== 'boolean'
      || !Number.isInteger(data.minimum_stay_nights)
      || data.minimum_stay_nights<1 || data.minimum_stay_nights>365
      || data.maximum_stay_nights!==365 || data.currency!=='EUR'
      || data.rooms.length!==2) throw new Error('Invalid request context');
    return data;
  }
  function prepareRequest(form, context) {
    const data = new FormData(form);
    const adults = Number(data.get('adults'));
    const children = Number(data.get('children'));
    if (!Number.isInteger(adults) || adults<1 || adults>8 ||
        !Number.isInteger(children) || children<0 || children>7 ||
        adults+children>8) throw new Error('INVALID_GUESTS');
    const ages = Array.from(form.querySelectorAll('[data-request-child-age]'),
      node=>String(node.value).trim()!=='' ? Number(node.value) : NaN);
    if (ages.length!==children || ages.some(a=>!Number.isInteger(a)||a<0||a>17)) {
      throw new Error('INVALID_GUESTS');
    }
    const total = adults+children;
    const rule = context.allocation_rules.find(r=>r.min_guest_count<=total
      && r.max_guest_count>=total);
    if (!rule) throw new Error('INVALID_ALLOCATION');
    const room = rule.allocation_mode==='customer_choice'
      ? String(data.get('room_type_id') || '') : null;
    if (room && !context.rooms.some(r=>r.id===room && r.max_occupancy>=total)) {
      throw new Error('INVALID_ROOM');
    }
    if (rule.allocation_mode==='customer_choice' && !exactUUID(room)) {
      throw new Error('INVALID_ROOM');
    }
    const arrival=String(data.get('arrival_date')||'');
    const departure=String(data.get('departure_date')||'');
    const nights=(Date.parse(departure+'T12:00:00Z')-Date.parse(arrival+'T12:00:00Z'))/86400000;
    if (!exactDate(arrival)||!exactDate(departure)||!Number.isInteger(nights)||nights<context.minimum_stay_nights||nights>context.maximum_stay_nights) {
      throw new Error('INVALID_DATES');
    }
    const selectedExtras=Array.from(form.querySelectorAll('[data-request-extra]:checked'),
      input=>input.value);
    if (selectedExtras.some(id=>!context.extras.some(extra=>extra.id===id))) {
      throw new Error('INVALID_EXTRAS');
    }
    return {
      hotel_id:PILOT,arrival_date:arrival,departure_date:departure,
      adults,child_ages:ages,room_type_id:room,selected_extra_ids:selectedExtras
    };
  }

  async function mount({ hotelId, target, client, lang='en' }={}) {
    if (hotelId !== PILOT || !target || !client) return null;
    let context;
    try {
      context=validateContext(await call(client,RPC.context,{}));
    } catch (_error) {
      // Missing migration, unsafe catalog or inaccessible RPC = no form.
      return null;
    }
    if (!context.can_submit) return null;
    const locale=language(lang);
    const copy=COPY[locale];
    const section=document.createElement('section');
    section.className='offer-card offer-section hotels-v2-request-only';
    section.setAttribute('data-hotel-request-only-114497','');
    section.dir=locale==='he'?'rtl':'ltr';
    section.innerHTML=`
      <h2>${safeHtml(copy.heading)}</h2><p>${safeHtml(copy.notice)}</p>
      <form data-request-form>
        <div class="offer-form">
          <label>${safeHtml(copy.name)}<input name="name" required maxlength="160" autocomplete="name"></label>
          <label>${safeHtml(copy.email)}<input name="email" type="email" required maxlength="254" autocomplete="email"></label>
          <label>${safeHtml(copy.arrival)}<input name="arrival_date" type="date" required></label>
          <label>${safeHtml(copy.departure)}<input name="departure_date" type="date" required></label>
          <label>${safeHtml(copy.adults)}<input name="adults" type="number" min="1" max="8" value="2" required></label>
          <label>${safeHtml(copy.children)}<input name="children" type="number" min="0" max="7" value="0" required></label>
          <div data-children-ages></div>
          <label data-request-room-wrap>${safeHtml(copy.room)}
            <select name="room_type_id">${context.rooms.map(room=>`<option value="${safeHtml(room.id)}">${safeHtml(room.name_i18n?.[locale]||room.name_i18n?.en||room.code)}</option>`).join('')}</select>
          </label>
          <div data-request-extras>${context.extras.filter(x=>x.is_mandatory!==true)
            .map(x=>`<label><input type="checkbox" data-request-extra value="${safeHtml(x.id)}"> ${safeHtml(x.name_i18n?.[locale]||x.name_i18n?.en||x.code||x.id)}</label>`).join('')}</div>
          <div role="status" aria-live="polite" data-request-feedback></div>
          <button type="button" class="btn-primary" data-request-preview>${safeHtml(copy.preview)}</button>
          <button type="submit" class="btn-primary" data-request-submit disabled>${safeHtml(copy.submit)}</button>
        </div>
      </form>
    `;
    target.appendChild(section);
    const form=section.querySelector('[data-request-form]');
    const feedback=section.querySelector('[data-request-feedback]');
    const previewButton=section.querySelector('[data-request-preview]');
    const submitButton=section.querySelector('[data-request-submit]');
    const agesWrap=section.querySelector('[data-children-ages]');
    const roomWrap=section.querySelector('[data-request-room-wrap]');
    let verified=null;
    let verifiedPrice=null;
    let submitting=false;
    let finalized=false;
    function message(text) { feedback.textContent=String(text); }
    function invalidate(){if(finalized)return;verified=null;verifiedPrice=null;submitButton.disabled=true;message('');}
    function refresh() {
      invalidate();
      const children=Math.min(7,Math.max(0,Number(form.elements.children.value)||0));
      agesWrap.replaceChildren();
      for(let i=0;i<children;i++) {
        const label=document.createElement('label');
        label.textContent=copy.age+' '+(i+1);
        const age=document.createElement('input');
        age.type='number';age.min='0';age.max='17';age.required=true;
        age.setAttribute('data-request-child-age','');
        age.addEventListener('input',invalidate);
        label.appendChild(age);agesWrap.appendChild(label);
      }
      const guests=(Number(form.elements.adults.value)||0)+children;
      const rule=context.allocation_rules.find(r=>r.min_guest_count<=guests&&r.max_guest_count>=guests);
      roomWrap.hidden=rule?.allocation_mode!=='customer_choice';
      form.elements.room_type_id.required=!roomWrap.hidden;
      if (roomWrap.hidden) message(copy.bundle);
    }
    form.addEventListener('input',e=>{
      if (e.target.name==='children' || e.target.name==='adults') refresh();
      else invalidate();
    });
    previewButton.addEventListener('click',async()=>{
      if(submitting||finalized)return;
      previewButton.disabled=true;invalidate();
      try {
        const request=prepareRequest(form,context);
        const options=await call(client,RPC.options,{p_request:request});
        if (options?.hotel_id!==PILOT||options?.mode!=='A'
          ||options?.can_submit!==true||options?.available!==true
          ||options?.currency!==context.currency
          ||Number(options.due_now)!==0
          ||!Number.isFinite(Number(options.gross))
          ||!Array.isArray(options.allocation)
          ||options.allocation.length!==(request.room_type_id?1:2)) {
          message(copy.unavailable);return;
        }
        verified=JSON.stringify(request);
        verifiedPrice=Number(options.gross);
        const total=verifiedPrice;
        message(copy.price+': '+(Number.isFinite(total)
          ? new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(total)
          : '—')+' · '+copy.notice);
        submitButton.disabled=false;
      } catch(error){message(error?.message==='INVALID_GUESTS'?copy.guestError:copy.error);}
      finally{previewButton.disabled=finalized;}
    });
    form.addEventListener('submit',async(event)=>{
      event.preventDefault();
      if(submitting||finalized||!verified)return;
      let request;
      try{request=prepareRequest(form,context);}
      catch(_){invalidate();message(copy.guestError);return;}
      if(JSON.stringify(request)!==verified){invalidate();message(copy.needPreview);return;}
      submitting=true;submitButton.disabled=true;previewButton.disabled=true;
      let issued=null;
      let beginAttempted=false;
      try{
        issued=await call(client,RPC.quote,{p_request:request});
        if(!exactUUID(issued?.quote_id)||typeof issued.lookup_token!=='string'
          ||issued.quote?.mode!=='A'
          ||issued.quote?.currency!==context.currency
          ||Number(issued.quote?.due_now)!==0
          ||Number(issued.quote?.gross)!==verifiedPrice) throw new Error('INVALID_ISSUED_QUOTE');
        const customer={
          name:String(form.elements.name.value||'').trim(),
          email:String(form.elements.email.value||'').trim(),
          lang:locale
        };
        beginAttempted=true;
        const status=await call(client,RPC.begin,{
          p_quote_id:issued.quote_id,
          p_lookup_token:issued.lookup_token,
          p_customer:customer
        });
        if(status?.mode!=='A'||!['request_pending','confirmed'].includes(status.status)
          ||status.payment_required!==false||!exactUUID(status.order_id))
          throw new Error('INVALID_RECEIPT');
        finalized=true;
        message((status.status==='confirmed'?copy.confirmed:copy.pending)+' '+copy.reference+': '+status.order_id);
      }catch(error){
        if (beginAttempted && issued?.quote_id) {
          // Read-only lookup is safe; never retry the booking write automatically.
          finalized=true;
          let resolved=null;
          try {
            const status=await call(client,RPC.status,{
              p_order_id:issued.quote_id,
              p_lookup_token:issued.lookup_token
            });
            if(status?.order_id===issued.quote_id && status?.mode==='A'
              && status.payment_required===false
              && ['request_pending','confirmed'].includes(status.status)) resolved=status;
          } catch (_) { /* Preserve an uncertain result without replay. */ }
          message(resolved
            ? (resolved.status==='confirmed'?copy.confirmed:copy.pending)+' '+copy.reference+': '+resolved.order_id
            : copy.network+' '+copy.reference+': '+issued.quote_id);
        } else {
          // No begin mutation was attempted, so a fresh Preview is safe.
          message(error?.isNetworkAmbiguous?copy.network:copy.quoteChanged);
        }
      }finally{
        submitting=false;
        verified=null;verifiedPrice=null;
        previewButton.disabled=finalized;
        if(finalized) form.querySelectorAll('input,select').forEach(input=>{input.disabled=true;});
      }
    });
    refresh();
    return section;
  }

  return Object.freeze({PILOT,RPC,COPY,language,exactUUID,exactDate,
    prepareRequest,validateContext,mount});
});
