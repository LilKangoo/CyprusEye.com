import { SUPABASE_CONFIG } from './config.js'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    multiTab: false,
  },
})

const state = {
  lang: 'en',
  result: 'pending',
  dbRow: null,
}

function $(id) {
  return document.getElementById(id)
}

function getSearchParams() {
  return new URLSearchParams(window.location.search)
}

function getLangFromParams() {
  const params = getSearchParams()
  const lang = String(params.get('lang') || '').trim().toLowerCase()
  return lang === 'pl' ? 'pl' : 'en'
}

function t(lang, key) {
  const dict = {
    en: {
      title_success: 'Deposit paid successfully',
      title_cancel: 'Deposit payment cancelled',
      title_pending: 'Checking deposit status…',
      msg_success:
        'Thank you. Your deposit payment has been confirmed. The partner will contact you using the phone number you provided.',
      msg_cancel:
        'Your payment was cancelled. If you still want to confirm the booking, please use the payment link from the email and try again.',
      msg_pending:
        'Please wait a moment. We are checking the payment status. If this page does not update within ~60 seconds, refresh it or contact us.',
      label_reference: 'Reference',
      label_service: 'Service',
      label_amount: 'Paid now',
      label_total: 'Trip total',
      label_remaining: 'Remaining cash on-site',
      label_category: 'Category',
      home: 'Home',
      badge_success: 'Success',
      badge_cancel: 'Cancelled',
      badge_pending: 'Pending',
      unknown: '—',
    },
    pl: {
      title_success: 'Depozyt opłacony',
      title_cancel: 'Płatność depozytu anulowana',
      title_pending: 'Sprawdzamy status depozytu…',
      msg_success:
        'Dziękujemy. Płatność depozytu została potwierdzona. Partner skontaktuje się z Tobą na podany numer telefonu.',
      msg_cancel:
        'Płatność została anulowana. Jeśli nadal chcesz potwierdzić rezerwację, użyj linku z e-maila i spróbuj ponownie.',
      msg_pending:
        'Poczekaj chwilę. Sprawdzamy status płatności. Jeśli ta strona nie zaktualizuje się w ciągu ~60 sekund, odśwież ją lub skontaktuj się z nami.',
      label_reference: 'Referencja',
      label_service: 'Usługa',
      label_amount: 'Opłacono teraz',
      label_total: 'Łączna cena wycieczki',
      label_remaining: 'Do zapłaty gotówką na miejscu',
      label_category: 'Kategoria',
      home: 'Strona główna',
      badge_success: 'Opłacono',
      badge_cancel: 'Anulowano',
      badge_pending: 'Oczekiwanie',
      unknown: '—',
    },
  }
  return (dict[lang] && dict[lang][key]) || dict.en[key] || key
}

function money(amount, currency) {
  const a = Number(amount || 0)
  const c = String(currency || 'EUR').toUpperCase()
  if (!Number.isFinite(a)) return `${c} 0.00`
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(a)
  } catch (_e) {
    return `${c} ${a.toFixed(2)}`
  }
}

function toNumber(value) {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw === 'trip') return 'trips'
  if (raw === 'car') return 'cars'
  if (raw === 'hotel') return 'hotels'
  if (raw === 'transfer' || raw === 'transfers') return 'transport'
  return raw
}

function isGenericTripSummary(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'trip booking' || normalized === 'rezerwacja wycieczki' || normalized === 'booking'
}

function setBadge(kind, lang) {
  const badge = $('depositBadge')
  if (!badge) return

  badge.classList.remove('success', 'cancel', 'pending')
  if (kind === 'success') {
    badge.classList.add('success')
    badge.textContent = t(lang, 'badge_success')
  } else if (kind === 'cancel') {
    badge.classList.add('cancel')
    badge.textContent = t(lang, 'badge_cancel')
  } else {
    badge.classList.add('pending')
    badge.textContent = t(lang, 'badge_pending')
  }
}

function updateLangUrl(lang) {
  const url = new URL(window.location.href)
  url.searchParams.set('lang', lang)
  window.history.replaceState({}, '', url.toString())
}

function setupLanguageSwitcher() {
  const buttons = Array.from(document.querySelectorAll('.lang-btn[data-lang]'))
  const setPressed = (lang) => {
    buttons.forEach((btn) => {
      const value = String(btn.getAttribute('data-lang') || '').trim().toLowerCase()
      btn.setAttribute('aria-pressed', value === lang ? 'true' : 'false')
    })
  }
  setPressed(state.lang)

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = String(btn.getAttribute('data-lang') || '').trim().toLowerCase() === 'pl' ? 'pl' : 'en'
      if (next === state.lang) return
      state.lang = next
      updateLangUrl(next)
      render()
      setPressed(next)
    })
  })
}

