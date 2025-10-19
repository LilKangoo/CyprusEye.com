const SUPABASE_DEFAULTS = Object.freeze({
  url: 'https://daoohnbnnowmmcizgvrq.supabase.co',
  anon:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb29obmJubm93bWNpemd2cnEiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc2MDc2OTA0OSwiZXhwIjoyMDc2MzQ1MDQ5fQ.AJrmxrk18yWxL1_Ejk_SZ1-X04YxN4C8LXCn9c3yFSM',
  publishable: 'sb_publishable_QdxNGCb6LYD-6ywFrjCrjg_Oa7yDGTk',
});

const META_DESCRIPTORS = [
  {
    name: 'supabase-url',
    validate: (value) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(value || ''),
    fallbackKey: 'url',
  },
  {
    name: 'supabase-anon',
    validate: (value) => typeof value === 'string' && value.split('.').length === 3,
    fallbackKey: 'anon',
  },
  {
    name: 'supabase-publishable',
    validate: (value) => typeof value === 'string' && value.trim().length > 0,
    fallbackKey: 'publishable',
  },
];

function getDocument(node) {
  if (node && typeof node.querySelector === 'function') {
    return node;
  }
  if (typeof document !== 'undefined') {
    return document;
  }
  return null;
}

function readMeta(doc, name) {
  if (!doc) return '';
  const meta = doc.querySelector(`meta[name="${name}"]`);
  return meta?.content?.trim() || '';
}

function upsertMeta(doc, name, value) {
  if (!doc?.head) return;
  let meta = doc.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = doc.createElement('meta');
    meta.setAttribute('name', name);
    doc.head.appendChild(meta);
  }
  meta.setAttribute('content', value);
}

function getSupabaseConfig(node, { logWarnings = false } = {}) {
  const doc = getDocument(node);
  const config = { ...SUPABASE_DEFAULTS };

  META_DESCRIPTORS.forEach(({ name, validate, fallbackKey }) => {
    const value = readMeta(doc, name);
    if (validate(value)) {
      config[fallbackKey] = value;
    } else {
      if (logWarnings && value) {
        console.warn(`Konfiguracja Supabase: nieprawidłowa wartość meta ${name}, używam domyślnej.`);
      }
      config[fallbackKey] = SUPABASE_DEFAULTS[fallbackKey];
    }
  });

  return config;
}

function ensureSupabaseMeta(node) {
  const doc = getDocument(node);
  if (!doc) {
    return { ...SUPABASE_DEFAULTS };
  }

  META_DESCRIPTORS.forEach(({ name, validate, fallbackKey }) => {
    const current = readMeta(doc, name);
    if (!validate(current)) {
      upsertMeta(doc, name, SUPABASE_DEFAULTS[fallbackKey]);
    }
  });

  return getSupabaseConfig(doc);
}

export { SUPABASE_DEFAULTS, getSupabaseConfig, ensureSupabaseMeta };
