-- ============================================================================
-- SEED TEST RECOMMENDATIONS
-- Dodaj przykładowe rekomendacje do testowania strony recommendations.html
-- ============================================================================

-- Pobierz ID kategorii
DO $$
DECLARE
  cat_accommodation uuid;
  cat_restaurants uuid;
  cat_beaches uuid;
BEGIN
  -- Znajdź kategorie
  SELECT id INTO cat_accommodation FROM public.recommendation_categories WHERE name_en = 'Accommodation' LIMIT 1;
  SELECT id INTO cat_restaurants FROM public.recommendation_categories WHERE name_en = 'Restaurants' LIMIT 1;
  SELECT id INTO cat_beaches FROM public.recommendation_categories WHERE name_en = 'Beaches' LIMIT 1;

  -- Dodaj przykładowe rekomendacje - Zakwaterowanie
  INSERT INTO public.recommendations (
    category_id,
    title_pl, title_en,
    description_pl, description_en,
    location_name,
    latitude, longitude,
    image_url,
    google_url,
    website_url,
    phone,
    promo_code,
    discount_text_pl, discount_text_en,
    offer_text_pl, offer_text_en,
    active,
    featured,
    display_order,
    priority
  ) VALUES 
  -- Hotel w Larnace
  (
    cat_accommodation,
    'Sun Hall Hotel', 'Sun Hall Hotel',
    'Elegancki hotel przy plaży w centrum Larnaki z pięknym widokiem na morze i wysokim standardem obsługi.',
    'Elegant beachfront hotel in the heart of Larnaca with stunning sea views and high-quality service.',
    'Larnaka',
    34.9176, 33.6369,
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    'https://maps.google.com/?q=Sun+Hall+Hotel+Larnaca',
    'https://www.sunhall.com.cy',
    '+357 24 653 341',
    'CYPRUSEYE2024',
    '15% zniżki z kodem CYPRUSEYE2024', '15% discount with code CYPRUSEYE2024',
    'Darmowe śniadanie dla gości CyprusEye', 'Free breakfast for CyprusEye guests',
    true,
    true,
    1,
    10
  ),
  
  -- Villa w Pafos
  (
    cat_accommodation,
    'Coral Beach Hotel & Resort', 'Coral Beach Hotel & Resort',
    'Luksusowy resort z prywatną plażą, spa i wieloma restauracjami. Idealne miejsce na rodzinne wakacje.',
    'Luxury resort with private beach, spa and multiple restaurants. Perfect for family holidays.',
    'Paphos',
    34.7805, 32.4065,
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
    'https://maps.google.com/?q=Coral+Beach+Hotel+Paphos',
    'https://www.coral.com.cy',
    '+357 26 881 000',
    'CYPRUSEYE10',
    '10% rabatu przy rezerwacji przez CyprusEye', '10% discount when booking through CyprusEye',
    'Darmowy upgrade pokoju (w zależności od dostępności)', 'Free room upgrade (subject to availability)',
    true,
    true,
    2,
    9
  );

  -- Dodaj przykładowe rekomendacje - Restauracje
  INSERT INTO public.recommendations (
    category_id,
    title_pl, title_en,
    description_pl, description_en,
    location_name,
    latitude, longitude,
    image_url,
    google_url,
    phone,
    promo_code,
    discount_text_pl, discount_text_en,
    active,
    featured,
    display_order,
    priority
  ) VALUES
  -- Restauracja w Larnace
  (
    cat_restaurants,
    'Militzis', 'Militzis',
    'Autentyczna cypryjska tawerna z tradycyjnymi potrawami i świeżymi rybami. Rodzinna atmosfera i uczciwe ceny.',
    'Authentic Cypriot tavern with traditional dishes and fresh fish. Family atmosphere and fair prices.',
    'Larnaka',
    34.9176, 33.6280,
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
    'https://maps.google.com/?q=Militzis+Restaurant+Larnaca',
    '+357 24 655 867',
    'CYPRUSEYE15',
    '15% zniżki na całe zamówienie', '15% discount on entire order',
    true,
    true,
    1,
    8
  ),
  
  -- Restauracja w Limassol
  (
    cat_restaurants,
    'Artima Bistro', 'Artima Bistro',
    'Nowoczesna kuchnia śródziemnomorska z lokalnymi składnikami. Doskonałe wina i romantyczna atmosfera.',
    'Modern Mediterranean cuisine with local ingredients. Excellent wines and romantic atmosphere.',
    'Limassol',
    34.6841, 33.0441,
    'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800',
    'https://maps.google.com/?q=Artima+Bistro+Limassol',
    '+357 25 370 222',
    null,
    null, null,
    true,
    false,
    2,
    5
  );

  -- Dodaj przykładowe rekomendacje - Plaże
  INSERT INTO public.recommendations (
    category_id,
    title_pl, title_en,
    description_pl, description_en,
    location_name,
    latitude, longitude,
    image_url,
    google_url,
    offer_text_pl, offer_text_en,
    active,
    featured,
    display_order,
    priority
  ) VALUES
  -- Plaża Nissi Beach
  (
    cat_beaches,
    'Nissi Beach', 'Nissi Beach',
    'Najsłynniejsza plaża Cypru z turkusową wodą i białym piaskiem. Idealna do pływania i sportów wodnych.',
    'Cyprus''s most famous beach with turquoise water and white sand. Perfect for swimming and water sports.',
    'Ayia Napa',
    34.9893, 34.0016,
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    'https://maps.google.com/?q=Nissi+Beach+Ayia+Napa',
    'Wypożyczalnia leżaków i parasoli dostępna na miejscu', 'Sunbed and umbrella rentals available on site',
    true,
    true,
    1,
    7
  ),
  
  -- Plaża Konnos Bay
  (
    cat_beaches,
    'Konnos Bay', 'Konnos Bay',
    'Malownicza zatoka z czystą wodą, otoczona skałami. Spokojne miejsce idealne dla rodzin.',
    'Picturesque bay with crystal-clear water, surrounded by rocks. Peaceful spot ideal for families.',
    'Protaras',
    35.0337, 34.0611,
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
    'https://maps.google.com/?q=Konnos+Bay+Protaras',
    'Bezpłatny parking w pobliżu plaży', 'Free parking near the beach',
    true,
    false,
    2,
    6
  );

  RAISE NOTICE 'Dodano przykładowe rekomendacje!';
END $$;
