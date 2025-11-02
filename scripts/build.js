import { readdir, readFile, writeFile, mkdir, cp, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Pliki JS do zminifikowania
const JS_FILES = [
  'app.js',
  'car-rental.js',
  'js/auth.js',
  'js/authUi.js',
  'js/i18n.js',
  'js/account.js',
  'js/profile.js',
  'js/toast.js',
  'js/tutorial.js',
  'js/seo.js',
  'js/forms.js',
  'js/coupon.js',
  'js/xp.js',
  'js/supabaseClient.js',
  'js/authCallback.js',
  'js/authMessages.js',
  'js/languageSwitcher.js',
  'js/mobileTabbar.js',
  'js/achievements-profile.js',
  'js/config.js',
  'assets/js/modal-auth.js',
  'assets/js/account-modal.js',
  'assets/js/auth-ui.js',
];

// Community files
const COMMUNITY_FILES = [
  'js/community/ui.js',
  'js/community/photos.js',
  'js/community/comments.js',
  'js/community/likes.js',
  'js/community/ratings.js',
  'js/community/notifications.js',
  'js/community/location-filter.js',
  'js/community/i18nHelper.js',
];

// Utility modules (src/utils/)
const UTILITY_FILES = [
  'src/utils/dates.js',
  'src/utils/translations.js',
  'src/utils/validation.js',
  'src/utils/dataProcessing.js',
  'src/utils/storage.js',
  'src/utils/dom.js',
];

// State management modules (src/state/)
const STATE_FILES = [
  'src/state/store.js',
  'src/state/accounts.js',
  'src/state/progress.js',
  'src/state/notifications.js',
  'src/state/reviews.js',
];

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
      console.error(`❌ Minify error in ${filePath}:`, result.error);
      throw result.error;
    }
    
    if (!result.code) {
      console.error(`❌ Minify returned empty code for ${filePath}`);
      throw new Error(`Empty minification result for ${filePath}`);
    }
    
    // Zapisz do /dist/
    const distPath = join(DIST, filePath);
    await mkdir(dirname(distPath), { recursive: true });
    await writeFile(distPath, result.code, 'utf-8');
    
    console.log(`✅ Built: ${filePath} (${result.code.length} bytes)`);
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
    
    // Buduj pliki główne
    for (const file of JS_FILES) {
      await buildFile(file);
    }
    
    // Buduj pliki community
    for (const file of COMMUNITY_FILES) {
      await buildFile(file);
    }
    
    // Buduj utility modules
    for (const file of UTILITY_FILES) {
      await buildFile(file);
    }
    
    // Buduj state modules
    for (const file of STATE_FILES) {
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
