#!/bin/bash

# =====================================================
# DEPLOY SCRIPT - Wdróż zmiany na produkcję
# =====================================================

echo "🚀 Wdrażanie zmian na cypruseye.com..."
echo ""

# Sprawdź czy jesteśmy w repo git
if [ ! -d .git ]; then
    echo "❌ Błąd: To nie jest repo Git!"
    echo "Uruchom ten skrypt w folderze projektu."
    exit 1
fi

# Pokaż status
echo "📊 Status zmian:"
git status --short
echo ""

# Sprawdź czy są zmiany
if git diff-index --quiet HEAD --; then
    echo "✅ Brak zmian do wdrożenia."
    echo "Wszystko jest już na produkcji."
    exit 0
fi

# Pytaj o commit message
echo "📝 Podaj opis zmian (lub naciśnij Enter dla domyślnego):"
read -r commit_message

if [ -z "$commit_message" ]; then
    commit_message="Update: Auto-deploy $(date '+%Y-%m-%d %H:%M')"
fi

# Add wszystkie zmiany
echo ""
echo "📦 Dodawanie plików..."
git add .

# Commit
echo "💾 Tworzenie commita..."
git commit -m "$commit_message"

if [ $? -ne 0 ]; then
    echo "❌ Błąd podczas commita!"
    exit 1
fi

# Sprawdź branch
current_branch=$(git branch --show-current)
echo ""
echo "🌿 Obecny branch: $current_branch"

# Push
echo "🚀 Wysyłanie na GitHub..."
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

# Sukces!
echo ""
echo "✅ Zmiany wysłane na GitHub!"
echo ""
echo "📡 Netlify automatycznie wdroży za ~2 minuty"
echo ""
echo "🔗 Sprawdź status deploy:"
echo "   https://app.netlify.com"
echo ""
echo "🌐 Strona produkcyjna:"
echo "   https://cypruseye.com"
echo ""
echo "⏰ Po wdrożeniu:"
echo "   1. Wyczyść cache: Cmd+Shift+Delete"
echo "   2. Hard refresh: Cmd+Shift+R"
echo "   3. Sprawdź markery na mapie"
echo ""
echo "🎉 Gotowe!"
