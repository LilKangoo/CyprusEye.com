// Packing guide data - extracted from app.js
const PACKING_GUIDE = {

  universal: [
    {
      key: 'documents',
      label: 'Dowód osobisty lub paszport',
      hint: 'Paszport przyda się, jeśli planujesz wjazd na Północny Cypr.',
    },
    {
      key: 'bookings',
      label: 'Bilety, vouchery i kopie rezerwacji',
      hint: 'Zachowaj je w wersji cyfrowej i papierowej na wszelki wypadek.',
    },
    {
      key: 'insurance',
      label: 'Polisa podróżna oraz karta EKUZ',
      hint: 'EKUZ obowiązuje na południu wyspy; na północy potrzebna będzie prywatna opieka.',
    },
    {
      key: 'money',
      label: 'Karty płatnicze i gotówka w euro',
      hint: 'Nie wszędzie zapłacisz kartą, więc miej zapas banknotów i monet.',
    },
    {
      key: 'driving',
      label: 'Prawo jazdy i dodatkowe ubezpieczenie auta',
      hint: 'Przy wynajmie samochodu sprawdź zasady wjazdu na północ wyspy.',
    },
    {
      key: 'electronics',
      label: 'Smartfon z mapami offline, ładowarka i powerbank',
      hint: 'Zapisz ważne numery kontaktowe i miej energię na całodzienne zwiedzanie.',
    },
    {
      key: 'adapter',
      label: 'Adapter do gniazdek typu G',
      hint: 'Na Cyprze obowiązuje brytyjski standard 240 V z trzema prostokątnymi bolcami.',
    },
    {
      key: 'firstAid',
      label: 'Podstawowa apteczka i środki higieny',
      hint:
        'Leki na receptę, środki przeciwbólowe, na biegunkę, chorobę lokomocyjną oraz spray na komary.',
    },
    {
      key: 'sunProtection',
      label: 'Ochrona przeciwsłoneczna',
      hint: 'Krem SPF 30–50, okulary z filtrem UV i nakrycie głowy są potrzebne przez cały rok.',
    },
    {
      key: 'daypack',
      label: 'Plecak dzienny, butelka na wodę i kłódka do bagażu',
      hint: 'Zadbaj o nawodnienie i bezpieczeństwo rzeczy podczas wycieczek.',
    },
    {
      key: 'comfort',
      label: 'Akcesoria ułatwiające podróż',
      hint: 'Zatyczki do uszu, opaska na oczy i poduszka sprawią, że lot lub nocny przejazd będą wygodniejsze.',
    },
  ],
  seasons: [
    {
      id: 'spring',
      label: 'Wiosna',
      summary:
        'Łagodne dni (17–28°C) i rześkie wieczory. Przygotuj warstwy i lekką ochronę przed przelotnymi opadami.',
      emoji: '🌸',
      months: [3, 4, 5],
      items: [
        {
          key: 'layers',
          label: 'Warstwowe koszulki i lekka kurtka',
          hint: 'Dni są przyjemnie ciepłe, ale poranki oraz wieczory bywają chłodniejsze.',
        },
        {
          key: 'longSleeves',
          label: 'Długie spodnie i bluza z długim rękawem',
          hint: 'Przydadzą się zwłaszcza na początku marca oraz podczas wycieczek w góry.',
        },
        {
          key: 'shoes',
          label: 'Wygodne buty sportowe lub trekkingowe',
          hint: 'Idealne na zielone szlaki Troodos i zwiedzanie stanowisk archeologicznych.',
        },
        {
          key: 'sunAccessories',
          label: 'Okulary przeciwsłoneczne i kapelusz',
          hint: 'Wiosenne słońce potrafi świecić intensywnie podczas zwiedzania.',
        },
        {
          key: 'sunscreen',
          label: 'Krem przeciwsłoneczny SPF 30+',
          hint: 'Chroń skórę nawet przy umiarkowanych temperaturach.',
        },
        {
          key: 'scarf',
          label: 'Lekki szal lub chusta',
          hint: 'Osłoni kark przed słońcem i ogrzeje podczas chłodniejszych wieczorów.',
        },
        {
          key: 'swimwear',
          label: 'Strój kąpielowy i szybkoschnący ręcznik',
          hint: 'W maju woda ma już około 20°C, a hotele często oferują podgrzewane baseny.',
          optional: true,
        },
        {
          key: 'rainProtection',
          label: 'Składany parasol lub cienka kurtka przeciwdeszczowa',
          hint: 'Na początku wiosny zdarzają się przelotne opady.',
        },
        {
          key: 'camera',
          label: 'Aparat lub smartfon z wolnym miejscem na zdjęcia',
          hint: 'Kwitnące krajobrazy Cypru aż proszą się o uwiecznienie.',
        },
      ],
    },
    {
      id: 'summer',
      label: 'Lato',
      summary:
        'Upały powyżej 30°C, nagrzane morze (26–27°C) i brak deszczu. Liczy się lekka odzież i intensywna ochrona przed słońcem.',
      emoji: '☀️',
      months: [6, 7, 8],
      items: [
        {
          key: 'swimwear',
          label: 'Co najmniej dwa stroje kąpielowe',
          hint: 'Ułatwi to codzienne plażowanie bez czekania aż kostium wyschnie.',
        },
        {
          key: 'towel',
          label: 'Szybkoschnący ręcznik plażowy lub pareo',
          hint: 'Sprawdzi się nad morzem i przy hotelowym basenie.',
        },
        {
          key: 'clothing',
          label: 'Lekkie ubrania z naturalnych tkanin',
          hint: 'Bawełna i len pomogą przetrwać ponad 30-stopniowe temperatury.',
        },
        {
          key: 'footwear',
          label: 'Klapki, sandały i przewiewne obuwie',
          hint: 'Dodaj wygodne buty sportowe na dłuższe wycieczki.',
        },
        {
          key: 'sunscreen',
          label: 'Krem przeciwsłoneczny SPF 30–50',
          hint: 'Nakładaj obficie i ponownie po każdej kąpieli.',
        },
        {
          key: 'hat',
          label: 'Kapelusz z szerokim rondem i okulary UV',
          hint: 'Chroń głowę i oczy przed udarem słonecznym.',
        },
        {
          key: 'afterSun',
          label: 'Balsam po opalaniu lub żel z aloesem',
          hint: 'Pomoże ukoić skórę po całym dniu na słońcu.',
        },
        {
          key: 'bottle',
          label: 'Butelka termiczna na wodę',
          hint: 'Utrzyma napój w chłodzie i przypomni o regularnym nawadnianiu.',
        },
        {
          key: 'waterproofCase',
          label: 'Wodoodporne etui na telefon i elektronikę',
          hint: 'Zabezpieczy sprzęt przed piaskiem i wodą podczas sportów wodnych.',
        },
        {
          key: 'coverUp',
          label: 'Cienka narzutka lub koszula na wieczór',
          hint: 'Przyda się przy bryzie lub w klimatyzowanych pomieszczeniach.',
          optional: true,
        },
      ],
    },
    {
      id: 'autumn',
      label: 'Jesień',
      summary:
        'Wrzesień wciąż gorący, październik i listopad to przyjemne 21–30°C. Morze długo pozostaje ciepłe, a deszcze pojawiają się dopiero pod koniec sezonu.',
      emoji: '🍁',
      months: [9, 10, 11],
      items: [
        {
          key: 'summerClothes',
          label: 'Letnie ubrania na ciepłe dni',
          hint: 'We wrześniu temperatury przekraczają 30°C.',
        },
        {
          key: 'eveningLayer',
          label: 'Lekka kurtka lub sweter na wieczór',
          hint: 'Październik i listopad przynoszą chłodniejsze noce, szczególnie nad morzem.',
        },
        {
          key: 'trekkingShoes',
          label: 'Wygodne buty trekkingowe lub sportowe',
          hint: 'Jesień sprzyja wycieczkom po Akamas i górach Troodos.',
        },
        {
          key: 'sandals',
          label: 'Klapki lub sandały na plażę',
          hint: 'Morze pozostaje przyjemnie ciepłe nawet w listopadzie.',
        },
        {
          key: 'sunAccessories',
          label: 'Okulary przeciwsłoneczne i nakrycie głowy',
          hint: 'Jesienne słońce nadal mocno operuje.',
        },
        {
          key: 'sunscreen',
          label: 'Krem przeciwsłoneczny SPF 30',
          hint: 'Promieniowanie UV pozostaje wysokie mimo spadku temperatur.',
        },
        {
          key: 'swimwear',
          label: 'Strój kąpielowy i ręcznik plażowy',
          hint: 'Plaże są mniej zatłoczone, a woda nadal zachęca do kąpieli.',
        },
        {
          key: 'camera',
          label: 'Aparat na jesienne krajobrazy',
          hint: 'Winnice i góry Troodos nabierają złotych barw.',
        },
        {
          key: 'rainProtection',
          label: 'Parasolka lub lekka peleryna przeciwdeszczowa',
          hint: 'Pod koniec października mogą pojawić się pierwsze deszcze.',
        },
      ],
    },
    {
      id: 'winter',
      label: 'Zima',
      summary:
        'Nadmorskie 15–18°C w dzień, chłodne noce i możliwy śnieg w górach Troodos. To pora deszczowa – postaw na warstwy i wodoodporne okrycia.',
      emoji: '❄️',
      months: [12, 1, 2],
      items: [
        {
          key: 'coat',
          label: 'Ciepła kurtka lub płaszcz',
          hint: 'Lżejsza sprawdzi się nad morzem, ale w górach potrzebna jest zimowa odzież.',
        },
        {
          key: 'layers',
          label: 'Warstwowe swetry, bluzy i długie spodnie',
          hint: 'Pozwolą dostosować strój do zmiennej pogody.',
        },
        {
          key: 'boots',
          label: 'Buty za kostkę z antypoślizgową podeszwą',
          hint: 'Zabezpieczą przed deszczem i śliskimi nawierzchniami.',
        },
        {
          key: 'rainProtection',
          label: 'Wodoodporna kurtka lub parasol',
          hint: 'Zima to najbardziej deszczowy okres na wyspie.',
        },
        {
          key: 'accessories',
          label: 'Czapka, szalik i rękawiczki',
          hint: 'Niezbędne podczas wizyt w górach oraz w wietrzne dni.',
          optional: true,
        },
        {
          key: 'sunglasses',
          label: 'Okulary przeciwsłoneczne',
          hint: 'Zimowe słońce bywa oślepiające, zwłaszcza po deszczu i na śniegu.',
        },
        {
          key: 'thermal',
          label: 'Bielizna termiczna na górskie wycieczki',
          hint: 'Przydaje się, gdy temperatury spadają w okolice 0°C.',
          optional: true,
        },
        {
          key: 'thermos',
          label: 'Termos na ciepły napój',
          hint: 'Docenisz go podczas zwiedzania zimowych atrakcji.',
        },
        {
          key: 'equipmentPlan',
          label: 'Plan na wypożyczenie sprzętu zimowego',
          hint: 'Jeżeli jedziesz na narty na Olimpie, cięższy sprzęt wypożyczysz na miejscu.',
          optional: true,
        },
      ],
    },
  ],

};
