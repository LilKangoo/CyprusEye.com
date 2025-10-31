/**
 * Avatar Debug Helper
 * Pomocnicze funkcje do debugowania problemu z avatarem
 */

export async function checkAvatarSetup() {
  console.log('=== AVATAR SETUP DIAGNOSTIC ===');
  
  // Sprawdź czy Supabase jest dostępny
  let sb;
  try {
    if (typeof window.getSupabase === 'function') {
      sb = window.getSupabase();
      console.log('✅ Supabase client found');
    } else {
      console.error('❌ Supabase client not found (window.getSupabase is not a function)');
      return;
    }
  } catch (error) {
    console.error('❌ Error getting Supabase client:', error);
    return;
  }
  
  // Sprawdź użytkownika
  try {
    const { data: { user }, error } = await sb.auth.getUser();
    if (error) {
      console.error('❌ Error getting user:', error);
      return;
    }
    if (!user) {
      console.warn('⚠️ No user logged in');
      return;
    }
    console.log('✅ User authenticated:', user.id);
  } catch (error) {
    console.error('❌ Exception getting user:', error);
    return;
  }
  
  // Sprawdź bucket 'avatars'
  try {
    const { data: buckets, error } = await sb.storage.listBuckets();
    if (error) {
      console.error('❌ Error listing buckets:', error);
    } else {
      const avatarBucket = buckets.find(b => b.name === 'avatars');
      if (avatarBucket) {
        console.log('✅ Bucket "avatars" exists:', avatarBucket);
      } else {
        console.error('❌ Bucket "avatars" NOT FOUND');
        console.log('Available buckets:', buckets.map(b => b.name));
        console.log('📝 Create bucket using AVATAR_SETUP.md instructions');
      }
    }
  } catch (error) {
    console.error('❌ Exception listing buckets:', error);
  }
  
  // Sprawdź tabelę profiles
  try {
    const { data, error } = await sb.from('profiles').select('id, avatar_url').limit(1);
    if (error) {
      console.error('❌ Error querying profiles table:', error);
      if (error.message?.includes('avatar_url')) {
        console.error('📝 Column avatar_url probably doesn\'t exist. Run: ALTER TABLE profiles ADD COLUMN avatar_url TEXT;');
      }
    } else {
      console.log('✅ Profiles table accessible, avatar_url column exists');
    }
  } catch (error) {
    console.error('❌ Exception querying profiles:', error);
  }
  
  // Sprawdź elementy UI
  const elements = {
    avatarImg: document.querySelector('#profileAvatarImg'),
    avatarUploadInput: document.querySelector('#avatarUpload'),
    avatarUploadBtn: document.querySelector('#btnUploadAvatar'),
    avatarRemoveBtn: document.querySelector('#btnRemoveAvatar'),
  };
  
  console.log('=== UI ELEMENTS ===');
  Object.entries(elements).forEach(([name, el]) => {
    if (el) {
      console.log(`✅ ${name} found`);
    } else {
      console.error(`❌ ${name} NOT FOUND`);
    }
  });
  
  console.log('=== END DIAGNOSTIC ===');
  console.log('Run this in console: checkAvatarSetup()');
}

// Auto-run po załadowaniu
if (typeof window !== 'undefined') {
  window.checkAvatarSetup = checkAvatarSetup;
  console.log('💡 Avatar debug loaded. Run checkAvatarSetup() to diagnose issues.');
}
