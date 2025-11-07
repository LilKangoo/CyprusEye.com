// =====================================================
// 🧪 TEST ADMIN ACCESS IN BROWSER CONSOLE
// =====================================================
// Copy-paste these commands in browser console (F12) while on admin panel
// This will help diagnose why admin functions fail
// =====================================================

// 1. Check if you're logged in and get user ID
const checkAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  console.log('📋 Session:', session);
  console.log('👤 User ID:', session?.user?.id);
  console.log('📧 Email:', session?.user?.email);
  return session;
};

// 2. Check your profile in database
const checkProfile = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', '15f3d442-092d-4eb8-9627-db90da0283eb')
    .single();
  
  console.log('👤 Profile:', data);
  console.log('🔑 is_admin:', data?.is_admin);
  console.log('❌ Error:', error);
  return data;
};

// 3. Test admin check function
const testIsAdmin = async () => {
  const { data, error } = await supabase.rpc('is_current_user_admin');
  console.log('🔐 Is admin (RPC):', data);
  console.log('❌ Error:', error);
  return data;
};

// 4. Test getting user details
const testGetUserDetails = async () => {
  const { data, error } = await supabase.rpc('admin_get_user_details', {
    target_user_id: '15f3d442-092d-4eb8-9627-db90da0283eb'
  });
  console.log('📊 User details:', data);
  console.log('❌ Error:', error);
  return { data, error };
};

// 5. Check system diagnostics view
const testDiagnostics = async () => {
  const { data, error } = await supabase
    .from('admin_system_diagnostics')
    .select('*');
  
  console.log('📈 Diagnostics:', data);
  console.log('❌ Error:', error);
  return { data, error };
};

// 6. Run all tests
const runAllTests = async () => {
  console.log('🚀 Starting admin diagnostic tests...\n');
  
  console.log('=== TEST 1: Auth Session ===');
  await checkAuth();
  console.log('\n');
  
  console.log('=== TEST 2: Profile ===');
  await checkProfile();
  console.log('\n');
  
  console.log('=== TEST 3: Is Admin Function ===');
  await testIsAdmin();
  console.log('\n');
  
  console.log('=== TEST 4: Get User Details ===');
  await testGetUserDetails();
  console.log('\n');
  
  console.log('=== TEST 5: Diagnostics View ===');
  await testDiagnostics();
  console.log('\n');
  
  console.log('✅ All tests complete!');
};

// =====================================================
// HOW TO USE:
// =====================================================
// 1. Open admin panel: https://cypruseye.com/admin
// 2. Open browser console: F12 or Cmd+Opt+I
// 3. Paste this entire file
// 4. Run: runAllTests()
// 5. Send me the output!
// =====================================================

console.log('✅ Test functions loaded!');
console.log('📝 Run: runAllTests() to start');
