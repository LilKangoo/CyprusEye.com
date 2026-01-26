import { readdir, readFile, writeFile, mkdir, cp, rm, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Katalogi do skanowania pod kątem plików JS do minifikacji
const JS_DIRECTORIES = ['js', 'admin', 'assets/js', 'src/utils'];

// Wybrane pliki JS w katalogu głównym, które muszą być dostępne publicznie
const ROOT_JS_FILES = ['car-rental.js'];

// Proste skanowanie rekurencyjne (wyklucza katalogi build/test/backup)
async function collectJsFiles() {
  const excludeDirs = new Set([
    'node_modules',
    'dist',
    'scripts',
    'tests',
    'test-results',
    'test-results.json',
    'DELETED_BACKUPS',
    'backup',
  ]);

  /** @type {string[]} */
  const results = [];

  async function walk(dirRel) {
    const base = join(ROOT, dirRel);
    if (!existsSync(base)) return;
    const entries = await readdir(base, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      if (excludeDirs.has(name)) continue;
      const relPath = join(dirRel, name);
      if (entry.isDirectory()) {
        await walk(relPath);
      } else if (entry.isFile() && name.endsWith('.js')) {
        results.push(relPath);
      }
    }
  }

  for (const dir of JS_DIRECTORIES) {
    await walk(dir);
  }

  return results;
}

async function buildFile(filePath) {
  const fullPath = join(ROOT, filePath);
  
  // Sprawdź czy plik istnieje
  if (!existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} (not found)`);
    return;
  }
  
  console.log(`Building: ${filePath}`);
  
  try {
    const code = await readFile(fullPath, 'utf-8');
    
    const result = await minify(code, {
      compress: {
        drop_console: ['log', 'warn'],  // Usuń console.log/warn (zostaw error)
        drop_debugger: true,
        dead_code: true,
        passes: 2,
      },
      mangle: false,  // Nie zmieniaj nazw zmiennych (dla debugowania)
      format: {
        comments: false,  // Usuń komentarze
      },
      module: true,  // Support ES6 modules
    });
    
    if (result.error) {
      console.warn(`⚠️  Minify error in ${filePath}, copying original:`, result.error.message || result.error);
    }
    
    // Jeśli minifikacja zwróciła pusty kod (np. plik tylko z danymi bez efektów ubocznych) – kopiuj oryginał
    const outputCode = result.code && result.code.trim().length > 0 ? result.code : code;
    
    // Zapisz do /dist/
    const distPath = join(DIST, filePath);
    await mkdir(dirname(distPath), { recursive: true });
    await writeFile(distPath, outputCode, 'utf-8');
    
    console.log(`✅ Built: ${filePath} (${outputCode.length} bytes)`);
  } catch (error) {
    console.error(`❌ Error building ${filePath}:`, error.message);
    console.error(error.stack);
    throw error;
  }
}

async function copyStaticFiles() {
  console.log('\n📦 Copying static files...');
  
  try {
    // Kopiuj HTML files
    const htmlFiles = [
      '404.html',
      'deposit.html',
      'index.html',
      'plan.html',
      'shop.html',
      'partners.html',
      'vip.html',
      'achievements.html',
      'advertise.html',
      'attractions.html',
      'autopfo.html',
      'car-rental-landing.html',
      'car-rental.html',
      'community.html',
      'cruise.html',
      'hotels.html',
      'hotel.html',
      'trips.html',
      'trip.html',
      'kupon.html',
      'packing.html',
      'tasks.html',
      'recommendations.html',
      'terms.html',
    ];
    
    for (const file of htmlFiles) {
      const src = join(ROOT, file);
      const dest = join(DIST, file);
      if (existsSync(src)) {
        await cp(src, dest);
      }
    }
    
    // Kopiuj foldery HTML
    const htmlDirs = ['auth', 'account', 'reset', 'shop'];
    for (const dir of htmlDirs) {
      const src = join(ROOT, dir);
      const dest = join(DIST, dir);
      if (existsSync(src)) {
        await cp(src, dest, { recursive: true });
      }
    }

    // Kopiuj admin (bez plików .js, bo są budowane do dist wcześniej)
    const adminSrc = join(ROOT, 'admin');
    const adminDest = join(DIST, 'admin');
    if (existsSync(adminSrc)) {
      await cp(adminSrc, adminDest, {
        recursive: true,
        filter: (srcPath) => !srcPath.endsWith('.js'),
      });
    }
    
    // Kopiuj CSS (global)
    await cp(join(ROOT, 'css'), join(DIST, 'css'), { recursive: true });

    // Kopiuj CAŁY katalog assets (obrazy, css, js, pois.json, itp.)
    if (existsSync(join(ROOT, 'assets'))) {
      await cp(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });
    }
    
    // Kopiuj translations
    await cp(join(ROOT, 'translations'), join(DIST, 'translations'), { recursive: true });
    
    // Kopiuj config files
    if (existsSync(join(ROOT, 'robots.txt'))) {
      await cp(join(ROOT, 'robots.txt'), join(DIST, 'robots.txt'));
    }
    if (existsSync(join(ROOT, 'ads.txt'))) {
      await cp(join(ROOT, 'ads.txt'), join(DIST, 'ads.txt'));
    }
    if (existsSync(join(ROOT, 'sitemap.xml'))) {
      await cp(join(ROOT, 'sitemap.xml'), join(DIST, 'sitemap.xml'));
    }
    if (existsSync(join(ROOT, '_headers'))) {
      await cp(join(ROOT, '_headers'), join(DIST, '_headers'));
    }
    if (existsSync(join(ROOT, '_redirects'))) {
      await cp(join(ROOT, '_redirects'), join(DIST, '_redirects'));
    }
    if (existsSync(join(ROOT, '_routes.json'))) {
      await cp(join(ROOT, '_routes.json'), join(DIST, '_routes.json'));
    }
    
    // Kopiuj Cloudflare Functions
    if (existsSync(join(ROOT, 'functions'))) {
      await cp(join(ROOT, 'functions'), join(DIST, 'functions'), { recursive: true });
    }

    // Kopiuj katalog public (np. /public/admin/trips.html i skrypty)
    if (existsSync(join(ROOT, 'public'))) {
      await cp(join(ROOT, 'public'), join(DIST, 'public'), { recursive: true });
    }
    
    console.log('✅ Static files copied');
  } catch (error) {
    console.error('❌ Error copying static files:', error.message);
    throw error;
  }
}

async function generateSitemap() {
  const baseUrl = 'https://www.cypruseye.com';

  async function walk(dirAbs, dirRel) {
    const entries = await readdir(dirAbs, { withFileTypes: true });
    const urls = [];
    for (const e of entries) {
      const name = e.name;
      const nextAbs = join(dirAbs, name);
      const nextRel = dirRel ? `${dirRel}/${name}` : name;

      if (e.isDirectory()) {
        if (/(^|\/)admin(\/|$)/.test(nextRel)) continue;
        if (/(^|\/)auth(\/|$)/.test(nextRel)) continue;
        if (/(^|\/)account(\/|$)/.test(nextRel)) continue;
        if (/(^|\/)reset(\/|$)/.test(nextRel)) continue;
        urls.push(...(await walk(nextAbs, nextRel)));
      } else if (e.isFile() && name.endsWith('.html')) {
        if (/^404\.html$/i.test(name)) continue;
        if (/^partners\.html$/i.test(name)) continue;
        if (/^(TEST_|test-|debug-|STANDARD_|simple-test)/i.test(name)) continue;
        if (/sos-modal-fragment/i.test(name)) continue;
        urls.push(`/${nextRel}`);
      }
    }
    return urls;
  }

  const htmlPaths = await walk(DIST, '');
  const unique = Array.from(new Set(htmlPaths)).sort();

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...unique.map((p) => `  <url><loc>${baseUrl}${p}</loc></url>`),
    '</urlset>'
  ];

  const xml = lines.join('\n');
  await writeFile(join(DIST, 'sitemap.xml'), xml, 'utf-8');
}

async function build() {
  try {
    console.log('🚀 Starting build process...\n');
    
    // Najpierw usuń poprzedni dist/
    if (existsSync(DIST)) {
      await rm(DIST, { recursive: true });
    }
    
    await mkdir(DIST, { recursive: true });
    
    // Zbieraj i buduj wszystkie pliki JS
    const allJsFiles = await collectJsFiles();
    const filesToBuild = Array.from(new Set([...allJsFiles, ...ROOT_JS_FILES]));
    for (const file of filesToBuild) {
      await buildFile(file);
    }
  
  // Copy static files
  await copyStaticFiles();

  await generateSitemap();

  // Dodatkowa asekuracja: skopiuj całe drzewa JS jeśli z jakiegoś powodu minifikacja pominie pliki
  try {
    if (existsSync(join(ROOT, 'js'))) {
      await cp(join(ROOT, 'js'), join(DIST, 'js'), { recursive: true });
    }
    if (existsSync(join(ROOT, 'assets/js'))) {
      await cp(join(ROOT, 'assets/js'), join(DIST, 'assets/js'), { recursive: true });
    }
  } catch (e) {
    console.warn('⚠️  Fallback copy of JS trees failed:', e.message);
  }
  
  console.log('\n✅ Build complete! Files in /dist/');
  console.log(`📊 Output directory: ${DIST}`);
  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

build().catch((error) => {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
});
