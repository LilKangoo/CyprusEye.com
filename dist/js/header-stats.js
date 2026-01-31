/**
 * Header Stats Module
 * Automatycznie aktualizuje statystyki użytkownika w headerze na wszystkich stronach
 */

(function() {
  'use strict';

  console.log('📊 Header Stats Module loaded');

  const XP_PER_LEVEL = 150;

  // Local i18n helper for header stats
  function translateHeader(key, params, fallback) {
    // Prefer appI18n (global i18n.js system)
    try {
      const i18n = window.appI18n;
      if (i18n && i18n.translations) {
        const lang = i18n.language || document.documentElement.lang || 'pl';
        const translations = i18n.translations[lang] || {};

        let entry = translations;
        if (key && typeof key === 'string') {
          const parts = key.split('.');
          for (const part of parts) {
            if (entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, part)) {
              entry = entry[part];
            } else {
              entry = null;
              break;
            }
          }
        } else {
          entry = null;
        }

        let text = null;
        if (typeof entry === 'string') {
          text = entry;
        } else if (entry && typeof entry === 'object') {
          if (typeof entry.text === 'string') {
            text = entry.text;
          } else if (typeof entry.html === 'string') {
            text = entry.html;
          }
        }

        if (typeof text === 'string' && text) {
          if (params && typeof params === 'object') {
            return text.replace(/\{\{(\w+)\}\}/g, (m, p) =>
              Object.prototype.hasOwnProperty.call(params, p) ? String(params[p]) : m
            );
          }
          return text;
        }
      }
    } catch (_) { /* ignore i18n errors */ }

    // Fallback to legacy window.i18n if available
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        const value = window.i18n.t(key, params || {});
        if (typeof value === 'string' && value) {
          return value;
        }
      }
    } catch (_) { /* ignore legacy i18n errors */ }

    return typeof fallback === 'string' ? fallback : '';
  }

  async function waitForSupabaseUser({ timeoutMs = 15000, stepMs = 250 } = {}) {
    const start = Date.now();

    try {
      const fn = typeof window.waitForAuthReady === 'function' ? window.waitForAuthReady : null;
      if (fn) {
        await Promise.race([
          Promise.resolve().then(() => fn()),
          new Promise((resolve) => setTimeout(resolve, Math.min(7000, timeoutMs))),
        ]);
      }
    } catch (_) {}

    while (Date.now() - start < timeoutMs) {
      try {
        const stateUser = window?.CE_STATE?.session?.user || null;
        if (stateUser) return stateUser;
      } catch (_) {}

      try {
        const sb = typeof window.getSupabase === 'function' ? window.getSupabase() : null;
        if (sb?.auth?.getSession) {
          const { data, error } = await sb.auth.getSession();
          if (!error && data?.session?.user) return data.session.user;
        }
      } catch (_) {}

      await new Promise((r) => setTimeout(r, stepMs));
    }

    return null;
  }

  // Cache elementów DOM
  let elements = null;
  let profileChannel = null;

  function getElements() {
    if (elements) return elements;
    
    elements = {
      levelNumber: document.getElementById('headerLevelNumber'),
      xpPoints: document.getElementById('headerXpPoints'),
      xpFill: document.getElementById('headerXpFill'),
      badgesCount: document.getElementById('headerBadgesCount'),
      profileName: document.querySelector('.profile-name'),
      profileStatus: document.querySelector('.profile-status'),
      userAvatar: document.getElementById('headerUserAvatar')
    };

    return elements;
  }

  /**
   * Aktualizuje statystyki w headerze
   * @param {Object} stats - Obiekt ze statystykami {xp, level, badges, name}
   */
  function updateHeaderStats(stats) {
    const el = getElements();
    
    if (!stats) {
      console.warn('⚠️ Brak danych statystyk do aktualizacji');
      return;
    }

    const {
      xp = 0,
      level = 1,
      badges = 0,
      name = null,
      avatar_url = null
    } = stats;

    console.log('📈 Aktualizuję statystyki headera:', { xp, level, badges, name });

    // Aktualizuj poziom
    if (el.levelNumber) {
      el.levelNumber.textContent = String(level);
    }

    // Aktualizuj XP
    if (el.xpPoints) {
      el.xpPoints.textContent = String(xp);
    }

    // Aktualizuj pasek postępu XP
    const currentLevelXP = xp % XP_PER_LEVEL;
    const progressPercent = Math.max(0, Math.min(100, Math.round((currentLevelXP / XP_PER_LEVEL) * 100)));
    
    if (el.xpFill) {
      if (progressPercent <= 0) {
        el.xpFill.classList.add('is-width-zero');
      } else {
        el.xpFill.classList.remove('is-width-zero');
      }
      el.xpFill.style.width = progressPercent + '%';
    }

    // Aktualizuj odznaki
    if (el.badgesCount) {
      el.badgesCount.textContent = String(badges);
    }

    // Aktualizuj nazwę użytkownika
    if (el.profileName && name) {
      el.profileName.textContent = name;
    }

    // Aktualizuj status z tłumaczeniem
    if (el.profileStatus) {
      const defaultStatus = `Level ${level} • ${badges} badges`;
      const statusText = translateHeader('profile.status', { level, badges }, defaultStatus);
      el.profileStatus.textContent = statusText;
    }

    // Aktualizuj avatar
    if (el.userAvatar && avatar_url) {
      el.userAvatar.src = avatar_url;
    }

    console.log('✅ Statystyki headera zaktualizowane');
  }

  /**
   * Pobiera statystyki z Supabase
   */
  async function fetchUserStats() {
    try {
      const sb = typeof window.getSupabase === 'function' ? window.getSupabase() : null;
      
      if (!sb) {
        console.log('ℹ️ Supabase niedostępny');
        return null;
      }

      let user = null;
      try {
        const { data, error } = await sb.auth.getSession();
        if (!error && data?.session?.user) {
          user = data.session.user;
        }
      } catch (_) {}

      if (!user) {
        try {
          const res = await sb.auth.getUser();
          user = res?.data?.user || null;
        } catch (_) {}
      }

      if (!user) {
        console.log('ℹ️ Użytkownik niezalogowany');
        return null;
      }

      console.log('👤 Pobieram statystyki użytkownika:', user.id);

      // Pobierz profil i odwiedzone miejsca
      const { data: profile, error: profileError } = await sb
        .from('profiles')
        .select('xp, level, name, username, avatar_url, visited_places')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('❌ Błąd pobierania profilu:', profileError);
        return null;
      }

      // Oblicz liczbę odznak z tablicy visited_places
      const badgesCount = Array.isArray(profile?.visited_places) ? profile.visited_places.length : 0;

      return {
        xp: profile?.xp || 0,
        level: profile?.level || 1,
        badges: badgesCount,
        name: profile?.name || profile?.username || 'Gracz',
        avatar_url: profile?.avatar_url || null,
        userId: user.id
      };

    } catch (error) {
      console.error('❌ Błąd pobierania statystyk:', error);
      return null;
    }
  }

  function subscribeProfileRealtime(userId) {
    try {
      const sb = typeof window.getSupabase === 'function' ? window.getSupabase() : null;
      if (!sb || !userId) {
        return;
      }

      if (profileChannel && typeof profileChannel.unsubscribe === 'function') {
        profileChannel.unsubscribe();
        profileChannel = null;
      }

      profileChannel = sb
        .channel(`header-profile-rt-${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload) => {
            const newRow = payload && payload.new ? payload.new : null;
            if (!newRow) {
              return;
            }
            const badgesCount = Array.isArray(newRow.visited_places) ? newRow.visited_places.length : 0;
            updateHeaderStats({
              xp: newRow.xp || 0,
              level: newRow.level || 1,
              badges: badgesCount,
              name: newRow.name || newRow.username || 'Gracz',
              avatar_url: newRow.avatar_url || null
            });
          }
        )
        .subscribe();
    } catch (error) {
      console.warn('⚠️ Nie udało się włączyć nasłuchu zmian profilu w headerze:', error);
    }
  }

  /**
   * Inicjalizacja modułu
   */
  async function init() {
    console.log('🔄 Inicjalizacja Header Stats...');

    const waitForAuthReady = async () => {
      try {
        const fn = typeof window.waitForAuthReady === 'function' ? window.waitForAuthReady : null;
        if (!fn) return;
        await Promise.race([
          Promise.resolve().then(() => fn()),
          new Promise((resolve) => setTimeout(resolve, 4500)),
        ]);
      } catch (_) {
      }
    };

    const refreshStatsWithRetry = async ({ attempts: max = 16, stepMs = 250, userTimeoutMs = 15000 } = {}) => {
      const user = await waitForSupabaseUser({ timeoutMs: userTimeoutMs, stepMs });
      if (!user) {
        return false;
      }

      for (let i = 0; i < max; i += 1) {
        const stats = await fetchUserStats();
        if (stats) {
          updateHeaderStats(stats);
          if (stats.userId) {
            subscribeProfileRealtime(stats.userId);
          }
          return true;
        }
        await new Promise((r) => setTimeout(r, stepMs));
      }
      return false;
    };

    // Poczekaj na załadowanie Supabase
    let attempts = 0;
    const maxAttempts = 50; // 5 sekund (50 × 100ms)

    const waitForSupabase = () => {
      return new Promise((resolve) => {
        const check = () => {
          if (typeof window.getSupabase === 'function') {
            resolve(true);
            return;
          }
          attempts++;
          if (attempts >= maxAttempts) {
            resolve(false);
            return;
          }
          setTimeout(check, 100);
        };
        check();
      });
    };

    const supabaseAvailable = await waitForSupabase();

    if (!supabaseAvailable) {
      console.log('⚠️ Supabase nie załadowany, pomijam aktualizację statystyk');
      return;
    }

    await waitForAuthReady();
    await refreshStatsWithRetry({ userTimeoutMs: 15000 });

    // Nasłuchuj zmian sesji
    try {
      const sb = window.getSupabase();
      sb.auth.onAuthStateChange(async (event, session) => {
        console.log('🔄 Zmiana stanu autoryzacji:', event);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          const userId = session && session.user ? session.user.id : null;
          if (userId) {
            subscribeProfileRealtime(userId);
          }
          await waitForAuthReady();
          await refreshStatsWithRetry({ attempts: 8, stepMs: 200, userTimeoutMs: 15000 });
        } else if (event === 'SIGNED_OUT') {
          if (profileChannel && typeof profileChannel.unsubscribe === 'function') {
            try {
              profileChannel.unsubscribe();
            } catch (e) {
              console.warn('⚠️ Błąd podczas odpinania kanału profilu w headerze:', e);
            }
            profileChannel = null;
          }
          // Resetuj do wartości domyślnych
          updateHeaderStats({
            xp: 0,
            level: 1,
            badges: 0,
            name: 'Mój Profil',
            avatar_url: null
          });
        }
      });
    } catch (error) {
      console.warn('⚠️ Nie udało się nasłuchiwać zmian autoryzacji:', error);
    }

    // Udostępnij globalnie funkcję aktualizacji
    window.updateHeaderStats = updateHeaderStats;
    window.refreshHeaderStats = async () => {
      const stats = await fetchUserStats();
      if (stats) {
        updateHeaderStats(stats);
      }
    };

    // Nasłuchuj zmian języka i odśwież statystyki
    window.addEventListener('languageChanged', async () => {
      console.log('🔄 Język zmieniony - odświeżam statystyki headera');
      const stats = await fetchUserStats();
      if (stats) {
        updateHeaderStats(stats);
      }
    });

    console.log('✅ Header Stats zainicjalizowany');
  }

  // Uruchom po załadowaniu DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
