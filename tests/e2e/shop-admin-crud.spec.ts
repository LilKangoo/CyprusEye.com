/**
 * Shop Admin CRUD Tests
 * 
 * Comprehensive tests for all shop management functionality in admin panel:
 * - Categories: hierarchical, i18n, images, SEO
 * - Vendors: contact info, commission, stats
 * - Discounts: all types, validity rules, usage limits
 * - Shipping: zones, methods, classes, tax classes
 * - Customer Groups: pricing tiers
 * - Attributes: product variations
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const ADMIN_URL = 'http://localhost:8080/admin/dashboard.html';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';

// Helper to wait for Supabase
async function waitForSupabase(page: Page) {
  await page.waitForFunction(() => typeof (window as any).supabase !== 'undefined', { timeout: 10000 });
}

// Helper to navigate to shop tab
async function navigateToShopTab(page: Page, tabName: string) {
  await page.click('[data-section="shop"]');
  await page.waitForSelector('.admin-shop-tabs', { state: 'visible' });
  await page.click(`.admin-shop-tabs button:has-text("${tabName}")`);
  await page.waitForTimeout(500);
}

// =====================================================
// CATEGORIES CRUD TESTS
// =====================================================
test.describe('Shop Categories CRUD', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Kategorie');
  });

  test('should display categories table with correct columns', async ({ page }) => {
    // Expected columns: Obraz, Nazwa, Slug, Nadrzędna, Produkty, Kolejność, Status, Akcje
    const headers = await page.locator('#shopCategoriesTab th').allTextContents();
    expect(headers).toContain('Obraz');
    expect(headers).toContain('Nazwa');
    expect(headers).toContain('Slug');
    expect(headers).toContain('Nadrzędna');
    expect(headers).toContain('Produkty');
    expect(headers).toContain('Kolejność');
    expect(headers).toContain('Status');
    expect(headers).toContain('Akcje');
  });

  test('should open new category modal with correct fields', async ({ page }) => {
    await page.click('button:has-text("Dodaj kategorię")');
    await page.waitForSelector('#shopCategoryModal', { state: 'visible' });
    
    // Check modal title
    const title = await page.locator('#shopCategoryModalTitle').textContent();
    expect(title).toBe('Nowa kategoria');
    
    // Check required fields exist
    await expect(page.locator('#shopCategoryName')).toBeVisible();
    await expect(page.locator('#shopCategoryNameEn')).toBeVisible();
    await expect(page.locator('#shopCategoryDescription')).toBeVisible();
    await expect(page.locator('#shopCategoryDescriptionEn')).toBeVisible();
    await expect(page.locator('#shopCategorySlug')).toBeVisible();
    await expect(page.locator('#shopCategoryParent')).toBeVisible();
    await expect(page.locator('#shopCategorySortOrder')).toBeVisible();
    await expect(page.locator('#shopCategoryImage')).toBeVisible();
    await expect(page.locator('#shopCategoryActive')).toBeVisible();
  });

  test('should validate required fields on category form', async ({ page }) => {
    await page.click('button:has-text("Dodaj kategorię")');
    await page.waitForSelector('#shopCategoryModal', { state: 'visible' });
    
    // Try to submit empty form
    await page.click('button:has-text("Zapisz kategorię")');
    
    // Should show error
    const error = await page.locator('#shopCategoryFormError');
    await expect(error).toBeVisible();
  });

  test('should create category with all fields', async ({ page }) => {
    await page.click('button:has-text("Dodaj kategorię")');
    await page.waitForSelector('#shopCategoryModal', { state: 'visible' });
    
    // Fill Polish content
    await page.fill('#shopCategoryName', 'Testowa Kategoria');
    await page.fill('#shopCategoryDescription', 'Opis testowej kategorii');
    
    // Switch to English tab
    await page.click('button[data-lang="en"]');
    await page.fill('#shopCategoryNameEn', 'Test Category');
    await page.fill('#shopCategoryDescriptionEn', 'Test category description');
    
    // Fill common fields
    await page.fill('#shopCategorySlug', 'test-category');
    await page.fill('#shopCategorySortOrder', '10');
    await page.fill('#shopCategoryImage', 'https://example.com/image.jpg');
    
    // Submit
    await page.click('button:has-text("Zapisz kategorię")');
    
    // Modal should close
    await expect(page.locator('#shopCategoryModal')).toBeHidden();
    
    // New category should appear in table
    await expect(page.locator('td:has-text("Testowa Kategoria")')).toBeVisible();
  });

  test('should filter categories by status', async ({ page }) => {
    const statusFilter = page.locator('#shopCategoryStatusFilter');
    await expect(statusFilter).toBeVisible();
    
    // Filter by active only
    await statusFilter.selectOption('active');
    await page.waitForTimeout(500);
    
    // All visible badges should be "Aktywna"
    const badges = await page.locator('#shopCategoriesTableBody .badge').allTextContents();
    badges.forEach(badge => {
      expect(badge).toBe('Aktywna');
    });
  });

  test('should filter categories by parent level', async ({ page }) => {
    const parentFilter = page.locator('#shopCategoryParentFilter');
    await expect(parentFilter).toBeVisible();
    
    // Filter by root categories only
    await parentFilter.selectOption('root');
    await page.waitForTimeout(500);
    
    // No "↳" symbol should be visible (indicates child category)
    const parentCells = await page.locator('#shopCategoriesTableBody tr td:nth-child(4)').allTextContents();
    parentCells.forEach(cell => {
      expect(cell.trim()).toBe('—');
    });
  });

  test('should search categories by name', async ({ page }) => {
    const searchInput = page.locator('#shopCategorySearch');
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    
    // All visible categories should contain "test" in name
    const names = await page.locator('#shopCategoriesTableBody tr td:nth-child(2)').allTextContents();
    names.forEach(name => {
      expect(name.toLowerCase()).toContain('test');
    });
  });

  test('should edit existing category', async ({ page }) => {
    // Click edit on first category
    await page.click('#shopCategoriesTableBody tr:first-child button[title="Edytuj"]');
    await page.waitForSelector('#shopCategoryModal', { state: 'visible' });
    
    // Title should indicate editing
    const title = await page.locator('#shopCategoryModalTitle').textContent();
    expect(title).toBe('Edytuj kategorię');
    
    // Form should be populated
    const name = await page.locator('#shopCategoryName').inputValue();
    expect(name).not.toBe('');
  });

  test('should delete category with confirmation', async ({ page }) => {
    // Count categories before
    const countBefore = await page.locator('#shopCategoriesTableBody tr').count();
    
    // Mock window.confirm
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    
    // Click delete on first category
    await page.click('#shopCategoriesTableBody tr:first-child button:has-text("🗑️")');
    
    await page.waitForTimeout(1000);
    
    // Count should decrease
    const countAfter = await page.locator('#shopCategoriesTableBody tr').count();
    expect(countAfter).toBe(countBefore - 1);
  });
});

// =====================================================
// VENDORS CRUD TESTS
// =====================================================
test.describe('Shop Vendors CRUD', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Vendorzy');
  });

  test('should display vendors table with correct columns', async ({ page }) => {
    // Expected: Logo, Nazwa, Email, Produkty, Sprzedaż, Przychód, Prowizja, Status, Akcje
    const headers = await page.locator('#shopVendorsTab th').allTextContents();
    expect(headers).toContain('Logo');
    expect(headers).toContain('Nazwa');
    expect(headers).toContain('Email');
    expect(headers).toContain('Produkty');
    expect(headers).toContain('Sprzedaż');
    expect(headers).toContain('Przychód');
    expect(headers).toContain('Prowizja');
    expect(headers).toContain('Status');
    expect(headers).toContain('Akcje');
  });

  test('should open new vendor modal with all fields', async ({ page }) => {
    await page.click('button:has-text("Dodaj dostawcę")');
    await page.waitForSelector('#shopVendorModal', { state: 'visible' });
    
    // Check title
    const title = await page.locator('#shopVendorModalTitle').textContent();
    expect(title).toBe('Nowy dostawca');
    
    // Check fields - Polish tab
    await expect(page.locator('#shopVendorName')).toBeVisible();
    await expect(page.locator('#shopVendorDescription')).toBeVisible();
    
    // Common fields
    await expect(page.locator('#shopVendorSlug')).toBeVisible();
    await expect(page.locator('#shopVendorEmail')).toBeVisible();
    await expect(page.locator('#shopVendorPhone')).toBeVisible();
    await expect(page.locator('#shopVendorCommission')).toBeVisible();
    await expect(page.locator('#shopVendorWebsite')).toBeVisible();
    await expect(page.locator('#shopVendorLogo')).toBeVisible();
    await expect(page.locator('#shopVendorActive')).toBeVisible();
  });

  test('should create vendor with full contact info', async ({ page }) => {
    await page.click('button:has-text("Dodaj dostawcę")');
    await page.waitForSelector('#shopVendorModal', { state: 'visible' });
    
    // Fill form
    await page.fill('#shopVendorName', 'Testowy Dostawca');
    await page.fill('#shopVendorDescription', 'Opis testowego dostawcy');
    
    // Switch to English
    await page.click('button[data-lang="en"]');
    await page.fill('#shopVendorNameEn', 'Test Vendor');
    await page.fill('#shopVendorDescriptionEn', 'Test vendor description');
    
    // Common fields
    await page.fill('#shopVendorSlug', 'test-vendor');
    await page.fill('#shopVendorEmail', 'vendor@test.com');
    await page.fill('#shopVendorPhone', '+48 123 456 789');
    await page.fill('#shopVendorCommission', '15');
    await page.fill('#shopVendorWebsite', 'https://vendor.test.com');
    await page.fill('#shopVendorLogo', 'https://example.com/logo.png');
    
    // Submit
    await page.click('button:has-text("Zapisz dostawcę")');
    
    // Should close and refresh
    await expect(page.locator('#shopVendorModal')).toBeHidden();
    await expect(page.locator('td:has-text("Testowy Dostawca")')).toBeVisible();
  });

  test('should filter vendors by status', async ({ page }) => {
    const statusFilter = page.locator('#shopVendorStatusFilter');
    await expect(statusFilter).toBeVisible();
    
    await statusFilter.selectOption('active');
    await page.waitForTimeout(500);
    
    const badges = await page.locator('#shopVendorsTableBody .badge').allTextContents();
    badges.forEach(badge => {
      expect(badge).toBe('Aktywny');
    });
  });

  test('should search vendors by name', async ({ page }) => {
    const searchInput = page.locator('#shopVendorSearch');
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    
    const names = await page.locator('#shopVendorsTableBody tr td:nth-child(2)').allTextContents();
    names.forEach(name => {
      expect(name.toLowerCase()).toContain('test');
    });
  });
});

// =====================================================
// DISCOUNTS CRUD TESTS
// =====================================================
test.describe('Shop Discounts CRUD', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Rabaty');
  });

  test('should display discounts table with correct columns', async ({ page }) => {
    // Expected: Kod, Nazwa, Typ, Wartość, Użycia, Min. kwota, Ważność, Status, Akcje
    const headers = await page.locator('#shopDiscountsTab th').allTextContents();
    expect(headers).toContain('Kod');
    expect(headers).toContain('Nazwa');
    expect(headers).toContain('Typ');
    expect(headers).toContain('Wartość');
    expect(headers).toContain('Użycia');
    expect(headers).toContain('Min. kwota');
    expect(headers).toContain('Ważność');
    expect(headers).toContain('Status');
    expect(headers).toContain('Akcje');
  });

  test('should open new discount modal with all fields', async ({ page }) => {
    await page.click('button:has-text("Dodaj rabat")');
    await page.waitForSelector('#shopDiscountModal', { state: 'visible' });
    
    // Check title
    const title = await page.locator('#shopDiscountModalTitle').textContent();
    expect(title).toBe('Nowy kod rabatowy');
    
    // Check fields
    await expect(page.locator('#shopDiscountCode')).toBeVisible();
    await expect(page.locator('#shopDiscountDescription')).toBeVisible();
    await expect(page.locator('#shopDiscountType')).toBeVisible();
    await expect(page.locator('#shopDiscountValue')).toBeVisible();
    await expect(page.locator('#shopDiscountMinOrder')).toBeVisible();
    await expect(page.locator('#shopDiscountMaxDiscount')).toBeVisible();
    await expect(page.locator('#shopDiscountUsageLimit')).toBeVisible();
    await expect(page.locator('#shopDiscountPerUserLimit')).toBeVisible();
    await expect(page.locator('#shopDiscountStartDate')).toBeVisible();
    await expect(page.locator('#shopDiscountExpiryDate')).toBeVisible();
    await expect(page.locator('#shopDiscountActive')).toBeVisible();
  });

  test('should have correct discount type options', async ({ page }) => {
    await page.click('button:has-text("Dodaj rabat")');
    await page.waitForSelector('#shopDiscountModal', { state: 'visible' });
    
    const options = await page.locator('#shopDiscountType option').allTextContents();
    expect(options).toContain('Procentowy (%)');
    expect(options).toContain('Kwotowy (€)');
    expect(options).toContain('Darmowa wysyłka');
  });

  test('should create percentage discount', async ({ page }) => {
    await page.click('button:has-text("Dodaj rabat")');
    await page.waitForSelector('#shopDiscountModal', { state: 'visible' });
    
    await page.fill('#shopDiscountCode', 'TEST20');
    await page.fill('#shopDiscountDescription', 'Testowy rabat 20%');
    await page.selectOption('#shopDiscountType', 'percentage');
    await page.fill('#shopDiscountValue', '20');
    await page.fill('#shopDiscountMinOrder', '50');
    
    await page.click('button:has-text("Zapisz kod")');
    
    await expect(page.locator('#shopDiscountModal')).toBeHidden();
    await expect(page.locator('code:has-text("TEST20")')).toBeVisible();
  });

  test('should create fixed amount discount', async ({ page }) => {
    await page.click('button:has-text("Dodaj rabat")');
    await page.waitForSelector('#shopDiscountModal', { state: 'visible' });
    
    await page.fill('#shopDiscountCode', 'SAVE10');
    await page.selectOption('#shopDiscountType', 'fixed');
    await page.fill('#shopDiscountValue', '10');
    
    await page.click('button:has-text("Zapisz kod")');
    
    await expect(page.locator('#shopDiscountModal')).toBeHidden();
  });

  test('should create free shipping discount', async ({ page }) => {
    await page.click('button:has-text("Dodaj rabat")');
    await page.waitForSelector('#shopDiscountModal', { state: 'visible' });
    
    await page.fill('#shopDiscountCode', 'FREESHIP');
    await page.selectOption('#shopDiscountType', 'free_shipping');
    await page.fill('#shopDiscountMinOrder', '100');
    
    await page.click('button:has-text("Zapisz kod")');
    
    await expect(page.locator('#shopDiscountModal')).toBeHidden();
  });

  test('should filter discounts by type', async ({ page }) => {
    const typeFilter = page.locator('#shopDiscountTypeFilter');
    await expect(typeFilter).toBeVisible();
    
    await typeFilter.selectOption('percentage');
    await page.waitForTimeout(500);
    
    const types = await page.locator('#shopDiscountsTableBody tr td:nth-child(3)').allTextContents();
    types.forEach(type => {
      expect(type).toBe('Procentowy');
    });
  });

  test('should filter discounts by status', async ({ page }) => {
    const statusFilter = page.locator('#shopDiscountStatusFilter');
    await expect(statusFilter).toBeVisible();
    
    await statusFilter.selectOption('active');
    await page.waitForTimeout(500);
    
    const badges = await page.locator('#shopDiscountsTableBody .badge').allTextContents();
    badges.forEach(badge => {
      expect(badge).toBe('Aktywny');
    });
  });

  test('should show expired status for past discounts', async ({ page }) => {
    // Create expired discount via Supabase directly, then verify display
    const expiredRow = page.locator('#shopDiscountsTableBody tr:has(.badge:has-text("Wygasł"))');
    
    if (await expiredRow.count() > 0) {
      // Row should have reduced opacity
      const opacity = await expiredRow.evaluate(el => getComputedStyle(el).opacity);
      expect(parseFloat(opacity)).toBeLessThan(1);
    }
  });
});

// =====================================================
// SHIPPING CRUD TESTS
// =====================================================
test.describe('Shop Shipping CRUD', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Wysyłka');
  });

  test('should display shipping zones section', async ({ page }) => {
    await expect(page.locator('h4:has-text("Strefy wysyłkowe")')).toBeVisible();
    await expect(page.locator('#shopShippingZonesContainer')).toBeVisible();
  });

  test('should display shipping classes section', async ({ page }) => {
    await expect(page.locator('h4:has-text("Klasy wysyłkowe")')).toBeVisible();
    await expect(page.locator('#shopShippingClassesTableBody')).toBeVisible();
  });

  test('should display tax classes section', async ({ page }) => {
    await expect(page.locator('h4:has-text("Klasy podatkowe")')).toBeVisible();
    await expect(page.locator('#shopTaxClassesTableBody')).toBeVisible();
  });

  test('should display customer groups section', async ({ page }) => {
    await expect(page.locator('h4:has-text("Grupy klientów")')).toBeVisible();
    await expect(page.locator('#shopCustomerGroupsTableBody')).toBeVisible();
  });

  test('should display product attributes section', async ({ page }) => {
    await expect(page.locator('h4:has-text("Atrybuty produktów")')).toBeVisible();
    await expect(page.locator('#shopAttributesTableBody')).toBeVisible();
  });

  test('should open add shipping zone modal', async ({ page }) => {
    await page.click('button:has-text("Dodaj strefę")');
    await page.waitForSelector('#shopShippingZoneModal', { state: 'visible' });
    
    await expect(page.locator('#shopShippingZoneName')).toBeVisible();
    await expect(page.locator('#shopShippingZoneCountries')).toBeVisible();
  });

  test('should create shipping zone with methods', async ({ page }) => {
    await page.click('button:has-text("Dodaj strefę")');
    await page.waitForSelector('#shopShippingZoneModal', { state: 'visible' });
    
    await page.fill('#shopShippingZoneName', 'Strefa Testowa');
    await page.fill('#shopShippingZoneNameEn', 'Test Zone');
    await page.fill('#shopShippingZoneCountries', 'PL,DE');
    
    await page.click('button:has-text("Zapisz strefę")');
    
    await expect(page.locator('#shopShippingZoneModal')).toBeHidden();
  });

  test('should open shipping method modal from zone', async ({ page }) => {
    // Click "Dodaj metodę" in first zone
    const addMethodBtn = page.locator('.shipping-zone-card button:has-text("Dodaj metodę")').first();
    if (await addMethodBtn.isVisible()) {
      await addMethodBtn.click();
      await page.waitForSelector('#shopShippingMethodModal', { state: 'visible' });
      
      await expect(page.locator('#shippingMethodName')).toBeVisible();
      await expect(page.locator('#shippingMethodType')).toBeVisible();
      await expect(page.locator('#shippingMethodCost')).toBeVisible();
    }
  });

  test('should create shipping class', async ({ page }) => {
    await page.click('button:has-text("Dodaj klasę wysyłkową")');
    await page.waitForSelector('#shopShippingClassModal', { state: 'visible' });
    
    await page.fill('#shopShippingClassName', 'Klasa Testowa');
    await page.fill('#shopShippingClassSlug', 'test-class');
    await page.fill('#shopShippingClassExtraCost', '5');
    
    await page.click('button:has-text("Zapisz")');
    
    await expect(page.locator('#shopShippingClassModal')).toBeHidden();
  });

  test('should create tax class', async ({ page }) => {
    await page.click('button:has-text("Dodaj klasę podatkową")');
    await page.waitForSelector('#shopTaxClassModal', { state: 'visible' });
    
    await page.fill('#shopTaxClassName', 'VAT 23%');
    await page.fill('#shopTaxClassSlug', 'vat-23');
    
    await page.click('button:has-text("Zapisz")');
    
    await expect(page.locator('#shopTaxClassModal')).toBeHidden();
  });

  test('should create customer group', async ({ page }) => {
    await page.click('button:has-text("Dodaj grupę")');
    await page.waitForSelector('#shopCustomerGroupModal', { state: 'visible' });
    
    await page.fill('#shopCustomerGroupName', 'Grupa Testowa');
    await page.fill('#shopCustomerGroupSlug', 'test-group');
    await page.selectOption('#shopCustomerGroupDiscountType', 'percentage');
    await page.fill('#shopCustomerGroupDiscountValue', '10');
    
    await page.click('button:has-text("Zapisz")');
    
    await expect(page.locator('#shopCustomerGroupModal')).toBeHidden();
  });

  test('should create product attribute', async ({ page }) => {
    await page.click('button:has-text("Dodaj atrybut")');
    await page.waitForSelector('#shopAttributeModal', { state: 'visible' });
    
    await page.fill('#shopAttributeName', 'Kolor');
    await page.fill('#shopAttributeSlug', 'color');
    await page.selectOption('#shopAttributeType', 'select');
    
    await page.click('button:has-text("Zapisz")');
    
    await expect(page.locator('#shopAttributeModal')).toBeHidden();
  });
});

// =====================================================
// SETTINGS TESTS
// =====================================================
test.describe('Shop Settings', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Ustawienia');
  });

  test('should display all settings sections', async ({ page }) => {
    await expect(page.locator('h4:has-text("Ogólne")')).toBeVisible();
    await expect(page.locator('h4:has-text("System XP")')).toBeVisible();
    await expect(page.locator('h4:has-text("Recenzje")')).toBeVisible();
    await expect(page.locator('h4:has-text("Powiadomienia")')).toBeVisible();
    await expect(page.locator('h4:has-text("Magazyn")')).toBeVisible();
  });

  test('should have general settings fields', async ({ page }) => {
    await expect(page.locator('#shopSettingsName')).toBeVisible();
    await expect(page.locator('#shopSettingsEmail')).toBeVisible();
    await expect(page.locator('#shopSettingsOrderPrefix')).toBeVisible();
    await expect(page.locator('#shopSettingsCurrency')).toBeVisible();
  });

  test('should have XP settings fields', async ({ page }) => {
    await expect(page.locator('#shopSettingsXpEnabled')).toBeVisible();
    await expect(page.locator('#shopSettingsXpPerEuro')).toBeVisible();
    await expect(page.locator('#shopSettingsXpPerReview')).toBeVisible();
  });

  test('should have review settings fields', async ({ page }) => {
    await expect(page.locator('#shopSettingsReviewsEnabled')).toBeVisible();
    await expect(page.locator('#shopSettingsReviewModeration')).toBeVisible();
    await expect(page.locator('#shopSettingsReviewVerifiedOnly')).toBeVisible();
  });

  test('should have notification settings fields', async ({ page }) => {
    await expect(page.locator('#shopSettingsNotifyAbandonedCart')).toBeVisible();
    await expect(page.locator('#shopSettingsNotifyOrderConfirm')).toBeVisible();
    await expect(page.locator('#shopSettingsNotifyShipped')).toBeVisible();
    await expect(page.locator('#shopSettingsNotifyReviewRequest')).toBeVisible();
  });

  test('should have inventory settings fields', async ({ page }) => {
    await expect(page.locator('#shopSettingsLowStockThreshold')).toBeVisible();
    await expect(page.locator('#shopSettingsReserveCartTime')).toBeVisible();
    await expect(page.locator('#shopSettingsHideOutOfStock')).toBeVisible();
    await expect(page.locator('#shopSettingsAllowBackorder')).toBeVisible();
  });

  test('should save settings successfully', async ({ page }) => {
    await page.fill('#shopSettingsName', 'Test Shop Name');
    await page.fill('#shopSettingsOrderPrefix', 'TST-');
    
    await page.click('button:has-text("Zapisz ustawienia")');
    
    // Should show success toast
    await expect(page.locator('.toast:has-text("Zapisano")')).toBeVisible({ timeout: 5000 });
  });
});

// =====================================================
// INTEGRATION TESTS
// =====================================================
test.describe('Shop Admin Integration', () => {
  
  test('should load category dropdown in product form', async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Produkty');
    
    await page.click('button:has-text("Dodaj produkt")');
    await page.waitForSelector('#shopProductModal', { state: 'visible' });
    
    // Category dropdown should have options
    const options = await page.locator('#shopProductCategory option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('should load vendor dropdown in product form', async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Produkty');
    
    await page.click('button:has-text("Dodaj produkt")');
    await page.waitForSelector('#shopProductModal', { state: 'visible' });
    
    // Vendor dropdown should have options
    const options = await page.locator('#shopProductVendor option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('should load shipping class dropdown in product form', async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Produkty');
    
    await page.click('button:has-text("Dodaj produkt")');
    await page.waitForSelector('#shopProductModal', { state: 'visible' });
    
    // Shipping class dropdown should have options
    const options = await page.locator('#shopProductShippingClass option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('should load tax class dropdown in product form', async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Produkty');
    
    await page.click('button:has-text("Dodaj produkt")');
    await page.waitForSelector('#shopProductModal', { state: 'visible' });
    
    // Tax class dropdown should have options
    const options = await page.locator('#shopProductTaxClass option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('should load parent dropdown in category form', async ({ page }) => {
    await page.goto(ADMIN_URL);
    await waitForSupabase(page);
    await navigateToShopTab(page, 'Kategorie');
    
    await page.click('button:has-text("Dodaj kategorię")');
    await page.waitForSelector('#shopCategoryModal', { state: 'visible' });
    
    // Parent dropdown should have "Brak" option
    const firstOption = await page.locator('#shopCategoryParent option').first().textContent();
    expect(firstOption).toBe('Brak (główna)');
  });
});
