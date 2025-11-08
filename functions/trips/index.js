import { createSupabaseClients } from '../_utils/supabaseAdmin.js';

export async function onRequest(context) {
  const { env } = context;
  const { publicClient } = createSupabaseClients(env);
  // Public: list published trips with selected fields
  const { data, error } = await publicClient
    .from('trips')
    .select('id,slug,title,description,start_city,categories,display_mode,display_label,pricing_model,price_base,price_per_person,price_extra_person,included_people,min_hours,cover_image_url')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
