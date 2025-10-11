# Audyt UX i optymalizacji serwisu WakacjeCypr Quest / CyprusEye

## 1. Obserwacje globalne

### 1.1 Fundamenty SEO
- Brak meta opisu (`<meta name="description">`) w kluczowych plikach (`index.html`, `packing.html`, `tasks.html`, `media-trips.html`, `achievements.html`, `attractions.html`). Dodanie unikalnych, opisowych meta tagów poprawi CTR i widoczność w wynikach wyszukiwania.【F:index.html†L1-L13】【F:packing.html†L1-L13】【F:tasks.html†L1-L13】【F:media-trips.html†L1-L13】【F:achievements.html†L1-L15】【F:attractions.html†L1-L14】
- Nazwy stron są powtarzalne („WakacjeCypr Quest”) bez doprecyzowania sekcji. Rozważ rozszerzenie `<title>` o słowa kluczowe dla każdej podstrony (np. „Planer pakowania | WakacjeCypr Quest”).【F:packing.html†L7-L13】【F:tasks.html†L7-L13】【F:media-trips.html†L7-L13】

### 1.2 Dostępność i nawigacja
- Brak linku „Skip to content” utrudnia nawigację klawiaturą przy rozbudowanym nagłówku. Warto dodać element ukryty wizualnie pojawiający się po fokusie przed `<header>`.【F:index.html†L15-L169】
- Wspólny nagłówek w widokach aplikacji ma bardzo dużo akcji i kart, co tworzy długi cykl tabulacji (co najmniej 12 fokuso-walnych elementów zanim użytkownik dotrze do treści). Rozważ grupowanie lub część przenieść do menu typu „More”.【F:index.html†L15-L168】
- Przyciski w pasku metryk (Poziom, XP, Odznaki) są linkami, ale nie mają `aria-current`, przez co użytkownik nie wie, że przeniosą na inną stronę. Dodanie informacji kontekstowej ułatwi orientację.【F:index.html†L90-L115】

### 1.3 Spójność językowa i lokalizacja
- HTML określa `lang="pl"`, lecz część treści i danych (np. w `services.html`) zawiera anglicyzmy i zapis wartości w euro bez spacji lub w formacie mieszanym, co utrudnia odbiór. Przygotuj strategię lokalizacyjną (np. pl/en) i stosuj jednolite formatowanie walut z odstępem nierozdzielającym.【F:services.html†L37-L178】
- Wiele elementów ma atrybut `data-i18n-key`, ale na podstronach standalone (np. `services.html`) nie jest ładowany skrypt i18n. Jeśli planowana jest wielojęzyczność, należy zapewnić spójne tłumaczenia lub usunąć zbędne atrybuty.【F:services.html†L37-L178】

### 1.4 Wydajność
- Wszystkie strony ładują te same fonty Google (dwa krój) oraz pełny arkusz `styles.css` (~ szeroki, z licznymi komponentami) nawet jeśli wykorzystują jedynie część komponentów. Rozważ kriowanie krytycznych stylów (critical CSS) dla głównej strony i modularnych arkuszy dla podstron, a także lokalne hostowanie fontów dla lepszego LCP.【F:index.html†L8-L13】【F:services.html†L7-L13】
- W widokach aplikacji (`index.html`, `packing.html`, `tasks.html`, `media-trips.html`) wczytywany jest Leaflet CSS niezależnie od tego, czy użytkownik faktycznie korzysta z mapy na danej zakładce. Wprowadzenie lazy loadingu skryptów/arkuszy (np. przez dynamiczne importy) skróci czas pierwszego renderu.【F:index.html†L8-L13】【F:packing.html†L8-L13】【F:tasks.html†L8-L13】【F:media-trips.html†L8-L13】

### 1.5 Komponenty formularzy
- Formularze kalkulatorów i rezerwacji (np. w `car-rental.html`, `autopfo.html`) nie mają widocznych komunikatów błędów oraz brak atrybutów `aria-describedby` do powiązania komunikatów statusu z polami. Dodaj walidację z informacjami o błędach w czasie rzeczywistym.【F:car-rental.html†L123-L175】【F:autopfo.html†L124-L176】
- Przyciski w formularzach otwierających linki w nowych kartach (`target="_blank"`) powinny informować użytkownika (np. `aria-label` lub tekst „(otwiera w nowej karcie)”).【F:car-rental.html†L183-L195】【F:autopfo.html†L184-L196】

## 2. Strona główna (`index.html`)

