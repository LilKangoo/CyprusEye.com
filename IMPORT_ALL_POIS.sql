-- =====================================================
-- IMPORT STATIC POIs TO SUPABASE
-- =====================================================
-- Generated from: js/data-places.js
-- Total POIs: 58
-- =====================================================

-- Delete existing POIs (optional - comment out if you want to keep existing)
-- DELETE FROM pois;

-- Insert all POIs
INSERT INTO pois (id, name, description, lat, lng, badge, xp, required_level, status, google_maps_url)
VALUES
  ('kato-pafos-archaeological-park', 'Kato Paphos Archaeological Park (Nea Paphos)', 'Expansive UNESCO site with famous mosaics and the ruins of the ancient city of Nea Paphos.', 34.75567, 32.40417, 'Nea Paphos Curator', 210, 6, 'published', 'https://maps.google.com/?q=34.75567,32.40417'),
  ('tombs-of-the-kings', 'Tombs of the Kings in Paphos', 'Monumental rock-cut tombs from the Hellenistic and Roman periods adorned with Doric columns.', 34.775, 32.40694, 'Necropolis Guardian', 190, 5, 'published', 'https://maps.google.com/?q=34.77500,32.40694'),
  ('coral-bay', 'Coral Bay Beach', 'Golden sand, gentle entry into the sea and crystal-clear water—the classic spot to relax near Peyia.', 34.854, 32.3695, 'Beach Explorer', 110, 1, 'published', 'https://maps.google.com/?q=34.85400,32.36950'),
  ('aphrodite-rock', 'Skała Afrodyty (Petra tou Romiou)', 'Legenda głosi, że wśród turkusowych fal u stóp skały narodziła się Afrodyta – idealne miejsce na zachód słońca.', 34.6641, 32.6271, 'Strażnik Mitów', 120, 1, 'published', 'https://maps.google.com/?q=34.66410,32.62710'),
  ('blue-lagoon-akamas', 'Błękitna Laguna (Akamas)', 'Krystalicznie czysta zatoka otoczona dziką przyrodą półwyspu Akamas – raj do snorkelingu.', 35.08417, 32.30611, 'Łowca Turkusu', 220, 7, 'published', 'https://maps.google.com/?q=35.08417,32.30611'),
  ('kourion-archaeological-site', 'Stanowisko archeologiczne Kurion', 'Ruiny antycznego miasta na klifie z teatrem, łaźniami i mozaikami Domu Eustoliosa.', 34.6642, 32.8877, 'Obrońca Kurionu', 200, 6, 'published', 'https://maps.google.com/?q=34.66420,32.88770'),
  ('kolossi-castle', 'Zamek Kolossi', 'XIII-wieczna forteca joannitów, dawne centrum produkcji słodkiego wina Commandaria.', 34.66527, 32.93396, 'Rycerz Kolossi', 170, 4, 'published', 'https://maps.google.com/?q=34.66527,32.93396'),
  ('molos-promenade', 'Promenada Molos w Limassol', 'Nadmorski park z palmami, rzeźbami i kawiarniami – ulubione miejsce spacerów mieszkańców Limassol.', 34.67658, 33.04979, 'Mistrz Promenady', 130, 2, 'published', 'https://maps.google.com/?q=34.67658,33.04979'),
  ('amathus-ruins', 'Ruiny starożytnego Amathus', 'Pozostałości jednego z królewskich miast Cypru z agorą, świątynią Afrodyty i wczesnochrześcijańską bazyliką.', 34.7125, 33.14167, 'Kurator Amathus', 180, 5, 'published', 'https://maps.google.com/?q=34.71250,33.14167'),
  ('limassol-castle', 'Zamek Limassol (Muzeum Średniowiecza)', 'Kamienny zamek w sercu starego miasta, dziś mieszczący muzeum średniowiecznych artefaktów.', 34.6722, 33.0415, 'Strażnik Limassol', 160, 3, 'published', 'https://maps.google.com/?q=34.67220,33.04150'),
  ('saint-lazarus-church', 'Kościół św. Łazarza w Larnace', 'Kamienna świątynia z IX wieku, zbudowana nad grobem św. Łazarza i słynąca z bogatego ikonostasu.', 34.9125, 33.6333, 'Opiekun Relikwii', 150, 3, 'published', 'https://maps.google.com/?q=34.91250,33.63330'),
  ('larnaca-salt-lake-hala-sultan', 'Słone Jezioro Larnaka i Hala Sultan Tekke', 'Zimowe flamingi i mistyczny meczet Hala Sultan Tekke tworzą wyjątkowy krajobraz nad słonym jeziorem.', 34.8853, 33.6102, 'Obserwator Flamingów', 140, 3, 'published', 'https://maps.google.com/?q=34.88530,33.61020'),
  ('finikoudes-beach', 'Plaża Finikoudes w Larnace', 'Miejska plaża z palmową promenadą, tętniącymi życiem kawiarniami i łagodnym wejściem do morza.', 34.913895, 33.638418, 'Mistrz Palm', 115, 1, 'published', 'https://maps.google.com/?q=34.913895,33.638418'),
  ('chirokitia-archaeological-site', 'Stanowisko archeologiczne Chirokitia', 'Neolityczna osada wpisana na listę UNESCO z rekonstrukcjami okrągłych kamiennych chat.', 34.79672, 33.34372, 'Pionier Neolitu', 200, 5, 'published', 'https://maps.google.com/?q=34.79672,33.34372'),
  ('lefkara-village', 'Wioska Lefkara', 'Górska wioska słynąca z koronek lefkaritiko i srebrnego rękodzieła w kamiennych domach.', 34.867, 33.3, 'Mistrzyni Koronek', 170, 4, 'published', 'https://maps.google.com/?q=34.86700,33.30000'),
  ('nissi-beach', 'Plaża Nissi (Ayia Napa)', 'Jasny piasek, płytka laguna i wysepka Nissi czynią to miejsce ikoną wypoczynku i sportów wodnych.', 34.99, 33.97, 'Łowca Słońca', 120, 1, 'published', 'https://maps.google.com/?q=34.99000,33.97000'),
  ('cape-greco', 'Przylądek Greko (Cape Greco)', 'Park narodowy z klifami, morskimi jaskiniami i słynnym skalnym Mostem Miłości.', 35, 34.01667, 'Łowca Horyzontów', 210, 8, 'published', 'https://maps.google.com/?q=35.00000,34.01667'),
  ('fig-tree-bay', 'Plaża Fig Tree Bay (Protaras)', 'Lazurowa zatoka ze złotym piaskiem i samotnym drzewem figowym będącym symbolem okolicy.', 35.012567, 34.058549, 'Strażnik Piasków', 125, 1, 'published', 'https://maps.google.com/?q=35.012567,34.058549'),
  ('ayia-napa-monastery', 'Klasztor Ayia Napa', 'XVII-wieczny klasztor z dziedzińcem i sykomorą, będący duchową oazą gwarnej Ayia Napy.', 34.989202, 33.999746, 'Kustosz Monastyrów', 160, 3, 'published', 'https://maps.google.com/?q=34.989202,33.999746'),
  ('ayia-napa-sculpture-park', 'Park Rzeźb w Ayia Napa', 'Plenerowa galeria sztuki z ponad setką rzeźb na tle morza i sąsiedniego parku kaktusów.', 34.985077, 34.01929, 'Kurator Rzeźb', 150, 3, 'published', 'https://maps.google.com/?q=34.985077,34.019290'),
  ('troodos-olympos', 'Góra Olimp (Olimbos)', 'Najwyższy szczyt Cypru z letnim szlakiem Artemis i zimowymi stokami narciarskimi.', 34.93639, 32.86333, 'Zdobywca Troodos', 200, 7, 'published', 'https://maps.google.com/?q=34.93639,32.86333'),
  ('kykkos-monastery', 'Klasztor Kykkos', 'Najbogatszy klasztor Cypru z mozaikami, złotymi ikonami i muzeum sakralnym.', 34.98334, 32.741299, 'Opiekun Dziedzictwa', 190, 5, 'published', 'https://maps.google.com/?q=34.98334,32.741299'),
  ('omodos-village', 'Wioska Omodos (centrum)', 'Historyczna wioska z klasztorem Św. Krzyża, brukowanymi uliczkami i lokalnym rękodziełem.', 34.84926, 32.80986, 'Sommelier Omodos', 170, 4, 'published', 'https://maps.google.com/?q=34.84926,32.80986'),
  ('kakopetria-village', 'Wioska Kakopetria', 'Górska miejscowość z tradycyjnymi domami i strumieniem, idealna na spacery po Troodos.', 34.9876, 32.9015, 'Strażnik Górskich Wiosek', 160, 3, 'published', 'https://maps.google.com/?q=34.98760,32.90150'),
  ('caledonia-waterfall', 'Wodospad Kaledonia (Kalidonia)', 'Jedna z najwyższych kaskad Cypru ukryta w cienistym wąwozie w pobliżu miejscowości Platres.', 34.90298, 32.86989, 'Poskramiacz Wodospadów', 180, 4, 'published', 'https://maps.google.com/?q=34.90298,32.86989'),
  ('kyrenia-old-harbour', 'Stary port w Kyrenii (Girne)', 'Zabytkowy port z tawernami i jachtami u stóp średniowiecznego zamku, tętniący wieczornym życiem.', 35.34189, 33.320442, 'Kapitan Morza Śródziemnego', 150, 2, 'published', 'https://maps.google.com/?q=35.34189,33.320442'),
  ('kyrenia-castle', 'Zamek w Kyrenii', 'Wenecka forteca z muzeum wraku statku i widokami na port oraz Morze Śródziemne.', 35.34202, 33.32191, 'Strażnik Bastionu', 180, 4, 'published', 'https://maps.google.com/?q=35.34202,33.32191'),
  ('st-hilarion-castle', 'Zamek św. Hilariona', 'Górska twierdza rozsiana po trzech poziomach skał, z legendarnymi widokami na wybrzeże.', 35.312485, 33.281364, 'Rycerz Gór Kyrenii', 220, 6, 'published', 'https://maps.google.com/?q=35.312485,33.281364'),
  ('famagusta-old-town', 'Stare miasto Famagusta (Gazimağusa)', 'Ufortyfikowane miasto z weneckimi murami, katedrą św. Mikołaja i zamkiem Othello przy porcie.', 35.125, 33.94167, 'Kronikarz Famagusty', 210, 6, 'published', 'https://maps.google.com/?q=35.12500,33.94167'),
  ('karpaz-golden-beach', 'Złota Plaża (Golden Beach) na Półwyspie Karpaz', 'Dzika, szeroka plaża o drobnym piasku, otoczona wydmami i stadami dzikich osłów.', 35.63889, 34.54389, 'Strażnik Wydm', 230, 7, 'published', 'https://maps.google.com/?q=35.63889,34.54389'),
  ('zenobia-wreck', 'Wrak Zenobii (Zenobia Wreck)', 'Wrak promu zatopiony u wybrzeża Larnaki, popularny obiekt do nurkowania.', 34.9, 33.633, 'Mistrz Wraków', 240, 8, 'published', 'https://maps.google.com/?q=34.90000,33.63300'),
  ('avakas-gorge', 'Wąwóz Avakas (Avakas Gorge)', 'Wąwóz z dramatycznymi formacjami skalnymi i ścieżkami trekkingowymi na półwyspie Akamas.', 34.9935, 32.355, 'Wędrowiec Wąwozów', 200, 6, 'published', 'https://maps.google.com/?q=34.99350,32.35500'),
  ('aphrodites-baths', 'Łaźnie Afrodyty (Baths of Aphrodite)', 'Mały, romantyczny basen naturalny na półwyspie Akamas, związany z legendą Afrodyty.', 35.014, 32.367, 'Strażnik Legend Afrodyty', 150, 3, 'published', 'https://maps.google.com/?q=35.01400,32.36700'),
  ('polis-latchi-marina', 'Polis i Marina Latchi', 'Nadmorskie miasteczko z mariną, będące punktem wypadowym na rejsy do Błękitnej Laguny.', 35.038, 32.43, 'Kapitan Laguny', 140, 2, 'published', 'https://maps.google.com/?q=35.03800,32.43000'),
  ('st-hilarion-vantage-point', 'Punkt widokowy zamku św. Hilariona', 'Punkt widokowy u stóp zamku św. Hilariona z szeroką panoramą wybrzeża Kyrenii.', 35.31, 33.28, 'Łowca Horyzontów', 160, 4, 'published', 'https://maps.google.com/?q=35.31000,33.28000'),
  ('buffavento-castle', 'Zamek Buffavento', 'Ruiny zamku na wzgórzu nad Morzem Śródziemnym, niedaleko twierdzy św. Hilariona.', 35.33, 33.29, 'Strażnik Buffavento', 210, 6, 'published', 'https://maps.google.com/?q=35.33000,33.29000'),
  ('lania-village', 'Wioska Lania', 'Malownicza osada u podnóża Troodos, znana z winiarstwa, galerii i spokojnej atmosfery.', 34.78, 32.9, 'Artysta z Lanii', 120, 1, 'published', 'https://maps.google.com/?q=34.78000,32.90000'),
  ('trooditissa-monastery', 'Klasztor Trooditissa', 'Górski monastyr w masywie Troodos, otoczony lasami i pełen ikon oraz pielgrzymów.', 34.916, 32.819, 'Pielgrzym Trooditissa', 170, 4, 'published', 'https://maps.google.com/?q=34.91600,32.81900'),
  ('soli-ancient-site', 'Starożytne miasto Soli', 'Ruiny antycznego miasta z amfiteatrem i pozostałościami portu w pobliżu Famagusty.', 35.144, 33.897, 'Archeolog Soli', 180, 5, 'published', 'https://maps.google.com/?q=35.14400,33.89700'),
  ('limassol-municipal-aquarium', 'Miejskie Akwarium w Limassol', 'Kameralne akwarium edukacyjne prezentujące lokalną faunę morską i programy ochronne.', 34.707, 33.069, 'Opiekun Raf Limassol', 110, 1, 'published', 'https://maps.google.com/?q=34.70700,33.06900'),
  ('dasoudi-beach', 'Plaża Dasoudi', 'Piaszczysta plaża w Limassol z nadbrzeżnym parkiem, ścieżkami spacerowymi i terenami zielonymi.', 34.68, 33.035, 'Miłośnik Dasoudi', 115, 1, 'published', 'https://maps.google.com/?q=34.68000,33.03500'),
  ('governors-beach', 'governors-beach', '', 34.725, 33.1, 'Odkrywca Klifów', 130, 2, 'published', 'https://maps.google.com/?q=34.72500,33.10000'),
  ('macronissos-beach', 'Plaża Macronissos', 'Zatoka z jasnym piaskiem i spokojnymi wodami w pobliżu Ayia Napy, idealna na rodzinny wypoczynek.', 34.9975, 34.02, 'Plażowicz Macronissos', 125, 1, 'published', 'https://maps.google.com/?q=34.99750,34.02000'),
  ('yeroskipou-town', 'Yeroskipou (Kouklia)', 'Miasteczko niedaleko Pafos z kościołem Agios Georgios i słynnymi słodyczami pastelli.', 34.715, 32.49, 'Smakosz Pastelli', 135, 2, 'published', 'https://maps.google.com/?q=34.71500,32.49000'),
  ('agios-neophytos-monastery', 'Klasztor Agios Neophytos', 'Pustelniczy klasztor wykuty w skale, zdobiony malowidłami założonymi przez św. Neofitosa.', 34.822, 32.389, 'Kronikarz Neofitosa', 175, 4, 'published', 'https://maps.google.com/?q=34.82200,32.38900'),
  ('vouni-ancient-house', 'Starożytny dom zgromadzeń w Vouni', 'Archeologiczne ruiny na wzgórzu Vouni z widokiem na zatoki i dawne królewskie rezydencje.', 34.8, 32.583, 'Strażnik Vouni', 190, 5, 'published', 'https://maps.google.com/?q=34.80000,32.58300'),
  ('nicosia-archaeological-museum', 'Muzeum Archeologiczne w Nikozji', 'Muzeum ukazujące dzieje Cypru od prehistorii po średniowiecze z bogatą kolekcją artefaktów.', 35.171, 33.365, 'Kurator Nikozji', 160, 3, 'published', 'https://maps.google.com/?q=35.17100,33.36500'),
  ('buyuk-han', 'Büyük Han w Nikozji', 'Otoczony dziedziniec karawanseraj z czasów osmańskich, pełen warsztatów rękodzieła i kawiarni.', 35.176, 33.364, 'Kupiec Han', 150, 3, 'published', 'https://maps.google.com/?q=35.17600,33.36400'),
  ('ledra-street', 'Ulica i Brama Ledra', 'Jedna z głównych ulic Starej Nikozji prowadząca przez Zieloną Linię między południem a północą.', 35.1765, 33.3605, 'Wędrowiec Ledra', 120, 1, 'published', 'https://maps.google.com/?q=35.17650,33.36050'),
  ('eleftheria-square', 'Plac Eleftheria (Plac Wolności)', 'Nowoczesny plac w Nikozji projektu Zahy Hadid, łączący historyczne i współczesne warstwy miasta.', 35.173, 33.366, 'Odkrywca Eleftherii', 125, 1, 'published', 'https://maps.google.com/?q=35.17300,33.36600'),
  ('anexartisias-street', 'Ulica Anexartisias w Limassol', 'Główna ulica handlowa Limassol, ulubiona przez mieszkańców i turystów na zakupy oraz kawiarnie.', 34.7073, 33.0214, 'Łowca Witryn', 115, 1, 'published', 'https://maps.google.com/?q=34.70730,33.02140'),
  ('fasouri-watermania', 'Park wodny Fasouri Watermania', 'Największy park wodny na Cyprze z licznymi zjeżdżalniami, basenami tematycznymi i strefami relaksu.', 34.682, 33.013, 'Mistrz Zjeżdżalni', 180, 4, 'published', 'https://maps.google.com/?q=34.68200,33.01300'),
  ('akamas-national-park', 'Park Narodowy Akamas', 'Rozległy obszar dzikiej natury z punktami widokowymi, szlakami i miejscami lęgowymi żółwi.', 35.041, 32.375, 'Strażnik Akamas', 230, 7, 'published', 'https://maps.google.com/?q=35.04100,32.37500'),
  ('panagia-kykkos-viewpoint', 'Punkt widokowy klasztoru Panagia Kykkos', 'Wysoko położony punkt przy klasztorze Kykkos z panoramicznym widokiem na góry Troodos.', 34.991, 32.741, 'Pielgrzym Kykkos', 220, 7, 'published', 'https://maps.google.com/?q=34.99100,32.74100'),
  ('troodos-square', 'Plac Troodos', 'Centralny punkt gór Troodos z bazą wypadową na szlaki i zimową stacją narciarską.', 34.95, 32.87, 'Odkrywca Troodos', 140, 2, 'published', 'https://maps.google.com/?q=34.95000,32.87000'),
  ('avakas-gorge-west-entrance', 'Wąwóz Avakas – wejście zachodnie', 'Alternatywne wejście do wąwozu Avakas, oferujące spokojniejszy trekking i inne formacje skalne.', 35.0005, 32.35, 'Tropiciel Avakas', 190, 5, 'published', 'https://maps.google.com/?q=35.00050,32.35000'),
  ('cape-greco-sea-caves', 'Jaskinie morskie Cape Greco', 'Spektakularne jaskinie morskie na klifach Cape Greco, dostępne łodzią, kajakiem lub ze snorkelem.', 34.9965, 34.025, 'Poszukiwacz Jaskiń', 200, 6, 'published', 'https://maps.google.com/?q=34.99650,34.02500'),
  ('cyprus-museum', 'Cyprus Museum w Nikozji', 'Główne muzeum archeologiczne Cypru z kolekcją obejmującą wszystkie epoki historyczne.', 35.172, 33.3655, 'Strażnik Dziedzictwa', 170, 4, 'published', 'https://maps.google.com/?q=35.17200,33.36550')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  badge = EXCLUDED.badge,
  xp = EXCLUDED.xp,
  required_level = EXCLUDED.required_level,
  status = EXCLUDED.status,
  google_maps_url = EXCLUDED.google_maps_url;

-- =====================================================
-- VERIFY
-- =====================================================

SELECT 
  'Import completed!' as status,
  COUNT(*) as total_pois,
  COUNT(*) FILTER (WHERE status = 'published') as published_pois
FROM pois;

-- Show sample
SELECT id, name, lat, lng, status, xp 
FROM pois 
WHERE status = 'published'
ORDER BY xp DESC
LIMIT 10;

-- =====================================================
-- RESULT:
-- Should show 58 total POIs, all published
-- =====================================================
