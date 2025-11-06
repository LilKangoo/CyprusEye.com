#!/bin/bash

# =====================================================
# NAPRAWA MARKERÓW - AUTOMATYCZNY SKRYPT
# =====================================================

echo "🎯 NAPRAWA MARKERÓW - Automatyczny Skrypt"
echo "=========================================="
echo ""

# Sprawdź czy jesteśmy w repo
if [ ! -d .git ]; then
    echo "❌ Błąd: To nie jest repo Git!"
    echo "Uruchom ten skrypt w folderze projektu."
    exit 1
fi

echo "📂 Folder: $(pwd)"
echo ""

# KROK 1: Backup starych plików
echo "📦 KROK 1: Backup starych plików..."

if [ -f "js/poi-loader.js" ]; then
    cp js/poi-loader.js js/poi-loader.OLD.js
    echo "✅ Backup: js/poi-loader.js → js/poi-loader.OLD.js"
fi

if [ -f "app-core.js" ]; then
    cp app-core.js app-core.OLD.js
    echo "✅ Backup: app-core.js → app-core.OLD.js"
fi

echo ""

# KROK 2: Zamiana na V2
echo "🔄 KROK 2: Zamiana na V2..."

if [ -f "js/poi-loader-v2.js" ]; then
    cp js/poi-loader-v2.js js/poi-loader.js
    echo "✅ Skopiowano: poi-loader-v2.js → poi-loader.js"
else
    echo "❌ BŁĄD: Brak pliku js/poi-loader-v2.js!"
    echo "→ Plik musi zostać utworzony najpierw"
    exit 1
fi

if [ -f "app-core-v2.js" ]; then
    cp app-core-v2.js app-core.js
    echo "✅ Skopiowano: app-core-v2.js → app-core.js"
else
    echo "❌ BŁĄD: Brak pliku app-core-v2.js!"
    echo "→ Plik musi zostać utworzony najpierw"
    exit 1
fi

echo ""

# KROK 3: Git Status
echo "📊 KROK 3: Sprawdzam zmiany..."
git status --short
echo ""

# KROK 4: Commit i Push
echo "💾 KROK 4: Commit i Push..."

git add .

commit_message="Fix: Używam poi-loader-v2 i app-core-v2 dla gwarantowanych markerów"
git commit -m "$commit_message"

if [ $? -ne 0 ]; then
    echo "❌ Błąd podczas commita!"
    echo "→ Może nie było zmian lub inny problem"
    exit 1
fi

echo ""
echo "🚀 Wysyłam na GitHub..."

current_branch=$(git branch --show-current)
git push origin "$current_branch"

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Błąd podczas push!"
    echo ""
    echo "Spróbuj ręcznie:"
    echo "  git pull origin $current_branch"
    echo "  git push origin $current_branch"
    exit 1
fi

# SUKCES
echo ""
echo "✅ ================================"
echo "✅  NAPRAWA ZAKOŃCZONA SUKCESEM!"
echo "✅ ================================"
echo ""
echo "📡 Netlify automatycznie wdroży za ~2 minuty"
echo ""
echo "🔗 Sprawdź status deploy:"
echo "   https://app.netlify.com"
echo ""
echo "🌐 Strona produkcyjna:"
echo "   https://cypruseye.com"
echo ""
echo "⏰ Po wdrożeniu (za 2 min):"
echo "   1. Otwórz: https://cypruseye.com"
echo "   2. Wyczyść cache: Cmd+Shift+Delete"
echo "   3. Hard refresh: Cmd+Shift+R"
echo "   4. Otwórz konsolę: Cmd+Option+J"
echo "   5. Sprawdź logi - powinny być V2"
echo "   6. Sprawdź mapę - powinny być markery 📍"
echo ""
echo "🔍 Oczekiwane logi:"
echo "   🔵 POI Loader V2 - START"
echo "   ✅ Pobrano X POI z Supabase"
echo "   🔵 App Core V2 - START"
echo "   📍 Dodaję markery..."
echo "   ✅ Dodano X markerów"
echo ""
echo "📚 Jeśli coś nie działa:"
echo "   1. Sprawdź bazę: Uruchom CHECK_DATABASE.sql"
echo "   2. Zobacz logi w konsoli"
echo "   3. Przeczytaj: NAPRAW_MARKERY_FINAL.md"
echo ""
echo "🎉 Gotowe!"
