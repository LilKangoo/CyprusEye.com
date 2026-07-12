import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function countMatches(source: string, pattern: RegExp): number {
  return (source.match(pattern) || []).length;
}

function renderSpecialOfferSeo(helperPath: string, options: Record<string, unknown>): string {
  const script = `
    import { applySpecialOfferSeoToHtml } from ${JSON.stringify(pathToFileURL(helperPath).href)};
    const input = ${JSON.stringify(options)};
    process.stdout.write(applySpecialOfferSeoToHtml(input.html, input.options));
  `;
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
  });
}

describe('Special Offer server-rendered SEO metadata', () => {
  const root = process.cwd();
  const helperPath = path.join(root, 'functions/_utils/specialOfferSeo.js');
  const helperSource = fs.readFileSync(helperPath, 'utf8');
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const functionSource = fs.readFileSync(path.join(root, 'functions/[[path]].js'), 'utf8');

  test('uses public-safe SEO RPC without service role or raw Special Offers table reads', () => {
    expect(helperSource).toContain('/rest/v1/rpc/get_public_special_offer_seo');
    expect(helperSource).toContain('SUPABASE_ANON_KEY');
    expect(helperSource).not.toMatch(/SERVICE_ROLE|service_role|SUPABASE_SERVICE/i);
    expect(helperSource).not.toMatch(/\.from\(['"]special_offers['"]\)/);
    expect(helperSource).not.toMatch(/\.from\(['"]special_offer_translations['"]\)/);
    expect(serverSource).toContain('applySpecialOfferSeoToHtml');
    expect(functionSource).toContain('applySpecialOfferSeoToHtml');
  });

  test('renders the required campaign meta tags once with clean canonical URLs', async () => {
    const html = renderSpecialOfferSeo(helperPath, {
      html: '<!doctype html><html lang="en"><head><title>Old</title><meta name="description" content="Old" /></head><body></body></html>',
      options: {
        slug: 'seo-test',
        requestedLang: 'pl',
        seoRow: {
          campaign_slug: 'seo-test',
          requested_lang: 'pl',
          resolved_lang: 'pl',
          meta_title: 'Konkurs <SEO> & "Social"',
          meta_description: 'Opis <b>bezpieczny</b> & gotowy',
          meta_image_url: 'https://cdn.example.com/social.webp',
          meta_image_alt: 'Obraz "kampanii" & test',
        },
      },
    });

    expect(html).toContain('<html lang="pl" dir="ltr">');
    expect(countMatches(html, /<title>/g)).toBe(1);
    expect(countMatches(html, /<meta name="description"/g)).toBe(1);
    expect(countMatches(html, /<link rel="canonical"/g)).toBe(1);
    expect(countMatches(html, /hreflang="pl"/g)).toBe(1);
    expect(countMatches(html, /hreflang="en"/g)).toBe(1);
    expect(countMatches(html, /hreflang="he"/g)).toBe(1);
    expect(countMatches(html, /hreflang="x-default"/g)).toBe(1);
    expect(countMatches(html, /property="og:type"/g)).toBe(1);
    expect(countMatches(html, /property="og:site_name"/g)).toBe(1);
    expect(countMatches(html, /property="og:title"/g)).toBe(1);
    expect(countMatches(html, /property="og:description"/g)).toBe(1);
    expect(countMatches(html, /property="og:url"/g)).toBe(1);
    expect(countMatches(html, /property="og:image"/g)).toBe(1);
    expect(countMatches(html, /property="og:image:alt"/g)).toBe(1);
    expect(countMatches(html, /property="og:locale"/g)).toBe(1);
    expect(countMatches(html, /property="og:locale:alternate"/g)).toBe(1);
    expect(countMatches(html, /name="twitter:card"/g)).toBe(1);
    expect(countMatches(html, /name="twitter:title"/g)).toBe(1);
    expect(countMatches(html, /name="twitter:description"/g)).toBe(1);
    expect(countMatches(html, /name="twitter:image"/g)).toBe(1);
    expect(countMatches(html, /name="twitter:image:alt"/g)).toBe(1);
    expect(html).toContain('href="https://cypruseye.com/special-offers/seo-test?lang=pl"');
    expect(html).toContain('content="https://cypruseye.com/special-offers/seo-test?lang=pl"');
    expect(html).not.toMatch(/[?&]ref=/);
    expect(html).toContain('Konkurs &lt;SEO&gt; &amp; &quot;Social&quot;');
    expect(html).toContain('Obraz &quot;kampanii&quot; &amp; test');
  });

  test('supports Hebrew direction and safe fallback metadata for unavailable campaigns', async () => {
    const html = renderSpecialOfferSeo(helperPath, {
      html: '<!doctype html><html><head></head><body></body></html>',
      options: { slug: 'private-campaign', requestedLang: 'he', seoRow: null },
    });

    expect(html).toContain('<html lang="he" dir="rtl">');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(html).toContain('Special Offer - CyprusEye');
    expect(html).not.toContain('private campaign title');
  });

  test('rejects unsafe social image URLs and falls back to the CyprusEye image', async () => {
    const html = renderSpecialOfferSeo(helperPath, {
      html: '<!doctype html><html><head></head><body></body></html>',
      options: {
        slug: 'unsafe-image',
        requestedLang: 'en',
        seoRow: {
          campaign_slug: 'unsafe-image',
          resolved_lang: 'en',
          meta_title: 'Unsafe image',
          meta_description: 'Description',
          meta_image_url: 'javascript:alert(1)',
          meta_image_alt: 'Unsafe image',
        },
      },
    });

    expect(html).not.toContain('javascript:');
    expect(html).toContain('https://cypruseye.com/assets/cyprus_logo-1000x1054.png');
  });
});
