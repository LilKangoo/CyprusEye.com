import { SUPABASE_CONFIG } from './config.js'

function byId(id) {
  return document.getElementById(id)
}

function getLang() {
  const params = new URLSearchParams(window.location.search)
  const raw = String(params.get('lang') || '').trim().toLowerCase()
  return raw === 'pl' ? 'pl' : 'en'
}

const DICT = {
  en: {
    title: 'Choose your trip date',
    intro: 'Please choose one available date to continue with your booking confirmation.',
    badge_loading: 'Loading…',
    badge_ready: 'Date options ready',
    badge_selected: 'Date selected',
    badge_expired: 'Link expired',
    badge_error: 'Error',
    label_trip: 'Trip',
    label_preferred: 'Preferred date',
    label_stay: 'Stay range',
    label_selected: 'Selected date',
    btn_confirm: 'Confirm selected date',
    btn_home: 'Back to home',
    empty: 'No dates available in this request.',
    required: 'Please select one date option.',
    loading: 'Loading date options…',
    selected_ok: 'Date confirmed. Check your email for the payment link to complete booking confirmation.',
    redirecting_payment: 'Date confirmed. Redirecting to secure payment…',
    payment_pending: 'Date confirmed. Payment link is being prepared and will be sent by email shortly.',
    already_selected: 'This date was already selected. If you need changes, contact support.',
    expired: 'This link has expired. Contact support and ask for a new date-selection email.',
    invalid: 'This selection link is invalid or no longer available.',
  },
  pl: {
    title: 'Wybierz datę wycieczki',
    intro: 'Wybierz jedną z dostępnych dat, aby przejść do potwierdzenia rezerwacji.',
    badge_loading: 'Ładowanie…',
    badge_ready: 'Opcje dat gotowe',
    badge_selected: 'Data wybrana',
    badge_expired: 'Link wygasł',
    badge_error: 'Błąd',
    label_trip: 'Wycieczka',
    label_preferred: 'Preferowana data',
    label_stay: 'Zakres pobytu',
    label_selected: 'Wybrana data',
    btn_confirm: 'Potwierdź wybraną datę',
    btn_home: 'Powrót na stronę główną',
    empty: 'Brak dat dostępnych w tym zgłoszeniu.',
    required: 'Wybierz jedną datę.',
    loading: 'Ładowanie opcji dat…',
    selected_ok: 'Data potwierdzona. Sprawdź email z linkiem płatności, aby zakończyć potwierdzenie rezerwacji.',
    redirecting_payment: 'Data potwierdzona. Przekierowujemy do bezpiecznej płatności…',
    payment_pending: 'Data potwierdzona. Link płatności jest przygotowywany i zostanie wysłany na email.',
    already_selected: 'Ta data została już wybrana. Jeśli chcesz zmianę, skontaktuj się z obsługą.',
    expired: 'Ten link wygasł. Poproś obsługę o nowy email z wyborem daty.',
    invalid: 'Ten link jest nieprawidłowy lub nie jest już dostępny.',
  },
}

function t(lang, key) {
  return (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key
}

function parseIso(value) {
  const raw = String(value || '').trim()
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toISOString().slice(0, 10)
}

function formatIsoDate(value) {
  const iso = parseIso(value)
  if (!iso) return '—'
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB')
  } catch (_e) {
    return iso
  }
}

function setBadge(text, tone) {
  const el = byId('tripDateSelectionBadge')
  if (!el) return
  el.classList.remove('success', 'warn')
  if (tone === 'success') el.classList.add('success')
  if (tone === 'warn') el.classList.add('warn')
  el.textContent = text
}

function setStatus(message, tone = 'info') {
  const box = byId('tripDateSelectionStatus')
  if (!box) return
  box.hidden = false
  box.classList.remove('success', 'error')
  if (tone === 'success') box.classList.add('success')
  if (tone === 'error') box.classList.add('error')
  box.textContent = message
}

function setLabels(lang) {
  const labels = [
    ['tripDateSelectionTitle', 'title'],
    ['tripDateSelectionIntro', 'intro'],
    ['tripDateSelectionBack', 'btn_home'],
    ['labelTripName', 'label_trip'],
    ['labelPreferredDate', 'label_preferred'],
    ['labelStayRange', 'label_stay'],
    ['labelSelectedDate', 'label_selected'],
    ['tripDateSelectionSubmit', 'btn_confirm'],
  ]
  labels.forEach(([id, key]) => {
    const el = byId(id)
    if (el) el.textContent = t(lang, key)
  })
}

function getFunctionsBase() {
  const url = String(SUPABASE_CONFIG?.url || '').trim()
  if (!url) return ''
  try {
    const host = new URL(url).hostname
    const projectRef = host.split('.')[0] || ''
    if (!projectRef) return ''
    return `https://${projectRef}.functions.supabase.co`
  } catch (_e) {
    return ''
  }
}

async function callTripDateSelection(payload) {
  const base = getFunctionsBase()
  if (!base) throw new Error('Missing Supabase functions URL')
  const anonKey = String(SUPABASE_CONFIG?.anonKey || '').trim()
  if (!anonKey) throw new Error('Missing Supabase anon key')

  const response = await fetch(`${base}/trip-date-selection`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload || {}),
  })

  let json = null
  try {
    json = await response.json()
  } catch (_e) {
    json = null
  }

  if (!response.ok) {
    const msg = String(json?.error || json?.message || `Request failed (${response.status})`)
    const err = new Error(msg)
    err.status = response.status
    throw err
  }

  if (json && typeof json === 'object' && json.error) {
    throw new Error(String(json.error || 'Request failed'))
  }

  return json
}

