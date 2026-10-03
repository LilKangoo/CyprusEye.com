// Presentation adapter. Original fields and booking events remain the source of truth.
const forms = [...document.querySelectorAll('#bookingForm, #hotelBookingForm, #bookForm')];
const enhanced = new WeakSet();
let nextId = 0;
const caption = input => input.closest('label')?.querySelector('span')?.textContent || input.form?.querySelector(`label[for="${input.id}"]`)?.textContent || input.closest('.form-field')?.querySelector('label')?.textContent || input.name;
const assignText = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const language = () => document.documentElement.lang.split('-')[0] || 'en';
const words = {
  pl: ['Szukaj', 'Brak wyników', 'Anuluj', 'Zastosuj datę', 'Wybierz datę', 'Wyczyść datę', 'Godzina', 'Minuty', 'Poprzedni miesiąc', 'Następny miesiąc', 'Wybierz poprawną datę.', 'Wybierz datę'],
  en: ['Search', 'No results', 'Cancel', 'Apply date', 'Choose date', 'Clear date', 'Hour', 'Minutes', 'Previous month', 'Next month', 'Choose a valid date.', 'Choose date'],
  he: ['חיפוש', 'אין תוצאות', 'ביטול', 'אישור התאריך', 'בחירת תאריך', 'ניקוי התאריך', 'שעה', 'דקות', 'החודש הקודם', 'החודש הבא', 'בחרו תאריך תקין.', 'בחירת תאריך'],
};
const t = i => (words[language()] || words.en)[i];
const locale = () => ({pl:'pl-PL',en:'en-GB',he:'he-IL'})[language()] || 'en-GB';
const make = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  if (tag === 'button') el.type = 'button';
  return el;
};
const localDate = value => new Date(`${value}T12:00:00`);
const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const change = input => input.dispatchEvent(new Event('change', {bubbles:true}));
const views = new Map();
let currentDialog;
function dialogFor(title, opener) {
  currentDialog?.close();
  const dialog = make('dialog','service-picker-dialog');
  dialog.dir = language() === 'he' ? 'rtl' : 'ltr';
  const header = make('header');
  const heading = make('h2','',title);
  heading.id = 'service-picker-title';
  dialog.setAttribute('aria-labelledby',heading.id);
  const close = make('button','service-picker-close','×');
  close.setAttribute('aria-label',t(2));
  close.onclick = () => dialog.close();
  header.append(heading,close);
  dialog.append(header);
  // Escape closes this picker, without closing the booking modal underneath it.
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') event.stopPropagation();
  });
  dialog.addEventListener('close',() => {
    dialog.remove();
    if (currentDialog === dialog) currentDialog = null;
    if (opener.isConnected) opener.focus();
  });
  document.body.append(dialog);
  currentDialog = dialog;
  return dialog;
}
function replacePresentation(input, display) {
  input.id ||= 'service-field-' + (++nextId);
  display.id = input.id + 'Picker';
  display.setAttribute('aria-haspopup','dialog');
  input.classList.add('service-native-control');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden','true');
  input.after(display);
  input.addEventListener('focus',() => display.focus());
  input.addEventListener('invalid',event => {
    event.preventDefault(); display.setAttribute('aria-invalid','true'); display.focus();
  });
  input.addEventListener('change',() => display.removeAttribute('aria-invalid'));
}
function enhanceSelect(select) {
  const trigger = make('button','service-picker-trigger');
  const update = () => {
    assignText(trigger, select.selectedOptions[0]?.textContent || '—');
    trigger.setAttribute('aria-label', `${caption(select)}: ${trigger.textContent}`);
    trigger.disabled = select.disabled;
  };
  replacePresentation(select,trigger);
  trigger.onclick = () => {
    const title = caption(select);
    const dialog = dialogFor(title,trigger);
    const search = make('input','service-picker-search');
    search.type = 'search'; search.placeholder = t(0); search.setAttribute('aria-label',t(0));
    const list = make('div','service-picker-options');
    const draw = () => {
      list.replaceChildren();
      for (const option of select.options) {
        if (option.hidden || !option.textContent.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())) continue;
        const item = make('button','',option.textContent);
        item.disabled = option.disabled;
        item.setAttribute('aria-pressed',String(option.selected));
        item.onclick = () => {
          select.value = option.value;
          change(select);
          update();
          dialog.close();
        };
        list.append(item);
      }
      if (!list.children.length) list.append(make('p','',t(1)));
    };
    search.oninput = draw;
    search.onkeydown = event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); list.querySelector('button:not(:disabled)')?.focus(); }
      if (event.key === 'Enter') { event.preventDefault(); list.querySelector('button:not(:disabled)')?.click(); }
    };
    dialog.append(search,list);
    const observer = new MutationObserver(draw);
    observer.observe(select,{childList:true,subtree:true,attributes:true});
    dialog.addEventListener('close',() => observer.disconnect(),{once:true});
    draw(); dialog.showModal(); search.focus();
  };
  new MutationObserver(update).observe(select,{childList:true,subtree:true,attributes:true});
  select.addEventListener('change',update);
  views.set(select, update); update();
}
function calendar(date,opener) {
  const dialog = dialogFor(caption(date),opener);
  const minimum = () => date.min || '';
  let selected = date.value || minimum() || key(new Date());
  let month = localDate(selected);
  const nav = make('div','service-calendar-nav');
  const previous = make('button','',language()==='he'?'›':'‹');
  const next = make('button','',language()==='he'?'‹':'›');
  previous.setAttribute('aria-label',t(8)); next.setAttribute('aria-label',t(9));
  const heading = make('strong'); nav.append(previous,heading,next);
  const week = make('div','service-calendar-week');
  for(let i=0;i<7;i++) week.append(make('span','',new Intl.DateTimeFormat(locale(),{weekday:'short'}).format(new Date(2026,0,5+i))));
  const days = make('div','service-calendar-days');
  const error = make('p','service-picker-error'); error.setAttribute('role','alert');
  const footer = make('footer');
  const cancel = make('button','',t(2)), apply = make('button','service-picker-apply',t(3));
  footer.append(cancel,apply);
  const valid = () => selected >= minimum() && (!date.max || selected <= date.max) && Boolean(selected);
  const validate = () => { const ok=valid(); apply.disabled=!ok; error.textContent=ok?'':t(10); };
  const draw = () => {
    heading.textContent = new Intl.DateTimeFormat(locale(),{month:'long',year:'numeric'}).format(month);
    days.replaceChildren();
    const first = new Date(month.getFullYear(),month.getMonth(),1);
    for(let i=0;i<(first.getDay()+6)%7;i++) days.append(make('span'));
    const count = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let day=1;day<=count;day++) {
      const value = key(new Date(month.getFullYear(),month.getMonth(),day));
      const button = make('button','',day);
      button.disabled = value < minimum() || Boolean(date.max && value > date.max);
      button.setAttribute('aria-label',new Intl.DateTimeFormat(locale(),{dateStyle:'full'}).format(localDate(value)));
      button.setAttribute('aria-pressed',String(value===selected));
      if(value===key(new Date())) button.classList.add('is-today');
      button.onclick = () => { selected=value; draw(); }; days.append(button);
    }
    previous.disabled = Boolean(minimum() && key(first).slice(0,7)<=minimum().slice(0,7));
    next.disabled = Boolean(date.max && key(first).slice(0,7)>=date.max.slice(0,7));
    validate();
  };
  previous.onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);draw();};
  next.onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);draw();};
  cancel.onclick=()=>dialog.close();
  apply.onclick=()=>{
    if(!valid()) return validate();
    date.value=selected;
    date.dispatchEvent(new Event('input', {bubbles:true}));
    change(date); refresh(); dialog.close();
  };
  if (!date.required) {
    const clear=make('button','',t(5));
    clear.onclick=()=>{date.value='';change(date);refresh();dialog.close();};
    footer.prepend(clear);
  }
  dialog.append(nav,week,days,error,footer); draw(); dialog.showModal();
}
function enhanceDate(date) {
  const trigger=make('button','service-picker-trigger');
  replacePresentation(date,trigger);
  const update=()=>{
    assignText(trigger,date.value ? new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short',year:'numeric'}).format(localDate(date.value)) : t(11));
    trigger.setAttribute('aria-label',caption(date)+': '+trigger.textContent);
    trigger.disabled=date.disabled || date.readOnly;
  };
  trigger.onclick=()=>calendar(date,trigger);
  date.addEventListener('change',update);
  new MutationObserver(update).observe(date,{attributes:true});
  views.set(date,update); update();
}
function refresh() {
  for (const form of forms) localizeCoupon(form);
  for (const [input, update] of views) {
    if(input.isConnected) update(); else views.delete(input);
  }
}
function localizeCoupon(form) {
  const lang = language();
  const pack = window.appI18n?.translations?.[lang];
  if (!pack) return;
  const hotel = form.id !== 'bookingForm';
  const prefix = hotel ? 'hotels' : 'trips';
  const bindings = [
    ['label[for="bookingCouponCode"],label[for="hotelBookingCouponCode"],#hotelCouponLabel','label'],
    ['#bookingApplyCoupon,#hotelBookingApplyCoupon,#applyCouponBtn','apply'],
    ['#bookingClearCoupon,#hotelBookingClearCoupon,#clearCouponBtn','clear'],
    ['#bookingCouponCode,#hotelBookingCouponCode,#couponCode','placeholder'],
  ];
  for (const [selector, suffix] of bindings) {
    const text = pack[`${prefix}.booking.coupon.${suffix}`];
    if (typeof text !== 'string') continue;
    for (const node of form.querySelectorAll(selector)) {
      if (node.dataset.serviceLocale === lang) continue;
      node.dataset.serviceLocale = lang;
      if (suffix === 'placeholder') node.placeholder = text;
      else assignText(node, text);
    }
  }
}
function enhance(form) {
  for(const input of form.querySelectorAll('input[type=date],select')) {
    if(enhanced.has(input)) continue;
    enhanced.add(input);
    if(input.tagName==='SELECT') enhanceSelect(input); else enhanceDate(input);
  }
  refresh();
}
for(const form of forms) {
  form.classList.add('service-booking-form');
  enhance(form);
  new MutationObserver(()=>enhance(form)).observe(form,{childList:true,subtree:true});
  form.addEventListener('change',()=>queueMicrotask(refresh));
  form.addEventListener('reset',()=>setTimeout(refresh,0));
  form.addEventListener('focusin',refresh);
}
document.addEventListener('wakacjecypr:languagechange',()=>{currentDialog?.close();queueMicrotask(refresh);});
new MutationObserver(refresh).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
