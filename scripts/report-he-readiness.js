#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const auditPath = path.join(rootDir, 'translations', 'audit-he-vs-en.json');
const jsonReportPath = path.join(rootDir, 'translations', 'he-readiness-report.json');
const markdownReportPath = path.join(rootDir, 'docs', 'he-translation-readiness.md');

const ERROR_VALIDATION_RE = /(^|\.)(error|errors|validation|required|invalid|empty|loading|success|failed|failure|unavailable|hint|warning|status|message|messages)(\.|$)/i;

const GROUPS = [
  {
    id: 'critical_ui_navigation',
    label: 'Critical UI / navigation',
    priority: 'P0',
    description: 'Header, navigation, global controls, mobile nav, modals, accessibility and common CTA copy.',
    prefixes: [
      'accessibility',
      'common',
      'footer',
      'header',
      'hero',
      'language',
      'lightbox',
      'metrics',
      'mobile',
      'modal',
      'nav',
      'notifications',
      'shortcuts',
    ],
  },
  {
    id: 'errors_validation',
    label: 'Errors / validation',
    priority: 'P0',
    description: 'Cross-flow status, validation, empty states, loading states and error messages.',
    matcher: (key) => ERROR_VALIDATION_RE.test(key),
  },
  {
    id: 'booking_flows',
    label: 'Booking flows',
    priority: 'P0',
    description: 'Transport, car rental, trips, hotels, coupon and deposit booking UI.',
    prefixes: [
      'carRental',
      'carRentalLanding',
      'carRentalPfo',
      'coupon',
      'deposit',
      'hotels',
      'transport',
      'trips',
    ],
  },
  {
    id: 'auth',
    label: 'Auth',
    priority: 'P0',
    description: 'Sign-in, account, profile, reset and referral entry points.',
    prefixes: ['account', 'auth', 'profile', 'resetPage'],
  },
  {
    id: 'checkout_shop',
    label: 'Checkout / shop',
    priority: 'P0',
    description: 'Shop, cart, checkout, product, shipping and coupon copy.',
    prefixes: ['shop'],
  },
  {
    id: 'partner_panel',
    label: 'Partner panel',
    priority: 'P1',
    description: 'Partner acquisition, partner-facing copy and referral business flows.',
    prefixes: ['advertise', 'partner', 'partners', 'referral'],
  },
  {
    id: 'admin',
    label: 'Admin',
    priority: 'P2',
    description: 'Admin dashboard and internal management copy.',
    prefixes: ['admin', 'dashboard'],
  },
  {
    id: 'blog_public_content',
    label: 'Blog / public content',
    priority: 'P1',
    description: 'Homepage, blog UI, planning, community, map, recommendations and public feature content.',
    prefixes: [
      'badges',
      'blog',
      'blogUi',
      'checkIn',
      'community',
      'currentPlace',
      'home',
      'legal',
      'map',
      'plan',
      'recommendations',
      'sos',
      'tasks',
      'tutorial',
    ],
  },
  {
    id: 'seo_static_meta',
    label: 'SEO / static meta',
    priority: 'P1 before public launch',
    description: 'Static SEO and metadata keys. Planning only until HE public SEO is explicitly enabled.',
    prefixes: ['seo'],
  },
  {
    id: 'low_priority_internal',
    label: 'Low priority / internal',
    priority: 'P3',
    description: 'Remaining keys that do not match a higher-priority Stage 8 bucket.',
    matcher: () => true,
  },
];

function groupMatchesPrefix(key, prefix) {
  return key === prefix || key.startsWith(`${prefix}.`);
}

function groupForKey(key) {
  return GROUPS.find((group) => {
    if (typeof group.matcher === 'function' && group.matcher(key)) {
      return true;
    }

    return Array.isArray(group.prefixes)
      && group.prefixes.some((prefix) => groupMatchesPrefix(key, prefix));
  });
}