function renderSummary(data) {
  byId('tripDateSelectionTripName').textContent = String(data?.trip_title || '—')
  byId('tripDateSelectionPreferredDate').textContent = formatIsoDate(data?.preferred_date)
  const stayFrom = formatIsoDate(data?.stay_from)
  const stayTo = formatIsoDate(data?.stay_to)
  byId('tripDateSelectionStayRange').textContent = stayFrom === '—' && stayTo === '—' ? '—' : `${stayFrom} → ${stayTo}`
  byId('tripDateSelectionSelectedDate').textContent = formatIsoDate(data?.selected_date)

  const summary = byId('tripDateSelectionSummary')
  if (summary) summary.hidden = false
}

function renderOptions(data) {
  const root = byId('tripDateSelectionOptions')
  if (!root) return

  const options = Array.isArray(data?.proposed_dates) ? data.proposed_dates : []
  const selectedIso = parseIso(data?.selected_date)
  if (!options.length) {
    root.innerHTML = ''
    return
  }

  root.innerHTML = options
    .map((raw, idx) => {
      const iso = parseIso(raw)
      const value = iso || String(raw || '')
      const label = formatIsoDate(value)
      const isChecked = selectedIso ? selectedIso === value : idx === 0
      return `
        <label class="option">
          <input type="radio" name="tripDateOption" value="${value}" ${isChecked ? 'checked' : ''} />
          <strong>${label}</strong>
        </label>
      `
    })
    .join('')
}

function selectedOptionValue() {
  const picked = document.querySelector('input[name="tripDateOption"]:checked')
  return picked ? String(picked.value || '').trim() : ''
}

async function main() {
  const lang = getLang()
  setLabels(lang)
  setBadge(t(lang, 'badge_loading'))
  setStatus(t(lang, 'loading'))

  const params = new URLSearchParams(window.location.search)
  const token = String(params.get('token') || '').trim()
  if (!token) {
    setBadge(t(lang, 'badge_error'))
    setStatus(t(lang, 'invalid'), 'error')
    return
  }

  let preview = null
  try {
    const res = await callTripDateSelection({ action: 'preview', token })
    preview = res?.data || null
  } catch (error) {
    const msg = String(error?.message || '')
    if (error?.status === 410) {
      setBadge(t(lang, 'badge_expired'), 'warn')
      setStatus(t(lang, 'expired'), 'error')
      return
    }
    setBadge(t(lang, 'badge_error'))
    setStatus(msg || t(lang, 'invalid'), 'error')
    return
  }

  if (!preview || typeof preview !== 'object') {
    setBadge(t(lang, 'badge_error'))
    setStatus(t(lang, 'invalid'), 'error')
    return
  }

  renderSummary(preview)
  renderOptions(preview)

  const form = byId('tripDateSelectionForm')
  const submit = byId('tripDateSelectionSubmit')
  const canConfirm = Boolean(preview?.can_confirm)

  if (!canConfirm) {
    if (form) form.hidden = true
    setBadge(t(lang, 'badge_selected'), 'success')
    setStatus(t(lang, 'already_selected'), 'success')
    return
  }

  const options = Array.isArray(preview?.proposed_dates) ? preview.proposed_dates : []
  if (!options.length) {
    if (form) form.hidden = true
    setBadge(t(lang, 'badge_error'))
    setStatus(t(lang, 'empty'), 'error')
    return
  }

  if (form) form.hidden = false
  setBadge(t(lang, 'badge_ready'))
  setStatus(t(lang, 'intro'))

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const selected = selectedOptionValue()
    if (!selected) {
      setStatus(t(lang, 'required'), 'error')
      return
    }

    if (submit) submit.disabled = true
    try {
      const res = await callTripDateSelection({
        action: 'confirm',
        token,
        selected_date: selected,
      })

      const payload = res?.data || {}
      byId('tripDateSelectionSelectedDate').textContent = formatIsoDate(payload?.selected_date || selected)
      const checkoutUrl = String(payload?.checkout_url || '').trim()
      const paymentLinkError = String(payload?.payment_link_error || '').trim()
      if (checkoutUrl) {
        if (form) form.hidden = true
        setBadge(t(lang, 'badge_selected'), 'success')
        setStatus(t(lang, 'redirecting_payment'), 'success')
        setTimeout(() => {
          window.location.href = checkoutUrl
        }, 450)
        return
      }

      if (form) form.hidden = true
      setBadge(t(lang, 'badge_selected'), 'success')
      setStatus(paymentLinkError ? t(lang, 'payment_pending') : t(lang, 'selected_ok'), 'success')
    } catch (error) {
      if (error?.status === 410) {
        setBadge(t(lang, 'badge_expired'), 'warn')
        setStatus(t(lang, 'expired'), 'error')
      } else {
        setBadge(t(lang, 'badge_error'))
        setStatus(String(error?.message || t(lang, 'invalid')), 'error')
      }
      if (submit) submit.disabled = false
    }
  })
}

void main()
