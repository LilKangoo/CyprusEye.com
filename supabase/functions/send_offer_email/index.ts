// TODO: implementacja – Edge Function send_offer_email
// Responsibilities:
// - pobierz rezerwację
// - policz dni (pełne 24h)
// - wylicz depozyt: DEPOSIT_PER_DAY * dni
// - utwórz Stripe Checkout Session
// - zapisz stripe_session_id + status='waiting_payment'
// - wyślij e‑mail (Zoho SMTP)

export default { async fetch(req: Request): Promise<Response> {
  // TODO: implementacja
  return new Response('send_offer_email TODO', { status: 200 });
}} as const;