### 2.1 Architektura informacji
- Sekcja nagłówka zawiera wiele metryk, przycisków SOS, powiadomień i modalnych okien, co przy pierwszym wejściu może przytłaczać. Zaproponuj tryb onboardingowy z uproszczonym widokiem (np. ukrycie SOS i statystyk do czasu zalogowania).【F:index.html†L15-L188】
- Układ głównej kolumny obejmuje mapę, zadania, wyzwania i skróty. Brakuje jednak wyraźnych nagłówków `<h2>` w sekcjach po mapie (np. `class="map-panel"` nie zawiera nagłówka), co utrudnia skanowanie treści przez czytniki ekranowe i użytkowników mobilnych. Dodaj strukturalne nagłówki dla każdej sekcji.【F:index.html†L198-L312】
- Panel „Szybkie skróty” ma trzy karty, ale używa `<p>` zamiast listy – warto zamienić na `<ul>` i dodać krótkie opisy CTA z informacją o korzyści (np. „Gotowa lista – zacznij od zera”).【F:index.html†L240-L285】

### 2.2 Widok „Twoja przygoda”
- Karty misji w sekcji `objectives` mają struktury przycisków w listach, ale brak informacji o stanie (np. `aria-pressed`, `data-status`). Dodanie wizualnego i tekstowego oznaczenia, które zadania są aktywne, poprawi czytelność.【F:index.html†L313-L403】
- Sekcja „Twoja baza” zawiera wiele komponentów (noclegi, transport, pakiet SOS) w jednym kontenerze. Rozważ podział na zakładki lub akordeon, by ograniczyć scroll i jednorazowe obciążenie poznawcze.【F:index.html†L404-L487】

### 2.3 Stopka i modale
- Stopka aplikacji ogranicza się do jednego zdania i nie zawiera danych kontaktowych ani linków prawnych (RODO, regulaminy). Dodanie tych elementów zwiększy wiarygodność i zgodność prawną.【F:index.html†L476-L487】
- Modale (np. logowania, SOS, eksploratora) znajdują się na końcu dokumentu, lecz brakuje atrybutów `aria-modal="true"` i pułapki fokusu po otwarciu. Warto zaimplementować logikę dostępności, aby uniknąć „uciekania” fokusu w tle.【F:index.html†L504-L774】

## 3. Planer pakowania (`packing.html`)

- Widok dzieli komponenty z aplikacją, ale inicjuje się w kontekście `packingView`. Sprawdź, czy sekcja planera posiada własny nagłówek i czytelne oznaczenia kategorii – w kodzie brak `<h1>` specyficznego dla tej podstrony, co utrudnia orientację (pierwszy nagłówek pochodzi prawdopodobnie z JS). Warto wstawić statyczny tytuł w HTML, np. „Planer pakowania na Cypr”.【F:packing.html†L14-L200】
- Formularz pakowania powinien oferować gotowe presety (np. lato/zima). Dodanie przełączników w HTML + tooltipów usprawni korzystanie bez JS (obecnie całość zależy od skryptu).【F:packing.html†L195-L312】

## 4. Zadania i osiągnięcia (`tasks.html`, `achievements.html`)

- `tasks.html` nie zawiera meta opisu i ma identyczny nagłówek jak strona główna; rozważ osobny opis i ikonografię dla list zadań, np. timeline lub karty z priorytetem.【F:tasks.html†L1-L312】
- W `achievements.html` brakuje meta opisu oraz sekcji FAQ, która wyjaśnia różnice między poziomami i odznakami. Dodanie tooltipów do liczb (0 XP) i stanu pasków postępu zwiększy motywację użytkownika.【F:achievements.html†L1-L86】
- Lista odznak jest pustym `<ul>` aktualizowanym przez JS; w przypadku braku danych użytkownik widzi tylko krótki tekst. Warto rozważyć CTA kierujące do katalogu atrakcji lub proponujące pierwszą misję.【F:achievements.html†L66-L83】

## 5. Katalog atrakcji (`attractions.html`)

- Brak meta opisu i brak statycznego tytułu `h1` (poza nagłówkiem). Dla SEO warto umieścić krótkie streszczenie z frazami „atrakcje Cypru”, „mapa atrakcji”.【F:attractions.html†L1-L56】
- Pole wyszukiwania nie zawiera etykiety wizualnej; opiera się na placeholderze. Dodaj widoczny `<label>` lub `aria-labelledby`, by zwiększyć dostępność.【F:attractions.html†L43-L52】
- Rozważ wprowadzenie filtrów (checkboxy dla kategorii plaże/miasta/natura) oraz sortowania po odległości/popularności dla lepszego UX.【F:attractions.html†L56-L68】

## 6. VIP wyjazdy i media (`media-trips.html`, `services.html`)

