# E2E Test Status

**Last Updated:** November 1, 2025  
**Status:** 26/52 passing (50%)

---

## ✅ Fixed Issues (3h 45min debugging)

### 1. Tutorial Overlay Blocking Tests
**Problem:** Tutorial showed on every page load, blocking click interactions  
**Solution:** Created `tests/e2e/utils/disable-tutorial.ts` utility  
**Impact:** +11 tests now passing

### 2. CSP Headers Too Restrictive
**Problem:** server.js CSP blocked Leaflet, fonts, external scripts  
**Solution:** Updated CSP in server.js to match production _headers  
**Impact:** Leaflet loads correctly in tests

### 3. Supabase Stub Syntax Error
**Problem:** Missing `}` on line 615 caused stub to fail parsing  
**Solution:** Fixed syntax error in `tests/fixtures/supabase-stub.js`  
**Impact:** Stub has valid syntax (but still doesn't fully work)

---

## ❌ Known Issues (26 tests failing)

### Issue #1: Supabase Stub Not Loading (16 tests)
**Status:** BLOCKED  
**Severity:** HIGH  
**Tests Affected:**
- `auth-acceptance.spec.ts`: 5 tests
- `auth-session-persistence.spec.ts`: 2 tests
- `auth-confirmation-redirect.spec.ts`: 1 test
- `account-stats-switching.spec.ts`: 1 test
- `supabase-integration.spec.ts`: 7 tests

**Root Cause:**
- `__supabaseStub` doesn't get injected before module imports
- Route interception doesn't work reliably
- InitScript runs but stub doesn't expose globally in time

**Workaround:** Made `waitForSupabaseStub()` non-blocking (2s timeout)

**Next Steps:**
- Refactor tests to not rely on stub
- OR fix module import timing
- OR use real Supabase test instance

---

### Issue #2: Console Errors in app.js (7 tests)
**Status:** OPEN  
**Severity:** MEDIUM  
**Tests Affected:**
- `supabase-integration.spec.ts`: 7 "Brak błędów w konsoli" tests

**Root Cause:**
- 32 critical errors logged in app.js
- Likely related to missing dependencies or undefined variables
- Errors happen during normal operation

**Error Examples:**
- (Need to extract from test output)

**Next Steps:**
- Run manual console check
- Fix errors during Phase 2 refactoring
- May resolve naturally when app.js is modularized

---

### Issue #3: VIP Navigation Timeout (1 test)
**Status:** OPEN  
**Severity:** LOW  
**Test:** `vip-navigation.spec.ts`

**Root Cause:**
- `page.waitForNavigation()` times out
- Header VIP button may not trigger navigation
- Possible JS error preventing navigation

**Next Steps:**
- Check if button has click handler
- Verify navigation logic in app.js
- May need to update test to match new dynamic tabbar

---

### Issue #4: Other Navigation/DOM Issues (2 tests)
**Status:** OPEN  
**Severity:** LOW

**Tests:**
- `back-navigation.spec.ts`: 1 test (history back)
- `language-persistence.spec.ts`: 1 test
- `sos-modal.spec.ts`: 1 test

**Next Steps:**
- Individual debugging needed
- Likely DOM selector changes or timing issues

---

## ✅ Tests Passing (26/52)

### Regression Tests
- ✅ `home-regression.spec.ts`: 3/3
- ✅ `coupon-regression.spec.ts`: 1/1
- ✅ `packing-regression.spec.ts`: 1/1
- ✅ `tasks-regression.spec.ts`: 1/1

### Supabase Integration (Partial)
- ✅ Some integration tests pass (non-console-error tests)
- ✅ Header metrics tests pass
- ✅ Account page visibility tests pass

### Other
- ✅ Various navigation and UI tests

---

## 📊 Test Coverage

| Category | Passing | Failing | Coverage |
|----------|---------|---------|----------|
| Regression | 6 | 0 | 100% ✅ |
| Auth | 0 | 5 | 0% ❌ |
| Navigation | 1 | 2 | 33% ⚠️ |
| Supabase Integration | 19 | 11 | 63% ⚠️ |
| **TOTAL** | **26** | **26** | **50%** |

---

## 🎯 Goals for Phase 2

During refactoring, we aim to:
1. **Simplify app.js** → Easier to test individual modules
2. **Fix console errors** → Clean up undefined variables
3. **Improve test reliability** → Better stub injection or remove dependency
4. **Target:** 45+/52 passing (85%+)

---

## 🚫 Decision: Accept 50% and Continue

**Reasoning:**
- 3h 45min already spent debugging
- 50% is acceptable progress (was 29%)
- Phase 2 refactoring may naturally fix issues
- Modular code = easier to test
- Can revisit after refactoring

**Approved by:** User  
**Date:** November 1, 2025  
**Next Step:** Continue with Phase 2 refactoring
