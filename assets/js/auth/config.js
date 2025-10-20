const SUPABASE_URL = 'https://daoohnbnnowmmcizgvrq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb29obmJubm93bW1jaXpndnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjkwNDksImV4cCI6MjA3NjM0NTA0OX0.AJrmxrk18yWxL1_Ejk_SZ1-X04YxN4C8LXCn9c3yFSM';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QdxNGCb6LYD-6ywFrjCrjg_Oa7yDGTk';

const SUPABASE_DEFAULTS = Object.freeze({
  url: SUPABASE_URL,
  anon: SUPABASE_ANON_KEY,
  publishable: SUPABASE_PUBLISHABLE_KEY,
});

export function readSupabaseConfig(
  doc = typeof document !== 'undefined' ? document : undefined,
  win = typeof window !== 'undefined' ? window : undefined,
) {
  const meta = (name) => doc?.querySelector(`meta[name="${name}"]`)?.content;
  const w = win?.__SUPABASE_CONFIG;
  const url = w?.url || meta('supabase-url') || SUPABASE_URL;
  const anon = w?.anon || meta('supabase-anon') || SUPABASE_ANON_KEY;
  const publishable =
    w?.publishable || meta('supabase-publishable') || SUPABASE_PUBLISHABLE_KEY;
  const source = w ? 'window' : meta('supabase-url') ? 'meta' : 'defaults';
  return { url, anon, publishable, source };
}

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
  const win = typeof window !== 'undefined' ? window : undefined;
  const base = readSupabaseConfig(doc ?? undefined, win);
  const config = { url: base.url, anon: base.anon, publishable: base.publishable };
  let { source } = base;
  let usingDefaults = source === 'defaults';

  if (source === 'window') {
    return { ...config, source, usingDefaults };
  }

  META_DESCRIPTORS.forEach(({ name, validate, fallbackKey }) => {
    const value = readMeta(doc, name);
    if (validate(value)) {
      config[fallbackKey] = value;
      source = 'meta';
      usingDefaults = false;
    } else if (value) {
      if (logWarnings) {
        console.warn(`Konfiguracja Supabase: nieprawidłowa wartość meta ${name}, używam domyślnej.`);
      }
      config[fallbackKey] = SUPABASE_DEFAULTS[fallbackKey];
      if (source === 'meta') {
        usingDefaults = usingDefaults || config[fallbackKey] === SUPABASE_DEFAULTS[fallbackKey];
      }
    }
  });

  if (source === 'defaults' && (!config.url || !config.anon)) {
    config.url = SUPABASE_DEFAULTS.url;
    config.anon = SUPABASE_DEFAULTS.anon;
    config.publishable = SUPABASE_DEFAULTS.publishable;
    usingDefaults = true;
  }

  return { ...config, source, usingDefaults };
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

export {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_DEFAULTS,
  getSupabaseConfig,
  ensureSupabaseMeta,
  readSupabaseConfig,
};
