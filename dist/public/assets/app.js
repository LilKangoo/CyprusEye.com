// TODO: implementacja
// Inicjalizacja Supabase po stronie klienta (Cloudflare Pages env VITE_*)
// import { createClient } from '@supabase/supabase-js'
// const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// Formularze publiczne: ładowanie listy aut filtrowanej po location i submit do bookings
export async function initPublicForms() {
  // TODO: implementacja
}

// Admin (public/admin.html): wczytaj rezerwacje do trzech kolumn, akcja Odpowiedz
export async function initAdminCars() {
  // TODO: implementacja
}

// Auto-init na podstawie ścieżki
(function () {
  const path = (typeof location !== 'undefined' ? location.pathname : '') || '';
  if (path.endsWith('/auto-larnaka.html') || path.endsWith('/auto-paphos.html')) {
    initPublicForms();
  } else if (path.endsWith('/admin.html')) {
    initAdminCars();
  }
})();
