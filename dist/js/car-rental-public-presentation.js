const SUPPORTED_LANGUAGES = new Set(['pl', 'en', 'he']);

export function normalizeCarPublicLanguage(value) {
  const code = String(value || '').trim().toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.has(code) ? code : 'en';
}

export function carPublicText(values, language = 'en') {
  const lang = normalizeCarPublicLanguage(language);
  const source = values && typeof values === 'object' ? values : {};
  const chain = lang === 'pl' ? ['pl', 'en', 'he'] : lang === 'he' ? ['he', 'en', 'pl'] : ['en', 'pl', 'he'];
  for (const code of chain) {
    const value = source[code];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function formatEuroAmount(value, language) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat(normalizeCarPublicLanguage(language), {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * car_offers.deposit_amount is the refundable security/damage deposit only.
 * It is deliberately independent from service_deposit_* (payment due at booking).
 */
export function resolveCarSecurityDepositPresentation(offer, language = 'en') {
  const raw = offer?.deposit_amount;
  if (raw === null || raw === undefined || raw === '') {
    return { state: 'unspecified', visible: false, amount: null, label: '' };
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    return { state: 'unspecified', visible: false, amount: null, label: '' };
  }
  if (amount === 0) {
    return {
      state: 'none',
      visible: true,
      amount: 0,
      label: carPublicText({
        pl: '✓ Bez kaucji',
        en: '✓ No Deposit',
        he: '✓ ללא פיקדון',
      }, language),
    };
  }

  const formatted = formatEuroAmount(amount, language);
  return {
    state: 'amount',
    visible: true,
    amount,
    label: carPublicText({
      pl: `Kaucja ${formatted}€`,
      en: `Deposit €${formatted}`,
      he: `פיקדון €${formatted}`,
    }, language),
  };
}

export function resolveThresholdInsurancePresentation(offer, language = 'en') {
  const mode = String(offer?.insurance_mode || 'legacy_optional_daily').trim().toLowerCase();
  const dailyRate = Math.max(0, Number(offer?.insurance_per_day || 0));
  if (mode === 'not_offered') {
    return {
      mode,
      selectable: false,
      included: false,
      label: carPublicText({
        pl: 'Dodatkowe ubezpieczenie nie dotyczy tej oferty.',
        en: 'An optional insurance add-on does not apply to this offer.',
        he: 'תוספת ביטוח אופציונלית אינה חלה על הצעה זו.',
      }, language),
    };
  }
  if (mode === 'included') {
    return {
      mode,
      selectable: false,
      included: true,
      label: carPublicText({
        pl: 'Ubezpieczenie w cenie',
        en: 'Insurance included',
        he: 'הביטוח כלול',
      }, language),
    };
  }
  return {
    mode,
    selectable: true,
    included: false,
    dailyRate,
    label: carPublicText({
      pl: `Opcjonalne ubezpieczenie (+${formatEuroAmount(dailyRate, language)}€/dzień)`,
      en: `Optional insurance (+€${formatEuroAmount(dailyRate, language)}/day)`,
      he: `ביטוח אופציונלי (+€${formatEuroAmount(dailyRate, language)} ליום)`,
    }, language),
  };
}

export function resolveGenericVehicleCopy(language = 'en') {
  return {
    singular: carPublicText({ pl: 'pojazd', en: 'vehicle', he: 'כלי רכב' }, language),
    plural: carPublicText({ pl: 'pojazdy', en: 'vehicles', he: 'כלי רכב' }, language),
    select: carPublicText({ pl: 'Wybierz pojazd', en: 'Choose a vehicle', he: 'בחרו כלי רכב' }, language),
    reserve: carPublicText({ pl: 'Zarezerwuj ten pojazd', en: 'Reserve this vehicle', he: 'הזמינו כלי רכב זה' }, language),
    selected: carPublicText({ pl: 'Wybrany pojazd', en: 'Selected vehicle', he: 'כלי הרכב שנבחר' }, language),
  };
}
