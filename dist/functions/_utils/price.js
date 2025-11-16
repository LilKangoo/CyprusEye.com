// Shared price calculation for trips
// Models: per_person, base_plus_extra, per_hour, per_day

export function calcPriceTotal(trip, input) {
  const {
    pricing_model,
    price_base,
    price_per_person,
    price_extra_person,
    included_people,
    min_hours
  } = trip || {};

  const adults = Number(input?.adults ?? input?.party_adults ?? 1) || 1;
  const children = Number(input?.children ?? input?.party_children ?? 0) || 0;
  const hours = Number(input?.hours ?? 0) || 0;
  const days = Number(input?.days ?? 1) || 1;
  const addons = Number(input?.addons ?? 0) || 0;

  const childrenFactor = 1; // can be adjusted later if needed

  let total = 0;
  let breakdown = {};

  switch (pricing_model) {
    case 'per_person': {
      const ppl = adults + childrenFactor * children;
      total = (Number(price_per_person) || 0) * ppl + addons;
      breakdown = { model: 'per_person', ppl, price_per_person: Number(price_per_person) || 0, addons };
      break;
    }
    case 'base_plus_extra': {
      const base = Number(price_base) || 0;
      const included = Number(included_people) || 0;
      const extraPeople = Math.max(0, adults + childrenFactor * children - included);
      const extraTotal = extraPeople * (Number(price_extra_person) || 0);
      total = base + extraTotal + addons;
      breakdown = { model: 'base_plus_extra', base, included, extraPeople, price_extra_person: Number(price_extra_person) || 0, addons };
      break;
    }
    case 'per_hour': {
      const minH = Number(min_hours) || 1;
      const billable = Math.max(minH, hours || 0);
      total = billable * (Number(price_base) || 0) + addons;
      breakdown = { model: 'per_hour', billable_hours: billable, price_per_hour: Number(price_base) || 0, addons };
      break;
    }
    case 'per_day': {
      const billableDays = Math.max(1, days || 1);
      total = billableDays * (Number(price_base) || 0) + addons;
      breakdown = { model: 'per_day', billable_days: billableDays, price_per_day: Number(price_base) || 0, addons };
      break;
    }
    default: {
      total = Number(price_base) || 0;
      breakdown = { model: 'unknown', note: 'defaulted to base' };
    }
  }

  return { total: Number(total.toFixed(2)), breakdown };
}
