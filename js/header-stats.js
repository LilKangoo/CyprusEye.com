/**
 * Header Stats Module
 * Automatycznie aktualizuje statystyki użytkownika w headerze na wszystkich stronach
 */

(function() {
  'use strict';

  console.log('📊 Header Stats Module loaded');

  const XP_PER_LEVEL = 150;

  // Cache elementów DOM
  let elements = null;

  function getElements() {
    if (elements) return elements;
    
    elements = {
      levelNumber: document.getElementById('headerLevelNumber'),
      levelStatus: document.getElementById('headerLevelStatus'),
      xpPoints: document.getElementById('headerXpPoints'),
      xpFill: document.getElementById('headerXpFill'),
      xpProgressText: document.getElementById('headerXpProgressText'),
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

    if (el.xpProgressText) {
      const xpText = window.i18n ? 
        window.i18n.t('metrics.xp.progressTemplate', { current: currentLevelXP, target: XP_PER_LEVEL }) : 
        `${currentLevelXP} / ${XP_PER_LEVEL} XP`;
      el.xpProgressText.textContent = xpText;
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
      const statusText = window.i18n ? 
        window.i18n.t('profile.status', { level, badges }) : 
        `Poziom ${level} • ${badges} odznak`;
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

      const { data: { user } } = await sb.auth.getUser();
      
      if (!user) {
        console.log('ℹ️ Użytkownik niezalogowany');
        return null;
      }

      console.log('👤 Pobieram statystyki użytkownika:', user.id);

      // Pobierz profil
      const { data: profile, error: profileError } = await sb
        .from('profiles')
        .select('xp, level, name, username, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('❌ Błąd pobierania profilu:', profileError);
        return null;
      }

      // Pobierz liczbę odznak (odwiedzone miejsca)
      const { data: visits, error: visitsError } = await sb
        .from('user_visits')
        .select('place_id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const badgesCount = visitsError ? 0 : (visits || []).length;

      return {
        xp: profile?.xp || 0,
        level: profile?.level || 1,
        badges: badgesCount,
        name: profile?.name || profile?.username || 'Gracz',
        avatar_url: profile?.avatar_url || null
      };

    } catch (error) {
      console.error('❌ Błąd pobierania statystyk:', error);
      return null;
    }
  }

  /**
   * Inicjalizacja modułu
   */
  async function init() {
    console.log('🔄 Inicjalizacja Header Stats...');

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

    // Pobierz i zaktualizuj statystyki
    const stats = await fetchUserStats();
    if (stats) {
      updateHeaderStats(stats);
    }

    // Nasłuchuj zmian sesji
    try {
      const sb = window.getSupabase();
      sb.auth.onAuthStateChange(async (event, session) => {
        console.log('🔄 Zmiana stanu autoryzacji:', event);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const stats = await fetchUserStats();
          if (stats) {
            updateHeaderStats(stats);
          }
        } else if (event === 'SIGNED_OUT') {
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
