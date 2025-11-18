# Recommendations Categories - Quick Guide

## 🎯 Jak dodać nową kategorię

### Metoda 1: Przez panel admin (NAJŁATWIEJSZA)

1. **Otwórz admin panel** → Recommendations → **New Recommendation**
2. W polu **Category** kliknij przycisk **➕**
3. Wypełnij formularz:
   - 🇵🇱 **Name (Polish)** * - wymagane
   - 🇬🇧 **Name (English)** * - wymagane
   - 🇬🇷 **Name (Greek)** - opcjonalne
   - 🇮🇱 **Name (Hebrew)** - opcjonalne
   - **Icon** - emoji np. 🏨, 🍽️, 🚗, 🏖️
   - **Color** - wybierz kolor dla znacznika na mapie
   - **Display Order** - kolejność wyświetlania (0 = najwyżej)
4. Kliknij **💾 Save Category**
5. Kategoria automatycznie pojawi się w liście! ✅

---

### Metoda 2: Przez SQL (dla zaawansowanych)

```sql
INSERT INTO public.recommendation_categories 
  (name_pl, name_en, name_el, name_he, icon, color, display_order, active)
VALUES 
  ('Spa & Wellness', 'Spa & Wellness', 'Σπα & Ευεξία', 'ספא ובריאות', '🧖', '#9B59B6', 9, true);
```

---

## 📋 Domyślne kategorie

Jeśli uruchomiłeś SQL `027_recommendations_system.sql`, już masz te kategorie:

| PL | EN | EL | HE | Icon | Color |
|----|----|----|-------|------|-------|
| Zakwaterowanie | Accommodation | Διαμονή | לינה | 🏨 | #FF6B35 |
| Restauracje | Restaurants | Εστιατόρια | מסעדות | 🍽️ | #4ECDC4 |
| Wynajem Aut | Car Rentals | Ενοικίαση Αυτοκινήτων | השכרת רכב | 🚗 | #FFE66D |
| Plaże | Beaches | Παραλίες | חופים | 🏖️ | #95E1D3 |
| Aktywności | Activities | Δραστηριότητες | פעילויות | 🎯 | #F38181 |
| Zakupy | Shopping | Ψώνια | קניות | 🛍️ | #AA96DA |
| Życie Nocne | Nightlife | Νυχτερινή Ζωή | חיי לילה | 🎉 | #FCBAD3 |
| Usługi | Services | Υπηρεσίες | שירותים | 🔧 | #A8D8EA |

---

## 🐛 Troubleshooting

### Problem: "No categories found"
**Rozwiązanie:**
1. Uruchom SQL: `supabase/migrations/027_recommendations_system.sql`
2. Lub kliknij ➕ i dodaj pierwszą kategorię ręcznie

### Problem: Kategorie nie ładują się
**Rozwiązanie:**
1. Otwórz Console (F12)
2. Sprawdź czy są błędy
3. Odśwież stronę (Ctrl+Shift+R)
4. Zobacz logi: `🔵 Opening create modal, categories count: X`

### Problem: Nie mogę zapisać kategorii
**Rozwiązanie:**
- Sprawdź czy jesteś zalogowany jako admin
- Sprawdź czy `is_admin = true` w tabeli `profiles`
- Sprawdź RLS policies w Supabase

---

## 🎨 Propozycje nowych kategorii

```sql
-- Muzea i Galerie
INSERT INTO recommendation_categories (name_pl, name_en, name_el, name_he, icon, color, display_order)
VALUES ('Muzea i Galerie', 'Museums & Galleries', 'Μουσεία & Γκαλερί', 'מוזיאונים וגלריות', '🖼️', '#E74C3C', 10);

-- Transport
INSERT INTO recommendation_categories (name_pl, name_en, name_el, name_he, icon, color, display_order)
VALUES ('Transport', 'Transport', 'Μεταφορά', 'תחבורה', '🚌', '#3498DB', 11);

-- Medyczne
INSERT INTO recommendation_categories (name_pl, name_en, name_el, name_he, icon, color, display_order)
VALUES ('Służba zdrowia', 'Healthcare', 'Υγειονομική περίθαλψη', 'שירותי בריאות', '🏥', '#27AE60', 12);
```

---

## 🔐 Bezpieczeństwo

- ✅ Tylko **admini** mogą dodawać/edytować kategorie
- ✅ RLS policies sprawdzają `profiles.is_admin = true`
- ✅ Wszystkie pola są sanitized i validowane

---

## 💡 Tips

1. **Icon emoji**: Użyj emoji picker (Windows: Win + .) lub skopiuj z: https://emojipedia.org
2. **Kolory**: Wybierz kontrastowe kolory dla lepszej widoczności na mapie
3. **Display Order**: Popularne kategorie daj niższy numer (0, 1, 2...)
4. **Tłumaczenia**: PL i EN są wymagane, reszta opcjonalna

---

## 📊 Statystyki

Liczba kategorii per języka:
- 🇵🇱 Polski: **required**
- 🇬🇧 English: **required**
- 🇬🇷 Greek: optional
- 🇮🇱 Hebrew: optional

---

**Gotowe! Teraz możesz łatwo zarządzać kategoriami rekomendacji!** 🎉
