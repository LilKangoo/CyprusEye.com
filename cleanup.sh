#!/bin/bash

# =====================================================
# CLEANUP - Usuń stare pliki backupowe
# =====================================================

echo "🧹 Cleanup starych plików..."
echo ""

# Stworz folder dla archiwum
mkdir -p DELETED_BACKUPS

# Przenieś stare pliki
echo "📦 Archiwizuję stare pliki..."

if [ -f "app-core.OLD.js" ]; then
    mv app-core.OLD.js DELETED_BACKUPS/
    echo "✅ app-core.OLD.js → DELETED_BACKUPS/"
fi

if [ -f "app-core-v2.js" ]; then
    mv app-core-v2.js DELETED_BACKUPS/
    echo "✅ app-core-v2.js → DELETED_BACKUPS/"
fi

if [ -f "js/poi-loader.OLD.js" ]; then
    mv js/poi-loader.OLD.js DELETED_BACKUPS/
    echo "✅ js/poi-loader.OLD.js → DELETED_BACKUPS/"
fi

if [ -f "js/poi-loader-v2.js" ]; then
    mv js/poi-loader-v2.js DELETED_BACKUPS/
    echo "✅ js/poi-loader-v2.js → DELETED_BACKUPS/"
fi

echo ""
echo "✅ Cleanup zakończony!"
echo ""
echo "📊 Pliki zarchiwizowane w: DELETED_BACKUPS/"
echo ""
echo "🔍 Sprawdź git status:"
git status --short
echo ""
