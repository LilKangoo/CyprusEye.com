import { readdir, readFile, writeFile, mkdir, cp, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Katalogi do skanowania pod kątem plików JS do minifikacji
const JS_DIRECTORIES = ['js', 'admin', 'assets/js', 'src/utils'];

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
      'index.html',
      'achievements.html',
      'advertise.html',
      'attractions.html',
      'autopfo.html',
      'car-rental-landing.html',
      'car-rental.html',
      'community.html',
      'cruise.html',
      'kupon.html',
      'packing.html',
      'tasks.html',
      'vip.html',
    ];
    
    for (const file of htmlFiles) {
      const src = join(ROOT, file);
      const dest = join(DIST, file);
      if (existsSync(src)) {
        await cp(src, dest);
      }
    }
    
    // Kopiuj foldery HTML
    const htmlDirs = ['auth', 'account', 'reset'];
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
    
    // Kopiuj CSS
    await cp(join(ROOT, 'assets/css'), join(DIST, 'assets/css'), { recursive: true });
    await cp(join(ROOT, 'css'), join(DIST, 'css'), { recursive: true });
    
    // Kopiuj obrazy i assets
    const assetFiles = ['cyprus_logo-1000x1054.png', 'kupon logo.jpeg', 'favicon.json'];
    for (const file of assetFiles) {
      const src = join(ROOT, 'assets', file);
      if (existsSync(src)) {
        await cp(src, join(DIST, 'assets', file));
      }
    }
    
    // Kopiuj translations
    await cp(join(ROOT, 'translations'), join(DIST, 'translations'), { recursive: true });
    
    // Kopiuj config files
    if (existsSync(join(ROOT, 'robots.txt'))) {
      await cp(join(ROOT, 'robots.txt'), join(DIST, 'robots.txt'));
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
    
    console.log('✅ Static files copied');
  } catch (error) {
    console.error('❌ Error copying static files:', error.message);
    throw error;
  }
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
    for (const file of allJsFiles) {
      await buildFile(file);
    }
  
  // Copy static files
  await copyStaticFiles();
  
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
