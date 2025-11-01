#!/bin/bash

# ==============================================
# Instalacja Systemu Ocen POI dla CyprusEye
# ==============================================

echo "🚀 Instalacja systemu ocen i społeczności dla POI..."
echo ""

# Kolory
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Sprawdź czy npm jest zainstalowany
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ NPM nie jest zainstalowany. Zainstaluj Node.js najpierw.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Instalowanie zależności Supabase...${NC}"
npm install @supabase/supabase-js@^2.39.0
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Błąd podczas instalacji @supabase/supabase-js${NC}"
    exit 1
fi
echo -e "${GREEN}✅ @supabase/supabase-js zainstalowany${NC}"

echo -e "${YELLOW}📦 Instalowanie AsyncStorage...${NC}"
npm install @react-native-async-storage/async-storage@^1.21.0
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Błąd podczas instalacji AsyncStorage${NC}"
    exit 1
fi
echo -e "${GREEN}✅ @react-native-async-storage/async-storage zainstalowany${NC}"

echo -e "${YELLOW}📦 Instalowanie URL Polyfill...${NC}"
npm install react-native-url-polyfill@^2.0.0
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Błąd podczas instalacji URL Polyfill${NC}"
    exit 1
fi
echo -e "${GREEN}✅ react-native-url-polyfill zainstalowany${NC}"

echo ""
echo -e "${GREEN}🎉 Wszystkie zależności zainstalowane pomyślnie!${NC}"
echo ""
echo -e "${YELLOW}⚠️  WAŻNE NASTĘPNE KROKI:${NC}"
echo ""
echo "1. 🗄️  Wykonaj SQL w Supabase:"
echo "   - Zaloguj się do Supabase Dashboard"
echo "   - Przejdź do SQL Editor"
echo "   - Wklej i wykonaj zawartość pliku: SUPABASE_POI_RATINGS_SETUP.sql"
echo ""
echo "2. 📱 Uruchom aplikację:"
echo "   - npm start  (lub expo start)"
echo ""
echo "3. 📖 Przeczytaj dokumentację:"
echo "   - POI_RATING_IMPLEMENTATION.md"
echo ""
echo -e "${GREEN}✅ System gotowy do użycia!${NC}"
echo ""