- `media-trips.html` korzysta z layoutu aplikacji, ale nie posiada unikalnego nagłówka z informacją o ofercie VIP. Wstaw stały tytuł i opis w HTML, aby użytkownicy wiedzieli, w jakiej sekcji są po przeładowaniu strony bez JS.【F:media-trips.html†L14-L200】
- Podstrona `services.html` jest bogata w treść, jednak brakuje kotwic typu „wstecz do góry” oraz sticky nawigacji, co utrudnia powrót do menu po przewinięciu. Dodanie mini-menu w bocznym pasku zwiększy wygodę na desktopie.【F:services.html†L16-L200】
- W sekcji „Media” przyciski CTA prowadzą do maila, ale brakuje informacji o czasie odpowiedzi i cenniku. Rozważ wprowadzenie tabeli pakietów i formularza zapytań bezpośrednio na stronie.【F:services.html†L158-L199】

## 7. Wynajem aut (`car-rental-landing.html`, `car-rental.html`, `autopfo.html`)

- Landing wyboru miasta nie posiada meta opisu. Warto dodać opis koncentrujący się na „wynajem auta bez kaucji w Larnace i Pafos” dla SEO oraz wprowadzić breadcrumbs, aby użytkownik widział kontekst nawigacyjny.【F:car-rental-landing.html†L1-L32】
- Sekcje kalkulatora w `car-rental.html` i `autopfo.html` bazują na identycznym kodzie; można wydzielić wspólny komponent i zadbać o konsekwencję nazw (np. `aria-label` w `<select>`). Obecnie `select` ma `aria-required`, ale brak `aria-labelledby` z powiązanym `<span>`. Dodanie `id` i `for` w etykietach poprawi dostępność.【F:car-rental.html†L123-L175】【F:autopfo.html†L124-L176】
- Formularze osadzają Google Forms w iframe, co bywa kłopotliwe mobilnie. Zaproponuj responsywne rozwiązanie: własny formularz w stylu strony + fallback link do Google Forms. Dodatkowo frame jest wysoki i może powodować długi scroll – rozważ lazy loading dopiero po kliknięciu CTA.【F:car-rental.html†L183-L195】【F:autopfo.html†L184-L196】
- Sekcja flot nie zawiera zdjęć pojazdów. Dodanie galerii (z lazy loadingiem) zwiększy wiarygodność i konwersję. Można wykorzystać `loading="lazy"` i `srcset` dla różnych rozdzielczości.【F:car-rental.html†L69-L123】【F:autopfo.html†L69-L124】

## 8. Elementy prawne i zaufanie

- Brak linków do polityki prywatności, regulaminu i cookies w całym serwisie. Dodaj dedykowaną sekcję w stopce i modale potwierdzające zgodę na przetwarzanie danych przed wysłaniem formularzy, szczególnie że strona operuje na danych osobowych (rezerwacje, kontakt).【F:index.html†L476-L487】【F:car-rental.html†L183-L195】
- Sekcje z ofertą (np. `services.html`, `car-rental.html`) powinny zawierać opinie klientów lub referencje (np. cytaty, rating). Brak elementów społecznego dowodu utrudnia budowanie zaufania nowych użytkowników.【F:services.html†L59-L199】【F:car-rental.html†L69-L195】

## 9. Rekomendacje techniczne

1. **Refaktoryzacja layoutu nagłówka** – rozbij sekcję na moduły, dodaj „skip link” i upraszczaj układ mobilny poprzez hamburger menu dla działań dodatkowych.【F:index.html†L15-L188】
2. **Wprowadzenie tematu ciemnego** – zastosuj `prefers-color-scheme` i przygotuj wariant kolorystyczny w `styles.css`, co poprawi komfort nocnego czytania i dostępność (wykorzystać już zdefiniowane zmienne CSS).【F:styles.css†L1-L77】
3. **Optymalizacja zasobów** – wdrożenie `rel="preload"` dla głównych fontów, bundling JS (`app.js`, `car-rental.js`, `i18n.js`) i lazy loading modułów mapowych dopiero po wejściu w sekcję mapy.【F:index.html†L8-L13】【F:index.html†L491-L494】
4. **Dane strukturalne** – dodaj `JSON-LD` dla usług turystycznych (LocalBusiness/TravelAgency) na stronach ofertowych, co poprawi widoczność w wyszukiwarkach.【F:car-rental.html†L34-L200】【F:services.html†L37-L199】
5. **Testy użyteczności** – zalecane prototypowanie wariantów CTA i kolejności sekcji (np. w `car-rental-landing.html`) przy pomocy narzędzi jak Hotjar / GA4 (obecnie brak integracji analitycznej w kodzie). Rozważ wdrożenie `dataLayer` i zgód cookies.【F:car-rental-landing.html†L31-L102】

---

Dokument stanowi punkt wyjścia do dalszych iteracji UX, optymalizacji wydajności i zgodności prawnej. Rekomenduję ułożenie roadmapy zmian (quick wins vs. prace strategiczne) oraz przeprowadzenie testów na użytkownikach po wdrożeniu kluczowych poprawek.
