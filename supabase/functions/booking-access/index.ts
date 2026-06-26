import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

type BookingType = "transport" | "cars" | "trips" | "hotels";
type Action = "resolve" | "create_token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-booking-access-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const publicBaseUrl = (Deno.env.get("PUBLIC_SITE_URL") || "https://cypruseye.com").replace(/\/+$/, "");

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeError(status = 404) {
  return jsonResponse(status, {
    ok: false,
    error: "booking_link_unavailable",
    message: "This booking link is unavailable or has expired.",
  });
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = valueToString(value);
    if (text) return text;
  }
  return "";
}

function normalizeLang(value: unknown): "pl" | "en" | "he" {
  const raw = valueToString(value).toLowerCase().split("-")[0];
  if (raw === "pl" || raw === "he") return raw;
  return "en";
}

function normalizeBookingType(value: unknown): BookingType | null {
  const raw = valueToString(value).toLowerCase();
  if (raw === "transport" || raw === "transfer" || raw === "transfers") return "transport";
  if (raw === "cars" || raw === "car") return "cars";
  if (raw === "trips" || raw === "trip") return "trips";
  if (raw === "hotels" || raw === "hotel") return "hotels";
  return null;
}

function tableNameForBookingType(type: BookingType): string {
  if (type === "transport") return "transport_bookings";
  if (type === "cars") return "car_bookings";
  if (type === "trips") return "trip_bookings";
  return "hotel_bookings";
}

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function getAuthenticatedUserEmail(supabase: any, req: Request): Promise<string> {
  const token = extractBearerToken(req);
  if (!token) return "";
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return "";
    return valueToString((data.user as any)?.email).toLowerCase();
  } catch (_error) {
    return "";
  }
}

async function isUserAdmin(supabase: any, req: Request): Promise<boolean> {
  const token = extractBearerToken(req);
  if (!token) return false;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    const userId = valueToString((data as any)?.user?.id);
    if (error || !userId) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();
    return Boolean((profile as any)?.is_admin);
  } catch (_error) {
    return false;
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch (_error) {
    return null;
  }
}

function localizedText(value: unknown, lang: "pl" | "en" | "he"): string {
  const record = parseJsonObject(value);
  if (record) {
    return firstNonEmpty(record[lang], record.en, record.pl, record.he);
  }
  return valueToString(value);
}

function firstName(name: string): string {
  const clean = valueToString(name);
  if (!clean) return "";
  return clean.split(/\s+/)[0] || clean;
}

