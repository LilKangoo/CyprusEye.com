import { SUPABASE_CONFIG } from './config.js'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function $(id) {
  return document.getElementById(id)
}

function getLang() {
  const params = new URLSearchParams(window.location.search)
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
      label_amount: 'Amount',
      label_category: 'Category',
      home: 'Home',
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
      label_amount: 'Kwota',
      label_category: 'Kategoria',
      home: 'Strona główna',
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
  } catch (e) {
    return `${c} ${a.toFixed(2)}`
  }
}

function setBadge(kind) {
  const badge = $('depositBadge')
  if (!badge) return

  badge.classList.remove('success', 'cancel', 'pending')
  if (kind === 'success') {
    badge.classList.add('success')
    badge.textContent = 'Success'
  } else if (kind === 'cancel') {
    badge.classList.add('cancel')
    badge.textContent = 'Cancelled'
  } else {
    badge.classList.add('pending')
    badge.textContent = 'Pending'
  }
}

function applyStaticDetails(lang) {
  const params = new URLSearchParams(window.location.search)
  const category = String(params.get('category') || '').trim() || '—'
  const reference = String(params.get('reference') || '').trim() || '—'
  const summary = String(params.get('summary') || '').trim() || '—'
  const amount = params.get('amount')
  const currency = params.get('currency')

  const bookingId = String(params.get('booking_id') || '').trim()
  const depId = String(params.get('deposit_request_id') || '').trim()
  const sessionId = String(params.get('session_id') || '').trim()

  const valueAmount = amount ? money(amount, currency) : '—'

  $('labelReference').textContent = t(lang, 'label_reference')
  $('labelService').textContent = t(lang, 'label_service')
  $('labelAmount').textContent = t(lang, 'label_amount')
  $('labelCategory').textContent = t(lang, 'label_category')

  $('valueReference').textContent = reference
  $('valueService').textContent = summary
  $('valueAmount').textContent = valueAmount
  $('valueCategory').textContent = category

  const footer = $('depositFooter')
  if (footer) {
    const bits = []
    if (depId) bits.push(`deposit_request_id: ${depId}`)
    if (bookingId) bits.push(`booking_id: ${bookingId}`)
    if (sessionId) bits.push(`session_id: ${sessionId}`)
    footer.textContent = bits.length ? bits.join(' • ') : ''
  }

  const btnHome = $('btnHome')
  if (btnHome) btnHome.textContent = t(lang, 'home')
}

async function loadDepositStatusFromDb(lang) {
  const params = new URLSearchParams(window.location.search)
  const depId = String(params.get('deposit_request_id') || '').trim()
  if (!depId) return null

  const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)

  try {
    // Prefer RPC because service_deposit_requests is protected by RLS (anon cannot SELECT).
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_service_deposit_status', { p_id: depId })
      if (!rpcErr) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
        return row || null
      }
    } catch (_e) {
      // fallback below
    }

    const { data, error } = await supabase
      .from('service_deposit_requests')
      .select('id,status,paid_at,amount,currency,fulfillment_reference,fulfillment_summary,resource_type,booking_id')
      .eq('id', depId)
      .maybeSingle()

    if (error) throw error
    return data || null
  } catch (e) {
    return null
  }
}

function applyResultUi(lang, result, dbStatus) {
  const titleEl = $('depositTitle')
  const msgEl = $('depositMessage')

  const effective = (() => {
    if (dbStatus === 'paid') return 'success'
    if (result === 'cancel') return 'cancel'
    if (result === 'success') return 'pending'
    return 'pending'
  })()

  if (effective === 'success') {
    setBadge('success')
    titleEl.textContent = t(lang, 'title_success')
    msgEl.textContent = t(lang, 'msg_success')
    return
  }

  if (effective === 'cancel') {
    setBadge('cancel')
    titleEl.textContent = t(lang, 'title_cancel')
    msgEl.textContent = t(lang, 'msg_cancel')
    return
  }

  setBadge('pending')
  titleEl.textContent = t(lang, 'title_pending')
  msgEl.textContent = t(lang, 'msg_pending')
}

async function main() {
  const lang = getLang()
  const params = new URLSearchParams(window.location.search)
  const result = String(params.get('deposit') || '').trim().toLowerCase()

  applyStaticDetails(lang)
  applyResultUi(lang, result, null)

  // If Stripe returned success, poll DB for up to ~60s
  if (result === 'success') {
    for (let attempt = 0; attempt < 30; attempt++) {
      const row = await loadDepositStatusFromDb(lang)
      const status = String(row?.status || '').trim().toLowerCase()

      // Update details if DB has richer values
      try {
        if (row) {
          if (row.fulfillment_reference) $('valueReference').textContent = row.fulfillment_reference
          if (row.fulfillment_summary) $('valueService').textContent = row.fulfillment_summary
          if (row.amount) $('valueAmount').textContent = money(row.amount, row.currency)
          if (row.resource_type) $('valueCategory').textContent = row.resource_type
        }
      } catch (e) {}

      if (status === 'paid') {
        applyResultUi(lang, result, 'paid')
        return
      }

      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

main()
