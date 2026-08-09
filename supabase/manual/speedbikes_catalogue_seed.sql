-- speedbikes-catalogue-seed-v1
-- MANUAL, PRODUCTION-WRITE SCRIPT. DO NOT RUN UNTIL:
--   1. all Stage 3 migrations and the six-decimal precision migration PASS,
--   2. the 21 static image assets are deployed,
--   3. the Admin has approved the complete draft package.
--
-- Safe initial state: unpublished, unavailable, availability_mode=legacy,
-- both global runtime flags OFF. Availability rows are future requestability
-- only and never constitute partner acceptance.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create temporary table _speedbikes_expected_offers on commit drop as
select *
from jsonb_to_recordset($catalogue$
[
  {
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "deposit_override_id": "6ae5563c-7c97-50f7-8646-b5ae007a6960",
    "pdf_page": 4,
    "slug": "snipper-fx-400",
    "vehicle_kind": "buggy",
    "model": {
      "en": "Snipper FX",
      "pl": "Snipper FX",
      "he": "Snipper FX"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 400-450 CC",
    "description": {
      "en": "Snipper FX (BUGGY 400-450 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Snipper FX (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Snipper FX (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "400 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "400 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "400 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 400,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-snipper-fx-400.webp",
    "first_day_price": 110,
    "sort_order": 3000,
    "expected_tier_count": 7
  },
  {
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "deposit_override_id": "7aabc0c2-3887-5f05-9dff-5be74ec9e86b",
    "pdf_page": 5,
    "slug": "kymco-uvx-450",
    "vehicle_kind": "buggy",
    "model": {
      "en": "Kymco UVX",
      "pl": "Kymco UVX",
      "he": "Kymco UVX"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 400-450 CC",
    "description": {
      "en": "Kymco UVX (BUGGY 400-450 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Kymco UVX (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Kymco UVX (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "450 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "450 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "450 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 450,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-uvx-450.webp",
    "first_day_price": 110,
    "sort_order": 3001,
    "expected_tier_count": 7
  },
  {
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "deposit_override_id": "eb968a57-762c-5c0a-bdab-88fca2c41726",
    "pdf_page": 6,
    "slug": "linhai-t-boss-efi-550",
    "vehicle_kind": "buggy",
    "model": {
      "en": "Linhai T-BOSS Efi",
      "pl": "Linhai T-BOSS Efi",
      "he": "Linhai T-BOSS Efi"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 550 CC",
    "description": {
      "en": "Linhai T-BOSS Efi (BUGGY 550 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Linhai T-BOSS Efi (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Linhai T-BOSS Efi (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "550 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "550 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "550 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 550,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-linhai-t-boss-efi-550.webp",
    "first_day_price": 120,
    "sort_order": 3002,
    "expected_tier_count": 7
  },
  {
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "deposit_override_id": "2016c083-c8ef-5968-8d46-75c4744ac1a6",
    "pdf_page": 7,
    "slug": "polaris-ranger-nordic-pro-570",
    "vehicle_kind": "buggy",
    "model": {
      "en": "Polaris Ranger Nordic Pro",
      "pl": "Polaris Ranger Nordic Pro",
      "he": "Polaris Ranger Nordic Pro"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 570 CC NEW",
    "description": {
      "en": "Polaris Ranger Nordic Pro (BUGGY 570 CC NEW). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Polaris Ranger Nordic Pro (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Polaris Ranger Nordic Pro (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "570 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "570 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "570 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 570,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-polaris-ranger-nordic-pro-570.webp",
    "first_day_price": 140,
    "sort_order": 3003,
    "expected_tier_count": 7
  },
  {
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "deposit_override_id": "c6169a82-a8c8-5259-a7af-95dccfac03fd",
    "pdf_page": 8,
    "slug": "linhai-t-boss-efi-650",
    "vehicle_kind": "buggy",
    "model": {
      "en": "Linhai T-BOSS Efi",
      "pl": "Linhai T-BOSS Efi",
      "he": "Linhai T-BOSS Efi"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 650 CC",
    "description": {
      "en": "Linhai T-BOSS Efi (BUGGY 650 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Linhai T-BOSS Efi (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Linhai T-BOSS Efi (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "650 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "650 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "650 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 650,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-linhai-t-boss-efi-650.webp",
    "first_day_price": 150,
    "sort_order": 3004,
    "expected_tier_count": 7
  },
  {
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "deposit_override_id": "0db5ced8-0869-5b5a-8bce-dcad83c60faa",
    "pdf_page": 9,
    "slug": "cf-moto-efi-800",
    "vehicle_kind": "buggy",
    "model": {
      "en": "CF MOTO Efi",
      "pl": "CF MOTO Efi",
      "he": "CF MOTO Efi"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 800 CC",
    "description": {
      "en": "CF MOTO Efi (BUGGY 800 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "CF MOTO Efi (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "CF MOTO Efi (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "800 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "800 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "800 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 800,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-cf-moto-efi-800.webp",
    "first_day_price": 150,
    "sort_order": 3005,
    "expected_tier_count": 7
  },
  {
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "deposit_override_id": "8a50d5c6-1bca-50d1-84f6-3f3f438655f3",
    "pdf_page": 10,
    "slug": "cf-moto-z-force-se-800",
    "vehicle_kind": "buggy",
    "model": {
      "en": "CF MOTO Z-force S.E",
      "pl": "CF MOTO Z-force S.E",
      "he": "CF MOTO Z-force S.E"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 800 CC (SPECIAL EDITION)",
    "description": {
      "en": "CF MOTO Z-force S.E (BUGGY 800 CC (SPECIAL EDITION)). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "CF MOTO Z-force S.E (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "CF MOTO Z-force S.E (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "800 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "800 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "800 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 800,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-cf-moto-z-force-se-800.webp",
    "first_day_price": 160,
    "sort_order": 3006,
    "expected_tier_count": 7
  },
  {
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "deposit_override_id": "7c4117e5-5229-52a9-9f81-97dfd03c8f70",
    "pdf_page": 11,
    "slug": "polaris-rzr-trail-s-1000",
    "vehicle_kind": "buggy",
    "model": {
      "en": "Polaris RZR TRAIL-S",
      "pl": "Polaris RZR TRAIL-S",
      "he": "Polaris RZR TRAIL-S"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 1000 CC (2-3 SEAT)",
    "description": {
      "en": "Polaris RZR TRAIL-S (BUGGY 1000 CC (2-3 SEAT)). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Polaris RZR TRAIL-S (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Polaris RZR TRAIL-S (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "1000 cc",
        "3 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "1000 cm³",
        "3 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "1000 סמ״ק",
        "3 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 1000,
    "max_passengers": 3,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-polaris-rzr-trail-s-1000.webp",
    "first_day_price": 180,
    "sort_order": 3007,
    "expected_tier_count": 4
  },
  {
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "deposit_override_id": "7d4c28fc-ffe6-576c-9728-d3fd25631e6b",
    "pdf_page": 12,
    "slug": "polaris-xp-1000",
    "vehicle_kind": "buggy",
    "model": {
      "en": "Polaris XP",
      "pl": "Polaris XP",
      "he": "Polaris XP"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 1000 CC (2-3 SEAT)",
    "description": {
      "en": "Polaris XP (BUGGY 1000 CC (2-3 SEAT)). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Polaris XP (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Polaris XP (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "1000 cc",
        "3 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "1000 cm³",
        "3 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "1000 סמ״ק",
        "3 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 1000,
    "max_passengers": 3,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-polaris-xp-1000.webp",
    "first_day_price": 180,
    "sort_order": 3008,
    "expected_tier_count": 4
  },
  {
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "deposit_override_id": "29c4522c-8c2d-5449-8788-cd1e6bb52b09",
    "pdf_page": 13,
    "slug": "polaris-rzr-1000-4-seat",
    "vehicle_kind": "buggy",
    "model": {
      "en": "Polaris RZR",
      "pl": "Polaris RZR",
      "he": "Polaris RZR"
    },
    "car_type": {
      "en": "Buggy",
      "pl": "Buggy",
      "he": "באגי"
    },
    "source_price_group": "BUGGY 1000 CC (4 SEAT) - PARTNER CONFIRMED",
    "description": {
      "en": "Polaris RZR (BUGGY 1000 CC (4 SEAT)). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Polaris RZR (Buggy). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Polaris RZR (באגי). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "1000 cc",
        "4 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "1000 cm³",
        "4 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "1000 סמ״ק",
        "4 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 1000,
    "max_passengers": 4,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-polaris-rzr-1000-4-seat.webp",
    "first_day_price": 230,
    "sort_order": 3009,
    "expected_tier_count": 4
  },
  {
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "deposit_override_id": "3f36fcfa-d575-53a4-8068-ecf6facb18d4",
    "pdf_page": 14,
    "slug": "kymco-mxu-50",
    "vehicle_kind": "quad",
    "model": {
      "en": "Kymco MXU",
      "pl": "Kymco MXU",
      "he": "Kymco MXU"
    },
    "car_type": {
      "en": "Quad / ATV",
      "pl": "Quad / ATV",
      "he": "טרקטורון / ATV"
    },
    "source_price_group": "ATV 50 CC - PARTNER CONFIRMED",
    "description": {
      "en": "Kymco MXU (ATV 50 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Kymco MXU (Quad / ATV). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Kymco MXU (טרקטורון / ATV). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "50 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "50 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "50 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 50,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-mxu-50.webp",
    "first_day_price": 50,
    "sort_order": 3010,
    "expected_tier_count": 7
  },
  {
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "deposit_override_id": "ba5b1ac4-b3cc-5db8-979c-523e3318dd3e",
    "pdf_page": 15,
    "slug": "kymco-mxu-greenline-170",
    "vehicle_kind": "quad",
    "model": {
      "en": "Kymco MXU GreenLine",
      "pl": "Kymco MXU GreenLine",
      "he": "Kymco MXU GreenLine"
    },
    "car_type": {
      "en": "Quad / ATV",
      "pl": "Quad / ATV",
      "he": "טרקטורון / ATV"
    },
    "source_price_group": "ATV 170 CC",
    "description": {
      "en": "Kymco MXU GreenLine (ATV 170 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Kymco MXU GreenLine (Quad / ATV). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Kymco MXU GreenLine (טרקטורון / ATV). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "170 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "170 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "170 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 170,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-mxu-greenline-170.webp",
    "first_day_price": 60,
    "sort_order": 3011,
    "expected_tier_count": 7
  },
  {
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "deposit_override_id": "807bafdd-27e5-5a1b-994e-51eef14c5880",
    "pdf_page": 16,
    "slug": "kymco-mxu-250",
    "vehicle_kind": "quad",
    "model": {
      "en": "Kymco MXU",
      "pl": "Kymco MXU",
      "he": "Kymco MXU"
    },
    "car_type": {
      "en": "Quad / ATV",
      "pl": "Quad / ATV",
      "he": "טרקטורון / ATV"
    },
    "source_price_group": "ATV 250 CC",
    "description": {
      "en": "Kymco MXU (ATV 250 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Kymco MXU (Quad / ATV). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Kymco MXU (טרקטורון / ATV). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "250 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "250 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "250 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 250,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-mxu-250.webp",
    "first_day_price": 70,
    "sort_order": 3012,
    "expected_tier_count": 7
  },
  {
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "deposit_override_id": "1bd2f066-7b27-59d3-8656-c153a497ee10",
    "pdf_page": 17,
    "slug": "kymco-maxxer-300",
    "vehicle_kind": "quad",
    "model": {
      "en": "Kymco MAXXER",
      "pl": "Kymco MAXXER",
      "he": "Kymco MAXXER"
    },
    "car_type": {
      "en": "Quad / ATV",
      "pl": "Quad / ATV",
      "he": "טרקטורון / ATV"
    },
    "source_price_group": "ATV 300 CC",
    "description": {
      "en": "Kymco MAXXER (ATV 300 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Kymco MAXXER (Quad / ATV). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Kymco MAXXER (טרקטורון / ATV). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "300 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "300 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "300 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 300,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-maxxer-300.webp",
    "first_day_price": 80,
    "sort_order": 3013,
    "expected_tier_count": 7
  },
  {
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "deposit_override_id": "7fb496b2-be81-59a5-94ba-e4a37e71aab8",
    "pdf_page": 18,
    "slug": "cf-moto-450",
    "vehicle_kind": "quad",
    "model": {
      "en": "CF moto",
      "pl": "CF moto",
      "he": "CF moto"
    },
    "car_type": {
      "en": "Quad / ATV",
      "pl": "Quad / ATV",
      "he": "טרקטורון / ATV"
    },
    "source_price_group": "ATV 450 CC",
    "description": {
      "en": "CF moto (ATV 450 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "CF moto (Quad / ATV). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "CF moto (טרקטורון / ATV). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "450 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "450 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "450 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 450,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-cf-moto-450.webp",
    "first_day_price": 90,
    "sort_order": 3014,
    "expected_tier_count": 7
  },
  {
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "deposit_override_id": "de755671-8a8c-53a2-962d-5d122742cc3b",
    "pdf_page": 19,
    "slug": "cforce-efi-520",
    "vehicle_kind": "quad",
    "model": {
      "en": "CForce Efi",
      "pl": "CForce Efi",
      "he": "CForce Efi"
    },
    "car_type": {
      "en": "Quad / ATV",
      "pl": "Quad / ATV",
      "he": "טרקטורון / ATV"
    },
    "source_price_group": "ATV 520 CC",
    "description": {
      "en": "CForce Efi (ATV 520 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "CForce Efi (Quad / ATV). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "CForce Efi (טרקטורון / ATV). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "520 cc",
        "2 passengers",
        "2WD",
        "Automatic transmission",
        "Petrol",
        "Licence B required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "520 cm³",
        "2 osoby",
        "2WD",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy B",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "520 סמ״ק",
        "2 נוסעים",
        "2WD",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון B",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 520,
    "max_passengers": 2,
    "drive": "2WD",
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "B",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-cforce-efi-520.webp",
    "first_day_price": 100,
    "sort_order": 3015,
    "expected_tier_count": 7
  },
  {
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "deposit_override_id": "82f1e258-9bf7-5947-adcf-bf0a5b05eb2e",
    "pdf_page": 20,
    "slug": "kymco-vitality-50",
    "vehicle_kind": "scooter",
    "model": {
      "en": "Kymco Vitality",
      "pl": "Kymco Vitality",
      "he": "Kymco Vitality"
    },
    "car_type": {
      "en": "Scooter",
      "pl": "Skuter",
      "he": "קטנוע"
    },
    "source_price_group": "SCOOTER 50 CC",
    "description": {
      "en": "Kymco Vitality (SCOOTER 50 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Kymco Vitality (Skuter). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Kymco Vitality (קטנוע). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "50 cc",
        "2 passengers",
        "Automatic transmission",
        "Petrol",
        "Licence AM required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "50 cm³",
        "2 osoby",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy AM",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "50 סמ״ק",
        "2 נוסעים",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון AM",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 50,
    "max_passengers": 2,
    "drive": null,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "AM",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-vitality-50.webp",
    "first_day_price": 40,
    "sort_order": 3016,
    "expected_tier_count": 7
  },
  {
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "deposit_override_id": "8f5b5617-e28e-526a-802f-c7bcf87de6ce",
    "pdf_page": 21,
    "slug": "kymco-agility-sym-jet-14-125",
    "vehicle_kind": "scooter",
    "model": {
      "en": "Kymco Agility / Sym Jet-14",
      "pl": "Kymco Agility / Sym Jet-14",
      "he": "Kymco Agility / Sym Jet-14"
    },
    "car_type": {
      "en": "Scooter",
      "pl": "Skuter",
      "he": "קטנוע"
    },
    "source_price_group": "SCOOTER 125 CC",
    "description": {
      "en": "Kymco Agility / Sym Jet-14 (SCOOTER 125 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Kymco Agility / Sym Jet-14 (Skuter). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Kymco Agility / Sym Jet-14 (קטנוע). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "125 cc",
        "2 passengers",
        "Automatic transmission",
        "Petrol",
        "Licence A1 required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "125 cm³",
        "2 osoby",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy A1",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "125 סמ״ק",
        "2 נוסעים",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון A1",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 125,
    "max_passengers": 2,
    "drive": null,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "A1",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-agility-sym-jet-14-125.webp",
    "first_day_price": 50,
    "sort_order": 3017,
    "expected_tier_count": 7
  },
  {
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "deposit_override_id": "adaac77e-6112-51fb-b86c-e4020a7c7a55",
    "pdf_page": 22,
    "slug": "kymco-x-town-300",
    "vehicle_kind": "scooter",
    "model": {
      "en": "Kymco X-Town",
      "pl": "Kymco X-Town",
      "he": "Kymco X-Town"
    },
    "car_type": {
      "en": "Scooter",
      "pl": "Skuter",
      "he": "קטנוע"
    },
    "source_price_group": "SCOOTER 300 CC",
    "description": {
      "en": "Kymco X-Town (SCOOTER 300 CC). Rental day means exactly 24 hours from collection. VAT is included. Third-party insurance only and helmets are included. Petrol vehicles are supplied full-to-full. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Kymco X-Town (Skuter). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Obowiązuje wyłącznie ubezpieczenie OC; kaski są wliczone. Pojazdy benzynowe są wydawane i zwracane z pełnym bakiem. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Kymco X-Town (קטנוע). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. ביטוח צד ג׳ בלבד וקסדות כלולים. רכבי בנזין נמסרים ומוחזרים עם מכל מלא. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "300 cc",
        "2 passengers",
        "Automatic transmission",
        "Petrol",
        "Licence A required",
        "Minimum age 18",
        "Full valid licence card required; provisional and temporary paper licences are not accepted",
        "Third-party insurance only",
        "VAT included",
        "Helmets included",
        "Full-to-full fuel policy",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "300 cm³",
        "2 osoby",
        "Automatyczna skrzynia biegów",
        "Benzyna",
        "Wymagane prawo jazdy A",
        "Minimalny wiek 18 lat",
        "Wymagana jest pełna ważna karta prawa jazdy; dokumenty tymczasowe i prawa jazdy na okres próbny nie są akceptowane",
        "Wyłącznie ubezpieczenie OC",
        "VAT wliczony",
        "Kaski wliczone",
        "Paliwo pełny-pełny",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "300 סמ״ק",
        "2 נוסעים",
        "תיבת הילוכים אוטומטית",
        "בנזין",
        "נדרש רישיון A",
        "גיל מינימלי 18",
        "נדרש כרטיס רישיון מלא ותקף; רישיונות זמניים ורישיונות על תנאי אינם מתקבלים",
        "ביטוח צד ג׳ בלבד",
        "מע״מ כלול",
        "קסדות כלולות",
        "מדיניות דלק מלא-מלא",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": 300,
    "max_passengers": 2,
    "drive": null,
    "transmission": "automatic",
    "fuel_type": "petrol",
    "required_licence_category": "A",
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "included",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-kymco-x-town-300.webp",
    "first_day_price": 70,
    "sort_order": 3018,
    "expected_tier_count": 7
  },
  {
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "deposit_override_id": "ddf0e51c-0d78-501a-b63a-5b02fff14ca9",
    "pdf_page": 23,
    "slug": "bicycle-group-a",
    "vehicle_kind": "bicycle",
    "model": {
      "en": "Bicycle - Group A",
      "pl": "Rower - Grupa A",
      "he": "אופניים - קבוצה A"
    },
    "car_type": {
      "en": "Bicycle",
      "pl": "Rower",
      "he": "אופניים"
    },
    "source_price_group": "BICYCLE GROUP A",
    "description": {
      "en": "Bicycle - Group A (BICYCLE GROUP A). Rental day means exactly 24 hours from collection. VAT is included. Helmets are included. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Bicycle - Group A (Rower). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Kaski są wliczone. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Bicycle - Group A (אופניים). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. קסדות כלולות. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "3 gears",
        "Minimum age 18",
        "VAT included",
        "Helmets included",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "3 biegi",
        "Minimalny wiek 18 lat",
        "VAT wliczony",
        "Kaski wliczone",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "3 הילוכים",
        "גיל מינימלי 18",
        "מע״מ כלול",
        "קסדות כלולות",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": null,
    "max_passengers": null,
    "drive": null,
    "transmission": null,
    "fuel_type": null,
    "required_licence_category": null,
    "minimum_driver_age": 18,
    "bicycle_gears": "3 gears",
    "insurance_mode": "not_offered",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-bicycle-group-a.webp",
    "first_day_price": 10,
    "sort_order": 3019,
    "expected_tier_count": 7
  },
  {
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "deposit_override_id": "73a19b2c-7170-51a1-ab12-c6d4e699789c",
    "pdf_page": 24,
    "slug": "bicycle-group-b",
    "vehicle_kind": "bicycle",
    "model": {
      "en": "Bicycle - Group B",
      "pl": "Rower - Grupa B",
      "he": "אופניים - קבוצה B"
    },
    "car_type": {
      "en": "Bicycle",
      "pl": "Rower",
      "he": "אופניים"
    },
    "source_price_group": "BICYCLE GROUP B",
    "description": {
      "en": "Bicycle - Group B (BICYCLE GROUP B). Rental day means exactly 24 hours from collection. VAT is included. Helmets are included. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Bicycle - Group B (Rower). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Kaski są wliczone. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Bicycle - Group B (אופניים). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. קסדות כלולות. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "7 gears",
        "Minimum age 18",
        "VAT included",
        "Helmets included",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "7 biegów",
        "Minimalny wiek 18 lat",
        "VAT wliczony",
        "Kaski wliczone",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "7 הילוכים",
        "גיל מינימלי 18",
        "מע״מ כלול",
        "קסדות כלולות",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": null,
    "max_passengers": null,
    "drive": null,
    "transmission": null,
    "fuel_type": null,
    "required_licence_category": null,
    "minimum_driver_age": 18,
    "bicycle_gears": "7 gears",
    "insurance_mode": "not_offered",
    "image_url": null,
    "first_day_price": 15,
    "sort_order": 3020,
    "expected_tier_count": 7
  },
  {
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "deposit_override_id": "28dadd01-c6b9-5dd2-809e-715b3efca17a",
    "pdf_page": 25,
    "slug": "bicycle-group-c",
    "vehicle_kind": "bicycle",
    "model": {
      "en": "Bicycle - Group C",
      "pl": "Rower - Grupa C",
      "he": "אופניים - קבוצה C"
    },
    "car_type": {
      "en": "Bicycle",
      "pl": "Rower",
      "he": "אופניים"
    },
    "source_price_group": "BICYCLE GROUP C",
    "description": {
      "en": "Bicycle - Group C (BICYCLE GROUP C). Rental day means exactly 24 hours from collection. VAT is included. Helmets are included. No kilometre limit. Permitted driving area: Ayia Napa, Paralimni and Protaras. E-roads only; highways, off-road use and dirt tracks are prohibited. Hotel pickup is free on request, subject to availability.",
      "pl": "Bicycle - Group C (Rower). Doba najmu oznacza dokładnie 24 godziny od odbioru. VAT jest wliczony. Kaski są wliczone. Brak limitu kilometrów. Dozwolony obszar jazdy: Ayia Napa, Paralimni i Protaras. Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe są zabronione. Odbiór z hotelu jest bezpłatny na życzenie, zależnie od dostępności.",
      "he": "Bicycle - Group C (אופניים). יום השכרה הוא 24 שעות מדויקות ממועד האיסוף. המע״מ כלול. קסדות כלולות. ללא הגבלת קילומטרים. אזור נסיעה מותר: איה נאפה, פרלימני ופרוטרס. כבישי E בלבד; אסורות אוטוסטרדות, נסיעת שטח ודרכי עפר. איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות."
    },
    "features": {
      "en": [
        "Minimum age 18",
        "VAT included",
        "Helmets included",
        "No kilometre limit",
        "Ayia Napa / Paralimni / Protaras permitted driving area",
        "E-roads only; highways, off-road use and dirt tracks prohibited",
        "Hotel pickup free on request, subject to availability",
        "Rental day = exact 24 hours"
      ],
      "pl": [
        "Minimalny wiek 18 lat",
        "VAT wliczony",
        "Kaski wliczone",
        "Brak limitu kilometrów",
        "Dozwolony obszar jazdy: Ayia Napa / Paralimni / Protaras",
        "Wyłącznie drogi E; autostrady, jazda terenowa i drogi gruntowe zabronione",
        "Bezpłatny odbiór z hotelu na życzenie, zależnie od dostępności",
        "Doba najmu = dokładnie 24 godziny"
      ],
      "he": [
        "גיל מינימלי 18",
        "מע״מ כלול",
        "קסדות כלולות",
        "ללא הגבלת קילומטרים",
        "אזור נסיעה מותר: איה נאפה / פרלימני / פרוטרס",
        "כבישי E בלבד; אוטוסטרדות, נסיעת שטח ודרכי עפר אסורות",
        "איסוף מהמלון חינם לפי בקשה ובכפוף לזמינות",
        "יום השכרה = 24 שעות מדויקות"
      ]
    },
    "engine_capacity_cc": null,
    "max_passengers": null,
    "drive": null,
    "transmission": null,
    "fuel_type": null,
    "required_licence_category": null,
    "minimum_driver_age": 18,
    "bicycle_gears": null,
    "insurance_mode": "not_offered",
    "image_url": "/assets/images/cars/speedbikes/speedbikes-bicycle-group-c.webp",
    "first_day_price": 20,
    "sort_order": 3021,
    "expected_tier_count": 7
  }
]
$catalogue$::jsonb) as expected(
  offer_id uuid,
  deposit_override_id uuid,
  pdf_page integer,
  slug text,
  vehicle_kind text,
  model jsonb,
  car_type jsonb,
  source_price_group text,
  description jsonb,
  features jsonb,
  engine_capacity_cc integer,
  max_passengers integer,
  drive text,
  transmission text,
  fuel_type text,
  required_licence_category text,
  minimum_driver_age integer,
  bicycle_gears text,
  insurance_mode text,
  image_url text,
  first_day_price numeric,
  sort_order integer,
  expected_tier_count integer
);

alter table _speedbikes_expected_offers add primary key (offer_id);

create temporary table _speedbikes_expected_tiers on commit drop as
select *
from jsonb_to_recordset($catalogue$
[
  {
    "tier_id": "fd35502d-b51f-586a-ae2d-91f9d81d9193",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 1,
    "daily_rate": "110.000000",
    "source_total": 110
  },
  {
    "tier_id": "2d269821-df05-52cc-ba43-a1a8d6fcc8fe",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 2,
    "daily_rate": "95.000000",
    "source_total": 190
  },
  {
    "tier_id": "75d525c1-d2f2-520a-919d-cd978344c990",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 3,
    "daily_rate": "90.000000",
    "source_total": 270
  },
  {
    "tier_id": "f307bd4e-9b09-5ead-b7ec-1341164abfae",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 4,
    "daily_rate": "85.000000",
    "source_total": 340
  },
  {
    "tier_id": "300da3f7-7cc6-5b3f-a870-1643879f5aed",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 5,
    "daily_rate": "80.000000",
    "source_total": 400
  },
  {
    "tier_id": "6bf87b99-57f9-54a5-9167-9fcb5b7a3362",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 6,
    "daily_rate": "75.000000",
    "source_total": 450
  },
  {
    "tier_id": "9315e769-d8c4-5b99-967f-6d54e4a5b0de",
    "offer_id": "afd191d3-bbbf-5c7a-a8a1-12bde793ace1",
    "threshold_days": 7,
    "daily_rate": "70.000000",
    "source_total": 490
  },
  {
    "tier_id": "fa8fbc58-bd22-5bf8-933c-9606dc07a0c5",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 1,
    "daily_rate": "110.000000",
    "source_total": 110
  },
  {
    "tier_id": "1f89cf47-3af6-507a-9c6a-f5dba615f0c8",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 2,
    "daily_rate": "95.000000",
    "source_total": 190
  },
  {
    "tier_id": "177d85ab-4c2d-5eea-bce6-9bd06adc397a",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 3,
    "daily_rate": "90.000000",
    "source_total": 270
  },
  {
    "tier_id": "4a1bfdea-eeb6-508e-92e2-b549b4acc188",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 4,
    "daily_rate": "85.000000",
    "source_total": 340
  },
  {
    "tier_id": "630833e4-a907-5dc8-b963-d987f131b9bf",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 5,
    "daily_rate": "80.000000",
    "source_total": 400
  },
  {
    "tier_id": "1ff423c1-815b-5e79-95c8-f117c2c69aff",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 6,
    "daily_rate": "75.000000",
    "source_total": 450
  },
  {
    "tier_id": "c667e93e-4059-50b7-8672-f5d568c7b980",
    "offer_id": "2817e6de-25ba-5237-b721-dbc0460a7de4",
    "threshold_days": 7,
    "daily_rate": "70.000000",
    "source_total": 490
  },
  {
    "tier_id": "c5de320b-0582-5813-960d-86a69d2b4f1d",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 1,
    "daily_rate": "120.000000",
    "source_total": 120
  },
  {
    "tier_id": "6af5da9b-2769-5657-a56b-d6df59575e2a",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 2,
    "daily_rate": "100.000000",
    "source_total": 200
  },
  {
    "tier_id": "49545739-b0a1-5303-b485-c43cdd9a26b9",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 3,
    "daily_rate": "93.333333",
    "source_total": 280
  },
  {
    "tier_id": "f3a86b00-e9f6-50fc-8a86-3402edb49fa6",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 4,
    "daily_rate": "87.500000",
    "source_total": 350
  },
  {
    "tier_id": "5369ae10-7ec7-5c15-a3b6-99ea21480059",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 5,
    "daily_rate": "84.000000",
    "source_total": 420
  },
  {
    "tier_id": "2b2993eb-7adf-5426-9a7f-fbb0983bb0ef",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 6,
    "daily_rate": "80.000000",
    "source_total": 480
  },
  {
    "tier_id": "bb087ae7-db68-5250-8043-352cff0fcb95",
    "offer_id": "ef800460-cfef-57c1-b3cd-7269f366b00c",
    "threshold_days": 7,
    "daily_rate": "74.285714",
    "source_total": 520
  },
  {
    "tier_id": "0a5d288d-5f75-5286-a089-a93e8a3d0503",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 1,
    "daily_rate": "140.000000",
    "source_total": 140
  },
  {
    "tier_id": "73c53177-eefb-5102-9452-3b4e8fc77579",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 2,
    "daily_rate": "130.000000",
    "source_total": 260
  },
  {
    "tier_id": "6051883d-de72-5244-8a93-ab294c6200c8",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 3,
    "daily_rate": "120.000000",
    "source_total": 360
  },
  {
    "tier_id": "f37e9beb-b8e9-5aaf-ba00-21ed98a8012a",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 4,
    "daily_rate": "110.000000",
    "source_total": 440
  },
  {
    "tier_id": "5bdd180b-f0c2-5fe5-a0cd-b089d98315a5",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 5,
    "daily_rate": "100.000000",
    "source_total": 500
  },
  {
    "tier_id": "b06b4155-eddd-5ab3-9fb7-3aee40da2187",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 6,
    "daily_rate": "95.000000",
    "source_total": 570
  },
  {
    "tier_id": "df9cfaf0-fea3-5129-813e-bc4e9c0e026f",
    "offer_id": "d78cee10-c980-5445-b59b-a7006f2f8718",
    "threshold_days": 7,
    "daily_rate": "90.000000",
    "source_total": 630
  },
  {
    "tier_id": "cb274773-9eee-5c86-b48a-e13f1a74889f",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 1,
    "daily_rate": "150.000000",
    "source_total": 150
  },
  {
    "tier_id": "665aacd1-17f7-50e4-b08f-54c021d74c14",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 2,
    "daily_rate": "140.000000",
    "source_total": 280
  },
  {
    "tier_id": "7d2021fa-a32c-552f-8e5d-c2079311ec84",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 3,
    "daily_rate": "130.000000",
    "source_total": 390
  },
  {
    "tier_id": "9832908f-90b8-5e8c-9185-3a5139f487c6",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 4,
    "daily_rate": "120.000000",
    "source_total": 480
  },
  {
    "tier_id": "fa82c8f1-7d70-548e-948e-e137a37df6a7",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 5,
    "daily_rate": "110.000000",
    "source_total": 550
  },
  {
    "tier_id": "7f66acb2-7dc6-5c4f-9133-1a7f5dc122f1",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 6,
    "daily_rate": "100.000000",
    "source_total": 600
  },
  {
    "tier_id": "037a2455-c6ec-547d-bfd6-f19b91081171",
    "offer_id": "670f9df5-f9ac-5e38-821a-ac21847ff16d",
    "threshold_days": 7,
    "daily_rate": "94.285714",
    "source_total": 660
  },
  {
    "tier_id": "ecf3bcff-b01c-5d1d-8eb4-0a75c169b0ab",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 1,
    "daily_rate": "150.000000",
    "source_total": 150
  },
  {
    "tier_id": "f645680a-ef3a-5bd3-8729-89730c147baa",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 2,
    "daily_rate": "135.000000",
    "source_total": 270
  },
  {
    "tier_id": "05ba29ad-353f-554f-9884-f00c677fd468",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 3,
    "daily_rate": "100.000000",
    "source_total": 300
  },
  {
    "tier_id": "9b1983a6-9ff7-5446-8d18-b2c4d9c0278b",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 4,
    "daily_rate": "95.000000",
    "source_total": 380
  },
  {
    "tier_id": "92c2b9de-643d-5dd5-8000-459a7e7da22b",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 5,
    "daily_rate": "90.000000",
    "source_total": 450
  },
  {
    "tier_id": "316d6cb3-30e0-5a8a-ad85-4a2b5c33ae2e",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 6,
    "daily_rate": "85.000000",
    "source_total": 510
  },
  {
    "tier_id": "2afa768d-8b8e-5aad-b010-0f928718776b",
    "offer_id": "fee6c0e3-f213-53cb-9a94-bb7ed129ff58",
    "threshold_days": 7,
    "daily_rate": "80.000000",
    "source_total": 560
  },
  {
    "tier_id": "f84d0969-2198-54be-af53-2a5cddd0fd2c",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 1,
    "daily_rate": "160.000000",
    "source_total": 160
  },
  {
    "tier_id": "4f60ece8-d3de-512b-8012-4f4974fb903b",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 2,
    "daily_rate": "145.000000",
    "source_total": 290
  },
  {
    "tier_id": "88028db1-2bd3-5fbd-b074-da7011605a6a",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 3,
    "daily_rate": "123.333333",
    "source_total": 370
  },
  {
    "tier_id": "089dc9fa-f8f2-5134-b2ba-400cd0206b6c",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 4,
    "daily_rate": "115.000000",
    "source_total": 460
  },
  {
    "tier_id": "256a0069-cc9a-5a3b-b70b-b8fe4cb1647a",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 5,
    "daily_rate": "102.000000",
    "source_total": 510
  },
  {
    "tier_id": "91667a76-369a-55db-94d4-19cad7d81027",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 6,
    "daily_rate": "100.000000",
    "source_total": 600
  },
  {
    "tier_id": "71506bc9-72db-5179-878d-327a2d540636",
    "offer_id": "f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e",
    "threshold_days": 7,
    "daily_rate": "97.142857",
    "source_total": 680
  },
  {
    "tier_id": "84eaadb2-79df-5fdf-b3bb-f3bbd35dfcf5",
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "threshold_days": 1,
    "daily_rate": "180.000000",
    "source_total": 180
  },
  {
    "tier_id": "a13ed6df-91d9-5c38-9ac8-0ecc276d6143",
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "threshold_days": 2,
    "daily_rate": "175.000000",
    "source_total": 350
  },
  {
    "tier_id": "b32c8c90-3216-5e22-826a-b5a04af136fd",
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "threshold_days": 3,
    "daily_rate": "170.000000",
    "source_total": 510
  },
  {
    "tier_id": "7c2ba40b-3d8c-51d6-b9dd-41af2e127498",
    "offer_id": "cb127f3f-60ab-5375-a443-ac7bfb7804ce",
    "threshold_days": 4,
    "daily_rate": "165.000000",
    "source_total": 660
  },
  {
    "tier_id": "d7bbf456-7bef-5b2c-a12f-6465e3e5a8ea",
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "threshold_days": 1,
    "daily_rate": "180.000000",
    "source_total": 180
  },
  {
    "tier_id": "6f24a52a-156d-5027-ab6b-30ff6a867251",
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "threshold_days": 2,
    "daily_rate": "175.000000",
    "source_total": 350
  },
  {
    "tier_id": "64041fbb-947e-5377-99ee-0243732021f5",
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "threshold_days": 3,
    "daily_rate": "170.000000",
    "source_total": 510
  },
  {
    "tier_id": "5845de3a-adb3-57ca-8d42-fb21abd61968",
    "offer_id": "81dd11d2-68cf-57e7-831c-ec076c3e6a8b",
    "threshold_days": 4,
    "daily_rate": "165.000000",
    "source_total": 660
  },
  {
    "tier_id": "0785aec3-a495-5695-a8d4-e8fcceabb083",
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "threshold_days": 1,
    "daily_rate": "230.000000",
    "source_total": 230
  },
  {
    "tier_id": "958c8fa2-0a06-51f4-a544-b83943def244",
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "threshold_days": 2,
    "daily_rate": "210.000000",
    "source_total": 420
  },
  {
    "tier_id": "fd77438c-a304-59a7-b5ef-59cb8982b25b",
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "threshold_days": 3,
    "daily_rate": "200.000000",
    "source_total": 600
  },
  {
    "tier_id": "cb5ad5ea-e3ff-53a7-b666-a4efb35488de",
    "offer_id": "7496b0a4-aee0-58bc-a440-2d478514fec3",
    "threshold_days": 4,
    "daily_rate": "180.000000",
    "source_total": 720
  },
  {
    "tier_id": "0f3e44ee-0ec5-5da1-9c96-3330e559d7dd",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 1,
    "daily_rate": "50.000000",
    "source_total": 50
  },
  {
    "tier_id": "731408d0-9ec9-5f96-8a31-53306c2d7150",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 2,
    "daily_rate": "45.000000",
    "source_total": 90
  },
  {
    "tier_id": "b25eb6cc-5dc0-57a4-a682-d2d941d820ee",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 3,
    "daily_rate": "43.333333",
    "source_total": 130
  },
  {
    "tier_id": "27435fb3-abcd-594f-99e3-52dbb141264c",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 4,
    "daily_rate": "40.000000",
    "source_total": 160
  },
  {
    "tier_id": "02692391-02ac-51e8-8c89-2b61bdf6dba3",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 5,
    "daily_rate": "36.000000",
    "source_total": 180
  },
  {
    "tier_id": "f6ac6ad7-58f0-5d54-8177-852c46cf0c4e",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 6,
    "daily_rate": "33.333333",
    "source_total": 200
  },
  {
    "tier_id": "aadadbfb-7556-5f12-a306-452367e47274",
    "offer_id": "e217a068-afb5-5352-be8b-ab2f8b9313d9",
    "threshold_days": 7,
    "daily_rate": "31.428571",
    "source_total": 220
  },
  {
    "tier_id": "cf9a457c-d8e0-59dd-8948-7f89696de476",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 1,
    "daily_rate": "60.000000",
    "source_total": 60
  },
  {
    "tier_id": "9ecdc2ad-08f4-5e69-b30e-3752ebef014e",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 2,
    "daily_rate": "55.000000",
    "source_total": 110
  },
  {
    "tier_id": "8ddfe214-bbf1-57c6-9ac2-1a90d8a4d938",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 3,
    "daily_rate": "50.000000",
    "source_total": 150
  },
  {
    "tier_id": "0b681908-7aff-545a-9995-daa9d50b75af",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 4,
    "daily_rate": "47.500000",
    "source_total": 190
  },
  {
    "tier_id": "0728da6d-4058-5523-976e-d054a05a00e0",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 5,
    "daily_rate": "44.000000",
    "source_total": 220
  },
  {
    "tier_id": "e83e3a90-ceda-59bf-b759-bd65e5d024c4",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 6,
    "daily_rate": "40.000000",
    "source_total": 240
  },
  {
    "tier_id": "dbc80889-1314-5923-b83d-a8c1e3d617f9",
    "offer_id": "23192ab2-24ae-5bae-8123-54039c805560",
    "threshold_days": 7,
    "daily_rate": "35.714286",
    "source_total": 250
  },
  {
    "tier_id": "b85d6cc2-83d7-5218-b5e8-71da80a8b4cd",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 1,
    "daily_rate": "70.000000",
    "source_total": 70
  },
  {
    "tier_id": "e2077da0-e23e-5731-9e8c-0d862caa04db",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 2,
    "daily_rate": "65.000000",
    "source_total": 130
  },
  {
    "tier_id": "561347b0-996b-5fc7-9aee-4b0f32aa9b79",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 3,
    "daily_rate": "60.000000",
    "source_total": 180
  },
  {
    "tier_id": "cdbf1f19-eb19-5f7f-bff5-2a01618ecf52",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 4,
    "daily_rate": "55.000000",
    "source_total": 220
  },
  {
    "tier_id": "bc116742-c94c-51f7-b03a-9e25131b8827",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 5,
    "daily_rate": "50.000000",
    "source_total": 250
  },
  {
    "tier_id": "3fc90f65-5cde-5093-b3a5-f275f938ac0d",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 6,
    "daily_rate": "46.666667",
    "source_total": 280
  },
  {
    "tier_id": "234e73d3-0a74-5674-9c4e-3be781397f6c",
    "offer_id": "f1c56415-b0bd-5738-a8fa-114abd92adae",
    "threshold_days": 7,
    "daily_rate": "44.285714",
    "source_total": 310
  },
  {
    "tier_id": "7f49b1e8-2a4f-5152-99bf-2010d3b03ccc",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 1,
    "daily_rate": "80.000000",
    "source_total": 80
  },
  {
    "tier_id": "21ec315a-bd53-51d5-a33e-91c5fbbe24c7",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 2,
    "daily_rate": "75.000000",
    "source_total": 150
  },
  {
    "tier_id": "62dd7fb4-8080-5098-bd70-000bf7bcb9bf",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 3,
    "daily_rate": "66.666667",
    "source_total": 200
  },
  {
    "tier_id": "8ce56f44-4bb4-5ce0-8ec6-10eadf0101bc",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 4,
    "daily_rate": "57.500000",
    "source_total": 230
  },
  {
    "tier_id": "842d4c46-583a-5f35-bf73-f7dc5299b2ee",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 5,
    "daily_rate": "52.000000",
    "source_total": 260
  },
  {
    "tier_id": "3c510f7e-2cc9-50f8-b07c-fb4a6a7b69bf",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 6,
    "daily_rate": "48.333333",
    "source_total": 290
  },
  {
    "tier_id": "03738eb4-c5ba-5759-800b-da1398537257",
    "offer_id": "34dfca00-59b2-5c78-9600-f24f5a21cbea",
    "threshold_days": 7,
    "daily_rate": "45.714286",
    "source_total": 320
  },
  {
    "tier_id": "6407bbf2-17b7-5bc0-954b-d1c0701264de",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 1,
    "daily_rate": "90.000000",
    "source_total": 90
  },
  {
    "tier_id": "aebfd690-0d3d-500f-8c51-4eaf64b636d1",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 2,
    "daily_rate": "85.000000",
    "source_total": 170
  },
  {
    "tier_id": "aa3f4757-f886-5947-8cf5-2de3ba0d2495",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 3,
    "daily_rate": "76.666667",
    "source_total": 230
  },
  {
    "tier_id": "528fda8c-0c3f-506a-bf16-4ed5babef45a",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 4,
    "daily_rate": "67.500000",
    "source_total": 270
  },
  {
    "tier_id": "6e6282a2-95de-580b-b78c-75ac304a728a",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 5,
    "daily_rate": "60.000000",
    "source_total": 300
  },
  {
    "tier_id": "11dbb9c7-ecf7-5d11-aa4e-4e5d8b4b241c",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 6,
    "daily_rate": "55.000000",
    "source_total": 330
  },
  {
    "tier_id": "087b3848-ce4d-5554-a858-2099cb8a3809",
    "offer_id": "a0ba9599-7194-594f-930e-fa48911a6c6d",
    "threshold_days": 7,
    "daily_rate": "52.857143",
    "source_total": 370
  },
  {
    "tier_id": "4f6c02be-431e-5154-8b6b-7305e9d0ffc9",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 1,
    "daily_rate": "100.000000",
    "source_total": 100
  },
  {
    "tier_id": "bad940ad-de62-542a-b6c6-49f5c65c4e2b",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 2,
    "daily_rate": "90.000000",
    "source_total": 180
  },
  {
    "tier_id": "0b54e62f-3465-5e6e-a0c6-12dc0dd306d0",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 3,
    "daily_rate": "83.333333",
    "source_total": 250
  },
  {
    "tier_id": "d80d6556-1403-55d4-b7e7-123d349a5d1f",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 4,
    "daily_rate": "75.000000",
    "source_total": 300
  },
  {
    "tier_id": "12b18e1a-9515-51f4-ab00-39a4aa004094",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 5,
    "daily_rate": "70.000000",
    "source_total": 350
  },
  {
    "tier_id": "0a3caa10-1c8c-56cd-b6f6-c7f53dcbcbd4",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 6,
    "daily_rate": "66.666667",
    "source_total": 400
  },
  {
    "tier_id": "76d61d44-87ce-52e8-8c4d-c81bf63f9c25",
    "offer_id": "8df639ad-c4dc-5a04-b06e-c7f93313df05",
    "threshold_days": 7,
    "daily_rate": "64.285714",
    "source_total": 450
  },
  {
    "tier_id": "73ce8c98-73cc-5752-ac81-9ee65d7a81b2",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 1,
    "daily_rate": "40.000000",
    "source_total": 40
  },
  {
    "tier_id": "a66c639d-9da7-5487-a60c-63c935067037",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 2,
    "daily_rate": "35.000000",
    "source_total": 70
  },
  {
    "tier_id": "47983543-8f7f-5d3e-8cb9-219f12757b81",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 3,
    "daily_rate": "30.000000",
    "source_total": 90
  },
  {
    "tier_id": "f0d9307c-03d7-57ea-8ef3-d0ed51ec9a2c",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 4,
    "daily_rate": "27.500000",
    "source_total": 110
  },
  {
    "tier_id": "5a163b70-182d-5509-a035-7beab59de308",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 5,
    "daily_rate": "24.000000",
    "source_total": 120
  },
  {
    "tier_id": "0fcf2304-a546-540e-9e28-0fcd217bc568",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 6,
    "daily_rate": "21.666667",
    "source_total": 130
  },
  {
    "tier_id": "8e82b617-2fa7-514c-9bc4-2b8a12b29265",
    "offer_id": "bacb158c-0bfb-5735-bd70-bafa5e589882",
    "threshold_days": 7,
    "daily_rate": "20.000000",
    "source_total": 140
  },
  {
    "tier_id": "5b175308-95e5-549c-b0f3-b87b59aa0411",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 1,
    "daily_rate": "50.000000",
    "source_total": 50
  },
  {
    "tier_id": "d99e5853-950c-5588-abb3-580bb2f52c2d",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 2,
    "daily_rate": "45.000000",
    "source_total": 90
  },
  {
    "tier_id": "d4ccbf69-5216-5c3d-9714-821cf34c5f50",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 3,
    "daily_rate": "40.000000",
    "source_total": 120
  },
  {
    "tier_id": "30fc3c9d-143d-59bd-9d89-225c13ee0e41",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 4,
    "daily_rate": "35.000000",
    "source_total": 140
  },
  {
    "tier_id": "e39e9130-e9b2-53e0-9f65-0e67ad6f9215",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 5,
    "daily_rate": "34.000000",
    "source_total": 170
  },
  {
    "tier_id": "531d2861-b622-53dc-879c-082b849ebd96",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 6,
    "daily_rate": "30.000000",
    "source_total": 180
  },
  {
    "tier_id": "a8779094-3338-5321-a9d2-25c4608b5bd9",
    "offer_id": "4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e",
    "threshold_days": 7,
    "daily_rate": "28.571429",
    "source_total": 200
  },
  {
    "tier_id": "1b2ec86d-0fe4-5c99-99ee-6798f623f18f",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 1,
    "daily_rate": "70.000000",
    "source_total": 70
  },
  {
    "tier_id": "07fad372-f05d-5364-9f5e-30c228088cea",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 2,
    "daily_rate": "65.000000",
    "source_total": 130
  },
  {
    "tier_id": "381e1e34-29f1-5b29-bc9d-c26cab5f0578",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 3,
    "daily_rate": "60.000000",
    "source_total": 180
  },
  {
    "tier_id": "36d81c07-f44c-58bf-b9ba-5f2f880e9205",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 4,
    "daily_rate": "55.000000",
    "source_total": 220
  },
  {
    "tier_id": "bf890a95-26e1-59e2-9c61-3d234cc503b7",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 5,
    "daily_rate": "50.000000",
    "source_total": 250
  },
  {
    "tier_id": "c590ac12-1640-55f2-ac2f-b8df1fabbb5f",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 6,
    "daily_rate": "46.666667",
    "source_total": 280
  },
  {
    "tier_id": "0bae2c79-79d5-5d0b-b554-fc5339aa46f4",
    "offer_id": "9dc40c8c-0096-5405-aaf0-495ef479af74",
    "threshold_days": 7,
    "daily_rate": "42.857143",
    "source_total": 300
  },
  {
    "tier_id": "b1fdd6a7-bb3d-5c8c-ba66-3b892e406633",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 1,
    "daily_rate": "10.000000",
    "source_total": 10
  },
  {
    "tier_id": "917cfbc9-8885-5443-841e-de3a569bab14",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 2,
    "daily_rate": "7.500000",
    "source_total": 15
  },
  {
    "tier_id": "4d7ceaae-4d4a-5136-98a5-c287cb5dc3dd",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 3,
    "daily_rate": "6.666667",
    "source_total": 20
  },
  {
    "tier_id": "bb6b2503-fdd7-5b9b-8e2f-fef8cba2c5d4",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 4,
    "daily_rate": "6.250000",
    "source_total": 25
  },
  {
    "tier_id": "d11000c0-36a1-5815-a974-7d07ee7b6e74",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 5,
    "daily_rate": "5.800000",
    "source_total": 29
  },
  {
    "tier_id": "d722da30-75ab-5808-a234-a69bd1c38212",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 6,
    "daily_rate": "5.500000",
    "source_total": 33
  },
  {
    "tier_id": "3a2a9666-4209-5bcf-9aad-c502ac04e374",
    "offer_id": "d54382fd-4761-5d49-92b5-81d83eda5fb9",
    "threshold_days": 7,
    "daily_rate": "5.285714",
    "source_total": 37
  },
  {
    "tier_id": "e070888d-7916-5184-94ef-0406eb0d40e2",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 1,
    "daily_rate": "15.000000",
    "source_total": 15
  },
  {
    "tier_id": "af74e6ef-97b9-5825-b1b0-6352ee608b35",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 2,
    "daily_rate": "12.500000",
    "source_total": 25
  },
  {
    "tier_id": "c42de672-1241-5fa3-8b86-bd61c3b5e92c",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 3,
    "daily_rate": "10.000000",
    "source_total": 30
  },
  {
    "tier_id": "968bc16f-8d1d-555e-9429-fcd71b4985d9",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 4,
    "daily_rate": "10.000000",
    "source_total": 40
  },
  {
    "tier_id": "80decc8f-44fe-5ff1-a9bf-e5e0a8147531",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 5,
    "daily_rate": "10.000000",
    "source_total": 50
  },
  {
    "tier_id": "6694b196-1376-5c9d-990d-b98b89bdf42e",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 6,
    "daily_rate": "9.166667",
    "source_total": 55
  },
  {
    "tier_id": "7fd9111a-7e27-53d9-8d4c-792c12c8c670",
    "offer_id": "1860d043-132c-519b-bf97-c5eddc464087",
    "threshold_days": 7,
    "daily_rate": "8.571429",
    "source_total": 60
  },
  {
    "tier_id": "62a36cb6-4590-588f-9b4b-b68adeb085ff",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 1,
    "daily_rate": "20.000000",
    "source_total": 20
  },
  {
    "tier_id": "7d3a0815-8391-5aa4-b95a-14d8f705d74b",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 2,
    "daily_rate": "17.500000",
    "source_total": 35
  },
  {
    "tier_id": "c9656e74-5627-54d8-9caf-a724af6cb851",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 3,
    "daily_rate": "15.000000",
    "source_total": 45
  },
  {
    "tier_id": "16446e25-ce39-5655-a27f-433b281da7ce",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 4,
    "daily_rate": "13.750000",
    "source_total": 55
  },
  {
    "tier_id": "9f17ce67-5f60-5f08-8c2a-516d79ed0ac5",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 5,
    "daily_rate": "12.600000",
    "source_total": 63
  },
  {
    "tier_id": "533127ae-92e5-51a3-b6e7-eac79bef2d6b",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 6,
    "daily_rate": "11.666667",
    "source_total": 70
  },
  {
    "tier_id": "856f217c-d2df-5f3f-9859-4a03d4e6697d",
    "offer_id": "ecc945e9-eff8-5b7d-a478-b69689380dbd",
    "threshold_days": 7,
    "daily_rate": "10.714286",
    "source_total": 75
  }
]
$catalogue$::jsonb) as expected(
  offer_id uuid,
  tier_id uuid,
  threshold_days integer,
  daily_rate numeric(12,6),
  source_total numeric(12,2)
);

alter table _speedbikes_expected_tiers
  add primary key (offer_id, threshold_days),
  add unique (tier_id);

-- The catalogue import is intentionally all-or-nothing. Prevent concurrent
-- Admin writes from invalidating the protected baseline between preflight and
-- the final postconditions; lock_timeout above makes contention fail closed.
lock table public.car_offer_city_availability in share row exclusive mode;
lock table public.car_offer_daily_rate_tiers in share row exclusive mode;
lock table public.car_offers in share row exclusive mode;
lock table public.car_rental_cities in share mode;
lock table public.car_vehicle_kinds in share mode;
lock table public.partners in share mode;
lock table public.service_deposit_overrides in share row exclusive mode;
lock table public.site_settings in share mode;

do $$
declare
  v_missing text[];
  v_existing_expected integer;
  v_legacy_count integer;
  v_legacy_fingerprint text;
  v_partner_resolver_source text;
  v_existing_availability_count integer;
  v_existing_active_availability_count integer;
  v_existing_inherit_availability_count integer;
  v_existing_override_availability_count integer;
begin
  select coalesce(array_agg(name order by name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.car_offers',
    'public.car_offer_daily_rate_tiers',
    'public.car_offer_city_availability',
    'public.car_rental_cities',
    'public.car_vehicle_kinds',
    'public.partners',
    'public.service_deposit_overrides',
    'public.site_settings'
  ]::text[]) required(name)
  where to_regclass(name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using errcode = '42P01', message = 'speedbikes_required_object_missing', detail = array_to_string(v_missing, ',');
  end if;

  if (select count(*) from _speedbikes_expected_offers) <> 22
     or (select count(*) from _speedbikes_expected_tiers) <> 145 then
    raise exception using errcode = '23514', message = 'speedbikes_manifest_count_mismatch';
  end if;

  if exists (
    select 1
    from _speedbikes_expected_tiers tier
    where round(tier.daily_rate * tier.threshold_days, 2) <> tier.source_total
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_source_total_precision_mismatch';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'car_offer_daily_rate_tiers'
      and column_info.column_name = 'daily_rate'
      and column_info.data_type = 'numeric'
      and column_info.numeric_scale >= 6
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_daily_rate_precision_migration_required';
  end if;

  if not exists (
    select 1 from public.site_settings setting
    where setting.id = 1
      and setting.car_multi_city_mapped_enabled is false
      and setting.car_threshold_daily_rates_enabled is false
  ) or exists (
    select 1 from public.site_settings setting
    where setting.car_multi_city_mapped_enabled is true
       or setting.car_threshold_daily_rates_enabled is true
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_import_requires_both_runtime_flags_off';
  end if;

  if not exists (
    select 1 from public.partners partner
    where partner.id = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
      and lower(partner.status) = 'active'
      and partner.can_manage_cars is true
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_verified_partner_missing_or_inactive';
  end if;

  select procedure.prosrc
  into v_partner_resolver_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure(
    'public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)'
  );

  if position('v_pricing_strategy = ''threshold_daily_rate''' in coalesce(v_partner_resolver_source, '')) = 0
     or position('partner.id = v_exact_owner_id' in coalesce(v_partner_resolver_source, '')) = 0 then
    raise exception using
      errcode = '23514',
      message = 'speedbikes_exact_owner_routing_migration_required';
  end if;

  if (select count(*) from public.car_rental_cities city where city.code = 'ayia-napa' and city.is_active) <> 1 then
    raise exception using errcode = '23514', message = 'speedbikes_ayia_napa_city_missing_or_inactive';
  end if;

  if exists (
    select 1
    from (values ('buggy'), ('quad'), ('scooter'), ('bicycle')) required(code)
    where not exists (
      select 1 from public.car_vehicle_kinds kind
      where kind.code = required.code and kind.is_active
    )
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_vehicle_kind_missing_or_inactive';
  end if;

  select count(*) into v_existing_expected
  from public.car_offers offer
  join _speedbikes_expected_offers expected on expected.offer_id = offer.id;

  if v_existing_expected not in (0, 22) then
    raise exception using errcode = '23514', message = 'speedbikes_partial_previous_import_detected';
  end if;

  select
    count(*)::integer,
    md5(coalesce(string_agg(
      jsonb_build_array(
        offer.id,
        offer.price_per_day,
        offer.price_3days,
        offer.price_4_6days,
        offer.price_7_10days,
        offer.price_10plus_days,
        offer.currency,
        offer.location,
        offer.owner_partner_id,
        offer.deposit_amount,
        offer.insurance_per_day,
        offer.young_driver_fee,
        offer.young_driver_cost,
        offer.stock_count,
        offer.north_allowed,
        offer.is_available,
        offer.is_published,
        offer.submission_status
      )::text,
      E'\n' order by offer.id
    ), ''))
  into v_legacy_count, v_legacy_fingerprint
  from public.car_offers offer
  where not exists (
    select 1 from _speedbikes_expected_offers expected where expected.offer_id = offer.id
  );

  if v_legacy_count <> 27 or v_legacy_fingerprint <> 'aa1abc7ce187779927838bafb706cf3b' then
    raise exception using
      errcode = '23514',
      message = 'speedbikes_existing_legacy_baseline_mismatch',
      detail = format('count=%s fingerprint=%s', v_legacy_count, v_legacy_fingerprint);
  end if;

  select
    count(*)::integer,
    count(*) filter (where availability.is_active)::integer,
    count(*) filter (where availability.fee_mode = 'inherit')::integer,
    count(*) filter (where availability.fee_mode = 'override')::integer
  into
    v_existing_availability_count,
    v_existing_active_availability_count,
    v_existing_inherit_availability_count,
    v_existing_override_availability_count
  from public.car_offer_city_availability availability
  where not exists (
    select 1 from _speedbikes_expected_offers expected where expected.offer_id = availability.offer_id
  );

  if v_existing_availability_count <> 12
     or v_existing_active_availability_count <> 12
     or v_existing_inherit_availability_count <> 12
     or v_existing_override_availability_count <> 0 then
    raise exception using
      errcode = '23514',
      message = 'speedbikes_existing_availability_baseline_mismatch',
      detail = format(
        'rows=%s active=%s inherit=%s override=%s',
        v_existing_availability_count,
        v_existing_active_availability_count,
        v_existing_inherit_availability_count,
        v_existing_override_availability_count
      );
  end if;
end
$$;

create temporary table _speedbikes_new_offer_ids (
  offer_id uuid primary key
) on commit drop;

with inserted as (
  insert into public.car_offers (
    id,
    location,
    car_type,
    car_model,
    price_per_day,
    currency,
    features,
    image_url,
    description,
    max_passengers,
    max_luggage,
    transmission,
    fuel_type,
    is_available,
    stock_count,
    min_rental_days,
    max_rental_days,
    deposit_amount,
    insurance_per_day,
    sort_order,
    owner_partner_id,
    is_published,
    submission_status,
    north_allowed,
    pricing_profile_id,
    availability_mode,
    vehicle_kind_id,
    pricing_strategy,
    engine_capacity_cc,
    required_licence_category,
    minimum_driver_age,
    insurance_mode,
    young_driver_fee,
    young_driver_cost
  )
  select
    expected.offer_id,
    'larnaca',
    expected.car_type,
    expected.model,
    expected.first_day_price,
    'EUR',
    expected.features,
    expected.image_url,
    expected.description,
    expected.max_passengers,
    null,
    expected.transmission,
    expected.fuel_type,
    false,
    0,
    1,
    null,
    null,
    0,
    expected.sort_order,
    '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid,
    false,
    'draft',
    false,
    (
      select profile.id
      from public.car_pricing_profiles profile
      where profile.code = 'larnaca'
        and profile.legacy_booking_location = 'larnaca'
      limit 1
    ),
    'legacy',
    kind.id,
    'legacy_compat',
    expected.engine_capacity_cc,
    expected.required_licence_category,
    expected.minimum_driver_age,
    expected.insurance_mode,
    false,
    0
  from _speedbikes_expected_offers expected
  join public.car_vehicle_kinds kind
    on kind.code = expected.vehicle_kind
   and kind.is_active
  on conflict (id) do nothing
  returning id
)
insert into _speedbikes_new_offer_ids (offer_id)
select id from inserted;

insert into public.car_offer_daily_rate_tiers (
  id,
  offer_id,
  threshold_days,
  daily_rate,
  is_active
)
select
  expected.tier_id,
  expected.offer_id,
  expected.threshold_days,
  expected.daily_rate,
  true
from _speedbikes_expected_tiers expected
join public.car_offers offer on offer.id = expected.offer_id
on conflict (offer_id, threshold_days) do nothing;

update public.car_offers offer
set
  pricing_strategy = 'threshold_daily_rate',
  pricing_profile_id = null
where offer.id in (select offer_id from _speedbikes_new_offer_ids);

insert into public.car_offer_city_availability (
  offer_id,
  city_id,
  pickup_enabled,
  return_enabled,
  is_active,
  fee_mode,
  fee_per_direction,
  fee_note
)
select
  expected.offer_id,
  city.id,
  true,
  true,
  true,
  'override',
  0,
  'Exact-offer Ayia Napa requestability. Free hotel pickup is on request and subject to partner availability.'
from _speedbikes_expected_offers expected
cross join public.car_rental_cities city
where city.code = 'ayia-napa'
  and city.is_active
on conflict (offer_id, city_id) do nothing;

insert into public.service_deposit_overrides (
  id,
  resource_type,
  resource_id,
  mode,
  amount,
  currency,
  include_children,
  enabled
)
select
  expected.deposit_override_id,
  'cars',
  expected.offer_id,
  'percent_total',
  15,
  'EUR',
  true,
  true
from _speedbikes_expected_offers expected
on conflict (resource_type, resource_id) do nothing;

do $$
declare
  v_legacy_count integer;
  v_legacy_fingerprint text;
  v_existing_availability_count integer;
  v_existing_active_availability_count integer;
  v_existing_inherit_availability_count integer;
  v_existing_override_availability_count integer;
begin
  if exists (
    select 1 from public.site_settings setting
    where setting.car_multi_city_mapped_enabled is true
       or setting.car_threshold_daily_rates_enabled is true
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_import_must_not_enable_runtime_flags';
  end if;

  if exists (
    select 1
    from _speedbikes_expected_offers expected
    left join public.car_offers offer on offer.id = expected.offer_id
    left join public.car_vehicle_kinds kind on kind.id = offer.vehicle_kind_id
    where offer.id is null
       or offer.location <> 'larnaca'
       or offer.pricing_strategy <> 'threshold_daily_rate'
       or offer.pricing_profile_id is not null
       or offer.availability_mode <> 'legacy'
       or offer.is_available is not false
       or offer.is_published is not false
       or offer.submission_status <> 'draft'
       or offer.stock_count <> 0
       or offer.currency <> 'EUR'
       or offer.owner_partner_id <> '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
       or offer.min_rental_days <> 1
       or offer.max_rental_days is not null
       or offer.engine_capacity_cc is distinct from expected.engine_capacity_cc
       or offer.max_passengers is distinct from expected.max_passengers
       or offer.transmission is distinct from expected.transmission
       or offer.fuel_type is distinct from expected.fuel_type
       or offer.required_licence_category is distinct from expected.required_licence_category
       or offer.minimum_driver_age <> 18
       or offer.insurance_mode <> expected.insurance_mode
       or offer.young_driver_fee is not false
       or coalesce(offer.young_driver_cost, 0) <> 0
       or offer.image_url is distinct from expected.image_url
       or kind.code <> expected.vehicle_kind
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_offer_contract_mismatch';
  end if;

  if exists (
    select 1
    from _speedbikes_expected_offers expected
    where public.partner_service_fulfillment_partner_id_for_car_booking(
      expected.offer_id,
      'ayia-napa'
    ) is distinct from '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_exact_owner_routing_mismatch';
  end if;

  if exists (
    select 1
    from _speedbikes_expected_tiers expected
    left join public.car_offer_daily_rate_tiers tier
      on tier.id = expected.tier_id
     and tier.offer_id = expected.offer_id
     and tier.threshold_days = expected.threshold_days
    where tier.id is null
       or tier.is_active is not true
       or tier.daily_rate <> expected.daily_rate
       or round(tier.daily_rate * tier.threshold_days, 2) <> expected.source_total
  ) or exists (
    select 1
    from public.car_offer_daily_rate_tiers tier
    join _speedbikes_expected_offers expected on expected.offer_id = tier.offer_id
    where not exists (
      select 1 from _speedbikes_expected_tiers expected_tier
      where expected_tier.offer_id = tier.offer_id
        and expected_tier.threshold_days = tier.threshold_days
    )
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_tier_contract_mismatch';
  end if;

  if exists (
    select 1
    from _speedbikes_expected_offers expected
    left join public.service_deposit_overrides override_row
      on override_row.resource_type = 'cars'
     and override_row.resource_id = expected.offer_id
    where override_row.id is distinct from expected.deposit_override_id
       or override_row.mode <> 'percent_total'
       or override_row.amount <> 15
       or override_row.currency <> 'EUR'
       or override_row.enabled is not true
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_deposit_override_contract_mismatch';
  end if;

  if exists (
    select 1
    from _speedbikes_expected_offers expected
    left join public.car_offer_city_availability availability
      on availability.offer_id = expected.offer_id
    left join public.car_rental_cities city
      on city.id = availability.city_id
     and city.code = 'ayia-napa'
    where city.id is null
       or availability.pickup_enabled is not true
       or availability.return_enabled is not true
       or availability.is_active is not true
       or availability.fee_mode <> 'override'
       or availability.fee_per_direction <> 0
  ) or exists (
    select 1
    from public.car_offer_city_availability availability
    join _speedbikes_expected_offers expected on expected.offer_id = availability.offer_id
    join public.car_rental_cities city on city.id = availability.city_id
    where city.code <> 'ayia-napa'
  ) then
    raise exception using errcode = '23514', message = 'speedbikes_availability_contract_mismatch';
  end if;

  select
    count(*)::integer,
    md5(coalesce(string_agg(
      jsonb_build_array(
        offer.id,
        offer.price_per_day,
        offer.price_3days,
        offer.price_4_6days,
        offer.price_7_10days,
        offer.price_10plus_days,
        offer.currency,
        offer.location,
        offer.owner_partner_id,
        offer.deposit_amount,
        offer.insurance_per_day,
        offer.young_driver_fee,
        offer.young_driver_cost,
        offer.stock_count,
        offer.north_allowed,
        offer.is_available,
        offer.is_published,
        offer.submission_status
      )::text,
      E'\n' order by offer.id
    ), ''))
  into v_legacy_count, v_legacy_fingerprint
  from public.car_offers offer
  where not exists (
    select 1 from _speedbikes_expected_offers expected where expected.offer_id = offer.id
  );

  if v_legacy_count <> 27 or v_legacy_fingerprint <> 'aa1abc7ce187779927838bafb706cf3b' then
    raise exception using errcode = '23514', message = 'speedbikes_existing_legacy_offers_changed';
  end if;

  select
    count(*)::integer,
    count(*) filter (where availability.is_active)::integer,
    count(*) filter (where availability.fee_mode = 'inherit')::integer,
    count(*) filter (where availability.fee_mode = 'override')::integer
  into
    v_existing_availability_count,
    v_existing_active_availability_count,
    v_existing_inherit_availability_count,
    v_existing_override_availability_count
  from public.car_offer_city_availability availability
  where not exists (
    select 1 from _speedbikes_expected_offers expected where expected.offer_id = availability.offer_id
  );

  if v_existing_availability_count <> 12
     or v_existing_active_availability_count <> 12
     or v_existing_inherit_availability_count <> 12
     or v_existing_override_availability_count <> 0 then
    raise exception using errcode = '23514', message = 'speedbikes_existing_availability_changed';
  end if;
end
$$;

commit;