function numberOrNull(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function moneyObject(params: { total?: unknown; paid?: unknown; currency?: unknown }) {
  const total = numberOrNull(params.total);
  const paid = numberOrNull(params.paid);
  const remaining = total !== null && paid !== null ? Math.max(0, total - paid) : null;
  return {
    total,
    paid,
    remaining,
    currency: firstNonEmpty(params.currency, "EUR").toUpperCase(),
  };
}

async function loadLatestDeposit(supabase: any, bookingType: BookingType, bookingId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("service_deposit_requests")
    .select("id,status,amount,currency,paid_at,fulfillment_reference,fulfillment_summary,booking_id,resource_type")
    .eq("resource_type", bookingType)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

async function buildTransportSummary(supabase: any, row: Record<string, unknown>, lang: "pl" | "en" | "he"): Promise<string> {
  const routeIds = [
    valueToString((row as any).route_id),
    valueToString((row as any).return_route_id),
  ].filter(Boolean);

  const locationIds = [
    valueToString((row as any).origin_location_id),
    valueToString((row as any).destination_location_id),
    valueToString((row as any).return_origin_location_id),
    valueToString((row as any).return_destination_location_id),
  ].filter(Boolean);

  const routeMap: Record<string, any> = {};
  if (routeIds.length) {
    const { data } = await supabase
      .from("transport_routes")
      .select("id, origin_location_id, destination_location_id")
      .in("id", Array.from(new Set(routeIds)));
    (data || []).forEach((route: any) => {
      routeMap[String(route.id)] = route;
      if (route.origin_location_id) locationIds.push(String(route.origin_location_id));
      if (route.destination_location_id) locationIds.push(String(route.destination_location_id));
    });
  }

  const locationMap: Record<string, string> = {};
  const uniqueLocationIds = Array.from(new Set(locationIds.filter(Boolean)));
  if (uniqueLocationIds.length) {
    const { data } = await supabase
      .from("transport_locations")
      .select("id,name,name_local,code")
      .in("id", uniqueLocationIds);
    (data || []).forEach((location: any) => {
      locationMap[String(location.id)] = firstNonEmpty(
        localizedText(location.name, lang),
        localizedText(location.name_local, lang),
        location.code,
      );
    });
  }

  const buildLeg = (prefix: "" | "return_") => {
    const route = routeMap[valueToString((row as any)[`${prefix}route_id`])] || {};
    const originId = firstNonEmpty((row as any)[`${prefix}origin_location_id`], route.origin_location_id);
    const destinationId = firstNonEmpty((row as any)[`${prefix}destination_location_id`], route.destination_location_id);
    const origin = firstNonEmpty(locationMap[originId], (row as any)[`${prefix}pickup_address`]);
    const destination = firstNonEmpty(locationMap[destinationId], (row as any)[`${prefix}dropoff_address`]);
    return [origin, destination].filter(Boolean).join(" -> ");
  };

  return firstNonEmpty(
    buildLeg(""),
    [firstNonEmpty((row as any).pickup_address), firstNonEmpty((row as any).dropoff_address)].filter(Boolean).join(" -> "),
    lang === "pl" ? "Transfer" : "Transport booking",
  );
}

async function mapBookingPayload(
  supabase: any,
  params: {
    tokenRow: Record<string, unknown>;
    booking: Record<string, unknown>;
    bookingType: BookingType;
    lang: "pl" | "en" | "he";
    isOwner: boolean;
  },
) {
  const { tokenRow, booking, bookingType, lang, isOwner } = params;
  const deposit = await loadLatestDeposit(supabase, bookingType, valueToString((booking as any).id));
  const depositPaid = valueToString((deposit as any)?.status).toLowerCase() === "paid"
    ? numberOrNull((deposit as any)?.amount)
    : numberOrNull((booking as any).deposit_amount);

  const base = {
    ok: true,
    access_level: isOwner ? "owner" : "public_preview",
    is_owner: isOwner,
    booking: {
      id: isOwner ? valueToString((booking as any).id) : undefined,
      reference: firstNonEmpty((tokenRow as any).booking_reference, (booking as any).booking_reference, (booking as any).order_number, (booking as any).id),
      type: bookingType,
      status: firstNonEmpty((booking as any).status, "pending"),
      payment_status: firstNonEmpty((booking as any).payment_status, (deposit as any)?.status),
      created_at: valueToString((booking as any).created_at),
    },
    schedule: {},
    location: {},
    money: {},
    customer: {
      name: firstName(firstNonEmpty((booking as any).customer_name, (booking as any).full_name)),
    },
    actions: {
      contact_url: `mailto:hello@cypruseye.com?subject=${encodeURIComponent("Booking " + firstNonEmpty((tokenRow as any).booking_reference, (booking as any).id))}`,
      login_url: `/auth/?lang=${lang}`,
      all_bookings_url: isOwner ? `/achievements.html?lang=${lang}&section=reservations` : null,
    },
  } as Record<string, unknown>;

  if (bookingType === "transport") {
    const summary = await buildTransportSummary(supabase, booking, lang);
    base.booking = {
      ...(base.booking as Record<string, unknown>),
      title: summary,
    };
    base.schedule = {
      date: valueToString((booking as any).travel_date),
      time: valueToString((booking as any).travel_time),
      return_date: valueToString((booking as any).return_travel_date),
      return_time: valueToString((booking as any).return_travel_time),
    };
    base.location = {
      summary,
      pickup: firstNonEmpty((booking as any).pickup_address),
      dropoff: firstNonEmpty((booking as any).dropoff_address),
      return_pickup: isOwner ? firstNonEmpty((booking as any).return_pickup_address) : "",
      return_dropoff: isOwner ? firstNonEmpty((booking as any).return_dropoff_address) : "",
    };
    base.money = moneyObject({
      total: (booking as any).total_price,
      paid: depositPaid,
      currency: firstNonEmpty((booking as any).currency, (deposit as any)?.currency),
    });
  } else if (bookingType === "cars") {
    base.booking = {
      ...(base.booking as Record<string, unknown>),
      title: firstNonEmpty((booking as any).car_model, lang === "pl" ? "Wynajem auta" : "Car rental"),
    };
    base.schedule = {
      date: valueToString((booking as any).pickup_date),
      time: valueToString((booking as any).pickup_time),
      return_date: valueToString((booking as any).return_date),
      return_time: valueToString((booking as any).return_time),
    };
    base.location = {
      summary: [
        firstNonEmpty((booking as any).pickup_location, (booking as any).pickup_address),
        firstNonEmpty((booking as any).return_location, (booking as any).return_address),
      ].filter(Boolean).join(" -> "),
      pickup: firstNonEmpty((booking as any).pickup_location, (booking as any).pickup_address),
      dropoff: firstNonEmpty((booking as any).return_location, (booking as any).return_address),
    };
    base.money = moneyObject({
      total: firstNonEmpty((booking as any).total_price, (booking as any).final_price, (booking as any).quoted_price),
      paid: depositPaid,
      currency: firstNonEmpty((booking as any).currency, (deposit as any)?.currency),
    });
  } else if (bookingType === "trips") {
    base.booking = {
      ...(base.booking as Record<string, unknown>),
      title: firstNonEmpty((booking as any).trip_name, (booking as any).trip_slug, lang === "pl" ? "Wycieczka" : "Trip booking"),
    };
    base.schedule = {
      date: firstNonEmpty((booking as any).selected_trip_date, (booking as any).trip_date, (booking as any).preferred_trip_date),
      arrival_date: valueToString((booking as any).arrival_date),
      departure_date: valueToString((booking as any).departure_date),
    };
    base.location = {
      summary: firstNonEmpty((booking as any).trip_slug, (deposit as any)?.fulfillment_summary),
    };
    base.money = moneyObject({
      total: (booking as any).total_price,
      paid: depositPaid,
      currency: firstNonEmpty((booking as any).currency, (deposit as any)?.currency),
    });
  } else {
    base.booking = {
      ...(base.booking as Record<string, unknown>),
      title: firstNonEmpty(localizedText((booking as any).hotel_name, lang), (booking as any).hotel_slug, lang === "pl" ? "Hotel" : "Hotel booking"),
    };
    base.schedule = {
      date: valueToString((booking as any).arrival_date),
      departure_date: valueToString((booking as any).departure_date),
    };
    base.location = {
      summary: firstNonEmpty(localizedText((booking as any).hotel_name, lang), (booking as any).hotel_slug),
    };
    base.money = moneyObject({
      total: (booking as any).total_price,
      paid: depositPaid,
      currency: firstNonEmpty((booking as any).currency, (deposit as any)?.currency),
    });
  }

  if (isOwner) {
    base.customer = {
      name: firstNonEmpty((booking as any).customer_name, (booking as any).full_name),
      email: firstNonEmpty((booking as any).customer_email, (booking as any).email),
      phone: firstNonEmpty((booking as any).customer_phone, (booking as any).phone),
    };
    base.owner_details = {
      notes: firstNonEmpty((booking as any).notes, (booking as any).special_requests),
      flight_number: firstNonEmpty((booking as any).flight_number),
      passengers: numberOrNull((booking as any).num_passengers),
      adults: numberOrNull((booking as any).num_adults),
      children: numberOrNull((booking as any).num_children),
    };
  }

  return base;
}

async function loadBooking(supabase: any, bookingType: BookingType, bookingId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from(tableNameForBookingType(bookingType))
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

function resolveCustomerEmail(bookingType: BookingType, booking: Record<string, unknown>): string {
  if (bookingType === "cars") return firstNonEmpty((booking as any).email, (booking as any).customer_email).toLowerCase();
  return firstNonEmpty((booking as any).customer_email, (booking as any).email).toLowerCase();
}

function resolveCustomerName(booking: Record<string, unknown>): string {
  return firstNonEmpty((booking as any).customer_name, (booking as any).full_name, (booking as any).name);
}

function resolveBookingReference(booking: Record<string, unknown>): string {
  return firstNonEmpty((booking as any).booking_reference, (booking as any).fulfillment_reference, (booking as any).reference, (booking as any).order_number, (booking as any).id);
}

async function createToken(supabase: any, bookingType: BookingType, bookingId: string, expiresAt: string | null = null) {
  const booking = await loadBooking(supabase, bookingType, bookingId);
  if (!booking) return null;

  const customerEmail = resolveCustomerEmail(bookingType, booking);
  if (!customerEmail) return null;

  const rawToken = generateAccessToken();
  const tokenHash = await sha256Hex(rawToken);
  const bookingReference = resolveBookingReference(booking);

  const { data, error } = await supabase
    .from("booking_access_tokens")
    .insert({
      booking_type: bookingType,
      booking_id: bookingId,
      booking_reference: bookingReference,
      customer_email: customerEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id, booking_type, booking_id, booking_reference, customer_email, expires_at, created_at")
    .single();

  if (error || !data) {
    console.error("[booking-access] failed to create token", error);
    return null;
  }

  return {
    token: rawToken,
    url: `${publicBaseUrl}/yourbooking.html?token=${encodeURIComponent(rawToken)}`,
    row: data,
    customer_name: resolveCustomerName(booking),
  };
}

async function handleResolve(supabase: any, req: Request, body: Record<string, unknown>) {
  const rawToken = valueToString(body.token);
  if (!rawToken || rawToken.length < 24) return safeError(404);

  const tokenHash = await sha256Hex(rawToken);
  const { data: tokenRow, error: tokenError } = await supabase
    .from("booking_access_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (tokenError || !tokenRow) return safeError(404);
  const expiresAt = valueToString((tokenRow as any).expires_at);
  if (expiresAt) {
    const expiresMs = Date.parse(expiresAt);
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) return safeError(404);
  }

  const bookingType = normalizeBookingType((tokenRow as any).booking_type);
  const bookingId = valueToString((tokenRow as any).booking_id);
  if (!bookingType || !bookingId) return safeError(404);

  const booking = await loadBooking(supabase, bookingType, bookingId);
  if (!booking) return safeError(404);

  const authEmail = await getAuthenticatedUserEmail(supabase, req);
  const customerEmail = firstNonEmpty((tokenRow as any).customer_email, resolveCustomerEmail(bookingType, booking)).toLowerCase();
  const isOwner = Boolean(authEmail && customerEmail && authEmail === customerEmail);
  const lang = normalizeLang(body.lang || (booking as any).lang);

  await supabase
    .from("booking_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", (tokenRow as any).id);

  const payload = await mapBookingPayload(supabase, {
    tokenRow: tokenRow as Record<string, unknown>,
    booking,
    bookingType,
    lang,
    isOwner,
  });

  if (authEmail && !isOwner) {
    payload.auth_email_mismatch = true;
    payload.message = "This booking belongs to a different email address.";
  }

  return jsonResponse(200, payload);
}

async function handleCreateToken(supabase: any, req: Request, body: Record<string, unknown>) {
  const configuredSecret = valueToString(Deno.env.get("BOOKING_ACCESS_INTERNAL_SECRET"));
  const providedSecret = valueToString(req.headers.get("x-booking-access-secret"));
  const internalAllowed = Boolean(configuredSecret && providedSecret && configuredSecret === providedSecret);
  const adminAllowed = await isUserAdmin(supabase, req);

  if (!internalAllowed && !adminAllowed) {
    return jsonResponse(403, { ok: false, error: "forbidden" });
  }

  const bookingType = normalizeBookingType(body.booking_type);
  const bookingId = valueToString(body.booking_id);
  if (!bookingType || !bookingId) {
    return jsonResponse(400, { ok: false, error: "invalid_booking" });
  }

  const expiresAt = valueToString(body.expires_at) || null;
  const created = await createToken(supabase, bookingType, bookingId, expiresAt);
  if (!created) {
    return jsonResponse(404, { ok: false, error: "booking_unavailable" });
  }

  const lang = normalizeLang(body.lang);
  const url = `${publicBaseUrl}/yourbooking.html?lang=${lang}&token=${encodeURIComponent(created.token)}`;
  return jsonResponse(200, {
    ok: true,
    token: created.token,
    yourbooking_url: url,
    booking_access_token_id: (created.row as any).id,
    booking_reference: (created.row as any).booking_reference,
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "method_not_allowed" });
  if (!supabaseUrl || !supabaseServiceKey) return jsonResponse(500, { ok: false, error: "missing_supabase_config" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse(400, { ok: false, error: "invalid_json" });
  }

  const action = valueToString(body.action).toLowerCase() as Action;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (action === "resolve") return handleResolve(supabase, req, body);
  if (action === "create_token") return handleCreateToken(supabase, req, body);
  return jsonResponse(400, { ok: false, error: "invalid_action" });
});