function buildViewModel(row) {
  const params = getSearchParams()
  const categoryQuery = normalizeCategory(params.get('category'))
  const category = normalizeCategory(row?.resource_type) || categoryQuery || ''
  const reference = String(row?.fulfillment_reference || params.get('reference') || '').trim()
  const summaryRaw = String(row?.fulfillment_summary || params.get('summary') || '').trim()
  const summaryPl = String(row?.trip_title_pl || row?.summary_pl || '').trim()
  const summaryEn = String(row?.trip_title_en || row?.summary_en || '').trim()
  let summary = summaryRaw
  if (category === 'trips' && (isGenericTripSummary(summaryRaw) || !summaryRaw)) {
    if (state.lang === 'pl') summary = summaryPl || summaryEn || summaryRaw
    else summary = summaryEn || summaryPl || summaryRaw
  }
  if (!summary && (summaryEn || summaryPl)) {
    summary = state.lang === 'pl' ? (summaryPl || summaryEn) : (summaryEn || summaryPl)
  }

  const currency = String(row?.currency || params.get('currency') || 'EUR').trim() || 'EUR'
  const amountPaid = toNumber(row?.amount) ?? toNumber(params.get('amount'))
  const totalFromQuery = toNumber(params.get('total'))
  const totalFromRow = toNumber(row?.fulfillment_total_price)
    ?? toNumber(row?.booking_total_price)
    ?? toNumber(row?.total_price)
  const totalPrice = totalFromQuery ?? totalFromRow
  const remaining = (amountPaid != null && totalPrice != null)
    ? Math.max(0, Number((totalPrice - amountPaid).toFixed(2)))
    : null

  return {
    category: category || '',
    reference: reference || '',
    summary: summary || '',
    amountPaid,
    totalPrice,
    remaining,
    currency,
  }
}

function renderDetails(lang) {
  const vm = buildViewModel(state.dbRow)
  const unknown = t(lang, 'unknown')

  $('labelReference').textContent = t(lang, 'label_reference')
  $('labelService').textContent = t(lang, 'label_service')
  $('labelAmount').textContent = t(lang, 'label_amount')
  $('labelTotal').textContent = t(lang, 'label_total')
  $('labelRemaining').textContent = t(lang, 'label_remaining')
  $('labelCategory').textContent = t(lang, 'label_category')

  $('valueReference').textContent = vm.reference || unknown
  $('valueService').textContent = vm.summary || unknown
  $('valueAmount').textContent = vm.amountPaid != null ? money(vm.amountPaid, vm.currency) : unknown
  $('valueTotal').textContent = vm.totalPrice != null ? money(vm.totalPrice, vm.currency) : unknown
  $('valueRemaining').textContent = vm.remaining != null ? money(vm.remaining, vm.currency) : unknown
  $('valueCategory').textContent = vm.category || unknown

  const params = getSearchParams()
  const footer = $('depositFooter')
  if (footer) {
    const bits = []
    const depId = String(params.get('deposit_request_id') || '').trim()
    const bookingId = String(params.get('booking_id') || '').trim()
    const sessionId = String(params.get('session_id') || '').trim()
    if (depId) bits.push(`deposit_request_id: ${depId}`)
    if (bookingId) bits.push(`booking_id: ${bookingId}`)
    if (sessionId) bits.push(`session_id: ${sessionId}`)
    footer.textContent = bits.length ? bits.join(' • ') : ''
  }

  const btnHome = $('btnHome')
  if (btnHome) btnHome.textContent = t(lang, 'home')
}

function applyResultUi(lang, result, dbStatus) {
  const titleEl = $('depositTitle')
  const msgEl = $('depositMessage')
  if (!titleEl || !msgEl) return

  const effective = (() => {
    if (dbStatus === 'paid') return 'success'
    if (result === 'cancel') return 'cancel'
    if (result === 'success') return 'pending'
    return 'pending'
  })()

  if (effective === 'success') {
    setBadge('success', lang)
    titleEl.textContent = t(lang, 'title_success')
    msgEl.textContent = t(lang, 'msg_success')
    return
  }

  if (effective === 'cancel') {
    setBadge('cancel', lang)
    titleEl.textContent = t(lang, 'title_cancel')
    msgEl.textContent = t(lang, 'msg_cancel')
    return
  }

  setBadge('pending', lang)
  titleEl.textContent = t(lang, 'title_pending')
  msgEl.textContent = t(lang, 'msg_pending')
}

async function loadDepositStatusFromDb() {
  const params = getSearchParams()
  const depId = String(params.get('deposit_request_id') || '').trim()
  if (!depId) return null

  try {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_service_deposit_status', { p_id: depId })
      if (!rpcErr) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
        return row || null
      }
    } catch (_e) {
    }

    const { data, error } = await supabase
      .from('service_deposit_requests')
      .select('id,status,paid_at,amount,currency,fulfillment_reference,fulfillment_summary,resource_type,booking_id')
      .eq('id', depId)
      .maybeSingle()
    if (error) throw error
    return data || null
  } catch (_e) {
    return null
  }
}

function render() {
  document.documentElement.lang = state.lang
  applyResultUi(state.lang, state.result, String(state.dbRow?.status || '').trim().toLowerCase())
  renderDetails(state.lang)
}

async function main() {
  state.lang = getLangFromParams()
  const params = getSearchParams()
  state.result = String(params.get('deposit') || '').trim().toLowerCase()

  setupLanguageSwitcher()
  render()

  if (state.result === 'success') {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const row = await loadDepositStatusFromDb()
      if (row) state.dbRow = row
      render()

      const status = String(row?.status || '').trim().toLowerCase()
      if (status === 'paid') return

      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
}

main()
