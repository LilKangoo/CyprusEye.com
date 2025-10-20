const AUTH_TEMPLATE = `
  <div class="auth-modal__tabs" role="tablist">
    <button
      type="button"
      class="auth-modal__tab is-active"
      role="tab"
      id="authTabLogin"
      aria-selected="true"
      aria-controls="authPanelLogin"
      data-auth-tab="login"
      data-i18n="auth.tab.login"
    >
      Logowanie
    </button>
    <button
      type="button"
      class="auth-modal__tab"
      role="tab"
      id="authTabRegister"
      aria-selected="false"
      aria-controls="authPanelRegister"
      data-auth-tab="register"
      tabindex="-1"
      data-i18n="auth.tab.register"
    >
      Rejestracja
    </button>
    <button
      type="button"
      class="auth-modal__tab"
      role="tab"
      id="authTabGuest"
      aria-selected="false"
      aria-controls="authPanelGuest"
      data-auth-tab="guest"
      tabindex="-1"
      data-i18n="auth.tab.guest"
    >
      Gość
    </button>
  </div>
  <div class="auth-modal__panels">
    <section
      id="authPanelLogin"
      class="auth-modal__panel is-active"
      role="tabpanel"
      aria-labelledby="authTabLogin"
      data-auth-panel="login"
    >
      <form id="loginForm" class="auth-form" novalidate>
        <label for="loginEmail" data-i18n="auth.email">Adres e-mail</label>
        <input
          id="loginEmail"
          name="email"
          type="email"
          required
          autocomplete="email"
          aria-label="Adres e-mail"
          data-i18n=""
          data-i18n-attrs="aria-label:auth.email"
        />
        <label for="loginPassword" data-i18n="auth.password">Hasło</label>
        <input
          id="loginPassword"
          name="password"
          type="password"
          required
          autocomplete="current-password"
          aria-label="Hasło"
          data-i18n=""
          data-i18n-attrs="aria-label:auth.password"
        />
        <div class="auth-form__actions">
          <button
            type="submit"
            class="btn btn--primary"
            data-i18n="auth.login.button"
            data-i18n-attrs="aria-label:auth.login.button"
            aria-label="Zaloguj się"
          >
            Zaloguj się
          </button>
          <button
            type="button"
            class="auth-form__link"
            id="loginForgotPassword"
            data-i18n="auth.reset.button"
            data-i18n-attrs="aria-label:auth.reset.button"
            aria-label="🔑 Resetuj hasło"
          >
            🔑 Resetuj hasło
          </button>
        </div>
      </form>
    </section>
    <section
      id="authPanelRegister"
      class="auth-modal__panel"
      role="tabpanel"
      aria-labelledby="authTabRegister"
      data-auth-panel="register"
      hidden
    >
      <form id="registerForm" class="auth-form" novalidate>
        <label for="registerFirstName" data-i18n="auth.firstName">Imię</label>
        <input
          id="registerFirstName"
          name="firstName"
          type="text"
          required
          autocomplete="given-name"
          maxlength="60"
          aria-label="Imię"
          data-i18n=""
          data-i18n-attrs="aria-label:auth.firstName"
        />
        <label for="registerUsername" data-i18n="auth.username">Nazwa użytkownika</label>
        <input
          id="registerUsername"
          name="username"
          type="text"
          required
          autocomplete="nickname"
          maxlength="32"
          aria-label="Nazwa użytkownika"
          inputmode="text"
          data-i18n=""
          data-i18n-attrs="aria-label:auth.username"
        />
        <label for="registerEmail" data-i18n="auth.email">Adres e-mail</label>
        <input
          id="registerEmail"
          name="email"
          type="email"
          required
          autocomplete="email"
          aria-label="Adres e-mail"
          data-i18n=""
          data-i18n-attrs="aria-label:auth.email"
        />
        <label for="registerPassword" data-i18n="auth.password">Hasło</label>
        <input
          id="registerPassword"
          name="password"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          aria-label="Hasło"
          data-i18n=""
          data-i18n-attrs="aria-label:auth.password"
        />
        <label for="registerPasswordConfirm" data-i18n="auth.confirmPassword">Powtórz hasło</label>
        <input
          id="registerPasswordConfirm"
          name="passwordConfirm"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          aria-label="Powtórz hasło"
          data-i18n=""
          data-i18n-attrs="aria-label:auth.confirmPassword"
        />
        <p class="form-hint" data-i18n="auth.register.hint">
          Po rejestracji sprawdź skrzynkę e-mail, aby potwierdzić konto.
        </p>
        <button
          type="submit"
          class="btn btn--primary"
          data-i18n="auth.register.button"
          data-i18n-attrs="aria-label:auth.register.button"
          aria-label="Utwórz konto"
        >
          Utwórz konto
        </button>
        <p class="form-hint" data-i18n="auth.register.usernameHint">
          Twoja nazwa użytkownika będzie widoczna publicznie. Możesz ją później zmienić w ustawieniach konta.
        </p>
      </form>
    </section>
    <section
      id="authPanelGuest"
      class="auth-modal__panel"
      role="tabpanel"
      aria-labelledby="authTabGuest"
      data-auth-panel="guest"
      hidden
    >
      <div class="auth-guest">
        <p data-i18n="auth.guest.description">
          Możesz grać jako gość – postęp zapisze się tylko na tym urządzeniu.
        </p>
        <button
          type="button"
          class="btn btn--secondary"
          id="guestPlayButton"
          data-i18n="auth.guest.button"
          data-i18n-attrs="aria-label:auth.guest.button"
          aria-label="Graj jako gość"
        >
          Graj jako gość
        </button>
      </div>
    </section>
  </div>
  <p id="authMessage" class="auth-message" role="status" aria-live="polite"></p>
`;

function renderAuthView(root) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  if (root.dataset.authViewRendered === 'true') {
    return root;
  }
  root.innerHTML = AUTH_TEMPLATE.trim();
  root.dataset.authViewRendered = 'true';
  return root;
}

function renderAuthViews() {
  document.querySelectorAll('[data-auth-view-root]').forEach((element) => {
    renderAuthView(element);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderAuthViews);
} else {
  renderAuthViews();
}

export { renderAuthView, renderAuthViews };
