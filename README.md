# CyprusExplorer (Expo + MapLibre)

Kompletny szkielet aplikacji Expo (TypeScript) z MapLibre, monitorowaniem geostref oraz listą punktów POI dla Cypru. Projekt jest gotowy do użycia z EAS (prebuild/dev client) i nie korzysta z płatnych SDK.

## Funkcje
- ✅ Interaktywna mapa MapLibre z kafelkami OSM/MapTiler i markerem bieżącej pozycji.
- ✅ Lokalne geostrefy (ENTER/EXIT) obsługiwane w tle z `expo-task-manager` oraz powiadomieniami lokalnymi.
- ✅ Lista POI (z `assets/pois.json`) z sortowaniem po dystansie i szybkim otwieraniem nawigacji.
- ✅ Ustawienia trybu tła, dokładności, minimalnego dystansu i klucza MapTiler zapisywanego w SecureStore.
- ✅ Hook `useLiveLocation` z filtracją „teleportów” i kontrolą zużycia baterii.

## Wymagania wstępne
- Node.js ≥ 18 oraz npm.
- Zainstalowane narzędzia Expo CLI (`npm install --global expo-cli`) oraz Xcode/Android Studio, jeżeli budujesz natywne binaria.

## Instalacja
```bash
npm install
```

## Konfiguracja mapy
1. Skopiuj plik `.env.example` do `.env`.
2. Ustaw `MAP_STYLE_URL` (np. własny styl MapLibre) **lub** wklej darmowy klucz MapTiler (`MAPTILER_KEY`).
3. Jeśli `.env` pozostanie puste, aplikacja użyje publicznego stylu demo `https://demotiles.maplibre.org/style.json`.
4. W aplikacji możesz wprowadzić/zmienić klucz również w ekranie **Ustawienia** – zapisujemy go w SecureStore i odświeżamy styl w locie.

> ℹ️ Darmowy plan MapTiler posiada limit zapytań (sprawdź aktualne limity na stronie MapTiler). Szanuj zasady fair use kafelków OSM – unikaj agresywnego odpytywania i cache’uj wyniki w produkcji.

## Uruchomienie
- Dev client / bundler:
  ```bash
  npm run start
  ```
- iOS (prebuild + simulator/device):
  ```bash
  npm run ios
  ```
- Android (prebuild + emulator/device):
  ```bash
  npm run android
  ```

> Aplikacja wykorzystuje moduły niedostępne w Expo Go (MapLibre, SecureStore w tle). Do testów używaj Expo Dev Client lub pełnego builda EAS.

## Jakość kodu i testy
- Lint: `npm run lint`
- TypeScript: `npm run typecheck`
- Testy jednostkowe: `npm test`

## EAS / prebuild
1. `cp .env.example .env` i uzupełnij wartości.
2. `expo prebuild` (lub `eas build --profile development`), aby wygenerować projekty native.
3. Upewnij się, że w `app.config.ts` są ustawione właściwe identyfikatory pakietów/bundle.
4. Na iOS dołącz tryb tła „location” oraz opisy uprawnień – zostały już skonfigurowane w pliku konfiguracyjnym.

## Bezpieczeństwo i prywatność
- Lokalne dane lokalizacyjne nie są nigdzie wysyłane – służą wyłącznie do renderowania mapy, sortowania POI i wyzwalania powiadomień.
- Powiadomienia generowane są lokalnie przez `expo-notifications`.
- Klucz MapTiler przechowujemy w `expo-secure-store` po stronie urządzenia.

## Struktura projektu
- `app/` – nawigacja Expo Router v3 (mapa, lista POI, ustawienia).
- `hooks/useLiveLocation.ts` – obserwacja lokalizacji z filtracją skoków i kontrolą zużycia baterii.
- `lib/geofencing.ts` – definicja zadania w tle, start/stop geostref i powiadomienia.
- `lib/permissions.ts` – helpery do proszenia o uprawnienia foreground/background.
- `assets/pois.json` – przykładowe punkty zainteresowania (Cypr).
- `context/SettingsContext.tsx` – stan aplikacji: styl mapy, dokładność, dystans, tryb tła.

## Jak to działa
- **Live GPS + geofencing:** `useLiveLocation` korzysta z `expo-location` z interwałem 10–25 m / 5–10 s, a `lib/geofencing` startuje zadanie `GEOFENCE_TASK`, które reaguje na ENTER/EXIT i wysyła lokalne powiadomienia.
- **Anty-cheat:** dane GPS przechodzą sanity check – skoki powyżej 150 m w 1 s są ignorowane, co stabilizuje geostrefy i oszczędza baterię.
- **Przyszła warstwa AR:** architektura jest gotowa do rozszerzenia o renderowanie AR (np. Niantic Lightship/Unity) – można dorzucić kolejny ekran/tab z widokiem 3D i synchronizacją z tym samym hookiem lokalizacji.