function groupKeys(keys) {
  const grouped = Object.fromEntries(GROUPS.map((group) => [
    group.id,
    {
      id: group.id,
      label: group.label,
      priority: group.priority,
      description: group.description,
      count: 0,
      samples: [],
      keys: [],
    },
  ]));

  keys.forEach((key) => {
    const group = groupForKey(key);
    const bucket = grouped[group.id];
    bucket.keys.push(key);
    bucket.count += 1;
    if (bucket.samples.length < 12) {
      bucket.samples.push(key);
    }
  });

  return grouped;
}

function countByRoot(keys) {
  return keys.reduce((accumulator, key) => {
    const root = key.split('.')[0] || 'unknown';
    accumulator[root] = (accumulator[root] || 0) + 1;
    return accumulator;
  }, {});
}

function sortObjectByCount(input) {
  return Object.fromEntries(
    Object.entries(input).sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0], 'en');
    }),
  );
}

function markdownTable(rows) {
  return rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
}

function inlineCodeList(values, limit = 6) {
  if (!values.length) return '-';
  const visible = values.slice(0, limit).map((value) => `\`${value}\``);
  const suffix = values.length > limit ? `, ... +${values.length - limit}` : '';
  return `${visible.join(', ')}${suffix}`;
}

function buildMarkdown(report) {
  const missingRows = [
    ['Grupa', 'Priorytet', 'Braki', 'Przyklady'],
    ['---', '---', '---:', '---'],
    ...Object.values(report.missingKeyGroups).map((group) => [
      group.label,
      group.priority,
      String(group.count),
      inlineCodeList(group.samples),
    ]),
  ];

  const sameAsEnglishRows = [
    ['Grupa', 'Klucze takie same jak EN', 'Przyklady'],
    ['---', '---:', '---'],
    ...Object.values(report.sameAsEnglishGroups).map((group) => [
      group.label,
      String(group.count),
      inlineCodeList(group.samples),
    ]),
  ];

  const qualityRows = [
    ['Status', 'Znaczenie', 'Aktualna liczba'],
    ['---', '---', '---:'],
    ['missing', 'Klucza nie ma w `translations/he.json`.', String(report.qualityWorkflow.currentSignals.missing)],
    ['needs_human_review', 'Klucz istnieje, ale jest taki sam jak EN albo wymaga potwierdzenia native/review.', String(report.qualityWorkflow.currentSignals.needsHumanReview)],
    ['machine_translated', 'Tlumaczenie maszynowe oczekujace na review. Ten status nie jest jeszcze automatycznie sledzony.', String(report.qualityWorkflow.currentSignals.machineTranslatedTracked)],
    ['reviewed', 'Tlumaczenie zaakceptowane przez czlowieka/native speaker. Ten status nie jest jeszcze automatycznie sledzony.', String(report.qualityWorkflow.currentSignals.reviewedTracked)],
  ];

  const rootRows = [
    ['Root', 'Braki'],
    ['---', '---:'],
    ...Object.entries(report.crossCutting.rootPrefixCounts).slice(0, 20).map(([root, count]) => [
      `\`${root}\``,
      String(count),
    ]),
  ];

  return `# HE Translation Readiness

Generated: ${report.generatedAt}
Source audit: \`${report.sourceAuditPath}\`

Hebrew is still internal/hidden. This report does not activate HE in the public language switcher, selectors, sitemap, hreflang, canonical metadata, public SEO, indexing, or \`/he/\` routes.

## Summary

- EN keys: ${report.counts.baseKeys}
- HE keys: ${report.counts.targetKeys}
- Missing HE keys: ${report.counts.missingKeys}
- Extra HE keys: ${report.counts.extraKeys}
- HE keys identical to EN: ${report.counts.sameAsBaseKeys}
- HE keys added in Stage 8: 0

## Missing Keys By Rollout Group

${markdownTable(missingRows)}

## Quality Workflow

${markdownTable(qualityRows)}

Full machine-readable lists live in \`translations/he-readiness-report.json\`:

- \`keysByStatus.missing\`
- \`keysByStatus.needs_human_review\`
- \`keysByStatus.machine_translated\`
- \`keysByStatus.reviewed\`

For now, \`needs_human_review\` is derived from keys where HE is exactly the same value as EN. If a dedicated translation management tool is introduced later, this report can be extended to read a separate reviewed/machine-translated status file.

## Same As EN Risk

${markdownTable(sameAsEnglishRows)}

## Largest Missing Roots

${markdownTable(rootRows)}

## Recommended Fill Order

1. P0 static UI: \`common\`, \`nav\`, \`header\`, \`mobile\`, \`modal\`, accessibility and global buttons.
2. P0 flows: booking validation/status, transport, car rental, trips/hotels booking, shop checkout and cart.
3. P0 auth/account: login, reset, profile, account security and user-facing status copy.
4. P1 public content shell: homepage, blog UI, plan, recommendations, map and community labels.
5. P1 SEO/static meta preparation: translate, review and keep hidden until SEO rollout is explicitly enabled.
6. P2/P3 partner/admin/internal copy after the public critical path is stable.

## Manual Review Rules

- Do not bulk-publish machine translated long marketing copy without human review.
- Preserve placeholders like \`{{value}}\`, HTML tags, line breaks and punctuation tokens.
- Prefer English fallback over Polish fallback for HE until native Hebrew text is reviewed.
- Mark each completed batch as reviewed in the translation workflow before public HE activation.

## Related Checklist

Public launch gates and dynamic content readiness are tracked in \`docs/he-public-rollout-checklist.md\`.
`;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const audit = await readJson(auditPath);
  const missingKeys = audit.missingKeys || [];
  const sameAsBaseKeys = audit.sameAsBaseKeys || [];
  const extraKeys = audit.extraKeys || [];
  const errorValidationKeys = missingKeys.filter((key) => ERROR_VALIDATION_RE.test(key));

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceAuditPath: path.relative(rootDir, auditPath),
    targetLanguage: audit.targetLanguage,
    baseLanguage: audit.baseLanguage,
    counts: audit.counts,
    qualityWorkflow: {
      statuses: {
        missing: 'Key is absent from translations/he.json.',
        machine_translated: 'Machine translated value that must be reviewed before public launch.',
        needs_human_review: 'Existing HE value that still needs human/native review.',
        reviewed: 'Human-reviewed HE value accepted for public launch.',
      },
      currentSignals: {
        missing: missingKeys.length,
        needsHumanReview: sameAsBaseKeys.length,
        machineTranslatedTracked: 0,
        reviewedTracked: 0,
        extraKeysNeedingTriage: extraKeys.length,
      },
    },
    keysByStatus: {
      missing: missingKeys,
      needs_human_review: sameAsBaseKeys,
      machine_translated: [],
      reviewed: [],
    },
    missingKeyGroups: groupKeys(missingKeys),
    sameAsEnglishGroups: groupKeys(sameAsBaseKeys),
    crossCutting: {
      rootPrefixCounts: sortObjectByCount(countByRoot(missingKeys)),
      errorsValidationKeys: {
        count: errorValidationKeys.length,
        samples: errorValidationKeys.slice(0, 25),
        keys: errorValidationKeys,
      },
    },
    launchReadiness: {
      hePubliclyEnabled: false,
      blocker: 'HE remains hidden until critical static keys, dynamic content, hidden visual QA and SEO gates are reviewed.',
      nextChecklist: 'docs/he-public-rollout-checklist.md',
    },
  };

  await writeJson(jsonReportPath, report);
  await fs.mkdir(path.dirname(markdownReportPath), { recursive: true });
  await fs.writeFile(markdownReportPath, buildMarkdown(report), 'utf8');

  console.log('HE translation readiness report generated.');
  console.log(`Missing HE keys: ${missingKeys.length}`);
  console.log(`Same as EN: ${sameAsBaseKeys.length}`);
  console.log(`JSON: ${path.relative(rootDir, jsonReportPath)}`);
  console.log(`Markdown: ${path.relative(rootDir, markdownReportPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
