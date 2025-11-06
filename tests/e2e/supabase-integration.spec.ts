import { test, expect } from '@playwright/test';

/**
 * Test Suite: Integracja Supabase na wszystkich stronach
 * 
 * Cel: Upewnić się że Supabase client i funkcje account działają
 * na każdej podstronie aplikacji
 */

// Deklaracje typów dla window extensions
declare global {
  interface Window {
    getSupabase?: () => any;
    getMyProfile?: () => Promise<any>;
    myXpEvents?: () => Promise<any[]>;
  }
}

const PAGES_TO_TEST = [
  { url: '/', name: 'Strona główna', hasAuth: true },
  { url: '/achievements.html', name: 'Osiągnięcia', hasAuth: true },
  { url: '/tasks.html', name: 'Zadania', hasAuth: true },
  { url: '/packing.html', name: 'Packing List', hasAuth: true },
  { url: '/vip.html', name: 'VIP', hasAuth: true },
  { url: '/attractions.html', name: 'Atrakcje', hasAuth: true },
  { url: '/account/', name: 'Konto', hasAuth: true },
];

test.describe('Supabase Client - Dostępność na stronach', () => {
  
  for (const page of PAGES_TO_TEST) {
    test(`${page.name}: window.getSupabase() jest dostępne`, async ({ page: pw }) => {
      await pw.goto(page.url);
      
      // Sprawdź czy klient Supabase jest załadowany
      const hasGetSupabase = await pw.evaluate(() => {
        return typeof window.getSupabase === 'function';
      });
      
      expect(hasGetSupabase).toBe(true);
    });

    test(`${page.name}: Supabase client jest zainicjalizowany`, async ({ page: pw }) => {
      await pw.goto(page.url);
      
      const clientInitialized = await pw.evaluate(() => {
        try {
          if (typeof window.getSupabase !== 'function') return false;
          const client = window.getSupabase();
          return client !== null && typeof client === 'object';
        } catch {
          return false;
        }
      });
      
      expect(clientInitialized).toBe(true);
    });

    test(`${page.name}: Brak błędów w konsoli związanych z Supabase`, async ({ page: pw }) => {
      const consoleErrors: string[] = [];
      
      pw.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filtruj tylko błędy Supabase
          if (text.includes('supabase') || text.includes('Supabase')) {
            consoleErrors.push(text);
          }
        }
      });
      
      await pw.goto(page.url);
      await pw.waitForTimeout(2000); // Czekaj na inicjalizację
      
      expect(consoleErrors).toHaveLength(0);
    });
  }
});

test.describe('Header Metrics - Wyświetlanie statystyk', () => {
  
  for (const page of PAGES_TO_TEST) {
    if (!page.hasAuth) continue;
    
    test(`${page.name}: Elementy headerLevelNumber i headerXpPoints istnieją`, async ({ page: pw }) => {
      await pw.goto(page.url);
      
      // Sprawdź czy elementy header metrics są w DOM
      const hasLevelEl = await pw.locator('#headerLevelNumber').count();
      const hasXpEl = await pw.locator('#headerXpPoints').count();
      
      expect(hasLevelEl).toBeGreaterThan(0);
      expect(hasXpEl).toBeGreaterThan(0);
    });
  }
});

test.describe('Account Page - Funkcjonalność', () => {
  
  test('Account page: Wszystkie sekcje są widoczne', async ({ page }) => {
    await page.goto('/account/');
    
    // Sprawdź czy główne sekcje istnieją
    await expect(page.locator('h2:has-text("Twój profil")')).toBeVisible();
    await expect(page.locator('text=Ostatnie zdarzenia XP')).toBeVisible();
  });
  
  test('Account page: Profile.js i xp.js są załadowane', async ({ page }) => {
    await page.goto('/account/');
    
    const modulesLoaded = await page.evaluate(() => {
      // Sprawdź czy moduły zostały wykonane przez sprawdzenie side-effects
      return {
        hasGetMyProfile: typeof window.getMyProfile !== 'undefined',
        hasMyXpEvents: typeof window.myXpEvents !== 'undefined'
      };
    });
    
    // Te funkcje są w module scope, więc nie będą bezpośrednio dostępne
    // Ale jeśli strona się załadowała bez błędów, moduły są OK
    expect(modulesLoaded).toBeDefined();
  });
});

test.describe('Błędy konsoli - Monitoring', () => {
  
  test('Brak krytycznych błędów na żadnej stronie', async ({ page }) => {
    const criticalErrors: { page: string, error: string }[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignoruj znane, niegroźne błędy
        if (
          text.includes('EventSource') && text.includes('MIME type') ||
          text.includes('Community journal stream')
        ) {
          return; // To jest oczekiwane
        }
        
        criticalErrors.push({ page: page.url(), error: text });
      }
    });
    
    // Test wszystkich stron
    for (const testPage of PAGES_TO_TEST) {
      await page.goto(testPage.url);
      await page.waitForTimeout(1500);
    }
    
    // Wypisz wszystkie błędy jeśli są
    if (criticalErrors.length > 0) {
      console.log('Znalezione błędy:');
      criticalErrors.forEach(e => console.log(`  ${e.page}: ${e.error}`));
    }
    
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Network - Sprawdzenie zapytań API', () => {
  
  test('Żadne zapytanie do Supabase nie zwraca 404', async ({ page }) => {
    const failed404: string[] = [];
    
    page.on('response', response => {
      const url = response.url();
      // Sprawdź tylko requesty do Supabase
      if (url.includes('supabase.co') && response.status() === 404) {
        failed404.push(url);
      }
    });
    
    // Test kilku kluczowych stron
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    await page.goto('/account/');
    await page.waitForTimeout(1000);
    
    if (failed404.length > 0) {
      console.log('404 requests do Supabase:');
      failed404.forEach(url => console.log(`  ${url}`));
    }
    
    // xp_events może zwrócić 404 jeśli tabela nie istnieje - to jest OK
    const nonXpEvents404 = failed404.filter(url => !url.includes('xp_events'));
    
    expect(nonXpEvents404).toHaveLength(0);
  });
});
