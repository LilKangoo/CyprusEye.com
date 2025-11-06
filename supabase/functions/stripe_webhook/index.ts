// TODO: implementacja – Edge Function stripe_webhook
// Responsibilities:
// - verify Stripe signature (placeholder)
// - on checkout.session.completed:
//   * set status='paid' for booking
//   * insert payment row
//   * send WhatsApp confirmation (placeholder)
//   * set status='approved'

export default { async fetch(req: Request): Promise<Response> {
  // TODO: implementacja
  return new Response('stripe_webhook TODO', { status: 200 });
}} as const;
