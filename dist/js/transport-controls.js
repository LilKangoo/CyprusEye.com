// Presentation adapter. Original fields and booking events remain the source of truth.
const form = document.getElementById('transportBookingForm');
const language = () => document.documentElement.lang.split('-')[0] || 'en';
const words = {
  pl: ['Szukaj', 'Brak wyników', 'Anuluj', 'Zastosuj termin', 'Data i godzina przejazdu', 'Data i godzina powrotu', 'Godzina', 'Minuty', 'Poprzedni miesiąc', 'Następny miesiąc', 'Wybierz poprawną datę i godzinę.', 'Wybierz termin'],
  en: ['Search', 'No results', 'Cancel', 'Apply date and time', 'Outbound date and time', 'Return date and time', 'Hour', 'Minutes', 'Previous month', 'Next month', 'Choose a valid date and time.', 'Choose date and time'],
  he: ['חיפוש', 'אין תוצאות', 'ביטול', 'אישור המועד', 'תאריך ושעת הנסיעה', 'תאריך ושעת החזרה', 'שעה', 'דקות', 'החודש הקודם', 'החודש הבא', 'בחרו תאריך ושעה תקינים.', 'בחירת תאריך ושעה'],
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
const views = [];
let currentDialog;
function dialogFor(title, opener) {
  currentDialog?.close();
  const dialog = make('dialog','transport-picker-dialog');
  dialog.dir = language() === 'he' ? 'rtl' : 'ltr';
  const header = make('header');
  const heading = make('h2','',title);
  heading.id = 'transport-picker-title';
  dialog.setAttribute('aria-labelledby',heading.id);
  const close = make('button','transport-picker-close','×');
  close.setAttribute('aria-label',t(2));
  close.onclick = () => dialog.close();
  header.append(heading,close);
  dialog.append(header);
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
  const label = form.querySelector(`label[for="${input.id}"]`);
  display.id = `${input.id}Picker`;
  if (label) {
    label.id ||= `${input.id}Label`;
    label.htmlFor = display.id;
    display.setAttribute('aria-labelledby',`${label.id} ${display.id}`);
  }
  display.setAttribute('aria-haspopup','dialog');
  input.classList.add('transport-native-control');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden','true');
  input.after(display);
  input.addEventListener('focus',() => display.focus());
  input.addEventListener('invalid',event => {
    event.preventDefault();
    display.setAttribute('aria-invalid','true');
    display.focus();
  });
  input.addEventListener('change',() => display.removeAttribute('aria-invalid'));
}
function enhanceSelect(select) {
  const trigger = make('button','transport-picker-trigger');
  const update = () => {
    trigger.textContent = select.selectedOptions[0]?.textContent || '—';
    trigger.disabled = select.disabled;
  };
  replacePresentation(select,trigger);
  trigger.onclick = () => {
    const title = form.querySelector(`#${select.id}Label`)?.textContent || '';
    const dialog = dialogFor(title,trigger);
    const search = make('input','transport-picker-search');
    search.type = 'search'; search.placeholder = t(0); search.setAttribute('aria-label',t(0));
    const list = make('div','transport-picker-options');
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
  views.push(update); update();
}
function calendar(date,time,returnLeg,opener) {
  const dialog = dialogFor(t(returnLeg ? 5 : 4),opener);
  const minimum = () => [date.min, returnLeg ? form.querySelector('#transportTravelDate').value : ''].filter(Boolean).sort().at(-1) || '';
  let selected = date.value || minimum() || key(new Date());
  let month = localDate(selected);
  const nav = make('div','transport-calendar-nav');
  const previous = make('button','',language()==='he'?'›':'‹');
  const next = make('button','',language()==='he'?'‹':'›');
  previous.setAttribute('aria-label',t(8)); next.setAttribute('aria-label',t(9));
  const heading = make('strong'); nav.append(previous,heading,next);
  const week = make('div','transport-calendar-week');
  for(let i=0;i<7;i++) week.append(make('span','',new Intl.DateTimeFormat(locale(),{weekday:'short'}).format(new Date(2026,0,5+i))));
  const days = make('div','transport-calendar-days');
  const times = make('div','transport-picker-times');
  const parts = (time.value || '12:00').split(':');
  const timeField = (index,max,value) => {
    const label = make('label','',t(index));
    const input = make('input'); input.type='number'; input.min='0'; input.max=String(max); input.step='1'; input.value=String(Number(value)); input.required=true;
    input.setAttribute('aria-label',t(index)); label.append(input); times.append(label); return input;
  };
  const hours = timeField(6,23,parts[0]), minutes = timeField(7,59,parts[1]);
  const error = make('p','transport-picker-error'); error.setAttribute('role','alert');
  const footer = make('footer');
  const cancel = make('button','',t(2)), apply = make('button','transport-picker-apply',t(3));
  footer.append(cancel,apply);
  const valid = () => selected >= minimum() && (!date.max || selected <= date.max) && hours.checkValidity() && minutes.checkValidity();
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
  hours.oninput=minutes.oninput=validate;
  cancel.onclick=()=>dialog.close();
  apply.onclick=()=>{
    if(!valid()) return validate();
    // Commit both values before notifying existing pricing and wizard handlers.
    date.value=selected; time.value=`${String(Number(hours.value)).padStart(2,'0')}:${String(Number(minutes.value)).padStart(2,'0')}`;
    change(date); change(time); refresh(); dialog.close();
  };
  dialog.append(nav,week,days,times,error,footer); draw(); dialog.showModal();
}
function enhanceDatePair(dateId,timeId,returnLeg) {
  const date=document.getElementById(dateId), time=document.getElementById(timeId);
  if(!date||!time) return;
  for(const input of [date,time]) {
    const trigger=make('button','transport-picker-trigger transport-date-trigger');
    replacePresentation(input,trigger);
    const update=()=>{
      trigger.textContent=input===date ? (date.value ? new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short',year:'numeric'}).format(localDate(date.value)) : t(11)) : time.value || t(11);
      trigger.disabled=input.disabled;
    };
    trigger.onclick=()=>calendar(date,time,returnLeg,trigger);
    input.addEventListener('change',update);
    new MutationObserver(update).observe(input,{attributes:true});
    views.push(update); update();
  }
}
function refresh() { views.forEach(update=>update()); }
if(form) {
  form.querySelectorAll('.transport-field select').forEach(enhanceSelect);
  enhanceDatePair('transportTravelDate','transportTravelTime',false);
  enhanceDatePair('transportReturnDate','transportReturnTime',true);
  form.addEventListener('change',()=>queueMicrotask(refresh));
  form.addEventListener('reset',()=>setTimeout(refresh,0));
  document.addEventListener('ce:transport:quote-updated',refresh);
  document.addEventListener('wakacjecypr:languagechange',()=>{currentDialog?.close();queueMicrotask(refresh);});
  new MutationObserver(refresh).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}
