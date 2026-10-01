// Read-only adapters: query the existing user-owned collections only when a panel opens.
export function localizedTitle(row, lang, fallback = "") {
  for (const key of [
    "title_i18n",
    "name_i18n",
    "title",
    "name",
    "display_name",
  ]) {
    const flat = row?.[`${key}_${lang}`];
    if (typeof flat === "string" && flat.trim()) return flat;
    let value = row?.[key];
    if (typeof value === "string" && value.trim().startsWith("{")) {
      try {
        value = JSON.parse(value);
      } catch {}
    }
    if (value && typeof value === "object") {
      for (const code of [lang, "en", "pl", "he"])
        if (typeof value[code] === "string" && value[code].trim())
          return value[code];
    }
    if (typeof value === "string" && value.trim()) return value;
  }
  return row?.slug || fallback;
}
export function savedDestination(type, row) {
  const id = String(row.id || "");
  if (type === "trip" || type === "hotel")
    return row.slug
      ? `/${type}.html?slug=${encodeURIComponent(row.slug)}`
      : `/${type}s.html`;
  if (type === "car")
    return (
      "/car.html?offer_id=" +
      encodeURIComponent(id) +
      (row.location
        ? "&offer_location=" + encodeURIComponent(row.location)
        : "")
    );
  if (type === "recommendation")
    return "/recommendations.html?recommendation=" + encodeURIComponent(id);
  return "/community.html?poi=" + encodeURIComponent(id);
}
export async function loadSaved(sb, userId, lang) {
  const refs = await sb
    .from("user_saved_catalog_items")
    .select("item_type, ref_id")
    .eq("user_id", userId);
  if (refs.error) throw refs.error;
  const tables = {
    trip: "trips",
    hotel: "hotels",
    car: "car_offers",
    poi: "pois",
    recommendation: "recommendations",
  };
  const result = await Promise.all(
    Object.entries(tables).map(async ([type, table]) => {
      const ids = [
        ...new Set(
          (refs.data || [])
            .filter((x) => x.item_type === type)
            .map((x) => String(x.ref_id)),
        ),
      ];
      if (!ids.length) return [];
      const rows = [];
      for (let start = 0; start < ids.length; start += 100) {
        let query = sb
          .from(table)
          .select("*")
          .in("id", ids.slice(start, start + 100));
        query =
          type === "poi"
            ? query.eq("status", "published")
            : type === "recommendation"
              ? query.eq("active", true)
              : query.eq("is_published", true);
        const res = await query;
        if (res.error) throw res.error;
        rows.push(...(res.data || []));
      }
      return rows.map((row) => ({
        title: localizedTitle(row, lang),
        href: savedDestination(type, row),
        type,
      }));
    }),
  );
  return result.flat();
}
export async function loadNotifications(sb, userId, lang, labels) {
  const res = await sb
    .from("poi_notifications")
    .select(
      "id, notification_type, is_read, created_at, comment_id, poi_comments(id, content, poi_id)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (res.error) throw res.error;
  return (res.data || []).map((row) => {
    const comment = Array.isArray(row.poi_comments)
      ? row.poi_comments[0]
      : row.poi_comments;
    return {
      title: labels(row.notification_type === "like" ? "liked" : "replied"),
      detail: comment?.content || "",
      unread: !row.is_read,
      href: comment?.poi_id
        ? "/community.html?poi=" +
          encodeURIComponent(comment.poi_id) +
          "&comment=" +
          encodeURIComponent(row.comment_id || comment.id)
        : "/community.html",
    };
  });
}
