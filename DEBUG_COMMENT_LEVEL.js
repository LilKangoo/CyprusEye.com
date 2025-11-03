// ===================================
// SKRYPT DIAGNOSTYCZNY - POZIOM W KOMENTARZACH
// Uruchom w konsoli przeglądarki (F12)
// ===================================

async function debugCommentLevels() {
  console.log('🔍 === ROZPOCZYNAM DIAGNOSTYKĘ POZIOMÓW ===\n');
  
  const sb = window.getSupabase();
  if (!sb) {
    console.error('❌ Supabase client nie jest dostępny!');
    return;
  }
  
  // TEST 1: Sprawdź strukturę tabeli profiles
  console.log('📋 TEST 1: Struktura tabeli profiles');
  try {
    const { data: profiles, error } = await sb
      .from('profiles')
      .select('id, username, name, avatar_url, level, xp')
      .limit(3);
    
    if (error) {
      console.error('❌ Błąd przy pobieraniu profiles:', error);
      console.log('💡 Możliwa przyczyna: Kolumny level/xp nie istnieją w bazie danych');
      console.log('💡 Rozwiązanie: Uruchom plik ADD_XP_COLUMNS_TO_PROFILES.sql w Supabase');
    } else {
      console.log('✅ Profiles pobrane poprawnie:', profiles);
      
      // Sprawdź czy level i xp są obecne
      if (profiles && profiles.length > 0) {
        const firstProfile = profiles[0];
        console.log('📊 Przykładowy profil:', {
          username: firstProfile.username,
          has_level: 'level' in firstProfile,
          level_value: firstProfile.level,
          has_xp: 'xp' in firstProfile,
          xp_value: firstProfile.xp
        });
        
        if (!('level' in firstProfile)) {
          console.error('❌ PROBLEM: Kolumna "level" nie istnieje w tabeli profiles!');
          console.log('💡 Musisz uruchomić: ADD_XP_COLUMNS_TO_PROFILES.sql');
        }
      }
    }
  } catch (err) {
    console.error('❌ Wyjątek w TEST 1:', err);
  }
  
  console.log('\n');
  
  // TEST 2: Sprawdź komentarze z profilem
  console.log('📋 TEST 2: Komentarze z danymi profilu');
  try {
    const { data: comments, error } = await sb
      .from('poi_comments')
      .select(`
        id,
        user_id,
        content,
        profiles (
          username,
          name,
          avatar_url,
          level,
          xp
        )
      `)
      .limit(3);
    
    if (error) {
      console.error('❌ Błąd przy pobieraniu komentarzy:', error);
    } else {
      console.log('✅ Komentarze pobrane poprawnie:', comments);
      
      if (comments && comments.length > 0) {
        comments.forEach((comment, idx) => {
          console.log(`\n📝 Komentarz #${idx + 1}:`, {
            id: comment.id,
            user_id: comment.user_id,
            profile_exists: !!comment.profiles,
            username: comment.profiles?.username,
            has_level: comment.profiles?.level !== undefined,
            level_value: comment.profiles?.level
          });
          
          if (!comment.profiles) {
            console.warn('⚠️ Brak danych profilu dla tego komentarza!');
            console.log('💡 Możliwa przyczyna: User został usunięty lub RLS policy blokuje dostęp');
          }
          
          if (comment.profiles && comment.profiles.level === undefined) {
            console.error('❌ Profil istnieje ale brak pola level!');
          }
        });
      } else {
        console.log('ℹ️ Brak komentarzy w bazie danych');
      }
    }
  } catch (err) {
    console.error('❌ Wyjątek w TEST 2:', err);
  }
  
  console.log('\n');
  
  // TEST 3: Sprawdź aktualnego użytkownika
  console.log('📋 TEST 3: Profil zalogowanego użytkownika');
  try {
    const { data: { user } } = await sb.auth.getUser();
    
    if (user) {
      console.log('✅ Zalogowany użytkownik:', user.id);
      
      const { data: profile, error } = await sb
        .from('profiles')
        .select('username, name, avatar_url, level, xp')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('❌ Błąd przy pobieraniu profilu użytkownika:', error);
      } else {
        console.log('✅ Profil użytkownika:', profile);
        console.log('📊 Szczegóły:', {
          username: profile.username,
          level: profile.level,
          xp: profile.xp,
          has_level: 'level' in profile
        });
      }
    } else {
      console.log('ℹ️ Brak zalogowanego użytkownika');
    }
  } catch (err) {
    console.error('❌ Wyjątek w TEST 3:', err);
  }
  
  console.log('\n');
  
  // TEST 4: Sprawdź czy CSS jest załadowany
  console.log('📋 TEST 4: Style CSS dla poziomu');
  const testElement = document.createElement('div');
  testElement.className = 'comment-author-level';
  testElement.textContent = 'TEST';
  testElement.style.cssText = 'position: absolute; left: -9999px;';
  document.body.appendChild(testElement);
  
  const styles = window.getComputedStyle(testElement);
  const hasStyles = styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                    styles.backgroundColor !== 'transparent';
  
  if (hasStyles) {
    console.log('✅ CSS dla .comment-author-level jest załadowany');
    console.log('📊 Style:', {
      background: styles.background,
      fontSize: styles.fontSize,
      padding: styles.padding
    });
  } else {
    console.error('❌ CSS dla .comment-author-level NIE jest załadowany!');
    console.log('💡 Sprawdź czy community.css jest poprawnie zaimportowany');
  }
  
  document.body.removeChild(testElement);
  
  console.log('\n');
  
  // PODSUMOWANIE
  console.log('🏁 === PODSUMOWANIE DIAGNOSTYKI ===');
  console.log('1. Sprawdź powyższe logi pod kątem błędów (❌)');
  console.log('2. Jeśli brak kolumny level - uruchom ADD_XP_COLUMNS_TO_PROFILES.sql');
  console.log('3. Jeśli CSS nie działa - sprawdź czy community.css jest załadowany');
  console.log('4. Jeśli profile są null - sprawdź RLS policies w Supabase');
  console.log('\n');
  
  return '✅ Diagnostyka zakończona - sprawdź logi powyżej';
}

// Auto-uruchom
console.log('💻 Uruchom: debugCommentLevels()');
console.log('lub po prostu odśwież stronę i sprawdź logi automatyczne\n');

// Eksportuj do window
window.debugCommentLevels = debugCommentLevels;
