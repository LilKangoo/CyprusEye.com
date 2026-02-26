#!/bin/bash
# Quick Navigation Test Script
# Tests that all header links exist and paths are correct

echo "🔍 Testing Header & Navigation Links..."
echo ""

PAGES=(
  "index.html"
  "achievements.html"
  "kupon.html"
  "vip.html"
  "packing.html"
  "tasks.html"
  "community.html"
  "car.html"
)

ERRORS=0

# Check if all main pages exist
echo "✓ Checking main pages exist..."
for page in "${PAGES[@]}"; do
  if [ ! -f "$page" ]; then
    echo "  ❌ Missing: $page"
    ((ERRORS++))
  fi
done

# Check for leading slashes in HTML files (should be none)
echo ""
echo "✓ Checking for leading slash issues..."
for page in "${PAGES[@]}"; do
  if [ -f "$page" ]; then
    # Check for bad patterns like href="/index.html" or src="/assets"
    BAD_PATHS=$(grep -n 'href="/\(index\|packing\|tasks\|vip\|achievements\|kupon\|community\|car-rental\)' "$page" || true)
    if [ ! -z "$BAD_PATHS" ]; then
      echo "  ⚠️  $page has leading slashes in page links"
      ((ERRORS++))
    fi
    
    BAD_ASSETS=$(grep -n 'src="/\(assets\|js\|css\)' "$page" || true)
    if [ ! -z "$BAD_ASSETS" ]; then
      echo "  ⚠️  $page has leading slashes in asset paths"
      ((ERRORS++))
    fi
  fi
done

# Check for header-metrics.css
echo ""
echo "✓ Checking header-metrics.css is included..."
for page in "${PAGES[@]}"; do
  if [ -f "$page" ]; then
    if ! grep -q "header-metrics.css" "$page"; then
      echo "  ❌ Missing header-metrics.css: $page"
      ((ERRORS++))
    fi
  fi
done

# Check for standard header structure
echo ""
echo "✓ Checking standard header structure..."
for page in "${PAGES[@]}"; do
  if [ -f "$page" ]; then
    if ! grep -q 'class="header-top"' "$page"; then
      echo "  ❌ Missing header-top: $page"
      ((ERRORS++))
    fi
    if ! grep -q 'class="header-auth-controls"' "$page"; then
      echo "  ❌ Missing header-auth-controls: $page"
      ((ERRORS++))
    fi
    if ! grep -q 'class="header-actions"' "$page"; then
      echo "  ❌ Missing header-actions: $page"
      ((ERRORS++))
    fi
    # achievements.html has special profile layout, skip user-stats-section check
    if [ "$page" != "achievements.html" ]; then
      if ! grep -q 'class="user-stats-section"' "$page"; then
        echo "  ❌ Missing user-stats-section: $page"
        ((ERRORS++))
      fi
    fi
    if ! grep -q 'class="header-tabs"' "$page"; then
      echo "  ❌ Missing header-tabs: $page"
      ((ERRORS++))
    fi
  fi
done

# Summary
echo ""
echo "================================"
if [ $ERRORS -eq 0 ]; then
  echo "✅ ALL TESTS PASSED!"
  echo "Navigation structure is correct."
else
  echo "❌ FOUND $ERRORS ISSUES"
  echo "Please review the errors above."
fi
echo "================================"

exit $ERRORS
