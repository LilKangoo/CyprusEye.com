# AppGPt Backend

Ten projekt dostarcza prosty serwer API do rejestracji użytkowników oraz resetowania hasła poprzez weryfikację adresu e-mail.

## Wymagania

- Node.js 18 lub nowszy

## Instalacja

Projekt nie posiada zewnętrznych zależności, więc krok instalacji można pominąć. Jeśli chcesz wygenerować plik `package-lock.json`, uruchom `npm install`.

## Uruchomienie

```bash
npm start
```

Serwer domyślnie nasłuchuje na porcie `3001`. Port można zmienić ustawiając zmienną środowiskową `PORT`.

### Konfiguracja ścieżki bazowej (`BASE_PATH`)

Jeżeli aplikacja ma być dostępna pod adresem w stylu `https://twojadomena.com/app`, ustaw zmienną środowiskową `BASE_PATH=/app`.
Serwer automatycznie udostępni wtedy pliki statyczne (HTML, CSS, JS, grafiki) oraz endpointy API pod tym prefiksem.

Przykład uruchomienia z pełną konfiguracją:

```bash
PORT=8080 BASE_PATH=/app PASSWORD_RESET_URL="https://wakacjecypr.com/reset-password" npm start
```

> Uwaga: `BASE_PATH` zawsze musi zaczynać się od ukośnika (`/`). Można go pominąć, jeśli aplikacja ma działać w katalogu głównym
> domeny (wtedy domyślnie używana jest wartość `/`).

## Hosting aplikacji na WakacjeCypr.com/app

Aby udostępnić grę pod adresem `https://WakacjeCypr.com/app`:

1. **Przenieś pliki statyczne** – katalog repozytorium zawiera komplet plików front-endowych (`app.html`, `styles.css`, `app.js`,
   grafiki oraz dodatkowe podstrony). Skopiuj je na serwer HTTP w katalogu, który będzie obsługiwał ścieżkę `/app`.
2. **Uruchom serwer Node.js** – na tym samym hostingu uruchom `server.js`, ustawiając zmienne środowiskowe, np. `BASE_PATH=/app`
   i `PORT=8080`. Serwer API obsłuży logikę kont użytkowników i resetu haseł, a także samodzielnie udostępni pliki statyczne.
3. **Skonfiguruj reverse proxy** – jeżeli strona główna działa na innym serwerze (np. Apache lub Nginx), dodaj regułę przekazującą
   żądania `https://WakacjeCypr.com/app` do procesu Node.js. Przykład dla Nginx:

   ```nginx
   location /app {
       proxy_pass http://127.0.0.1:8080/app;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   }
   ```

4. **Przetestuj działanie** – odwiedź `https://WakacjeCypr.com/app` i sprawdź poprawność wszystkich widoków (mapa, osiągnięcia,
   planer pakowania). Panel logowania/rejestracji powinien działać w oparciu o lokalne konto oraz pamięć przeglądarki.

Serwer wspiera również końcówkę zdrowotną pod `/health` (lub `/app/health` przy ustawionym `BASE_PATH=/app`), co ułatwia monitorowanie.

## Reset hasła i wiadomości e-mail

Po zgłoszeniu prośby o reset hasła serwer generuje token oraz loguje w konsoli treść wiadomości e-mail z linkiem resetującym (zmienna środowiskowa `PASSWORD_RESET_URL`, domyślnie `http://localhost:3000/reset-password`). Token jest ważny przez godzinę — czas można zmodyfikować za pomocą zmiennej `PASSWORD_RESET_TOKEN_TTL_MS` wyrażonej w milisekundach.

## Endpointy

### `POST /api/register`

Rejestruje nowego użytkownika.

**Body**

```json
{
  "email": "jan.kowalski@example.com",
  "password": "bezpieczneHaslo",
  "name": "Jan Kowalski"
}
```

### `POST /api/login`

Zwraca dane użytkownika po poprawnym uwierzytelnieniu.

**Body**

```json
{
  "email": "jan.kowalski@example.com",
  "password": "bezpieczneHaslo"
}
```

### `POST /api/password-reset/request`

Generuje token resetu hasła i loguje wiadomość z instrukcjami.

**Body**

```json
{
  "email": "jan.kowalski@example.com"
}
```

### `POST /api/password-reset/confirm`

Ustawia nowe hasło po weryfikacji tokenu.

**Body**

```json
{
  "token": "reset-token",
  "password": "noweHaslo"
}
```

### `GET /health`

Zwraca status serwera.
