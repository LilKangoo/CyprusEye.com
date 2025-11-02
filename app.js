// Debug helper - logs only when debugging is enabled
// Date utilities (extracted to src/utils/dates.js)
import {
  toUtcDate,
  getTodayDateString,
  calculateDayDifference,
  formatNotificationDate,
  formatReviewDate,
  getDefaultDailyStreak,
  normalizeDailyStreak
} from './src/utils/dates.js';

// Translation utilities (extracted to src/utils/translations.js)
import {
  getTranslation,
  translate,
  getActiveTranslations,
  areTranslationsReady,
  getTaskTranslationKey,
  getTaskTitle,
  getTaskDescription,
  getPlaceTranslationKey,
  getPlaceName,
  getPlaceDescription,
  getPlaceBadge
} from './src/utils/translations.js';

const DEBUG = localStorage.getItem('CE_DEBUG') === 'true' || new URLSearchParams(window.location.search).has('debug');
function debug(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// getTranslation moved to src/utils/translations.js

const places = [
  {
    id: 'kato-pafos-archaeological-park',
    get name() { return getTranslation('places.kato-pafos-archaeological-park.name', 'Kato Paphos Archaeological Park (Nea Paphos)'); },
    get description() { return getTranslation('places.kato-pafos-archaeological-park.description', 'Expansive UNESCO site with famous mosaics and the ruins of the ancient city of Nea Paphos.'); },
    get badge() { return getTranslation('places.kato-pafos-archaeological-park.badge', 'Nea Paphos Curator'); },
    lat: 34.75567,
    lng: 32.40417,
    googleMapsUrl: 'https://maps.google.com/?q=34.75567,32.40417',
    xp: 210,
    requiredLevel: 6,
  },
  {
    id: 'tombs-of-the-kings',
    get name() { return getTranslation('places.tombs-of-the-kings.name', 'Tombs of the Kings in Paphos'); },
    get description() { return getTranslation('places.tombs-of-the-kings.description', 'Monumental rock-cut tombs from the Hellenistic and Roman periods adorned with Doric columns.'); },
    get badge() { return getTranslation('places.tombs-of-the-kings.badge', 'Necropolis Guardian'); },
    lat: 34.775,
    lng: 32.40694,
    googleMapsUrl: 'https://maps.google.com/?q=34.77500,32.40694',
    xp: 190,
    requiredLevel: 5,
  },
  {
    id: 'coral-bay',
    get name() { return getTranslation('places.coral-bay.name', 'Coral Bay Beach'); },
    get description() { return getTranslation('places.coral-bay.description', 'Golden sand, gentle entry into the sea and crystal-clear water—the classic spot to relax near Peyia.'); },
    lat: 34.854,
    lng: 32.3695,
    googleMapsUrl: 'https://maps.google.com/?q=34.85400,32.36950',
    get badge() { return getTranslation('places.coral-bay.badge', 'Beach Explorer'); },
    xp: 110,
    requiredLevel: 1,
  },
  {
    id: 'aphrodite-rock',
    get name() { return getTranslation('places.aphrodite-rock.name', 'Skała Afrodyty (Petra tou Romiou)'); },
    get description() { return getTranslation('places.aphrodite-rock.description', 'Legenda głosi, że wśród turkusowych fal u stóp skały narodziła się Afrodyta – idealne miejsce na zachód słońca.'); },
    lat: 34.6641,
    lng: 32.6271,
    googleMapsUrl: 'https://maps.google.com/?q=34.66410,32.62710',
    get badge() { return getTranslation('places.aphrodite-rock.badge', 'Strażnik Mitów'); },
    xp: 120,
    requiredLevel: 1,
  },
  {
    id: 'blue-lagoon-akamas',
    get name() { return getTranslation('places.blue-lagoon-akamas.name', 'Błękitna Laguna (Akamas)'); },
    get description() { return getTranslation('places.blue-lagoon-akamas.description', 'Krystalicznie czysta zatoka otoczona dziką przyrodą półwyspu Akamas – raj do snorkelingu.'); },
    lat: 35.08417,
    lng: 32.30611,
    googleMapsUrl: 'https://maps.google.com/?q=35.08417,32.30611',
    get badge() { return getTranslation('places.blue-lagoon-akamas.badge', 'Łowca Turkusu'); },
    xp: 220,
    requiredLevel: 7,
  },
  {
    id: 'kourion-archaeological-site',
    get name() { return getTranslation('places.kourion-archaeological-site.name', 'Stanowisko archeologiczne Kurion'); },
    get description() { return getTranslation('places.kourion-archaeological-site.description', 'Ruiny antycznego miasta na klifie z teatrem, łaźniami i mozaikami Domu Eustoliosa.'); },
    lat: 34.6642,
    lng: 32.8877,
    googleMapsUrl: 'https://maps.google.com/?q=34.66420,32.88770',
    get badge() { return getTranslation('places.kourion-archaeological-site.badge', 'Obrońca Kurionu'); },
    xp: 200,
    requiredLevel: 6,
  },
  {
    id: 'kolossi-castle',
    get name() { return getTranslation('places.kolossi-castle.name', 'Zamek Kolossi'); },
    get description() { return getTranslation('places.kolossi-castle.description', 'XIII-wieczna forteca joannitów, dawne centrum produkcji słodkiego wina Commandaria.'); },
    lat: 34.66527,
    lng: 32.93396,
    googleMapsUrl: 'https://maps.google.com/?q=34.66527,32.93396',
    get badge() { return getTranslation('places.kolossi-castle.badge', 'Rycerz Kolossi'); },
    xp: 170,
    requiredLevel: 4,
  },
  {
    id: 'molos-promenade',
    get name() { return getTranslation('places.molos-promenade.name', 'Promenada Molos w Limassol'); },
    get description() { return getTranslation('places.molos-promenade.description', 'Nadmorski park z palmami, rzeźbami i kawiarniami – ulubione miejsce spacerów mieszkańców Limassol.'); },
    lat: 34.67658,
    lng: 33.04979,
    googleMapsUrl: 'https://maps.google.com/?q=34.67658,33.04979',
    get badge() { return getTranslation('places.molos-promenade.badge', 'Mistrz Promenady'); },
    xp: 130,
    requiredLevel: 2,
  },
  {
    id: 'amathus-ruins',
    get name() { return getTranslation('places.amathus-ruins.name', 'Ruiny starożytnego Amathus'); },
    get description() { return getTranslation('places.amathus-ruins.description', 'Pozostałości jednego z królewskich miast Cypru z agorą, świątynią Afrodyty i wczesnochrześcijańską bazyliką.'); },
    lat: 34.7125,
    lng: 33.14167,
    googleMapsUrl: 'https://maps.google.com/?q=34.71250,33.14167',
    get badge() { return getTranslation('places.amathus-ruins.badge', 'Kurator Amathus'); },
    xp: 180,
    requiredLevel: 5,
  },
  {
    id: 'limassol-castle',
    get name() { return getTranslation('places.limassol-castle.name', 'Zamek Limassol (Muzeum Średniowiecza)'); },
    get description() { return getTranslation('places.limassol-castle.description', 'Kamienny zamek w sercu starego miasta, dziś mieszczący muzeum średniowiecznych artefaktów.'); },
    lat: 34.6722,
    lng: 33.0415,
    googleMapsUrl: 'https://maps.google.com/?q=34.67220,33.04150',
    get badge() { return getTranslation('places.limassol-castle.badge', 'Strażnik Limassol'); },
    xp: 160,
    requiredLevel: 3,
  },
  {
    id: 'saint-lazarus-church',
    get name() { return getTranslation('places.saint-lazarus-church.name', 'Kościół św. Łazarza w Larnace'); },
    get description() { return getTranslation('places.saint-lazarus-church.description', 'Kamienna świątynia z IX wieku, zbudowana nad grobem św. Łazarza i słynąca z bogatego ikonostasu.'); },
    lat: 34.9125,
    lng: 33.6333,
    googleMapsUrl: 'https://maps.google.com/?q=34.91250,33.63330',
    get badge() { return getTranslation('places.saint-lazarus-church.badge', 'Opiekun Relikwii'); },
    xp: 150,
    requiredLevel: 3,
  },
  {
    id: 'larnaca-salt-lake-hala-sultan',
    get name() { return getTranslation('places.larnaca-salt-lake-hala-sultan.name', 'Słone Jezioro Larnaka i Hala Sultan Tekke'); },
    get description() { return getTranslation('places.larnaca-salt-lake-hala-sultan.description', 'Zimowe flamingi i mistyczny meczet Hala Sultan Tekke tworzą wyjątkowy krajobraz nad słonym jeziorem.'); },
    lat: 34.8853,
    lng: 33.6102,
    googleMapsUrl: 'https://maps.google.com/?q=34.88530,33.61020',
    get badge() { return getTranslation('places.larnaca-salt-lake-hala-sultan.badge', 'Obserwator Flamingów'); },
    xp: 140,
    requiredLevel: 3,
  },
  {
    id: 'finikoudes-beach',
    get name() { return getTranslation('places.finikoudes-beach.name', 'Plaża Finikoudes w Larnace'); },
    get description() { return getTranslation('places.finikoudes-beach.description', 'Miejska plaża z palmową promenadą, tętniącymi życiem kawiarniami i łagodnym wejściem do morza.'); },
    lat: 34.913895,
    lng: 33.638418,
    googleMapsUrl: 'https://maps.google.com/?q=34.913895,33.638418',
    get badge() { return getTranslation('places.finikoudes-beach.badge', 'Mistrz Palm'); },
    xp: 115,
    requiredLevel: 1,
  },
  {
    id: 'chirokitia-archaeological-site',
    get name() { return getTranslation('places.chirokitia-archaeological-site.name', 'Stanowisko archeologiczne Chirokitia'); },
    get description() { return getTranslation('places.chirokitia-archaeological-site.description', 'Neolityczna osada wpisana na listę UNESCO z rekonstrukcjami okrągłych kamiennych chat.'); },
    lat: 34.79672,
    lng: 33.34372,
    googleMapsUrl: 'https://maps.google.com/?q=34.79672,33.34372',
    get badge() { return getTranslation('places.chirokitia-archaeological-site.badge', 'Pionier Neolitu'); },
    xp: 200,
    requiredLevel: 5,
  },
  {
    id: 'lefkara-village',
    get name() { return getTranslation('places.lefkara-village.name', 'Wioska Lefkara'); },
    get description() { return getTranslation('places.lefkara-village.description', 'Górska wioska słynąca z koronek lefkaritiko i srebrnego rękodzieła w kamiennych domach.'); },
    lat: 34.867,
    lng: 33.3,
    googleMapsUrl: 'https://maps.google.com/?q=34.86700,33.30000',
    get badge() { return getTranslation('places.lefkara-village.badge', 'Mistrzyni Koronek'); },
    xp: 170,
    requiredLevel: 4,
  },
  {
    id: 'nissi-beach',
    get name() { return getTranslation('places.nissi-beach.name', 'Plaża Nissi (Ayia Napa)'); },
    get description() { return getTranslation('places.nissi-beach.description', 'Jasny piasek, płytka laguna i wysepka Nissi czynią to miejsce ikoną wypoczynku i sportów wodnych.'); },
    lat: 34.99,
    lng: 33.97,
    googleMapsUrl: 'https://maps.google.com/?q=34.99000,33.97000',
    get badge() { return getTranslation('places.nissi-beach.badge', 'Łowca Słońca'); },
    xp: 120,
    requiredLevel: 1,
  },
  {
    id: 'cape-greco',
    get name() { return getTranslation('places.cape-greco.name', 'Przylądek Greko (Cape Greco)'); },
    get description() { return getTranslation('places.cape-greco.description', 'Park narodowy z klifami, morskimi jaskiniami i słynnym skalnym Mostem Miłości.'); },
    lat: 35.0,
    lng: 34.01667,
    googleMapsUrl: 'https://maps.google.com/?q=35.00000,34.01667',
    get badge() { return getTranslation('places.cape-greco.badge', 'Łowca Horyzontów'); },
    xp: 210,
    requiredLevel: 8,
  },
  {
    id: 'fig-tree-bay',
    get name() { return getTranslation('places.fig-tree-bay.name', 'Plaża Fig Tree Bay (Protaras)'); },
    get description() { return getTranslation('places.fig-tree-bay.description', 'Lazurowa zatoka ze złotym piaskiem i samotnym drzewem figowym będącym symbolem okolicy.'); },
    lat: 35.012567,
    lng: 34.058549,
    googleMapsUrl: 'https://maps.google.com/?q=35.012567,34.058549',
    get badge() { return getTranslation('places.fig-tree-bay.badge', 'Strażnik Piasków'); },
    xp: 125,
    requiredLevel: 1,
  },
  {
    id: 'ayia-napa-monastery',
    get name() { return getTranslation('places.ayia-napa-monastery.name', 'Klasztor Ayia Napa'); },
    get description() { return getTranslation('places.ayia-napa-monastery.description', 'XVII-wieczny klasztor z dziedzińcem i sykomorą, będący duchową oazą gwarnej Ayia Napy.'); },
    lat: 34.989202,
    lng: 33.999746,
    googleMapsUrl: 'https://maps.google.com/?q=34.989202,33.999746',
    get badge() { return getTranslation('places.ayia-napa-monastery.badge', 'Kustosz Monastyrów'); },
    xp: 160,
    requiredLevel: 3,
  },
  {
    id: 'ayia-napa-sculpture-park',
    get name() { return getTranslation('places.ayia-napa-sculpture-park.name', 'Park Rzeźb w Ayia Napa'); },
    get description() { return getTranslation('places.ayia-napa-sculpture-park.description', 'Plenerowa galeria sztuki z ponad setką rzeźb na tle morza i sąsiedniego parku kaktusów.'); },
    lat: 34.985077,
    lng: 34.01929,
    googleMapsUrl: 'https://maps.google.com/?q=34.985077,34.019290',
    get badge() { return getTranslation('places.ayia-napa-sculpture-park.badge', 'Kurator Rzeźb'); },
    xp: 150,
    requiredLevel: 3,
  },
  {
    id: 'troodos-olympos',
    get name() { return getTranslation('places.troodos-olympos.name', 'Góra Olimp (Olimbos)'); },
    get description() { return getTranslation('places.troodos-olympos.description', 'Najwyższy szczyt Cypru z letnim szlakiem Artemis i zimowymi stokami narciarskimi.'); },
    lat: 34.93639,
    lng: 32.86333,
    googleMapsUrl: 'https://maps.google.com/?q=34.93639,32.86333',
    get badge() { return getTranslation('places.troodos-olympos.badge', 'Zdobywca Troodos'); },
    xp: 200,
    requiredLevel: 7,
  },
  {
    id: 'kykkos-monastery',
    get name() { return getTranslation('places.kykkos-monastery.name', 'Klasztor Kykkos'); },
    get description() { return getTranslation('places.kykkos-monastery.description', 'Najbogatszy klasztor Cypru z mozaikami, złotymi ikonami i muzeum sakralnym.'); },
    lat: 34.98334,
    lng: 32.741299,
    googleMapsUrl: 'https://maps.google.com/?q=34.98334,32.741299',
    get badge() { return getTranslation('places.kykkos-monastery.badge', 'Opiekun Dziedzictwa'); },
    xp: 190,
    requiredLevel: 5,
  },
  {
    id: 'omodos-village',
    get name() { return getTranslation('places.omodos-village.name', 'Wioska Omodos (centrum)'); },
    get description() { return getTranslation('places.omodos-village.description', 'Historyczna wioska z klasztorem Św. Krzyża, brukowanymi uliczkami i lokalnym rękodziełem.'); },
    lat: 34.84926,
    lng: 32.80986,
    googleMapsUrl: 'https://maps.google.com/?q=34.84926,32.80986',
    get badge() { return getTranslation('places.omodos-village.badge', 'Sommelier Omodos'); },
    xp: 170,
    requiredLevel: 4,
  },
  {
    id: 'kakopetria-village',
    get name() { return getTranslation('places.kakopetria-village.name', 'Wioska Kakopetria'); },
    get description() { return getTranslation('places.kakopetria-village.description', 'Górska miejscowość z tradycyjnymi domami i strumieniem, idealna na spacery po Troodos.'); },
    lat: 34.9876,
    lng: 32.9015,
    googleMapsUrl: 'https://maps.google.com/?q=34.98760,32.90150',
    get badge() { return getTranslation('places.kakopetria-village.badge', 'Strażnik Górskich Wiosek'); },
    xp: 160,
    requiredLevel: 3,
  },
  {
    id: 'caledonia-waterfall',
    get name() { return getTranslation('places.caledonia-waterfall.name', 'Wodospad Kaledonia (Kalidonia)'); },
    get description() { return getTranslation('places.caledonia-waterfall.description', 'Jedna z najwyższych kaskad Cypru ukryta w cienistym wąwozie w pobliżu miejscowości Platres.'); },
    lat: 34.90298,
    lng: 32.86989,
    googleMapsUrl: 'https://maps.google.com/?q=34.90298,32.86989',
    get badge() { return getTranslation('places.caledonia-waterfall.badge', 'Poskramiacz Wodospadów'); },
    xp: 180,
    requiredLevel: 4,
  },
  {
    id: 'kyrenia-old-harbour',
    get name() { return getTranslation('places.kyrenia-old-harbour.name', 'Stary port w Kyrenii (Girne)'); },
    get description() { return getTranslation('places.kyrenia-old-harbour.description', 'Zabytkowy port z tawernami i jachtami u stóp średniowiecznego zamku, tętniący wieczornym życiem.'); },
    lat: 35.34189,
    lng: 33.320442,
    googleMapsUrl: 'https://maps.google.com/?q=35.34189,33.320442',
    get badge() { return getTranslation('places.kyrenia-old-harbour.badge', 'Kapitan Morza Śródziemnego'); },
    xp: 150,
    requiredLevel: 2,
  },
  {
    id: 'kyrenia-castle',
    get name() { return getTranslation('places.kyrenia-castle.name', 'Zamek w Kyrenii'); },
    get description() { return getTranslation('places.kyrenia-castle.description', 'Wenecka forteca z muzeum wraku statku i widokami na port oraz Morze Śródziemne.'); },
    lat: 35.34202,
    lng: 33.32191,
    googleMapsUrl: 'https://maps.google.com/?q=35.34202,33.32191',
    get badge() { return getTranslation('places.kyrenia-castle.badge', 'Strażnik Bastionu'); },
    xp: 180,
    requiredLevel: 4,
  },
  {
    id: 'st-hilarion-castle',
    get name() { return getTranslation('places.st-hilarion-castle.name', 'Zamek św. Hilariona'); },
    get description() { return getTranslation('places.st-hilarion-castle.description', 'Górska twierdza rozsiana po trzech poziomach skał, z legendarnymi widokami na wybrzeże.'); },
    lat: 35.312485,
    lng: 33.281364,
    googleMapsUrl: 'https://maps.google.com/?q=35.312485,33.281364',
    get badge() { return getTranslation('places.st-hilarion-castle.badge', 'Rycerz Gór Kyrenii'); },
    xp: 220,
    requiredLevel: 6,
  },
  {
    id: 'famagusta-old-town',
    get name() { return getTranslation('places.famagusta-old-town.name', 'Stare miasto Famagusta (Gazimağusa)'); },
    get description() { return getTranslation('places.famagusta-old-town.description', 'Ufortyfikowane miasto z weneckimi murami, katedrą św. Mikołaja i zamkiem Othello przy porcie.'); },
    lat: 35.125,
    lng: 33.94167,
    googleMapsUrl: 'https://maps.google.com/?q=35.12500,33.94167',
    get badge() { return getTranslation('places.famagusta-old-town.badge', 'Kronikarz Famagusty'); },
    xp: 210,
    requiredLevel: 6,
  },
  {
    id: 'karpaz-golden-beach',
    get name() { return getTranslation('places.karpaz-golden-beach.name', 'Złota Plaża (Golden Beach) na Półwyspie Karpaz'); },
    get description() { return getTranslation('places.karpaz-golden-beach.description', 'Dzika, szeroka plaża o drobnym piasku, otoczona wydmami i stadami dzikich osłów.'); },
    lat: 35.63889,
    lng: 34.54389,
    googleMapsUrl: 'https://maps.google.com/?q=35.63889,34.54389',
    get badge() { return getTranslation('places.karpaz-golden-beach.badge', 'Strażnik Wydm'); },
    xp: 230,
    requiredLevel: 7,
  },
  {
    id: 'zenobia-wreck',
    get name() { return getTranslation('places.zenobia-wreck.name', 'Wrak Zenobii (Zenobia Wreck)'); },
    get description() { return getTranslation('places.zenobia-wreck.description', 'Wrak promu zatopiony u wybrzeża Larnaki, popularny obiekt do nurkowania.'); },
    lat: 34.9,
    lng: 33.633,
    googleMapsUrl: 'https://maps.google.com/?q=34.90000,33.63300',
    get badge() { return getTranslation('places.zenobia-wreck.badge', 'Mistrz Wraków'); },
    xp: 240,
    requiredLevel: 8,
  },
  {
    id: 'avakas-gorge',
    get name() { return getTranslation('places.avakas-gorge.name', 'Wąwóz Avakas (Avakas Gorge)'); },
    get description() { return getTranslation('places.avakas-gorge.description', 'Wąwóz z dramatycznymi formacjami skalnymi i ścieżkami trekkingowymi na półwyspie Akamas.'); },
    lat: 34.9935,
    lng: 32.355,
    googleMapsUrl: 'https://maps.google.com/?q=34.99350,32.35500',
    get badge() { return getTranslation('places.avakas-gorge.badge', 'Wędrowiec Wąwozów'); },
    xp: 200,
    requiredLevel: 6,
  },
  {
    id: 'aphrodites-baths',
    get name() { return getTranslation('places.aphrodites-baths.name', 'Łaźnie Afrodyty (Baths of Aphrodite)'); },
    get description() { return getTranslation('places.aphrodites-baths.description', 'Mały, romantyczny basen naturalny na półwyspie Akamas, związany z legendą Afrodyty.'); },
    lat: 35.014,
    lng: 32.367,
    googleMapsUrl: 'https://maps.google.com/?q=35.01400,32.36700',
    get badge() { return getTranslation('places.aphrodites-baths.badge', 'Strażnik Legend Afrodyty'); },
    xp: 150,
    requiredLevel: 3,
  },
  {
    id: 'polis-latchi-marina',
    get name() { return getTranslation('places.polis-latchi-marina.name', 'Polis i Marina Latchi'); },
    get description() { return getTranslation('places.polis-latchi-marina.description', 'Nadmorskie miasteczko z mariną, będące punktem wypadowym na rejsy do Błękitnej Laguny.'); },
    lat: 35.038,
    lng: 32.43,
    googleMapsUrl: 'https://maps.google.com/?q=35.03800,32.43000',
    get badge() { return getTranslation('places.polis-latchi-marina.badge', 'Kapitan Laguny'); },
    xp: 140,
    requiredLevel: 2,
  },
  {
    id: 'st-hilarion-vantage-point',
    get name() { return getTranslation('places.st-hilarion-vantage-point.name', 'Punkt widokowy zamku św. Hilariona'); },
    get description() { return getTranslation('places.st-hilarion-vantage-point.description', 'Punkt widokowy u stóp zamku św. Hilariona z szeroką panoramą wybrzeża Kyrenii.'); },
    lat: 35.31,
    lng: 33.28,
    googleMapsUrl: 'https://maps.google.com/?q=35.31000,33.28000',
    get badge() { return getTranslation('places.st-hilarion-vantage-point.badge', 'Łowca Horyzontów'); },
    xp: 160,
    requiredLevel: 4,
  },
  {
    id: 'buffavento-castle',
    get name() { return getTranslation('places.buffavento-castle.name', 'Zamek Buffavento'); },
    get description() { return getTranslation('places.buffavento-castle.description', 'Ruiny zamku na wzgórzu nad Morzem Śródziemnym, niedaleko twierdzy św. Hilariona.'); },
    lat: 35.33,
    lng: 33.29,
    googleMapsUrl: 'https://maps.google.com/?q=35.33000,33.29000',
    get badge() { return getTranslation('places.buffavento-castle.badge', 'Strażnik Buffavento'); },
    xp: 210,
    requiredLevel: 6,
  },
  {
    id: 'lania-village',
    get name() { return getTranslation('places.lania-village.name', 'Wioska Lania'); },
    get description() { return getTranslation('places.lania-village.description', 'Malownicza osada u podnóża Troodos, znana z winiarstwa, galerii i spokojnej atmosfery.'); },
    lat: 34.78,
    lng: 32.9,
    googleMapsUrl: 'https://maps.google.com/?q=34.78000,32.90000',
    get badge() { return getTranslation('places.lania-village.badge', 'Artysta z Lanii'); },
    xp: 120,
    requiredLevel: 1,
  },
  {
    id: 'trooditissa-monastery',
    get name() { return getTranslation('places.trooditissa-monastery.name', 'Klasztor Trooditissa'); },
    get description() { return getTranslation('places.trooditissa-monastery.description', 'Górski monastyr w masywie Troodos, otoczony lasami i pełen ikon oraz pielgrzymów.'); },
    lat: 34.916,
    lng: 32.819,
    googleMapsUrl: 'https://maps.google.com/?q=34.91600,32.81900',
    get badge() { return getTranslation('places.trooditissa-monastery.badge', 'Pielgrzym Trooditissa'); },
    xp: 170,
    requiredLevel: 4,
  },
  {
    id: 'soli-ancient-site',
    get name() { return getTranslation('places.soli-ancient-site.name', 'Starożytne miasto Soli'); },
    get description() { return getTranslation('places.soli-ancient-site.description', 'Ruiny antycznego miasta z amfiteatrem i pozostałościami portu w pobliżu Famagusty.'); },
    lat: 35.144,
    lng: 33.897,
    googleMapsUrl: 'https://maps.google.com/?q=35.14400,33.89700',
    get badge() { return getTranslation('places.soli-ancient-site.badge', 'Archeolog Soli'); },
    xp: 180,
    requiredLevel: 5,
  },
  {
    id: 'limassol-municipal-aquarium',
    get name() { return getTranslation('places.limassol-municipal-aquarium.name', 'Miejskie Akwarium w Limassol'); },
    get description() { return getTranslation('places.limassol-municipal-aquarium.description', 'Kameralne akwarium edukacyjne prezentujące lokalną faunę morską i programy ochronne.'); },
    lat: 34.707,
    lng: 33.069,
    googleMapsUrl: 'https://maps.google.com/?q=34.70700,33.06900',
    get badge() { return getTranslation('places.limassol-municipal-aquarium.badge', 'Opiekun Raf Limassol'); },
    xp: 110,
    requiredLevel: 1,
  },
  {
    id: 'dasoudi-beach',
    get name() { return getTranslation('places.dasoudi-beach.name', 'Plaża Dasoudi'); },
    get description() { return getTranslation('places.dasoudi-beach.description', 'Piaszczysta plaża w Limassol z nadbrzeżnym parkiem, ścieżkami spacerowymi i terenami zielonymi.'); },
    lat: 34.68,
    lng: 33.035,
    googleMapsUrl: 'https://maps.google.com/?q=34.68000,33.03500',
    get badge() { return getTranslation('places.dasoudi-beach.badge', 'Miłośnik Dasoudi'); },
    xp: 115,
    requiredLevel: 1,
  },
  {
    id: 'governors-beach',
    name: "Governor's Beach (Plaża Gubernatorska)",
    description:
      'Plaża między Limassol a Larnaką ze skałami, mieszanką piasku i żwiru oraz rafami blisko brzegu.',
    lat: 34.725,
    lng: 33.1,
    googleMapsUrl: 'https://maps.google.com/?q=34.72500,33.10000',
    get badge() { return getTranslation('places.governors-beach.badge', 'Odkrywca Klifów'); },
    xp: 130,
    requiredLevel: 2,
  },
  {
    id: 'macronissos-beach',
    get name() { return getTranslation('places.macronissos-beach.name', 'Plaża Macronissos'); },
    get description() { return getTranslation('places.macronissos-beach.description', 'Zatoka z jasnym piaskiem i spokojnymi wodami w pobliżu Ayia Napy, idealna na rodzinny wypoczynek.'); },
    lat: 34.9975,
    lng: 34.02,
    googleMapsUrl: 'https://maps.google.com/?q=34.99750,34.02000',
    get badge() { return getTranslation('places.macronissos-beach.badge', 'Plażowicz Macronissos'); },
    xp: 125,
    requiredLevel: 1,
  },
  {
    id: 'yeroskipou-town',
    get name() { return getTranslation('places.yeroskipou-town.name', 'Yeroskipou (Kouklia)'); },
    get description() { return getTranslation('places.yeroskipou-town.description', 'Miasteczko niedaleko Pafos z kościołem Agios Georgios i słynnymi słodyczami pastelli.'); },
    lat: 34.715,
    lng: 32.49,
    googleMapsUrl: 'https://maps.google.com/?q=34.71500,32.49000',
    get badge() { return getTranslation('places.yeroskipou-town.badge', 'Smakosz Pastelli'); },
    xp: 135,
    requiredLevel: 2,
  },
  {
    id: 'agios-neophytos-monastery',
    get name() { return getTranslation('places.agios-neophytos-monastery.name', 'Klasztor Agios Neophytos'); },
    get description() { return getTranslation('places.agios-neophytos-monastery.description', 'Pustelniczy klasztor wykuty w skale, zdobiony malowidłami założonymi przez św. Neofitosa.'); },
    lat: 34.822,
    lng: 32.389,
    googleMapsUrl: 'https://maps.google.com/?q=34.82200,32.38900',
    get badge() { return getTranslation('places.agios-neophytos-monastery.badge', 'Kronikarz Neofitosa'); },
    xp: 175,
    requiredLevel: 4,
  },
  {
    id: 'vouni-ancient-house',
    get name() { return getTranslation('places.vouni-ancient-house.name', 'Starożytny dom zgromadzeń w Vouni'); },
    get description() { return getTranslation('places.vouni-ancient-house.description', 'Archeologiczne ruiny na wzgórzu Vouni z widokiem na zatoki i dawne królewskie rezydencje.'); },
    lat: 34.8,
    lng: 32.583,
    googleMapsUrl: 'https://maps.google.com/?q=34.80000,32.58300',
    get badge() { return getTranslation('places.vouni-ancient-house.badge', 'Strażnik Vouni'); },
    xp: 190,
    requiredLevel: 5,
  },
  {
    id: 'nicosia-archaeological-museum',
    get name() { return getTranslation('places.nicosia-archaeological-museum.name', 'Muzeum Archeologiczne w Nikozji'); },
    get description() { return getTranslation('places.nicosia-archaeological-museum.description', 'Muzeum ukazujące dzieje Cypru od prehistorii po średniowiecze z bogatą kolekcją artefaktów.'); },
    lat: 35.171,
    lng: 33.365,
    googleMapsUrl: 'https://maps.google.com/?q=35.17100,33.36500',
    get badge() { return getTranslation('places.nicosia-archaeological-museum.badge', 'Kurator Nikozji'); },
    xp: 160,
    requiredLevel: 3,
  },
  {
    id: 'buyuk-han',
    get name() { return getTranslation('places.buyuk-han.name', 'Büyük Han w Nikozji'); },
    get description() { return getTranslation('places.buyuk-han.description', 'Otoczony dziedziniec karawanseraj z czasów osmańskich, pełen warsztatów rękodzieła i kawiarni.'); },
    lat: 35.176,
    lng: 33.364,
    googleMapsUrl: 'https://maps.google.com/?q=35.17600,33.36400',
    get badge() { return getTranslation('places.buyuk-han.badge', 'Kupiec Han'); },
    xp: 150,
    requiredLevel: 3,
  },
  {
    id: 'ledra-street',
    get name() { return getTranslation('places.ledra-street.name', 'Ulica i Brama Ledra'); },
    get description() { return getTranslation('places.ledra-street.description', 'Jedna z głównych ulic Starej Nikozji prowadząca przez Zieloną Linię między południem a północą.'); },
    lat: 35.1765,
    lng: 33.3605,
    googleMapsUrl: 'https://maps.google.com/?q=35.17650,33.36050',
    get badge() { return getTranslation('places.ledra-street.badge', 'Wędrowiec Ledra'); },
    xp: 120,
    requiredLevel: 1,
  },
  {
    id: 'eleftheria-square',
    get name() { return getTranslation('places.eleftheria-square.name', 'Plac Eleftheria (Plac Wolności)'); },
    get description() { return getTranslation('places.eleftheria-square.description', 'Nowoczesny plac w Nikozji projektu Zahy Hadid, łączący historyczne i współczesne warstwy miasta.'); },
    lat: 35.173,
    lng: 33.366,
    googleMapsUrl: 'https://maps.google.com/?q=35.17300,33.36600',
    get badge() { return getTranslation('places.eleftheria-square.badge', 'Odkrywca Eleftherii'); },
    xp: 125,
    requiredLevel: 1,
  },
  {
    id: 'anexartisias-street',
    get name() { return getTranslation('places.anexartisias-street.name', 'Ulica Anexartisias w Limassol'); },
    get description() { return getTranslation('places.anexartisias-street.description', 'Główna ulica handlowa Limassol, ulubiona przez mieszkańców i turystów na zakupy oraz kawiarnie.'); },
    lat: 34.7073,
    lng: 33.0214,
    googleMapsUrl: 'https://maps.google.com/?q=34.70730,33.02140',
    get badge() { return getTranslation('places.anexartisias-street.badge', 'Łowca Witryn'); },
    xp: 115,
    requiredLevel: 1,
  },
  {
    id: 'fasouri-watermania',
    get name() { return getTranslation('places.fasouri-watermania.name', 'Park wodny Fasouri Watermania'); },
    get description() { return getTranslation('places.fasouri-watermania.description', 'Największy park wodny na Cyprze z licznymi zjeżdżalniami, basenami tematycznymi i strefami relaksu.'); },
    lat: 34.682,
    lng: 33.013,
    googleMapsUrl: 'https://maps.google.com/?q=34.68200,33.01300',
    get badge() { return getTranslation('places.fasouri-watermania.badge', 'Mistrz Zjeżdżalni'); },
    xp: 180,
    requiredLevel: 4,
  },
  {
    id: 'akamas-national-park',
    get name() { return getTranslation('places.akamas-national-park.name', 'Park Narodowy Akamas'); },
    get description() { return getTranslation('places.akamas-national-park.description', 'Rozległy obszar dzikiej natury z punktami widokowymi, szlakami i miejscami lęgowymi żółwi.'); },
    lat: 35.041,
    lng: 32.375,
    googleMapsUrl: 'https://maps.google.com/?q=35.04100,32.37500',
    get badge() { return getTranslation('places.akamas-national-park.badge', 'Strażnik Akamas'); },
    xp: 230,
    requiredLevel: 7,
  },
  {
    id: 'panagia-kykkos-viewpoint',
    get name() { return getTranslation('places.panagia-kykkos-viewpoint.name', 'Punkt widokowy klasztoru Panagia Kykkos'); },
    get description() { return getTranslation('places.panagia-kykkos-viewpoint.description', 'Wysoko położony punkt przy klasztorze Kykkos z panoramicznym widokiem na góry Troodos.'); },
    lat: 34.991,
    lng: 32.741,
    googleMapsUrl: 'https://maps.google.com/?q=34.99100,32.74100',
    get badge() { return getTranslation('places.panagia-kykkos-viewpoint.badge', 'Pielgrzym Kykkos'); },
    xp: 220,
    requiredLevel: 7,
  },
  {
    id: 'troodos-square',
    get name() { return getTranslation('places.troodos-square.name', 'Plac Troodos'); },
    get description() { return getTranslation('places.troodos-square.description', 'Centralny punkt gór Troodos z bazą wypadową na szlaki i zimową stacją narciarską.'); },
    lat: 34.95,
    lng: 32.87,
    googleMapsUrl: 'https://maps.google.com/?q=34.95000,32.87000',
    get badge() { return getTranslation('places.troodos-square.badge', 'Odkrywca Troodos'); },
    xp: 140,
    requiredLevel: 2,
  },
  {
    id: 'avakas-gorge-west-entrance',
    get name() { return getTranslation('places.avakas-gorge-west-entrance.name', 'Wąwóz Avakas – wejście zachodnie'); },
    get description() { return getTranslation('places.avakas-gorge-west-entrance.description', 'Alternatywne wejście do wąwozu Avakas, oferujące spokojniejszy trekking i inne formacje skalne.'); },
    lat: 35.0005,
    lng: 32.35,
    googleMapsUrl: 'https://maps.google.com/?q=35.00050,32.35000',
    get badge() { return getTranslation('places.avakas-gorge-west-entrance.badge', 'Tropiciel Avakas'); },
    xp: 190,
    requiredLevel: 5,
  },
  {
    id: 'cape-greco-sea-caves',
    get name() { return getTranslation('places.cape-greco-sea-caves.name', 'Jaskinie morskie Cape Greco'); },
    get description() { return getTranslation('places.cape-greco-sea-caves.description', 'Spektakularne jaskinie morskie na klifach Cape Greco, dostępne łodzią, kajakiem lub ze snorkelem.'); },
    lat: 34.9965,
    lng: 34.025,
    googleMapsUrl: 'https://maps.google.com/?q=34.99650,34.02500',
    get badge() { return getTranslation('places.cape-greco-sea-caves.badge', 'Poszukiwacz Jaskiń'); },
    xp: 200,
    requiredLevel: 6,
  },
  {
    id: 'cyprus-museum',
    get name() { return getTranslation('places.cyprus-museum.name', 'Cyprus Museum w Nikozji'); },
    get description() { return getTranslation('places.cyprus-museum.description', 'Główne muzeum archeologiczne Cypru z kolekcją obejmującą wszystkie epoki historyczne.'); },
    lat: 35.172,
    lng: 33.3655,
    googleMapsUrl: 'https://maps.google.com/?q=35.17200,33.36550',
    get badge() { return getTranslation('places.cyprus-museum.badge', 'Strażnik Dziedzictwa'); },
    xp: 170,
    requiredLevel: 4,
  },
];

const tasks = [
  { id: 'sunrise-challenge', xp: 80, requiredLevel: 1 },
  { id: 'taste-halloumi', xp: 95, requiredLevel: 2 },
  { id: 'nicosia-day-trip', xp: 130, requiredLevel: 4 },
  { id: 'troodos-wine-route', xp: 180, requiredLevel: 6 },
  { id: 'sea-adventure', xp: 220, requiredLevel: 9 },
  { id: 'nicosia-green-line-walk', xp: 140, requiredLevel: 3 },
  { id: 'loukoumi-workshop', xp: 150, requiredLevel: 4 },
  { id: 'akamas-jeep-safari', xp: 210, requiredLevel: 6 },
  { id: 'zenobia-dive-challenge', xp: 260, requiredLevel: 8 },
  { id: 'troodos-stargazing', xp: 180, requiredLevel: 7 },
  { id: 'limassol-bike-promenade', xp: 160, requiredLevel: 3 },
  { id: 'larnaca-art-walk', xp: 175, requiredLevel: 5 },
  { id: 'karpaz-donkey-care', xp: 190, requiredLevel: 6 },
  { id: 'halloumi-farm-visit', xp: 200, requiredLevel: 5 },
  { id: 'sunset-yoga-nissi', xp: 150, requiredLevel: 4 },
  { id: 'premium-car-rental', xp: 210, requiredLevel: 5 },
  { id: 'private-blue-lagoon-charter', xp: 240, requiredLevel: 8 },
  { id: 'troodos-private-tour', xp: 220, requiredLevel: 6 },
  { id: 'nicosia-famagusta-combo', xp: 230, requiredLevel: 7 },
  { id: 'family-waterpark-day', xp: 185, requiredLevel: 4 },
  { id: 'ayia-napa-sunset-cruise', xp: 215, requiredLevel: 5 },
  { id: 'wedding-photoshoot-cyprus', xp: 250, requiredLevel: 9 },
];

const TASK_TRANSLATION_FALLBACKS = {
  'sunrise-challenge': {
    pl: { title: `Poranny spacer po plaży`, description: `Wstań przed wschodem słońca i wybierz się na krótką przechadzkę po jednej z cypryjskich plaż.` },
    en: { title: `Sunrise beach walk`, description: `Wake up before sunrise and take a short stroll along one of Cyprus' beaches.` },
  },
  'taste-halloumi': {
    pl: { title: `Skosztuj lokalnego halloumi`, description: `Odwiedź tawernę i spróbuj świeżo grillowanego halloumi – wpisz miejsce w swoim dzienniku podróży.` },
    en: { title: `Try local halloumi`, description: `Visit a tavern and sample freshly grilled halloumi—log the place in your travel journal.` },
  },
  'nicosia-day-trip': {
    pl: { title: `Wycieczka do Nikozji`, description: `Zaplanuj półdniową wizytę w stolicy Cypru i odwiedź co najmniej jedno muzeum lub galerię.` },
    en: { title: `Day trip to Nicosia`, description: `Plan a half-day visit to Cyprus' capital and step into at least one museum or gallery.` },
  },
  'troodos-wine-route': {
    pl: { title: `Degustacja wina w górach`, description: `Skorzystaj z naszej oferty Troodos Wine Route i zarezerwuj degustację z kierowcą przez WakacjeCypr.com.` },
    en: { title: `Wine tasting in the mountains`, description: `Use our Troodos Wine Route offer and book a tasting with driver through WakacjeCypr.com.` },
  },
  'sea-adventure': {
    pl: { title: `Morska przygoda w Cape Greco`, description: `Wybierz jedną z morskich atrakcji z naszej oferty (kajak, snorkeling, rejs) i zarezerwuj ją w Cape Greco.` },
    en: { title: `Sea adventure in Cape Greco`, description: `Choose one of our sea experiences (kayak, snorkel, cruise) and book it in Cape Greco.` },
  },
  'nicosia-green-line-walk': {
    pl: { title: `Spacer Zieloną Linią`, description: `Poznaj historię podziału Nikozji podczas spaceru z lokalnym przewodnikiem.` },
    en: { title: `Green Line walk`, description: `Discover Nicosia's division history on a walk with a local guide.` },
  },
  'loukoumi-workshop': {
    pl: { title: `Warsztaty loukoumi w Geroskipou`, description: `Weź udział w przygotowaniu tradycyjnych słodyczy i zabierz pamiątkowy zestaw.` },
    en: { title: `Loukoumi workshop in Geroskipou`, description: `Join a traditional sweets workshop and take home a souvenir set.` },
  },
  'akamas-jeep-safari': {
    pl: { title: `Safari 4x4 po Akamas`, description: `Skorzystaj z naszego safari 4x4 i odwiedź wąwóz Avakas oraz plażę Lara z przewodnikiem WakacjeCypr.com.` },
    en: { title: `Akamas 4x4 safari`, description: `Use our 4x4 safari and visit Avakas Gorge and Lara Beach with a WakacjeCypr.com guide.` },
  },
  'zenobia-dive-challenge': {
    pl: { title: `Nurkowanie na wraku Zenobia`, description: `Dołącz do organizowanego przez nas nurkowania na wraku Zenobia z licencjonowanym instruktorem i sprzętem w cenie.` },
    en: { title: `Zenobia wreck dive challenge`, description: `Join our organised dive on the Zenobia wreck with a licensed instructor and gear included.` },
  },
  'troodos-stargazing': {
    pl: { title: `Nocne obserwacje w Troodos`, description: `Zarezerwuj naszą sesję astronomiczną w Troodos i policz konstelacje nad górą Olympos z ekspertem.` },
    en: { title: `Night stargazing in Troodos`, description: `Book our astronomy session in Troodos and count constellations over Mount Olympos with an expert.` },
  },
  'limassol-bike-promenade': {
    pl: { title: `Rowerem po promenadzie Molos`, description: `Wypożycz rower i przejedź co najmniej 8 km wzdłuż wybrzeża Limassol.` },
    en: { title: `Bike the Molos promenade`, description: `Rent a bike and ride at least 8 km along Limassol's seafront.` },
  },
  'larnaca-art-walk': {
    pl: { title: `Szlak sztuki Larnaki`, description: `Odwiedź trzy galerie lub murale i opisz ulubione dzieło w dzienniku podróży.` },
    en: { title: `Larnaca art walk`, description: `Visit three galleries or murals and describe your favourite piece in the travel journal.` },
  },
  'karpaz-donkey-care': {
    pl: { title: `Pomoc w sanktuarium osłów`, description: `Wykup nasz wolontariat w sanktuarium na Karpazie i spędź poranek na karmieniu oraz pielęgnacji osłów.` },
    en: { title: `Help at the donkey sanctuary`, description: `Purchase our Karpas sanctuary volunteering and spend a morning feeding and grooming donkeys.` },
  },
  'halloumi-farm-visit': {
    pl: { title: `Wizyta na farmie halloumi`, description: `Zarezerwuj wizytę na farmie halloumi przez WakacjeCypr.com i poznaj proces produkcji od wypasu po degustację.` },
    en: { title: `Halloumi farm visit`, description: `Book a halloumi farm visit via WakacjeCypr.com and learn the process from herding to tasting.` },
  },
  'sunset-yoga-nissi': {
    pl: { title: `Zachodnia joga na Nissi Beach`, description: `Zapisz się na zajęcia jogi o zachodzie słońca i nagraj krótką relację audio.` },
    en: { title: `Sunset yoga at Nissi Beach`, description: `Sign up for a sunset yoga class and record a short audio story.` },
  },
  'premium-car-rental': {
    pl: { title: `Wynajem auta z odbiorem na lotnisku`, description: `Skorzystaj z naszego wynajmu samochodów z pełnym ubezpieczeniem i odbierz auto na lotnisku w Pafos lub Larnace.` },
    en: { title: `Airport car rental pickup`, description: `Use our car rental with full insurance and collect your vehicle at Paphos or Larnaca airport.` },
  },
  'private-blue-lagoon-charter': {
    pl: { title: `Prywatny rejs do Blue Lagoon`, description: `Zarezerwuj ekskluzywny rejs lub jacht z oferty WakacjeCypr.com i odkryj Blue Lagoon z własną załogą.` },
    en: { title: `Private Blue Lagoon charter`, description: `Book an exclusive cruise or yacht from WakacjeCypr.com and explore Blue Lagoon with your own crew.` },
  },
  'troodos-private-tour': {
    pl: { title: `Prywatna wycieczka po Troodos`, description: `Zorganizuj z nami całodniową wycieczkę po górach Troodos z przewodnikiem i wygodnym transportem.` },
    en: { title: `Private Troodos tour`, description: `Arrange a full-day Troodos mountains trip with our guide and comfortable transport.` },
  },
  'nicosia-famagusta-combo': {
    pl: { title: `Zwiedzanie Nikozji i Famagusty`, description: `Wybierz pakiet łączony z przewodnikiem WakacjeCypr.com i odkryj oba oblicza wyspy w jeden dzień.` },
    en: { title: `Nicosia & Famagusta combo tour`, description: `Pick our combined package with a WakacjeCypr.com guide and see both sides of the island in one day.` },
  },
  'family-waterpark-day': {
    pl: { title: `Rodzinny dzień w aquaparku`, description: `Kup rodzinny pakiet do jednego z naszych polecanych parków wodnych z transferem hotelowym.` },
    en: { title: `Family day at the waterpark`, description: `Buy a family package to one of our recommended water parks with hotel transfers.` },
  },
  'ayia-napa-sunset-cruise': {
    pl: { title: `Rejs o zachodzie słońca w Ayia Napa`, description: `Zarezerwuj romantyczny rejs z kolacją i muzyką na żywo przez WakacjeCypr.com.` },
    en: { title: `Ayia Napa sunset cruise`, description: `Book a romantic cruise with dinner and live music via WakacjeCypr.com.` },
  },
  'wedding-photoshoot-cyprus': {
    pl: { title: `Sesja ślubna na Cyprze`, description: `Skorzystaj z usługi wedding & photo i zorganizuj sesję plenerową z naszym fotografem i stylistką.` },
    en: { title: `Wedding photoshoot in Cyprus`, description: `Use our wedding & photo service and arrange an outdoor shoot with our photographer and stylist.` },
  },
};

let xpModulePromise = null;

const mediaTrips = [
  {
    id: 'photo-trip',
    title: 'Foto wyjazd z LilKangooMedia',
    mediaType: 'Sesje fotograficzne premium',
    duration: 'Pakiety 5/8/10/20 godzin',
    basePrice: 400,
    additionalPersonPrice: 100,
    includedParticipants: 4,
    defaultParticipants: 4,
    description:
      'Prywatne zwiedzanie połączone z sesją zdjęciową LilKangooMedia. Odbierzemy Cię z hotelu, dobierzemy lokalizacje i przygotujemy gotową galerię kadrów.',
    pricingOptions: [
      {
        key: 'fiveHours',
        label: 'Foto wyjazd – do 5h (do 30 zdjęć)',
        price: 400,
        extraPerson: 100,
      },
      {
        key: 'eightHours',
        label: 'Foto wyjazd – do 8h (do 50 zdjęć)',
        price: 500,
        extraPerson: 125,
      },
      {
        key: 'tenHours',
        label: 'Foto wyjazd – do 10h (do 60 zdjęć)',
        price: 600,
        extraPerson: 150,
      },
      {
        key: 'twoDays',
        label: 'Foto wyjazd 2 dni – do 20h (do 120 zdjęć)',
        price: 1100,
        extraPerson: 275,
      },
    ],
    highlights: [
      { key: 'pickup', text: 'Odbiór z hotelu i komfortowy transport tylko dla Twojej ekipy.' },
      { key: 'planning', text: 'Indywidualny plan zdjęć dopasowany do złotej godziny.' },
      { key: 'gallery', text: '30/50/60/120 obrobionych fotografii zależnie od wariantu.' },
    ],
  },
  {
    id: 'video-trip',
    title: 'Video wyjazd z ekipą LilKangooMedia',
    mediaType: 'Produkcje filmowe premium',
    duration: 'Pakiety 5/8/10/20 godzin',
    basePrice: 800,
    additionalPersonPrice: 200,
    includedParticipants: 4,
    defaultParticipants: 4,
    description:
      'Dedykowany operator, pilot drona i realizator dźwięku utrwalą Twoją wyprawę w filmowym wydaniu. Zapewniamy transport i indywidualny scenariusz wyjazdu.',
    pricingOptions: [
      {
        key: 'fiveHours',
        label: 'Video wyjazd – do 5h (film do 3 minut)',
        price: 800,
        extraPerson: 200,
      },
      {
        key: 'eightHours',
        label: 'Video wyjazd – do 8h (film do 4 minut)',
        price: 900,
        extraPerson: 225,
      },
      {
        key: 'tenHours',
        label: 'Video wyjazd – do 10h (film do 5 minut + 2 rolki)',
        price: 1000,
        extraPerson: 250,
      },
      {
        key: 'twoDays',
        label: 'Video wyjazd 2 dni – do 20h (film do 10 minut + 5 rolek)',
        price: 1800,
        extraPerson: 450,
      },
    ],
    highlights: [
      { key: 'crew', text: 'Operator kamery, pilot drona i reżyser ujęć tylko dla Twojej grupy.' },
      { key: 'deliverables', text: 'Montaż, korekcja kolorów oraz rolki na media społecznościowe.' },
      { key: 'transport', text: 'Prywatny transport z hotelu i indywidualna trasa zwiedzania.' },
    ],
  },
];

const LOCATIONS_PREVIEW_LIMIT = 86; // Pokazuj wszystkie miejsca (było: 6)
const LOCATIONS_FULL_DATA_PATH = '/assets/data/attractions-full.json';
let locationsFullVisible = false;
let locationsFullLoaded = false;
let locationsFullLoading = false;
let locationsFullError = false;
let locationsFullData = [];

const packingGuide = {
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

let selectedPackingSeasonId = null;

const STORAGE_KEY = 'wakacjecypr-progress';
// ACCOUNT_STORAGE_KEY moved to src/state/accounts.js (imported above)
const SESSION_STORAGE_KEY = 'wakacjecypr-session';
const REVIEWS_STORAGE_KEY = 'wakacjecypr-reviews';
const JOURNAL_STORAGE_KEY = 'wakacjecypr-travel-journal';
const SELECTED_PLACE_STORAGE_KEY = 'wakacjecypr-selected-place';
const NOTIFICATIONS_STORAGE_KEY = 'wakacjecypr-notifications';
const REVIEW_MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2 MB
const JOURNAL_MAX_PHOTO_SIZE = 4 * 1024 * 1024; // 4 MB
const JOURNAL_COMMENT_MAX_LENGTH = 400;
const JOURNAL_PLACE_PREVIEW_LIMIT = 3;
const APP_BASE_PATH = resolveAppBasePath();
const API_BASE_URL = `${APP_BASE_PATH || ''}/api`;
const COMMUNITY_JOURNAL_API_URL = `${API_BASE_URL}/community/journal`;
const COMMUNITY_JOURNAL_STREAM_URL = `${COMMUNITY_JOURNAL_API_URL}/stream`;
const ADVENTURE_VIEW_ID = 'adventureView';
const PACKING_VIEW_ID = 'packingView';
const MEDIA_TRIPS_VIEW_ID = 'mediaTripsView';
const TASKS_VIEW_ID = 'tasksView';
const REVIEW_RATING_XP = 20;
const REVIEW_COMMENT_BONUS_XP = 15;
const REVIEW_PHOTO_BONUS_XP = 25;
const DAILY_CHALLENGE_BONUS_XP = 60;
const MAX_LEVEL = 100;
const GUEST_STATUS_MESSAGE = 'You are playing as a guest. Progress is saved on this device.';
const NOTIFICATIONS_LIMIT = 60;
const TRIP_PLANNER_TRAVEL_SPEED_KMH = 45;
const TRIP_PLANNER_STOP_DURATION_HOURS = 1.5;
const TRIP_PLANNER_MULTIPLIER_STEP = 0.25;
const TRIP_PLANNER_MAX_MULTIPLIER = 2;
const AUTH_STATE_VALUES = new Set(['loading', 'guest', 'authenticated']);
const AUTH_RESET_REDIRECT_PATH = '/reset/';

function translate(key, fallback = '', replacements = {}) {
  const i18n = typeof window !== 'undefined' ? window.appI18n : null;
  let result = null;

  if (i18n && i18n.translations) {
    const lang = i18n.language || 'pl';
    const entry = i18n.translations[lang] && i18n.translations[lang][key];
    if (typeof entry === 'string') {
      result = entry;
    } else if (entry && typeof entry === 'object') {
      if (typeof entry.text === 'string') {
        result = entry.text;
      } else if (typeof entry.html === 'string') {
        result = entry.html;
      }
    }
  }

  if (typeof result !== 'string' || !result) {
    result = fallback;
  }

  if (typeof result !== 'string') {
    return '';
  }

  return result.replace(/\{\{(\w+)\}\}/g, (match, param) =>
    Object.prototype.hasOwnProperty.call(replacements, param)
      ? String(replacements[param])
      : match
  );
}

function getTaskTranslationKey(task, field) {
  if (!task || !task.id) {
    return '';
  }
  return `tasks.items.${task.id}.${field}`;
}

function getTaskFallback(task, field) {
  if (!task || !task.id) {
    return '';
  }

  const currentLanguage =
    (typeof window !== 'undefined' && window.appI18n && window.appI18n.language) ||
    (typeof document !== 'undefined' && document.documentElement?.lang) ||
    'pl';

  const fallbacks = TASK_TRANSLATION_FALLBACKS[task.id] || {};
  const localizedFallback = fallbacks[currentLanguage];
  if (localizedFallback && typeof localizedFallback[field] === 'string') {
    return localizedFallback[field];
  }

  const defaultPolishFallback = fallbacks.pl;
  if (defaultPolishFallback && typeof defaultPolishFallback[field] === 'string') {
    return defaultPolishFallback[field];
  }

  const defaultEnglishFallback = fallbacks.en;
  if (defaultEnglishFallback && typeof defaultEnglishFallback[field] === 'string') {
    return defaultEnglishFallback[field];
  }

  return '';
}

function getTaskTitle(task) {
  return translate(getTaskTranslationKey(task, 'title'), getTaskFallback(task, 'title'));
}

function getTaskDescription(task) {
  return translate(getTaskTranslationKey(task, 'description'), getTaskFallback(task, 'description'));
}

function getActiveTranslations() {
  if (typeof window === 'undefined' || !window.appI18n) {
    return null;
  }

  const { language = 'pl', translations = {} } = window.appI18n;
  return translations?.[language] || null;
}

function areTranslationsReady() {
  const activeTranslations = getActiveTranslations();
  return !!(activeTranslations && Object.keys(activeTranslations).length > 0);
}

function refreshLocalizedUI() {
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        refreshLocalizedUI();
      },
      { once: true },
    );
    return;
  }

  renderAllForCurrentState();
  updatePackingPlannerLanguage();
  syncMarkers();
  updateBackLinksHref();

  if (playerMarker?.getTooltip?.()) {
    playerMarker.getTooltip().setContent(translate('map.playerLocation', 'Twoje położenie'));
  }
}

function loadXpModule() {
  if (xpModulePromise) {
    return xpModulePromise;
  }

  xpModulePromise = import('/js/xp.js').catch((error) => {
    xpModulePromise = null;
    throw error;
  });

  return xpModulePromise;
}

function getGuestStatusMessage() {
  return translate('auth.guest.status', GUEST_STATUS_MESSAGE);
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

// getPlaceTranslationKey moved to src/utils/translations.js

function getPlaceName(place) {
  return translate(getPlaceTranslationKey(place, 'name'), place?.name ?? '');
}

function getPlaceDescription(place) {
  return translate(getPlaceTranslationKey(place, 'description'), place?.description ?? '');
}

function getPlaceBadge(place) {
  return translate(getPlaceTranslationKey(place, 'badge'), place?.badge ?? '');
}

function resolveAppBasePath() {
  try {
    const currentScript = document.currentScript || document.querySelector('script[src$="app.js"]');
    if (currentScript && currentScript.src) {
      const url = new URL(currentScript.src, window.location.href);
      const pathname = url.pathname || '';
      if (pathname.endsWith('/app.js')) {
        const base = pathname.slice(0, -'/app.js'.length);
        return base === '/' ? '' : base;
      }
    }
  } catch (error) {
    console.error('Nie udało się ustalić ścieżki bazowej aplikacji:', error);
  }

  const { pathname } = window.location;
  const knownFiles = ['index.html', 'achievements.html', 'attractions.html'];

  for (const file of knownFiles) {
    if (pathname === `/${file}`) {
      return '';
    }
    if (pathname.endsWith(`/${file}`)) {
      const base = pathname.slice(0, -file.length - 1);
      return base === '/' ? '' : base;
    }
  }

  if (pathname.endsWith('/')) {
    return pathname === '/' ? '' : pathname.slice(0, -1);
  }

  const lastSlash = pathname.lastIndexOf('/');
  if (lastSlash <= 0) {
    return '';
  }

  const base = pathname.slice(0, lastSlash);
  return base === '/' ? '' : base;
}

const state = {
  xp: 0,
  level: 1,
  xpIntoLevel: 0,
  xpForNextLevel: null,
  badges: [],
  visited: new Set(),
  tasksCompleted: new Set(),
  selected: null,
  levelStatusMessage: '',
  reviewRewards: new Map(),
  dailyStreak: getDefaultDailyStreak(),
  dailyChallenge: getDefaultDailyChallenge(),
};

let accounts = {};
let currentUserKey = null;
let currentSupabaseUser = null;
let supabaseClient = null;
let supabaseSignOutInProgress = false;
let supabaseAuthInitialized = false;
let supabaseAuthSubscription = null;
let supabaseReadyListenerAttached = false;
const SUPABASE_PROGRESS_SYNC_DELAY = 400;
let pendingSupabaseProgress = null;
let supabaseProgressSyncPromise = null;
let supabaseProgressSyncTimeout = null;
let lastSupabaseSyncedProgress = null;
let supabaseProgressFetchInterval = null;
let lastSupabaseProgressFetchTime = null;
const SUPABASE_PROGRESS_FETCH_INTERVAL = 120000; // 2 minutes
let reviews = {};
let journalEntries = [];
let editingJournalEntryId = null;
let lastRenderedAccountStats = null;
let journalEventSource = null;
let journalStreamReconnectTimeout = null;
let notificationsByUser = {};
let notificationsPanelOpen = false;

let map;
let markers = new Map();
let playerMarker;
let playerAccuracyCircle;
let locationWatchId = null;
let hasCenteredOnPlayer = false;
const DEFAULT_MAP_CENTER = [35.095, 33.203];
const DEFAULT_MAP_ZOOM = 9;
const LEAFLET_STYLESHEET_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_SCRIPT_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
let leafletStylesheetPromise = null;
let leafletScriptPromise = null;
let mapLazyLoadStarted = false;
let leafletEnhancementsApplied = false;
let levelStatusTimeout;
let explorerFilterValue = 'all';
const tripPlannerState = {
  startId: null,
  selectedStops: new Set(),
};

let attractionsLocationWatchId = null;
let attractionsUserCoords = null;
let attractionsLocationMessage = '';
const attractionsDistanceElements = new Map();

// getDefaultDailyStreak moved to src/utils/dates.js

function getDefaultDailyChallenge() {
  return {
    placeId: null,
    assignedAt: null,
    completedAt: null,
    completedOn: null,
  };
}

function getDefaultProgress() {
  return {
    xp: 0,
    badges: [],
    visited: [],
    tasksCompleted: [],
    reviewRewards: {},
    dailyStreak: getDefaultDailyStreak(),
    dailyChallenge: getDefaultDailyChallenge(),
  };
}

function sanitizeAccountProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const name = typeof profile.name === 'string' ? profile.name : '';
  const email = typeof profile.email === 'string' ? profile.email : '';
  const xp = Number.isFinite(profile.xp) ? profile.xp : 0;
  const level = Number.isFinite(profile.level) ? profile.level : 1;
  const updatedAt =
    typeof profile.updatedAt === 'string' && profile.updatedAt
      ? profile.updatedAt
      : typeof profile.updated_at === 'string' && profile.updated_at
      ? profile.updated_at
      : null;

  return { name, email, xp, level, updatedAt };
}

function resetState() {
  state.xp = 0;
  state.level = 1;
  state.xpIntoLevel = 0;
  state.xpForNextLevel = null;
  state.badges = [];
  state.visited = new Set();
  state.tasksCompleted = new Set();
  state.selected = null;
  state.levelStatusMessage = '';
  state.reviewRewards = new Map();
  state.dailyStreak = getDefaultDailyStreak();
  state.dailyChallenge = getDefaultDailyChallenge();
}

function applyProgressToState(progress) {
  if (!progress || typeof progress !== 'object') {
    resetState();
    return;
  }

  state.xp = Number.isFinite(progress.xp) ? progress.xp : 0;
  state.badges = Array.isArray(progress.badges) ? [...progress.badges] : [];
  state.visited = new Set(Array.isArray(progress.visited) ? progress.visited : []);
  state.tasksCompleted = new Set(
    Array.isArray(progress.tasksCompleted) ? progress.tasksCompleted : [],
  );
  state.reviewRewards = normalizeReviewRewards(progress.reviewRewards);
  state.dailyStreak = normalizeDailyStreak(progress.dailyStreak);
  state.dailyChallenge = normalizeDailyChallenge(progress.dailyChallenge);
}

function extractProgressFromState() {
  const reviewRewards = {};
  state.reviewRewards.forEach((value, key) => {
    reviewRewards[key] = {
      rating: Boolean(value?.rating),
      comment: Boolean(value?.comment),
      photo: Boolean(value?.photo),
    };
  });

  return {
    xp: state.xp,
    badges: state.badges.map((badge) => ({ ...badge })),
    visited: [...state.visited],
    tasksCompleted: [...state.tasksCompleted],
    reviewRewards,
    dailyStreak: { ...state.dailyStreak },
    dailyChallenge: { ...state.dailyChallenge },
  };
}

function normalizeReviewRewards(raw) {
  if (!raw || typeof raw !== 'object') {
    return new Map();
  }

  const entries = Object.entries(raw)
    .map(([placeId, value]) => {
      if (typeof placeId !== 'string') {
        return null;
      }

      return [
        placeId,
        {
          rating: Boolean(value?.rating),
          comment: Boolean(value?.comment),
          photo: Boolean(value?.photo),
        },
      ];
    })
    .filter(Boolean);

  return new Map(entries);
}

// normalizeDailyStreak moved to src/utils/dates.js (duplicate removed)

function normalizeDailyChallenge(raw) {
  const defaults = getDefaultDailyChallenge();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const placeId = typeof raw.placeId === 'string' && raw.placeId.trim() ? raw.placeId.trim() : null;
  const assignedAt = typeof raw.assignedAt === 'string' && raw.assignedAt.trim() ? raw.assignedAt.trim() : null;
  const completedAt = typeof raw.completedAt === 'string' && raw.completedAt.trim() ? raw.completedAt.trim() : null;
  const completedOn = typeof raw.completedOn === 'string' && raw.completedOn.trim() ? raw.completedOn.trim() : null;

  return {
    ...defaults,
    placeId,
    assignedAt,
    completedAt,
    completedOn,
  };
}

// Date utilities (toUtcDate, getTodayDateString, calculateDayDifference) moved to src/utils/dates.js

function ensureReviewReward(placeId) {
  if (!placeId) {
    return null;
  }

  if (!state.reviewRewards.has(placeId)) {
    state.reviewRewards.set(placeId, {
      rating: false,
      comment: false,
      photo: false,
    });
  }

  return state.reviewRewards.get(placeId);
}

function applyReviewRewardProgress(placeId, { hasComment = false, hasPhoto = false } = {}) {
  if (!placeId) {
    return 0;
  }

  const rewardState = ensureReviewReward(placeId);
  if (!rewardState) {
    return 0;
  }

  let gainedXp = 0;

  if (!rewardState.rating) {
    rewardState.rating = true;
    gainedXp += REVIEW_RATING_XP;
  }

  if (hasComment && !rewardState.comment) {
    rewardState.comment = true;
    gainedXp += REVIEW_COMMENT_BONUS_XP;
  }

  if (hasPhoto && !rewardState.photo) {
    rewardState.photo = true;
    gainedXp += REVIEW_PHOTO_BONUS_XP;
  }

  state.reviewRewards.set(placeId, rewardState);

  return gainedXp;
}

function loadAccountsFromStorage() {
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const clean = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') {
        return;
      }

      const progress = value.progress && typeof value.progress === 'object'
        ? (() => {
            const normalizedRewards = normalizeReviewRewards(value.progress.reviewRewards);
            const reviewRewards = {};
            normalizedRewards.forEach((entry, key) => {
              reviewRewards[key] = {
                rating: Boolean(entry?.rating),
                comment: Boolean(entry?.comment),
                photo: Boolean(entry?.photo),
              };
            });

            return {
              xp: Number.isFinite(value.progress.xp) ? value.progress.xp : 0,
              badges: Array.isArray(value.progress.badges) ? value.progress.badges : [],
              visited: Array.isArray(value.progress.visited) ? value.progress.visited : [],
              tasksCompleted: Array.isArray(value.progress.tasksCompleted)
                ? value.progress.tasksCompleted
                : [],
              reviewRewards,
            };
          })()
        : getDefaultProgress();

      clean[key] = {
        username: typeof value.username === 'string' ? value.username : key,
        passwordHash: typeof value.passwordHash === 'string' ? value.passwordHash : '',
        progress,
        profile: sanitizeAccountProfile(value.profile),
      };
    });

    return clean;
  } catch (error) {
    console.error('Nie udało się wczytać kont graczy:', error);
    return {};
  }
}

function persistAccounts() {
  try {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Nie udało się zapisać kont graczy:', error);
  }
}

function loadReviewsFromStorage() {
  try {
    const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const sanitized = {};

    Object.entries(parsed).forEach(([placeId, items]) => {
      if (!Array.isArray(items)) {
        sanitized[placeId] = [];
        return;
      }

      const normalized = items
        .map((item) => {
          if (!item || typeof item !== 'object') return null;

          const userKey = typeof item.userKey === 'string' ? item.userKey : null;
          const ratingValue = Number(item.rating);
          if (!userKey || !Number.isFinite(ratingValue)) return null;

          const rating = Math.max(1, Math.min(5, Math.round(ratingValue)));
          const createdAt =
            typeof item.createdAt === 'string' && item.createdAt
              ? item.createdAt
              : new Date().toISOString();
          const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : undefined;

          return {
            id:
              typeof item.id === 'string'
                ? item.id
                : `${placeId}-${userKey}-${Math.random().toString(36).slice(2)}`,
            placeId,
            userKey,
            username: typeof item.username === 'string' ? item.username : 'Gracz',
            rating,
            comment: typeof item.comment === 'string' ? item.comment : '',
            photoDataUrl: typeof item.photoDataUrl === 'string' ? item.photoDataUrl : null,
            createdAt,
            updatedAt,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bDate - aDate;
        });

      sanitized[placeId] = normalized;
    });

    return sanitized;
  } catch (error) {
    console.error('Nie udało się wczytać opinii o miejscach:', error);
    return {};
  }
}

function persistReviews() {
  try {
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch (error) {
    console.error('Nie udało się zapisać opinii o miejscach:', error);
  }
}

function sanitizeJournalComment(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!text) {
    return null;
  }

  const limitedText = text.slice(0, JOURNAL_COMMENT_MAX_LENGTH);

  const createdAtRaw = typeof raw.createdAt === 'string' ? raw.createdAt : '';
  const createdTimestamp = Date.parse(createdAtRaw);
  const createdAt = Number.isFinite(createdTimestamp)
    ? new Date(createdTimestamp).toISOString()
    : new Date().toISOString();

  const updatedAtRaw = typeof raw.updatedAt === 'string' ? raw.updatedAt : '';
  const updatedTimestamp = Date.parse(updatedAtRaw);
  const updatedAt = Number.isFinite(updatedTimestamp)
    ? new Date(updatedTimestamp).toISOString()
    : createdAt;

  return {
    id:
      typeof raw.id === 'string'
        ? raw.id
        : `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: limitedText,
    createdAt,
    userKey: typeof raw.userKey === 'string' ? raw.userKey : null,
    username:
      typeof raw.username === 'string' && raw.username.trim()
        ? raw.username.trim()
        : 'Podróżnik',
    updatedAt,
    replies: sanitizeJournalComments(raw.replies),
  };
}

function sanitizeJournalComments(rawComments) {
  if (!Array.isArray(rawComments)) {
    return [];
  }

  return rawComments
    .map((comment) => sanitizeJournalComment(comment))
    .filter(Boolean)
    .sort((a, b) => {
      const aDate = Date.parse(a?.createdAt || 0);
      const bDate = Date.parse(b?.createdAt || 0);
      return aDate - bDate;
    });
}

function sanitizeJournalEntry(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const notes = typeof raw.notes === 'string' ? raw.notes.trim() : '';
  if (!notes) {
    return null;
  }

  const createdAtRaw = typeof raw.createdAt === 'string' ? raw.createdAt : '';
  const updatedAtRaw = typeof raw.updatedAt === 'string' ? raw.updatedAt : '';

  const createdTimestamp = Date.parse(createdAtRaw);
  const createdAt = Number.isFinite(createdTimestamp)
    ? new Date(createdTimestamp).toISOString()
    : new Date().toISOString();

  const updatedTimestamp = Date.parse(updatedAtRaw);
  const updatedAt = Number.isFinite(updatedTimestamp)
    ? new Date(updatedTimestamp).toISOString()
    : createdAt;

  const likedBy = Array.isArray(raw.likedBy)
    ? raw.likedBy
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    : [];

  return {
    id:
      typeof raw.id === 'string'
        ? raw.id
        : `journal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    notes,
    photoDataUrl: typeof raw.photoDataUrl === 'string' ? raw.photoDataUrl : null,
    createdAt,
    updatedAt,
    username:
      typeof raw.username === 'string' && raw.username.trim()
        ? raw.username.trim()
        : 'Podróżnik',
    userKey: typeof raw.userKey === 'string' ? raw.userKey : null,
    likedBy,
    comments: sanitizeJournalComments(raw.comments),
  };
}

function sanitizeNotification(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  if (!message) {
    return null;
  }

  const createdAtRaw = typeof raw.createdAt === 'string' ? raw.createdAt : '';
  const createdTimestamp = Date.parse(createdAtRaw);
  const createdAt = Number.isFinite(createdTimestamp)
    ? new Date(createdTimestamp).toISOString()
    : new Date().toISOString();

  return {
    id:
      typeof raw.id === 'string'
        ? raw.id
        : `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: typeof raw.type === 'string' ? raw.type : 'info',
    entryId: typeof raw.entryId === 'string' ? raw.entryId : null,
    actorKey: typeof raw.actorKey === 'string' ? raw.actorKey : null,
    actorName: typeof raw.actorName === 'string' ? raw.actorName : '',
    message,
    createdAt,
    read: Boolean(raw.read),
  };
}

function loadNotificationsFromStorage() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const sanitized = {};

    Object.entries(parsed).forEach(([userKey, list]) => {
      if (typeof userKey !== 'string' || !Array.isArray(list)) {
        return;
      }

      const normalized = list
        .map((item) => sanitizeNotification(item))
        .filter(Boolean)
        .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

      sanitized[userKey] = normalized.slice(0, NOTIFICATIONS_LIMIT);
    });

    return sanitized;
  } catch (error) {
    console.error('Nie udało się wczytać powiadomień:', error);
    return {};
  }
}

function persistNotifications() {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notificationsByUser));
  } catch (error) {
    console.error('Nie udało się zapisać powiadomień:', error);
  }
}

function getUserNotifications(userKey) {
  if (!userKey) {
    return [];
  }

  const list = notificationsByUser[userKey];
  return Array.isArray(list) ? [...list] : [];
}

function getUnreadNotificationsCount(userKey) {
  return getUserNotifications(userKey).filter((item) => !item.read).length;
}

function addNotificationForUser(userKey, payload = {}) {
  if (!userKey) {
    return;
  }

  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!message) {
    return;
  }

  const timestamp = new Date().toISOString();
  const notification = {
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: typeof payload.type === 'string' ? payload.type : 'info',
    entryId: typeof payload.entryId === 'string' ? payload.entryId : null,
    actorKey: typeof payload.actorKey === 'string' ? payload.actorKey : null,
    actorName: typeof payload.actorName === 'string' ? payload.actorName : '',
    message,
    createdAt: timestamp,
    read: false,
  };

  const existing = getUserNotifications(userKey);
  const updated = [notification, ...existing].slice(0, NOTIFICATIONS_LIMIT);
  notificationsByUser = { ...notificationsByUser, [userKey]: updated };
  persistNotifications();

  if (userKey === currentUserKey) {
    renderNotificationsUI();
  }
}

function updateNotificationReadState(notificationId, read = true) {
  if (!currentUserKey || !notificationId) {
    return;
  }

  const list = getUserNotifications(currentUserKey);
  let changed = false;

  const updated = list.map((item) => {
    if (item.id !== notificationId) {
      return item;
    }
    if (item.read === read) {
      return item;
    }
    changed = true;
    return { ...item, read };
  });

  if (!changed) {
    return;
  }

  notificationsByUser[currentUserKey] = updated;
  persistNotifications();
  renderNotificationsUI();
}

function markNotificationAsRead(notificationId) {
  updateNotificationReadState(notificationId, true);
}

function markAllNotificationsAsRead() {
  if (!currentUserKey) {
    return;
  }

  const list = getUserNotifications(currentUserKey);
  if (!list.length) {
    return;
  }

  const updated = list.map((item) => ({ ...item, read: true }));
  notificationsByUser[currentUserKey] = updated;
  persistNotifications();
  renderNotificationsUI();
}

// formatNotificationDate moved to src/utils/dates.js

function openJournalEntry(entryId) {
  switchAppView(ADVENTURE_VIEW_ID);

  const adventureTab = document.getElementById('headerAdventureTab');
  if (adventureTab instanceof HTMLButtonElement) {
    adventureTab.focus();
  }

  if (!entryId) {
    return;
  }

  requestAnimationFrame(() => {
    const list = document.getElementById('journalEntriesList');
    const target = list?.querySelector(`[data-entry-id="${entryId}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('is-highlighted');
      setTimeout(() => {
        target.classList.remove('is-highlighted');
      }, 2000);
    }
  });
}

function createNotificationListItem(notification, options = {}) {
  const { context = 'panel' } = options;
  const item = document.createElement('li');
  item.className = 'notification-item';
  if (!notification.read) {
    item.classList.add('is-unread');
  }
  item.dataset.notificationId = notification.id;

  const messageEl = document.createElement('p');
  messageEl.className = 'notification-message';
  messageEl.textContent = notification.message;
  item.appendChild(messageEl);

  const meta = document.createElement('div');
  meta.className = 'notification-meta';

  if (notification.createdAt) {
    const timeEl = document.createElement('time');
    timeEl.dateTime = notification.createdAt;
    timeEl.textContent = formatNotificationDate(notification.createdAt);
    meta.appendChild(timeEl);
  }

  const actions = document.createElement('div');
  actions.className = 'notification-actions';

  if (!notification.read) {
    const markBtn = document.createElement('button');
    markBtn.type = 'button';
    markBtn.className = 'link-button';
    markBtn.textContent = 'Oznacz jako przeczytane';
    markBtn.addEventListener('click', () => {
      markNotificationAsRead(notification.id);
    });
    actions.appendChild(markBtn);
  }

  if (notification.entryId) {
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'link-button';
    viewBtn.textContent = context === 'panel' ? 'Pokaż wpis' : 'Przejdź do wpisu';
    viewBtn.addEventListener('click', () => {
      markNotificationAsRead(notification.id);
      openJournalEntry(notification.entryId);
    });
    actions.appendChild(viewBtn);
  }

  if (actions.childElementCount > 0) {
    meta.appendChild(actions);
  }

  if (meta.childElementCount > 0) {
    item.appendChild(meta);
  }

  return item;
}

function renderNotificationsUI() {
  const toggleBtn = document.getElementById('notificationsToggle');
  const counter = document.getElementById('notificationsCounter');
  const panel = document.getElementById('notificationsPanel');
  const panelList = document.getElementById('notificationsPanelList');
  const panelEmpty = document.getElementById('notificationsPanelEmpty');
  const panelMarkAll = document.getElementById('notificationsMarkAll');
  const feedList = document.getElementById('notificationsFeedList');
  const feedEmpty = document.getElementById('notificationsFeedEmpty');
  const feedMarkAll = document.getElementById('notificationsFeedMarkAll');

  const notifications = currentUserKey ? getUserNotifications(currentUserKey) : [];
  const unreadCount = currentUserKey ? getUnreadNotificationsCount(currentUserKey) : 0;

  if (toggleBtn instanceof HTMLButtonElement) {
    toggleBtn.setAttribute('aria-expanded', notificationsPanelOpen ? 'true' : 'false');
    toggleBtn.title = currentUserKey ? '' : 'Zaloguj się, aby zobaczyć powiadomienia.';
  }

  if (counter) {
    counter.textContent = String(unreadCount);
    counter.hidden = unreadCount === 0;
  }

  if (panelList) {
    panelList.innerHTML = '';
    notifications.forEach((notification) => {
      panelList.appendChild(createNotificationListItem(notification));
    });
    panelList.hidden = notifications.length === 0;
  }

  if (panelEmpty) {
    if (!currentUserKey) {
      panelEmpty.textContent = 'Zaloguj się, aby zobaczyć swoje powiadomienia.';
    } else if (!notifications.length) {
      panelEmpty.textContent = 'Nie masz jeszcze powiadomień.';
    } else {
      panelEmpty.textContent = '';
    }
    panelEmpty.hidden = Boolean(currentUserKey && notifications.length);
  }

  if (panelMarkAll instanceof HTMLButtonElement) {
    panelMarkAll.disabled = !unreadCount;
  }

  if (feedList) {
    feedList.innerHTML = '';
    notifications.forEach((notification) => {
      feedList.appendChild(createNotificationListItem(notification, { context: 'feed' }));
    });
    feedList.hidden = notifications.length === 0;
  }

  if (feedEmpty) {
    if (!currentUserKey) {
      feedEmpty.textContent = 'Zaloguj się, aby otrzymywać powiadomienia o polubieniach i komentarzach w dzienniku.';
    } else if (!notifications.length) {
      feedEmpty.textContent = 'Brak powiadomień – dołącz do rozmowy, aby zacząć je otrzymywać.';
    } else {
      feedEmpty.textContent = '';
    }
    feedEmpty.hidden = Boolean(currentUserKey && notifications.length);
  }

  if (feedMarkAll instanceof HTMLButtonElement) {
    feedMarkAll.disabled = !unreadCount;
  }

  if (panel instanceof HTMLElement) {
    panel.hidden = !notificationsPanelOpen;
  }
}

function handleNotificationsOutsideClick(event) {
  const panel = document.getElementById('notificationsPanel');
  const toggleBtn = document.getElementById('notificationsToggle');

  if (!notificationsPanelOpen || !(panel instanceof HTMLElement)) {
    return;
  }

  const target = event.target;
  if (panel.contains(target) || toggleBtn?.contains(target)) {
    return;
  }

  closeNotificationsPanel();
}

function openNotificationsPanel() {
  if (!currentUserKey) {
    setLevelStatus('Zaloguj się, aby sprawdzić swoje powiadomienia.', 5000);
    openAuthModal();
    return;
  }

  notificationsPanelOpen = true;
  renderNotificationsUI();
  document.addEventListener('click', handleNotificationsOutsideClick);
}

function closeNotificationsPanel() {
  notificationsPanelOpen = false;
  renderNotificationsUI();
  document.removeEventListener('click', handleNotificationsOutsideClick);
}

function toggleNotificationsPanel() {
  if (notificationsPanelOpen) {
    closeNotificationsPanel();
  } else {
    openNotificationsPanel();
  }
}

function loadJournalEntriesFromStorage() {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const sanitized = parsed.map((item) => sanitizeJournalEntry(item)).filter(Boolean);
    sanitized.sort((a, b) => {
      const aDate = Date.parse(a.updatedAt || a.createdAt || 0);
      const bDate = Date.parse(b.updatedAt || b.createdAt || 0);
      return bDate - aDate;
    });

    return sanitized;
  } catch (error) {
    console.error('Nie udało się wczytać dziennika podróży:', error);
    return [];
  }
}

function persistJournalEntries() {
  try {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journalEntries));
  } catch (error) {
    console.error('Nie udało się zapisać dziennika podróży:', error);
  }
}

function sortJournalEntries() {
  journalEntries.sort((a, b) => {
    const aDate = Date.parse(a?.updatedAt || a?.createdAt || 0);
    const bDate = Date.parse(b?.updatedAt || b?.createdAt || 0);
    return bDate - aDate;
  });
}

function mergeJournalEntries(entries) {
  if (!Array.isArray(entries)) {
    return false;
  }

  let changed = false;

  entries.forEach((raw) => {
    const entry = sanitizeJournalEntry(raw);
    if (!entry) {
      return;
    }

    const index = journalEntries.findIndex((item) => item.id === entry.id);
    if (index === -1) {
      journalEntries.push(entry);
      changed = true;
      return;
    }

    const existing = journalEntries[index];
    const existingTimestamp = Date.parse(existing?.updatedAt || existing?.createdAt || 0);
    const incomingTimestamp = Date.parse(entry.updatedAt || entry.createdAt || 0);

    if (
      !Number.isFinite(existingTimestamp) ||
      !Number.isFinite(incomingTimestamp) ||
      incomingTimestamp >= existingTimestamp
    ) {
      journalEntries[index] = entry;
      changed = true;
    }
  });

  if (changed) {
    sortJournalEntries();
    persistJournalEntries();
    renderJournalEntries();
  }

  return changed;
}

async function refreshJournalEntriesFromServer() {
  try {
    const response = await fetch(COMMUNITY_JOURNAL_API_URL, {
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error(`Żądanie nie powiodło się z kodem ${response.status}.`);
    }

    const data = await response.json();
    if (data && Array.isArray(data.entries)) {
      mergeJournalEntries(data.entries);
    }
  } catch (error) {
    console.error('Nie udało się zsynchronizować wpisów dziennika:', error);
  }
}

function connectJournalRealtimeUpdates() {
  if (typeof EventSource === 'undefined') {
    return;
  }

  if (journalEventSource) {
    return;
  }

  try {
    journalEventSource = new EventSource(COMMUNITY_JOURNAL_STREAM_URL);
  } catch (error) {
    console.warn('Community journal stream nie jest dostępny');
    journalEventSource = null;
    return;
  }

  journalEventSource.addEventListener('journal-entry-created', (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload?.entry) {
        mergeJournalEntries([payload.entry]);
      }
    } catch (error) {
      console.error('Nie udało się przetworzyć aktualizacji dziennika:', error);
    }
  });

  journalEventSource.addEventListener('open', () => {
    if (journalStreamReconnectTimeout !== null) {
      window.clearTimeout(journalStreamReconnectTimeout);
      journalStreamReconnectTimeout = null;
    }
  });

  journalEventSource.addEventListener('error', (error) => {
    // Wyłącz reconnect jeśli endpoint nie wspiera SSE (MIME type error)
    const isMimeError = error?.target?.readyState === EventSource.CLOSED;
    
    if (journalEventSource) {
      journalEventSource.close();
      journalEventSource = null;
    }

    // Nie próbuj ponownie łączyć się jeśli to błąd MIME type
    if (isMimeError) {
      console.info('Community journal stream wyłączony (endpoint nie wspiera SSE)');
      return;
    }

    if (journalStreamReconnectTimeout !== null) {
      return;
    }

    journalStreamReconnectTimeout = window.setTimeout(() => {
      journalStreamReconnectTimeout = null;
      connectJournalRealtimeUpdates();
    }, 5000);
  });
}

async function createCommunityJournalEntry(payload) {
  const response = await fetch(COMMUNITY_JOURNAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `Serwer zwrócił kod ${response.status}.`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.error === 'string') {
        errorMessage = errorBody.error;
      }
    } catch {
      // odpowiedź nie jest JSON-em – pozostajemy przy domyślnym komunikacie
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data || typeof data !== 'object' || !data.entry) {
    throw new Error('Brak danych wpisu w odpowiedzi serwera.');
  }

  return data.entry;
}

function getReviewsForPlace(placeId) {
  if (!placeId) return [];
  const list = reviews?.[placeId];
  return Array.isArray(list) ? list : [];
}

function upsertReview(placeId, payload) {
  if (!placeId || !payload || typeof payload !== 'object') return;

  const existing = Array.isArray(reviews[placeId]) ? [...reviews[placeId]] : [];
  const index = existing.findIndex((item) => item.userKey === payload.userKey);
  const timestamp = new Date().toISOString();

  if (index >= 0) {
    const previous = existing[index];
    existing[index] = {
      ...previous,
      ...payload,
      id: previous.id,
      placeId,
      createdAt: previous.createdAt || timestamp,
      updatedAt: timestamp,
    };
  } else {
    existing.push({
      id:
        typeof payload.id === 'string'
          ? payload.id
          : `${placeId}-${payload.userKey}-${Date.now()}`,
      placeId,
      userKey: payload.userKey,
      username: payload.username || 'Gracz',
      rating: payload.rating,
      comment: payload.comment || '',
      photoDataUrl: payload.photoDataUrl || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  existing.sort((a, b) => {
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });

  reviews[placeId] = existing;
  persistReviews();
}

function getAccount(key) {
  if (!key) return null;
  return accounts?.[key] || null;
}

function getCurrentDisplayName() {
  const state = window.CE_STATE || {};
  const profile = state.profile || null;

  const profileName =
    (typeof profile?.name === 'string' && profile.name.trim()) ||
    (typeof profile?.username === 'string' && profile.username.trim()) ||
    '';
  if (profileName) {
    return profileName;
  }

  if (currentUserKey) {
    const account = getAccount(currentUserKey);
    const accountName =
      (typeof account?.profile?.name === 'string' && account.profile.name.trim()) ||
      (typeof account?.username === 'string' && account.username.trim()) ||
      '';
    if (accountName) {
      return accountName;
    }
  }

  const sessionUser = state.session?.user || null;
  if (sessionUser) {
    const sessionDisplay = getSupabaseDisplayName(sessionUser);
    if (sessionDisplay) {
      return sessionDisplay;
    }
    const sessionEmail = typeof sessionUser.email === 'string' ? sessionUser.email.trim() : '';
    if (sessionEmail) {
      return sessionEmail;
    }
  }

  if (currentSupabaseUser) {
    const supabaseDisplay = getSupabaseDisplayName(currentSupabaseUser);
    if (supabaseDisplay) {
      return supabaseDisplay;
    }
    const supabaseEmail =
      typeof currentSupabaseUser.email === 'string' ? currentSupabaseUser.email.trim() : '';
    if (supabaseEmail) {
      return supabaseEmail;
    }
  }

  return 'Gość';
}

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }
  
  // Próbuj pobrać z window.getSupabase() (nowy sposób)
  if (typeof window !== 'undefined' && typeof window.getSupabase === 'function') {
    try {
      supabaseClient = window.getSupabase();
      if (supabaseClient) {
        return supabaseClient;
      }
    } catch (error) {
      console.warn('Nie udało się pobrać klienta z window.getSupabase():', error);
    }
  }
  
  // Fallback: sprawdź window.CE_AUTH.supabase (stary sposób)
  const authApi = window.CE_AUTH || {};
  if (authApi.supabase) {
    supabaseClient = authApi.supabase;
    return supabaseClient;
  }
  
  // Fallback: sprawdź window.sb
  if (window.sb) {
    supabaseClient = window.sb;
    return supabaseClient;
  }
  
  console.warn('[getSupabaseClient] Brak klienta Supabase - sprawdź czy /js/supabaseClient.js jest załadowany');
  return null;
}

function getSupabaseDisplayName(user) {
  if (!user) return '';
  const metadata = user.user_metadata || {};
  return (
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
    (typeof metadata.display_name === 'string' && metadata.display_name.trim()) ||
    (typeof metadata.first_name === 'string' && metadata.first_name.trim()) ||
    (typeof metadata.username === 'string' && metadata.username.trim()) ||
    (typeof user.email === 'string' && user.email.trim()) ||
    ''
  );
}

function normalizeSupabaseProgressSnapshot(progress) {
  const xpValue = Number(progress?.xp);
  const levelValue = Number(progress?.level);
  const xp = Number.isFinite(xpValue) ? Math.max(0, Math.round(xpValue)) : 0;
  const level = Number.isFinite(levelValue) ? Math.max(1, Math.round(levelValue)) : 1;
  return { xp, level };
}

function markSupabaseProgressSynced(xp, level) {
  lastSupabaseSyncedProgress = normalizeSupabaseProgressSnapshot({ xp, level });
}

async function fetchLatestSupabaseProgress() {
  const client = getSupabaseClient();
  const userId = currentSupabaseUser?.id;
  
  if (!client || !userId) {
    return null;
  }
  
  try {
    const { data, error } = await client
      .from('profiles')
      .select('xp, level, updated_at')
      .eq('id', userId)
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    lastSupabaseProgressFetchTime = Date.now();
    return data;
  } catch (error) {
    console.warn('Nie udało się pobrać postępu z Supabase:', error);
    return null;
  }
}

async function syncProgressFromSupabase({ force = false } = {}) {
  if (!currentSupabaseUser?.id) {
    return false;
  }
  
  const remoteData = await fetchLatestSupabaseProgress();
  if (!remoteData) {
    return false;
  }
  
  const key = `supabase:${currentSupabaseUser.id}`;
  const account = getAccount(key);
  if (!account) {
    console.warn('[sync] Account not found for user:', currentSupabaseUser.id);
    return false;
  }
  
  const remoteXp = Number.isFinite(remoteData.xp) ? remoteData.xp : 0;
  const remoteLevel = Number.isFinite(remoteData.level) ? remoteData.level : 1;
  const remoteUpdatedAt = remoteData.updated_at || remoteData.updatedAt;
  
  // Compare against account data, not current state
  const localProfile = account.profile || {};
  const localProgress = account.progress || {};
  const localUpdatedAt = localProfile.updatedAt;
  const localXp = Number.isFinite(localProgress.xp) ? localProgress.xp : 0;
  
  debug('[sync] Comparing progress:', {
    remote: { xp: remoteXp, level: remoteLevel, updatedAt: remoteUpdatedAt },
    local: { xp: localXp, updatedAt: localUpdatedAt },
    force
  });
  
  // Check if remote data is newer
  let shouldUpdate = force;
  
  if (!shouldUpdate && remoteUpdatedAt && localUpdatedAt) {
    const remoteTime = Date.parse(remoteUpdatedAt);
    const localTime = Date.parse(localUpdatedAt);
    shouldUpdate = remoteTime > localTime;
    debug('[sync] Timestamp comparison:', {
      remoteTime,
      localTime,
      shouldUpdate
    });
  } else if (!shouldUpdate && remoteXp !== localXp) {
    // If no timestamps or force not set, update if XP differs
    shouldUpdate = true;
    debug('[sync] XP differs, updating');
  }
  
  if (shouldUpdate) {
    debug('[sync] Applying remote progress from Supabase');
    
    // Apply remote progress to local account (to aktualizuje też state.level z Supabase)
    applySupabaseProfileProgress(remoteXp, remoteLevel, remoteUpdatedAt);
    
    // Reload progress from account into state
    const savedProgress = account.progress;
    if (savedProgress) {
      applyProgressToState(savedProgress);
      // NIE wywołuj recalculateLevel() - poziom został już ustawiony z Supabase w applySupabaseProfileProgress
      renderAllForCurrentState();
      
      const xpDiff = remoteXp - localXp;
      if (xpDiff !== 0 && !force) {
        const message = xpDiff > 0 
          ? translate('sync.progress.updated', `Zsynchronizowano postęp: +${xpDiff} XP z innego urządzenia`, { xp: xpDiff })
          : translate('sync.progress.synced', 'Postęp zsynchronizowany z chmury');
        setLevelStatus(message, 5000);
      }
    }
    
    markSupabaseProgressSynced(remoteXp, remoteLevel);
    debug('[sync] Progress synced successfully');
    return true;
  }
  
  debug('[sync] No update needed, local data is current');
  return false;
}

function startSupabaseProgressFetching() {
  if (!currentSupabaseUser?.id) {
    return;
  }
  
  stopSupabaseProgressFetching();
  
  supabaseProgressFetchInterval = setInterval(() => {
    if (currentSupabaseUser?.id && document.visibilityState === 'visible') {
      void syncProgressFromSupabase();
    }
  }, SUPABASE_PROGRESS_FETCH_INTERVAL);
}

function stopSupabaseProgressFetching() {
  if (supabaseProgressFetchInterval) {
    clearInterval(supabaseProgressFetchInterval);
    supabaseProgressFetchInterval = null;
  }
  lastSupabaseProgressFetchTime = null;
}

function resetSupabaseProgressSyncState({ resetLast = true } = {}) {
  if (supabaseProgressSyncTimeout) {
    clearTimeout(supabaseProgressSyncTimeout);
    supabaseProgressSyncTimeout = null;
  }
  supabaseProgressSyncPromise = null;
  pendingSupabaseProgress = null;
  if (resetLast) {
    lastSupabaseSyncedProgress = null;
  }
  stopSupabaseProgressFetching();
}

function queueSupabaseProgressSync({ immediate = false } = {}) {
  if (!currentSupabaseUser?.id) {
    return;
  }

  pendingSupabaseProgress = normalizeSupabaseProgressSnapshot({
    xp: state.xp,
    level: state.level,
  });

  if (
    lastSupabaseSyncedProgress &&
    pendingSupabaseProgress.xp === lastSupabaseSyncedProgress.xp &&
    pendingSupabaseProgress.level === lastSupabaseSyncedProgress.level
  ) {
    pendingSupabaseProgress = null;
    return;
  }

  if (immediate) {
    triggerSupabaseProgressSync();
    return;
  }

  if (supabaseProgressSyncTimeout) {
    clearTimeout(supabaseProgressSyncTimeout);
  }

  supabaseProgressSyncTimeout = setTimeout(
    triggerSupabaseProgressSync,
    SUPABASE_PROGRESS_SYNC_DELAY,
  );
}

function triggerSupabaseProgressSync() {
  if (supabaseProgressSyncTimeout) {
    clearTimeout(supabaseProgressSyncTimeout);
    supabaseProgressSyncTimeout = null;
  }

  if (!pendingSupabaseProgress) {
    return;
  }

  if (!getSupabaseClient()) {
    supabaseProgressSyncTimeout = setTimeout(
      triggerSupabaseProgressSync,
      SUPABASE_PROGRESS_SYNC_DELAY,
    );
    return;
  }

  performSupabaseProgressSync();
}

function applySupabaseProfileProgress(xp, level, updatedAt, userId = null) {
  const targetUserId = userId || currentSupabaseUser?.id;
  if (!targetUserId) {
    return;
  }

  const key = `supabase:${targetUserId}`;
  const account = getAccount(key);
  if (!account) {
    return;
  }

  const baseProfile =
    account.profile && typeof account.profile === 'object' ? account.profile : {};

  const sanitized = sanitizeAccountProfile({
    ...baseProfile,
    xp,
    level,
    updatedAt,
  });

  const previous = account.profile || null;
  account.profile = sanitized;

  if (account.progress && typeof account.progress === 'object') {
    account.progress.xp = sanitized.xp;
  } else {
    const progress = getDefaultProgress();
    progress.xp = sanitized.xp;
    account.progress = progress;
  }

  const changed =
    !previous ||
    previous.xp !== sanitized.xp ||
    previous.level !== sanitized.level ||
    previous.updatedAt !== sanitized.updatedAt;

  if (changed) {
    persistAccounts();
  }
  
  // Jeśli to obecny użytkownik, zaktualizuj state.level z Supabase
  // (Supabase ma generated column która jest source of truth dla poziomu)
  if (currentUserKey === key && Number.isFinite(sanitized.level)) {
    state.level = sanitized.level;
    state.xp = sanitized.xp;
    // Przelicz xpIntoLevel i xpForNextLevel bazując na poziomie z Supabase
    const xpForCurrent = Array.from({ length: sanitized.level - 1 }, (_, i) => xpRequiredForLevel(i + 1)).reduce((sum, xp) => sum + xp, 0);
    state.xpIntoLevel = sanitized.xp - xpForCurrent;
    state.xpForNextLevel = xpRequiredForLevel(sanitized.level);
  }
}

function performSupabaseProgressSync() {
  if (supabaseProgressSyncPromise) {
    return supabaseProgressSyncPromise;
  }

  const client = getSupabaseClient();
  const userId = currentSupabaseUser?.id;
  const userEmail = currentSupabaseUser?.email || 'unknown';

  if (!client || !userId || !pendingSupabaseProgress) {
    return null;
  }

  const snapshot = { ...pendingSupabaseProgress };
  pendingSupabaseProgress = null;

  const payload = {
    id: userId,
    xp: snapshot.xp,
    // level jest kolumną generated - oblicza się automatycznie z xp
    updated_at: new Date().toISOString(),
  };

  debug('[sync-up] Uploading progress to Supabase:', {
    userId,
    email: userEmail,
    xp: payload.xp,
    expectedLevel: snapshot.level
  });

  const query = client
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('xp, level, updated_at');

  const request = (async () => {
    try {
      const { data, error } =
        typeof query.maybeSingle === 'function' ? await query.maybeSingle() : await query.single();
      if (error) {
        throw error;
      }

      const xpValue = Number.isFinite(data?.xp) ? data.xp : snapshot.xp;
      const levelValue = Number.isFinite(data?.level) ? data.level : snapshot.level;
      const updatedAtValue =
        (typeof data?.updated_at === 'string' && data.updated_at) ||
        (typeof data?.updatedAt === 'string' && data.updatedAt) ||
        payload.updated_at;

      debug('[sync-up] Progress uploaded successfully:', {
        xp: xpValue,
        level: levelValue,
        updatedAt: updatedAtValue
      });

      if (currentSupabaseUser?.id === userId) {
        markSupabaseProgressSynced(xpValue, levelValue);
      }

      applySupabaseProfileProgress(xpValue, levelValue, updatedAtValue, userId);
    } catch (error) {
      console.warn('[sync-up] Failed to sync progress to Supabase:', error);
      console.warn('Nie udało się zsynchronizować doświadczenia z Supabase:', error);
    }
  })();

  supabaseProgressSyncPromise = request;

  request.finally(() => {
    supabaseProgressSyncPromise = null;
    if (
      pendingSupabaseProgress &&
      (!lastSupabaseSyncedProgress ||
        pendingSupabaseProgress.xp !== lastSupabaseSyncedProgress.xp ||
        pendingSupabaseProgress.level !== lastSupabaseSyncedProgress.level)
    ) {
      if (supabaseProgressSyncTimeout) {
        clearTimeout(supabaseProgressSyncTimeout);
      }
      supabaseProgressSyncTimeout = setTimeout(
        triggerSupabaseProgressSync,
        SUPABASE_PROGRESS_SYNC_DELAY,
      );
    }
  });

  return request;
}

function ensureSupabaseAccount(user, preferredName = '') {
  if (!user || !user.id) {
    return null;
  }

  const key = `supabase:${user.id}`;
  const existing = accounts[key];
  const displayName = preferredName || getSupabaseDisplayName(user) || existing?.username || 'Gracz';
  const userEmail = typeof user.email === 'string' ? user.email.trim() : '';

  if (!existing) {
    debug('[account] Creating new Supabase account:', {
      userId: user.id,
      email: userEmail,
      displayName
    });
    
    accounts[key] = {
      username: displayName,
      progress: getDefaultProgress(),
      profile: null,
    };
    persistAccounts();
    return accounts[key];
  }

  debug('[account] Updating existing Supabase account:', {
    userId: user.id,
    email: userEmail,
    displayName,
    existingUsername: existing.username
  });

  let updated = false;
  if (displayName && existing.username !== displayName) {
    existing.username = displayName;
    updated = true;
  }

  if (!existing.progress || typeof existing.progress !== 'object') {
    existing.progress = getDefaultProgress();
    updated = true;
  }

  if (!existing.profile || typeof existing.profile !== 'object') {
    existing.profile = sanitizeAccountProfile(existing.profile) || null;
    updated = true;
  }

  if (updated) {
    persistAccounts();
    debug('[account] Account updated and persisted');
  }

  return existing;
}

async function syncSupabaseProfile(user) {
  const client = getSupabaseClient();
  if (!client || !user?.id) {
    return null;
  }

  try {
    const userEmail = typeof user.email === 'string' ? user.email.trim() : '';
    debug('[profile] Syncing Supabase profile for user:', {
      userId: user.id,
      email: userEmail
    });
    
    const { data, error } = await client
      .from('profiles')
      .select('name, email, xp, level, updated_at')
      .eq('id', user.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const metadata = user.user_metadata || {};
    const profile = data ? { ...data } : null;
    const profileName = typeof profile?.name === 'string' ? profile.name.trim() : '';
    const profileEmail = typeof profile?.email === 'string' ? profile.email.trim() : '';
    const metadataName =
      (typeof metadata.name === 'string' && metadata.name.trim()) ||
      (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
      (typeof metadata.display_name === 'string' && metadata.display_name.trim()) ||
      (typeof metadata.first_name === 'string' && metadata.first_name.trim()) ||
      '';

    debug('[profile] Profile data from Supabase:', {
      hasProfile: !!profile,
      profileName,
      profileEmail,
      metadataName,
      userEmail
    });

    const updates = {};
    let needsUpdate = false;
    if (!profileName && metadataName) {
      updates.name = metadataName;
      needsUpdate = true;
    }
    if (userEmail && userEmail !== profileEmail) {
      updates.email = userEmail;
      needsUpdate = true;
      debug('[profile] Email mismatch, updating profile email to:', userEmail);
    }

    let updatedProfile = profile ? { ...profile } : null;
    if (needsUpdate) {
      try {
        const { data: updateData, error: updateError } = await client
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select('name, email, xp, level, updated_at')
          .maybeSingle();
        if (updateError) {
          throw updateError;
        }
        if (updateData) {
          updatedProfile = updateData;
        } else if (updatedProfile) {
          updatedProfile = { ...updatedProfile, ...updates };
        } else {
          updatedProfile = { ...updates };
        }
      } catch (profileError) {
        console.warn('Nie udało się zaktualizować profilu Supabase:', profileError);
      }
    }

    const finalProfile = updatedProfile || profile || null;
    const resolvedName =
      (typeof finalProfile?.name === 'string' && finalProfile.name && finalProfile.name.trim()) ||
      metadataName ||
      getSupabaseDisplayName(user) ||
      'Gracz';

    const account = ensureSupabaseAccount(user, resolvedName);
    if (account) {
      const xpValue = Number(finalProfile?.xp);
      const levelValue = Number(finalProfile?.level);
      const resolvedEmail =
        (typeof finalProfile?.email === 'string' && finalProfile.email.trim()) ||
        profileEmail ||
        userEmail ||
        '';
      const updatedAtValue =
        (typeof finalProfile?.updated_at === 'string' && finalProfile.updated_at) ||
        (typeof finalProfile?.updatedAt === 'string' && finalProfile.updatedAt) ||
        null;

      const sanitized = sanitizeAccountProfile({
        name: resolvedName,
        email: resolvedEmail,
        xp: Number.isFinite(xpValue) ? xpValue : account.profile?.xp ?? 0,
        level: Number.isFinite(levelValue) ? levelValue : account.profile?.level ?? 1,
        updatedAt: updatedAtValue,
      });

      const localProfile = sanitizeAccountProfile(account.profile);
      const localUpdatedAtValue =
        (typeof localProfile?.updatedAt === 'string' && localProfile.updatedAt) || null;
      const localUpdatedAtTime = localUpdatedAtValue ? Date.parse(localUpdatedAtValue) : null;
      const remoteUpdatedAtTime = updatedAtValue ? Date.parse(updatedAtValue) : null;
      const currentProgressXp = Number.isFinite(account.progress?.xp) ? account.progress.xp : 0;

      let shouldApplyRemoteXp = false;
      if (remoteUpdatedAtTime && (!localUpdatedAtTime || remoteUpdatedAtTime >= localUpdatedAtTime)) {
        shouldApplyRemoteXp = true;
      } else if (
        !remoteUpdatedAtTime &&
        !localUpdatedAtTime &&
        Number.isFinite(xpValue) &&
        xpValue > currentProgressXp
      ) {
        shouldApplyRemoteXp = true;
      }

      if (shouldApplyRemoteXp) {
        if (account.progress && typeof account.progress === 'object') {
          account.progress.xp = sanitized.xp;
        } else {
          const progress = getDefaultProgress();
          progress.xp = sanitized.xp;
          account.progress = progress;
        }
      }

      account.profile = sanitized;
      persistAccounts();
      markSupabaseProgressSynced(sanitized.xp, sanitized.level);
    }

    return resolvedName;
  } catch (error) {
    console.warn('Nie udało się zsynchronizować profilu Supabase:', error);
  }
  return null;
}

async function applySupabaseUser(user, { reason = 'change' } = {}) {
  if (user && user.id) {
    const sameUser = currentSupabaseUser?.id === user.id;
    const userEmail = user.email || 'unknown';
    
    debug('[auth] Applying Supabase user:', {
      userId: user.id,
      email: userEmail,
      reason,
      sameUser
    });
    
    if (!sameUser) {
      resetSupabaseProgressSyncState();
    }
    
    currentSupabaseUser = user;
    currentUserKey = `supabase:${user.id}`;
    setDocumentAuthState('authenticated');
    
    // First, sync profile from Supabase (includes email and name)
    debug('[auth] Syncing profile from Supabase...');
    const syncedName = await syncSupabaseProfile(user);
    
    // Ensure local account exists
    ensureSupabaseAccount(user, syncedName || getSupabaseDisplayName(user));
    
    // Save session
    localStorage.setItem(SESSION_STORAGE_KEY, currentUserKey);
    
    // Force sync progress from Supabase BEFORE loading local progress
    // This ensures cloud data is the source of truth
    debug('[auth] Force syncing progress from Supabase...');
    const synced = await syncProgressFromSupabase({ force: true });
    
    if (!synced) {
      // If sync failed or no remote data, load from local storage
      debug('[auth] No remote progress found, loading local data');
      loadProgress();
    } else {
      debug('[auth] Successfully synced progress from Supabase');
    }
    
    renderAllForCurrentState();
    updateAuthUI();
    clearAuthForms();
    setAuthMessage('');
    closeAuthModal();
    
    // Start periodic progress fetching from Supabase
    startSupabaseProgressFetching();

    if (reason === 'sign-in' && !sameUser) {
      setLevelStatus(
        translate('auth.status.welcomeBack', 'Witaj ponownie, {{username}}!', {
          username: getCurrentDisplayName(),
        }),
        6000,
      );
    }
    
    debug('[auth] User applied successfully');
    return;
  }

  debug('[auth] Signing out user');
  currentSupabaseUser = null;
  resetSupabaseProgressSyncState();
  currentUserKey = null;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  const shouldShowMessage = supabaseSignOutInProgress || reason === 'sign-out';
  supabaseSignOutInProgress = false;
  const message = shouldShowMessage
    ? translate('auth.guest.switch', 'Wylogowano – grasz teraz jako gość.')
    : '';
  startGuestSession({ message, skipMessage: !shouldShowMessage });
  closeAuthModal();
}

function xpRequiredForLevel(level) {
  return Math.round(150 + (level - 1) * 35);
}

function isPlaceUnlocked(place) {
  return true;
}

function isTaskUnlocked(task) {
  return true;
}

function recalculateLevel() {
  let level = 1;
  let xpLeft = state.xp;
  let xpForNext = xpRequiredForLevel(level);

  while (level < MAX_LEVEL && xpLeft >= xpForNext) {
    xpLeft -= xpForNext;
    level += 1;
    xpForNext = xpRequiredForLevel(level);
  }

  state.level = level;
  state.xpIntoLevel = level === MAX_LEVEL ? 0 : xpLeft;
  state.xpForNextLevel = level === MAX_LEVEL ? null : xpForNext;
}

function awardXp(amount) {
  if (!amount || amount <= 0) {
    return false;
  }

  const previousLevel = state.level;
  state.xp += amount;
  recalculateLevel();
  return state.level > previousLevel;
}

function removeXp(amount) {
  if (!amount || amount <= 0) {
    return false;
  }

  const previousLevel = state.level;
  state.xp = Math.max(0, state.xp - amount);
  recalculateLevel();
  return state.level < previousLevel;
}

function loadProgress() {
  resetState();
  try {
    let savedProgress = null;
    if (currentUserKey) {
      const account = getAccount(currentUserKey);
      if (account?.progress) {
        savedProgress = account.progress;
      } else if (account) {
        account.progress = getDefaultProgress();
        persistAccounts();
      }
    }

    if (!savedProgress) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        savedProgress = JSON.parse(saved);
      }
    }

    if (savedProgress) {
      applyProgressToState(savedProgress);
    }
    recalculateLevel();
    renderAccountStats('load');
  } catch (error) {
    console.error('Nie udało się wczytać progresu:', error);
  }
}

function saveProgress() {
  try {
    const payload = extractProgressFromState();
    
    debug('[save] Saving progress:', {
      xp: state.xp,
      level: state.level,
      hasCurrentUser: !!currentUserKey,
      hasSupabaseUser: !!currentSupabaseUser?.id
    });
    
    if (currentUserKey) {
      const account = getAccount(currentUserKey);
      if (account) {
        account.progress = payload;
        const baseProfile =
          account.profile && typeof account.profile === 'object' ? account.profile : {};
        account.profile = sanitizeAccountProfile({
          ...baseProfile,
          xp: state.xp,
          level: state.level,
        });
        persistAccounts();
        debug('[save] Progress saved to local account');
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      debug('[save] Progress saved to localStorage');
    }

    if (currentSupabaseUser?.id) {
      debug('[save] Queueing Supabase sync');
      queueSupabaseProgressSync();
    }
  } catch (error) {
    console.error('Nie udało się zapisać progresu:', error);
  }
}

function renderLevelStatus() {
  const levelStatusEl = document.getElementById('levelStatus');
  const headerLevelStatusEl = document.getElementById('headerLevelStatus');
  if (levelStatusEl) {
    levelStatusEl.textContent = state.levelStatusMessage;
  }
  if (headerLevelStatusEl) {
    const defaultHeaderStatus =
      state.level > 1
        ? translate(
            'metrics.level.defaultStatus.progress',
            'Kontynuuj odkrywanie, aby zdobywać kolejne nagrody.'
          )
        : translate(
            'metrics.level.defaultStatus.initial',
            'Zdobądź pierwsze check-iny, aby awansować!'
          );
    headerLevelStatusEl.textContent = state.levelStatusMessage || defaultHeaderStatus;
  }
}

function getDailyChallengePlace() {
  if (!state.dailyChallenge?.placeId) {
    return null;
  }
  return places.find((place) => place.id === state.dailyChallenge.placeId) || null;
}

function assignNewDailyChallenge({ previousPlaceId = null, preferUnvisited = true } = {}) {
  if (!state.dailyChallenge) {
    state.dailyChallenge = getDefaultDailyChallenge();
  }

  const unlocked = places.filter((place) => isPlaceUnlocked(place));
  let candidates = unlocked;
  if (preferUnvisited) {
    const unvisited = unlocked.filter((place) => !state.visited.has(place.id));
    if (unvisited.length) {
      candidates = unvisited;
    }
  }

  if (previousPlaceId && candidates.length > 1) {
    candidates = candidates.filter((place) => place.id !== previousPlaceId);
  }

  if (!candidates.length) {
    state.dailyChallenge = {
      ...getDefaultDailyChallenge(),
      assignedAt: new Date().toISOString(),
    };
    return null;
  }

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  state.dailyChallenge.placeId = selected.id;
  state.dailyChallenge.assignedAt = new Date().toISOString();
  state.dailyChallenge.completedAt = null;
  state.dailyChallenge.completedOn = null;
  return selected;
}

function ensureDailyChallenge() {
  if (!state.dailyChallenge) {
    state.dailyChallenge = getDefaultDailyChallenge();
  }

  const today = getTodayDateString();
  const assignedDay = state.dailyChallenge.assignedAt
    ? state.dailyChallenge.assignedAt.slice(0, 10)
    : null;
  const completedDay = state.dailyChallenge.completedOn
    ? state.dailyChallenge.completedOn
    : state.dailyChallenge.completedAt
    ? state.dailyChallenge.completedAt.slice(0, 10)
    : null;

  if (!state.dailyChallenge.placeId || !assignedDay || assignedDay !== today) {
    assignNewDailyChallenge();
    return;
  }

  if (completedDay && completedDay !== today) {
    assignNewDailyChallenge({ previousPlaceId: state.dailyChallenge.placeId });
  }
}

function renderDailyChallenge() {
  const card = document.getElementById('dailyChallengeCard');
  if (!card) {
    return;
  }

  ensureDailyChallenge();

  const bonusEl = document.getElementById('dailyChallengeBonus');
  const titleEl = document.getElementById('dailyChallengeTitle');
  const descriptionEl = document.getElementById('dailyChallengeDescription');
  const statusEl = document.getElementById('dailyChallengeStatus');
  const focusBtn = document.getElementById('dailyChallengeFocus');
  const shuffleBtn = document.getElementById('dailyChallengeShuffle');

  if (bonusEl) {
    bonusEl.textContent = DAILY_CHALLENGE_BONUS_XP;
  }

  const challenge = state.dailyChallenge;
  if (!challenge?.placeId) {
    card.hidden = true;
    if (statusEl) {
      statusEl.textContent = translate(
        'dailyChallenge.noneAvailable',
        'Brak dostępnych wyzwań. Odblokuj więcej atrakcji, aby otrzymywać misje dnia.',
      );
      statusEl.dataset.state = 'locked';
    }
    if (shuffleBtn instanceof HTMLButtonElement) {
      shuffleBtn.disabled = true;
    }
    if (focusBtn instanceof HTMLButtonElement) {
      focusBtn.disabled = true;
    }
    return;
  }

  card.hidden = false;

  const place = getDailyChallengePlace();
  if (titleEl) {
    titleEl.textContent = place
      ? getPlaceName(place)
      : translate('dailyChallenge.placeholderTitle', 'Odkryj nowe miejsce');
  }
  if (descriptionEl) {
    descriptionEl.textContent = place
      ? getPlaceDescription(place)
      : translate(
          'dailyChallenge.placeholderDescription',
          'Zamelduj się w dowolnej atrakcji, aby rozpocząć misję dnia.',
        );
  }

  if (focusBtn instanceof HTMLButtonElement) {
    focusBtn.disabled = !place;
  }

  let statusMessage = '';
  let statusState = 'active';
  const isCompleted = Boolean(challenge.completedAt);
  const isUnlocked = place ? isPlaceUnlocked(place) : false;
  const isVisited = place ? state.visited.has(place.id) : false;

  if (isCompleted) {
    statusMessage = translate('dailyChallenge.status.completed', `Ukończono! Bonus +${DAILY_CHALLENGE_BONUS_XP} XP został doliczony.`, {
      bonus: DAILY_CHALLENGE_BONUS_XP,
    });
    statusState = 'completed';
    if (shuffleBtn instanceof HTMLButtonElement) {
      shuffleBtn.disabled = true;
    }
  } else if (!isUnlocked) {
    statusMessage = translate(
      'dailyChallenge.status.locked',
      'Zdobądź wyższy poziom, aby odblokować to wyzwanie albo wylosuj inne.',
    );
    statusState = 'locked';
    if (shuffleBtn instanceof HTMLButtonElement) {
      shuffleBtn.disabled = false;
    }
  } else if (isVisited) {
    statusMessage = translate(
      'dailyChallenge.status.visited',
      'Masz już odznakę z tego miejsca. Wylosuj nowe wyzwanie lub wróć jutro po kolejne.',
    );
    statusState = 'active';
    if (shuffleBtn instanceof HTMLButtonElement) {
      shuffleBtn.disabled = false;
    }
  } else {
    statusMessage = translate(
      'dailyChallenge.status.active',
      'Zamelduj się dziś w tej atrakcji, aby zgarnąć dodatkowe punkty doświadczenia!',
    );
    if (shuffleBtn instanceof HTMLButtonElement) {
      shuffleBtn.disabled = false;
    }
  }

  if (statusEl) {
    statusEl.textContent = statusMessage;
    statusEl.dataset.state = statusState;
  }
}

function renderDailyStreak() {
  const card = document.getElementById('dailyStreakCard');
  if (!card) {
    return;
  }

  const streak = state.dailyStreak || getDefaultDailyStreak();
  const currentEl = document.getElementById('dailyStreakCurrent');
  const bestEl = document.getElementById('dailyStreakBest');
  const messageEl = document.getElementById('dailyStreakMessage');

  if (currentEl) {
    currentEl.textContent = streak.current;
  }
  if (bestEl) {
    bestEl.textContent = streak.best;
  }

  const today = getTodayDateString();
  const lastCompleted = streak.lastCompletedDate;
  const daysSince = lastCompleted ? calculateDayDifference(today, lastCompleted) : null;
  let message = translate(
    'dailyStreak.message.start',
    'Zamelduj się w dowolnej atrakcji, aby rozpocząć serię przygód.',
  );

  if (daysSince === 0) {
    message = translate(
      'dailyStreak.message.today',
      'Świetnie! Dzisiejszy check-in już podtrzymał serię. Wróć jutro po kolejny dzień.',
    );
  } else if (daysSince === 1) {
    message = translate(
      'dailyStreak.message.warning',
      'Masz jeszcze dziś czas, aby utrzymać serię – odwiedź dowolne miejsce i zdobądź XP.',
    );
  } else if (typeof daysSince === 'number' && daysSince > 1 && streak.best > 0) {
    message = translate(
      'dailyStreak.message.reset',
      `Rozpocznij nową serię i pobij swój rekord ${streak.best} dni.`,
      { best: streak.best },
    );
  } else if (!lastCompleted && streak.current > 0) {
    message = translate(
      'dailyStreak.message.keepGoing',
      'Kontynuuj przygody, aby wydłużyć swoją serię check-inów.',
    );
  }

  if (messageEl) {
    messageEl.textContent = message;
  }

  if (typeof daysSince === 'number' && daysSince === 1) {
    card.classList.add('is-hot');
  } else {
    card.classList.remove('is-hot');
  }
}

function recordDailyCheckIn() {
  if (!state.dailyStreak) {
    state.dailyStreak = getDefaultDailyStreak();
  }

  const today = getTodayDateString();
  const lastCompleted = state.dailyStreak.lastCompletedDate;
  const difference = lastCompleted ? calculateDayDifference(today, lastCompleted) : null;

  if (difference === 0) {
    return { status: 'already-counted', streak: { ...state.dailyStreak } };
  }

  let status = 'started';
  if (difference === 1) {
    state.dailyStreak.current += 1;
    status = 'continued';
  } else {
    state.dailyStreak.current = 1;
    status = lastCompleted ? 'reset' : 'started';
  }

  state.dailyStreak.lastCompletedDate = today;
  state.dailyStreak.best = Math.max(state.dailyStreak.best, state.dailyStreak.current);

  return { status, streak: { ...state.dailyStreak } };
}

function completeDailyChallengeIfNeeded(place) {
  const challenge = state.dailyChallenge;
  if (!challenge || challenge.completedAt || challenge.placeId !== place.id) {
    return false;
  }

  challenge.completedAt = new Date().toISOString();
  challenge.completedOn = getTodayDateString();
  return true;
}

function skipDailyChallenge() {
  const previousPlaceId = state.dailyChallenge?.placeId || null;
  const newPlace = assignNewDailyChallenge({ previousPlaceId });
  renderDailyChallenge();
  saveProgress();

  if (newPlace) {
    const localizedName = getPlaceName(newPlace);
    showToast(
      translate('dailyChallenge.toast.new', `Nowe wyzwanie: ${localizedName}.`, {
        name: localizedName,
      }),
      {
        icon: '🎯',
        duration: 5500,
      },
    );
  } else {
    setLevelStatus(
      translate(
        'dailyChallenge.noneToShuffle',
        'Brak innych wyzwań do wylosowania. Odblokuj kolejne atrakcje, aby zyskać nowe misje.',
      ),
      6000,
    );
  }
}

function setLevelStatus(message, duration = 0) {
  state.levelStatusMessage = message;
  renderLevelStatus();
  if (levelStatusTimeout) {
    clearTimeout(levelStatusTimeout);
    levelStatusTimeout = null;
  }

  if (duration) {
    levelStatusTimeout = setTimeout(() => {
      state.levelStatusMessage = '';
      renderLevelStatus();
    }, duration);
  }
}

function showToast(message, options = {}) {
  if (!message) {
    return;
  }

  const container = document.getElementById('toastContainer');
  if (!container) {
    return;
  }

  const { duration = 6000, variant = 'info', title = '', icon = '' } = options;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (variant) {
    toast.classList.add(`toast-${variant}`);
  }

  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'toast-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = icon;
    toast.appendChild(iconEl);
  }

  const content = document.createElement('div');
  content.className = 'toast-content';

  if (title) {
    const titleEl = document.createElement('p');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;
    content.appendChild(titleEl);
  }

  const messageEl = document.createElement('p');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  content.appendChild(messageEl);

  toast.appendChild(content);
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  function removeToast() {
    toast.classList.remove('is-visible');
    setTimeout(() => {
      toast.remove();
    }, 250);
  }

  const timeoutId = setTimeout(removeToast, duration);

  toast.addEventListener('click', () => {
    clearTimeout(timeoutId);
    removeToast();
  });
}

function showLevelUpMessage(level) {
  const message = translate(
    'level.toast.levelUp.message',
    `Awans! Osiągnąłeś poziom ${level}. Gratulacje – świetnie Ci idzie! Kontynuuj odkrywanie Cypru, a zdobędziesz kolejne nagrody!`,
    { level },
  );
  setLevelStatus(message, 6000);
  showToast(message, {
    title: translate('level.toast.levelUp.title', 'Gratulacje!'),
    icon: '🏆',
    variant: 'success',
    duration: 6500,
  });

  if (currentUserKey) {
    const notificationMessage = translate(
      'notifications.level.up',
      '🏆 Nowy poziom! Osiągnąłeś poziom {{level}}.',
      { level },
    );
    addNotificationForUser(currentUserKey, {
      type: 'level-up',
      message: notificationMessage,
    });
  }
}

function getAccountStatsSnapshot() {
  return {
    level: state.level,
    xp: state.xp,
    badges: state.badges.length,
    visited: state.visited.size,
    tasks: state.tasksCompleted.size,
    streakCurrent: state.dailyStreak.current || 0,
    streakBest: state.dailyStreak.best || 0,
    source: currentUserKey ? 'account' : 'guest',
  };
}

function accountStatsSnapshotsEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  return (
    a.level === b.level &&
    a.xp === b.xp &&
    a.badges === b.badges &&
    a.visited === b.visited &&
    a.tasks === b.tasks &&
    a.streakCurrent === b.streakCurrent &&
    a.streakBest === b.streakBest &&
    a.source === b.source
  );
}

function setAccountStatTextContent(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function applyAccountStatsSnapshot(snapshot) {
  setAccountStatTextContent('accountStatLevel', String(snapshot.level));
  setAccountStatTextContent('accountStatXp', `${snapshot.xp} XP`);
  setAccountStatTextContent('accountStatBadges', String(snapshot.badges));
  setAccountStatTextContent('accountStatVisited', String(snapshot.visited));
  setAccountStatTextContent('accountStatTasks', String(snapshot.tasks));
  setAccountStatTextContent('accountStatStreak', String(snapshot.streakCurrent));
  setAccountStatTextContent('accountStatBestStreak', String(snapshot.streakBest));

  const resetDescription = document.getElementById('accountResetDescription');
  if (resetDescription) {
    resetDescription.textContent = currentSupabaseUser
      ? translate(
          'account.reset.description.auth',
          'Wyzeruj statystyki przypisane do tego konta i zacznij przygodę od nowa.',
        )
      : translate(
          'account.reset.description.guest',
          'Wyzeruj statystyki zapisane lokalnie na tym urządzeniu.',
        );
  }

  const root = document.documentElement;
  if (root) {
    root.dataset.accountStatsSource = snapshot.source;
    root.dataset.accountLevel = String(snapshot.level);
  }
}

function dispatchAccountStatsChanged(reason, snapshot) {
  if (typeof document === 'undefined') {
    return;
  }

  const detail = { reason, stats: snapshot };

  try {
    if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
      document.dispatchEvent(new CustomEvent('ce-account-stats-changed', { detail }));
      return;
    }

    if (typeof document.createEvent === 'function') {
      const event = document.createEvent('CustomEvent');
      event.initCustomEvent('ce-account-stats-changed', false, false, detail);
      document.dispatchEvent(event);
    }
  } catch (error) {
    console.warn('Nie udało się wysłać zdarzenia o zmianie statystyk konta.', error);
  }
}

function renderAccountStats(reason = 'render') {
  const snapshot = getAccountStatsSnapshot();

  if (accountStatsSnapshotsEqual(lastRenderedAccountStats, snapshot)) {
    return;
  }

  applyAccountStatsSnapshot(snapshot);
  dispatchAccountStatsChanged(reason, snapshot);
  lastRenderedAccountStats = { ...snapshot };
}

function renderProgress() {
  const xpPointsEl = document.getElementById('xpPoints');
  const badgesCountEl = document.getElementById('badgesCount');
  const xpFillEl = document.getElementById('xpFill');
  const badgesListEl = document.getElementById('badgesList');
  const levelNumberEl = document.getElementById('levelNumber');
  const headerLevelNumberEl = document.getElementById('headerLevelNumber');
  const headerXpPointsEl = document.getElementById('headerXpPoints');
  const headerBadgesCountEl = document.getElementById('headerBadgesCount');
  const headerXpFillEl = document.getElementById('headerXpFill');
  const xpProgressTextEl = document.getElementById('xpProgressText');
  const headerXpProgressTextEl = document.getElementById('headerXpProgressText');
  const achievementsBadgesCountEl = document.getElementById('achievementsBadgesCount');
  const achievementsVisitedCountEl = document.getElementById('achievementsVisitedCount');

  if (xpPointsEl) {
    xpPointsEl.textContent = state.xp;
  }
  if (headerXpPointsEl) {
    headerXpPointsEl.textContent = state.xp;
  }
  if (badgesCountEl) {
    badgesCountEl.textContent = state.badges.length;
  }
  if (headerBadgesCountEl) {
    headerBadgesCountEl.textContent = state.badges.length;
  }
  if (achievementsBadgesCountEl) {
    achievementsBadgesCountEl.textContent = state.badges.length;
  }
  if (levelNumberEl) {
    levelNumberEl.textContent = state.level;
  }
  if (headerLevelNumberEl) {
    headerLevelNumberEl.textContent = state.level;
  }
  if (achievementsVisitedCountEl) {
    achievementsVisitedCountEl.textContent = state.visited.size;
  }

  const fillWidth = (() => {
    if (state.level === MAX_LEVEL) {
      return '100%';
    }
    if (state.xpForNextLevel) {
      const fillPercent = Math.min(100, Math.round((state.xpIntoLevel / state.xpForNextLevel) * 100));
      return `${fillPercent}%`;
    }
    return '0%';
  })();

  if (xpFillEl) {
    xpFillEl.style.width = fillWidth;
  }
  if (headerXpFillEl) {
    headerXpFillEl.style.width = fillWidth;
  }

  const progressMessage = (() => {
    if (state.level === MAX_LEVEL) {
      return translate(
        'metrics.xp.maxLevel',
        'Osiągnąłeś maksymalny poziom – gratulacje!'
      );
    }
    if (state.xpForNextLevel) {
      return translate(
        'metrics.xp.progressTemplate',
        `${state.xpIntoLevel} / ${state.xpForNextLevel} XP do kolejnego poziomu`,
        { current: state.xpIntoLevel, total: state.xpForNextLevel }
      );
    }
    return translate(
      'metrics.xp.keepEarning',
      'Zdobywaj doświadczenie, aby awansować.'
    );
  })();

  if (xpProgressTextEl) {
    xpProgressTextEl.textContent = progressMessage;
  }
  if (headerXpProgressTextEl) {
    headerXpProgressTextEl.textContent = progressMessage;
  }

  if (badgesListEl) {
    badgesListEl.innerHTML = '';
    if (!state.badges.length) {
      const empty = document.createElement('li');
      empty.textContent = translate(
        'achievements.emptyBadges',
        'Jeszcze brak odznak – czas na pierwszą przygodę!'
      );
      badgesListEl.appendChild(empty);
    } else {
      state.badges.forEach((badge) => {
        const li = document.createElement('li');
        li.className = 'badge';
        li.innerHTML = `<span>🏅</span><div><strong>${badge.name}</strong><br/><small>${badge.description}</small></div>`;
        badgesListEl.appendChild(li);
      });
    }
  }

  renderLevelStatus();
  renderAccountStats('progress');
}

function renderAchievements() {
  const visitedListEl = document.getElementById('achievementsVisitedList');
  const visitedEmptyEl = document.getElementById('achievementsVisitedEmpty');
  const nextMilestoneEl = document.getElementById('achievementsNextMilestone');

  if (nextMilestoneEl) {
    if (state.level === MAX_LEVEL) {
      nextMilestoneEl.textContent = 'Jesteś na maksymalnym poziomie – świętuj swoje osiągnięcia!';
    } else if (state.xpForNextLevel) {
      const remaining = Math.max(0, state.xpForNextLevel - state.xpIntoLevel);
      const targetLevel = state.level + 1;
      nextMilestoneEl.textContent = `Brakuje ${remaining} XP do poziomu ${targetLevel}.`;
    } else {
      nextMilestoneEl.textContent = 'Rozpocznij eksplorację Cypru, aby zdobyć pierwsze doświadczenie!';
    }
  }

  if (!visitedListEl || !visitedEmptyEl) {
    return;
  }

  visitedListEl.innerHTML = '';
  const visitedPlaces = places.filter((place) => state.visited.has(place.id));

  if (!visitedPlaces.length) {
    visitedEmptyEl.hidden = false;
    return;
  }

  visitedEmptyEl.hidden = true;
  visitedPlaces.forEach((place) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${getPlaceName(place)}</strong>
      <p class="achievements-visited-meta">${getPlaceBadge(place)} • ${place.xp} XP</p>
    `;
    visitedListEl.appendChild(li);
  });
}

function renderLocations() {
  const listEl = document.getElementById('locationsList');
  if (!listEl) return;

  listEl.innerHTML = '';
  const previewItems = places.slice(0, LOCATIONS_PREVIEW_LIMIT);

  previewItems.forEach((place) => {
    const item = createLocationListItem(place);
    listEl.appendChild(item);
  });

  const carRentalItem = document.createElement('li');
  carRentalItem.className = 'locations-highlight';

  const carRentalLink = document.createElement('a');
  carRentalLink.href = 'car-rental.html';
  carRentalLink.className = 'locations-highlight-link';
  carRentalLink.innerHTML = `
    <strong><span aria-hidden="true">🚗</span> ${translate(
      'locations.highlight.title',
      'Wynajem auta na Cyprze',
    )}</strong>
    <span class="location-meta">${translate(
      'locations.highlight.subtitle',
      'Odbierz samochód z lotniska lub spod hotelu',
    )}</span>
  `;
  carRentalLink.setAttribute(
    'aria-label',
    translate('locations.highlight.aria', 'Przejdź do sekcji wynajmu auta na Cyprze'),
  );

  carRentalItem.appendChild(carRentalLink);
  listEl.appendChild(carRentalItem);

  listEl.classList.toggle('is-collapsed', !locationsFullVisible);
  listEl.classList.toggle('is-expanded', locationsFullVisible);
  listEl.setAttribute('aria-expanded', locationsFullVisible ? 'true' : 'false');

  updateLocationsToggleState();

  if (locationsFullLoaded) {
    renderFullLocationsList(locationsFullData);
  }
}

function createLocationListItem(place) {
  const li = document.createElement('li');
  li.dataset.id = place.id;
  
  // Pobierz opis miejsca
  const description = typeof place.description === 'function' ? place.description() : place.description;
  
  li.innerHTML = `
    <strong>${getPlaceName(place)}</strong>
    <p class="location-description" style="font-size: 0.9rem; color: var(--text-secondary, #64748b); margin: 0.5rem 0;">${description || ''}</p>
    <span class="location-meta">${getPlaceBadge(place)} • ${place.xp} XP</span>
  `;

  if (state.visited.has(place.id)) {
    li.classList.add('visited');
  }

  li.addEventListener('click', () => focusPlace(place.id));
  li.style.cursor = 'pointer';
  li.setAttribute('role', 'button');
  li.setAttribute('tabindex', '0');
  
  return li;
}

function updateLocationsToggleState() {
  const toggleBtn = document.getElementById('locationsToggle');
  if (!toggleBtn) {
    return;
  }

  if (places.length <= LOCATIONS_PREVIEW_LIMIT) {
    toggleBtn.hidden = true;
    return;
  }

  toggleBtn.hidden = false;

  if (locationsFullLoading) {
    toggleBtn.textContent = translate('locations.toggle.loading', 'Wczytywanie atrakcji…');
    toggleBtn.setAttribute('aria-busy', 'true');
    toggleBtn.disabled = true;
  } else {
    toggleBtn.disabled = false;
    toggleBtn.removeAttribute('aria-busy');

    if (locationsFullError) {
      toggleBtn.textContent = translate(
        'locations.toggle.retry',
        'Spróbuj ponownie załadować atrakcje',
      );
    } else if (locationsFullVisible) {
      toggleBtn.textContent = translate('locations.toggle.hide', 'Ukryj pełną listę');
    } else {
      toggleBtn.textContent = translate(
        'locations.toggle.showAll',
        `Pokaż wszystkie ${places.length} atrakcji`,
        {
          total: places.length,
        },
      );
    }
  }

  toggleBtn.setAttribute('aria-expanded', locationsFullVisible ? 'true' : 'false');
}

function renderFullLocationsList(fullPlaces) {
  const section = document.getElementById('locationsFullSection');
  const listEl = document.getElementById('locationsFullList');
  if (!section || !listEl) {
    return;
  }

  listEl.innerHTML = '';

  if (!Array.isArray(fullPlaces) || !fullPlaces.length) {
    setFullLocationsStatus('empty');
    return;
  }

  fullPlaces.forEach((place) => {
    const item = createLocationListItem(place);
    listEl.appendChild(item);
  });

  setFullLocationsStatus('ready');
}

function setFullLocationsStatus(status) {
  const statusEl = document.getElementById('locationsFullStatus');
  if (!statusEl) {
    return;
  }

  if (status === 'ready') {
    statusEl.hidden = true;
    statusEl.textContent = '';
    return;
  }

  statusEl.hidden = false;

  if (status === 'loading') {
    statusEl.textContent = translate(
      'locations.full.loading',
      'Wczytywanie pełnej listy atrakcji…',
    );
    return;
  }

  if (status === 'empty') {
    statusEl.textContent = translate(
      'locations.full.empty',
      'Brak dodatkowych atrakcji do wyświetlenia.',
    );
    return;
  }

  statusEl.textContent = translate(
    'locations.full.error',
    'Nie udało się wczytać pełnej listy atrakcji. Spróbuj ponownie później.',
  );
}

async function openFullLocationsSection() {
  const section = document.getElementById('locationsFullSection');
  if (!section || locationsFullLoading) {
    return;
  }

  section.hidden = false;
  section.setAttribute('aria-hidden', 'false');
  locationsFullLoading = true;
  locationsFullError = false;
  setFullLocationsStatus('loading');
  updateLocationsToggleState();

  try {
    const data = await fetchFullLocationsData();
    locationsFullData = data;
    locationsFullLoaded = true;
    locationsFullVisible = true;
    renderFullLocationsList(locationsFullData);
    enableAttractionsCatalogLink();
  } catch (error) {
    console.error('Nie udało się wczytać pełnej listy atrakcji.', error);
    locationsFullLoaded = false;
    locationsFullVisible = false;
    locationsFullError = true;
    section.hidden = true;
    section.setAttribute('aria-hidden', 'true');
    setFullLocationsStatus('error');
    disableAttractionsCatalogLink();
  } finally {
    locationsFullLoading = false;
    updateLocationsToggleState();
  }
}

function closeFullLocationsSection() {
  const section = document.getElementById('locationsFullSection');
  if (!section) {
    return;
  }

  locationsFullVisible = false;
  section.hidden = true;
  section.setAttribute('aria-hidden', 'true');
  updateLocationsToggleState();
}

async function fetchFullLocationsData() {
  if (locationsFullLoaded && Array.isArray(locationsFullData)) {
    return locationsFullData;
  }

  const url = `${APP_BASE_PATH || ''}${LOCATIONS_FULL_DATA_PATH}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid attractions payload.');
  }

  locationsFullError = false;
  locationsFullLoaded = true;
  locationsFullData = data;
  return locationsFullData;
}

function enableAttractionsCatalogLink() {
  const link = document.getElementById('attractionsCatalogLink');
  if (!link) {
    return;
  }

  link.hidden = false;
  link.removeAttribute('aria-disabled');
}

function disableAttractionsCatalogLink() {
  const link = document.getElementById('attractionsCatalogLink');
  if (!link) {
    return;
  }

  link.hidden = true;
  link.setAttribute('aria-disabled', 'true');
}

function formatAttractionCount(count) {
  const lang = typeof window !== 'undefined' && window.appI18n ? window.appI18n.language : 'pl';
  if (lang === 'en') {
    const absolute = Math.abs(count);
    return `${count} ${absolute === 1 ? 'attraction' : 'attractions'}`;
  }

  const absolute = Math.abs(count);
  const remainder100 = absolute % 100;
  const remainder10 = absolute % 10;

  if (remainder100 >= 10 && remainder100 <= 20) {
    return `${count} atrakcji`;
  }
  if (remainder10 === 1) {
    return `${count} atrakcja`;
  }
  if (remainder10 >= 2 && remainder10 <= 4) {
    return `${count} atrakcje`;
  }
  return `${count} atrakcji`;
}

function getCurrentLanguageCode() {
  if (typeof window !== 'undefined' && window.appI18n && window.appI18n.language) {
    return window.appI18n.language;
  }

  if (typeof document !== 'undefined') {
    const documentLang = document.documentElement?.lang;
    if (documentLang) {
      return documentLang;
    }
  }

  return 'pl';
}

const BACK_HOME_ENHANCED_FLAG = 'backHomeEnhanced';

function isModifiedNavigationClick(event) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}

function hasSafeHistoryEntry(fallbackUrl) {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!document.referrer || window.history.length <= 1) {
    return false;
  }

  try {
    const referrerUrl = new URL(document.referrer, window.location.href);
    if (referrerUrl.origin !== window.location.origin) {
      return false;
    }

    // Avoid bouncing between the same page repeatedly.
    if (fallbackUrl && referrerUrl.href === fallbackUrl) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Unable to parse referrer for back navigation.', error);
    return false;
  }
}

function handleBackHomeClick(event) {
  const link = event.currentTarget;
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  if (event.defaultPrevented || isModifiedNavigationClick(event)) {
    return;
  }

  const fallbackUrl = link.dataset.pageUrl || link.href || '/index.html';

  if (hasSafeHistoryEntry(fallbackUrl)) {
    event.preventDefault();

    let resolved = false;
    const cleanup = () => {
      resolved = true;
      window.removeEventListener('popstate', onPopState);
    };

    const onPopState = () => {
      cleanup();
    };

    window.addEventListener('popstate', onPopState, { once: true });
    window.history.back();

    window.setTimeout(() => {
      if (resolved) {
        return;
      }

      cleanup();
      window.location.assign(fallbackUrl);
    }, 400);
    return;
  }

  // When the link does not have a usable href (e.g. placeholder), ensure we still
  // navigate to the computed fallback URL.
  if (!link.href || link.getAttribute('href') === '#') {
    event.preventDefault();
    window.location.assign(fallbackUrl);
  }
}

function enhanceBackHomeLink(link) {
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  link.addEventListener('click', handleBackHomeClick);
  link.dataset[BACK_HOME_ENHANCED_FLAG] = 'true';
}

function updateBackLinksHref() {
  if (typeof document === 'undefined') {
    return;
  }

  const currentLang = getCurrentLanguageCode() || 'pl';
  const targetUrl = `/index.html?lang=${encodeURIComponent(currentLang)}`;
  const backLinks = document.querySelectorAll('[data-back-home-link]');
  backLinks.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    link.href = targetUrl;
    link.dataset.pageUrl = targetUrl;

    if (link.dataset[BACK_HOME_ENHANCED_FLAG] !== 'true') {
      enhanceBackHomeLink(link);
    }
  });
}

function storeSelectedPlaceForRedirect(placeId) {
  if (!placeId) return;
  try {
    localStorage.setItem(SELECTED_PLACE_STORAGE_KEY, placeId);
  } catch (error) {
    console.warn('Nie udało się zapisać wybranego miejsca przed przejściem na mapę.', error);
  }
}

function goToAdventureWithPlace(placeId) {
  const place = places.find((item) => item.id === placeId);
  if (!place) return;

  storeSelectedPlaceForRedirect(place.id);
  window.location.href = 'index.html#map';
}

function formatAttractionDistanceLabel(place) {
  if (attractionsUserCoords) {
    const distanceMeters = haversineDistance(
      attractionsUserCoords.latitude,
      attractionsUserCoords.longitude,
      place.lat,
      place.lng,
    );
    const distanceKm = distanceMeters / 1000;
    const formatted = distanceKm < 1 ? distanceKm.toFixed(2) : distanceKm.toFixed(1);
    return `📍 ${formatted} km`;
  }

  if (attractionsLocationMessage) {
    return `📍 ${attractionsLocationMessage}`;
  }

  if (!('geolocation' in navigator)) {
    return translate('places.distance.unavailable', '📍 Lokalizacja niedostępna');
  }

  return translate('places.distance.pending', '📍 Ustalanie pozycji…');
}

function updateAttractionDistance(placeId) {
  const span = attractionsDistanceElements.get(placeId);
  if (!span) return;
  const place = places.find((item) => item.id === placeId);
  if (!place) return;
  span.textContent = formatAttractionDistanceLabel(place);
}

function updateAllAttractionDistances() {
  attractionsDistanceElements.forEach((_, placeId) => {
    updateAttractionDistance(placeId);
  });
}

function isGeolocationPermissionDenied(error) {
  if (!error) {
    return false;
  }

  if (typeof error.code === 'number') {
    if (typeof error.PERMISSION_DENIED === 'number' && error.code === error.PERMISSION_DENIED) {
      return true;
    }
    if (error.code === 1) {
      return true;
    }
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('permission denied');
}

function isGeolocationSecureContextError(error) {
  if (!error) {
    return false;
  }

  if (error.name === 'SecurityError') {
    return true;
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('only secure origins allowed') || message.includes('secure origin');
}

function handleAttractionsLocationError(error) {
  console.warn('Błąd geolokalizacji katalogu atrakcji', error);
  if (isGeolocationSecureContextError(error)) {
    attractionsLocationMessage = translate(
      'places.distance.secureContext',
      'Użyj bezpiecznego połączenia (HTTPS), aby udostępnić lokalizację.',
    );
  } else if (isGeolocationPermissionDenied(error)) {
    attractionsLocationMessage = translate(
      'places.distance.permissionDenied',
      'Włącz udostępnianie lokalizacji',
    );
  } else {
    attractionsLocationMessage = translate(
      'places.distance.noData',
      'Brak danych o lokalizacji',
    );
  }
  attractionsUserCoords = null;
  updateAllAttractionDistances();
}

function startAttractionsLocationTracking() {
  if (attractionsLocationWatchId !== null) {
    return;
  }

  const catalog = document.getElementById('attractionsCatalog');
  if (!catalog) {
    return;
  }

  if (!('geolocation' in navigator)) {
    attractionsLocationMessage = 'Lokalizacja niedostępna';
    updateAllAttractionDistances();
    return;
  }

  try {
    attractionsLocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        attractionsUserCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        attractionsLocationMessage = '';
        updateAllAttractionDistances();
      },
      (error) => {
        handleAttractionsLocationError(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      },
    );
  } catch (error) {
    handleAttractionsLocationError(error);
    attractionsLocationWatchId = null;
  }
}

function renderAttractionsCatalog(filterValue = '') {
  const listEl = document.getElementById('attractionsCatalog');
  if (!listEl) return;

  const emptyEl = document.getElementById('attractionsEmptyState');
  const resultsEl = document.getElementById('attractionsResultsCount');
  const normalizedQuery = normalizeSearchText(filterValue.trim());
  const hasQuery = normalizedQuery.length > 0;

  const filtered = hasQuery
    ? places.filter((place) => {
        const name = getPlaceName(place);
        const description = getPlaceDescription(place);
        const badge = getPlaceBadge(place);
        const searchTargets = [
          normalizeSearchText(name),
          normalizeSearchText(description),
          normalizeSearchText(badge),
          normalizeSearchText(place.name),
          normalizeSearchText(place.description),
          normalizeSearchText(place.badge),
        ];
        return searchTargets.some((target) => target.includes(normalizedQuery));
      })
    : [...places];

  listEl.innerHTML = '';
  attractionsDistanceElements.clear();

  if (!filtered.length) {
    if (emptyEl) {
      emptyEl.hidden = false;
    }
    if (resultsEl) {
      resultsEl.textContent = `0 atrakcji (z ${formatAttractionCount(places.length)})`;
    }
    return;
  }

  if (emptyEl) {
    emptyEl.hidden = true;
  }

  filtered.forEach((place) => {
    const li = document.createElement('li');
    li.className = 'card attractions-card';
    if (state.visited.has(place.id)) {
      li.classList.add('visited');
    }

    const localizedName = getPlaceName(place);
    const title = document.createElement('h3');
    title.textContent = localizedName;
    li.appendChild(title);

    const description = document.createElement('p');
    description.textContent = getPlaceDescription(place);
    li.appendChild(description);

    const meta = document.createElement('div');
    meta.className = 'attractions-meta';

    const badgeSpan = document.createElement('span');
    badgeSpan.textContent = `🏅 ${getPlaceBadge(place)}`;
    meta.appendChild(badgeSpan);

    const xpSpan = document.createElement('span');
    xpSpan.textContent = `✨ ${place.xp} XP`;
    meta.appendChild(xpSpan);

    const distanceSpan = document.createElement('span');
    distanceSpan.textContent = formatAttractionDistanceLabel(place);
    distanceSpan.dataset.placeId = place.id;
    attractionsDistanceElements.set(place.id, distanceSpan);
    meta.appendChild(distanceSpan);

    li.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'attractions-actions';

    const focusBtn = document.createElement('button');
    focusBtn.type = 'button';
    focusBtn.className = 'secondary';
    focusBtn.textContent = translate('places.viewOnMap', 'Zobacz na mapie');
    focusBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      goToAdventureWithPlace(place.id);
    });
    actions.appendChild(focusBtn);

    const mapsLink = document.createElement('a');
    mapsLink.className = 'ghost-link';
    mapsLink.href = place.googleMapsUrl;
    mapsLink.target = '_blank';
    mapsLink.rel = 'noopener';
    mapsLink.textContent = translate('places.googleMaps', 'Google Maps');
    actions.appendChild(mapsLink);

    li.appendChild(actions);

    li.dataset.placeId = place.id;
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.addEventListener('click', (event) => {
      const interactiveTarget = event.target.closest('a, button');
      if (interactiveTarget && interactiveTarget !== li) {
        return;
      }
      goToAdventureWithPlace(place.id);
    });
    li.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goToAdventureWithPlace(place.id);
      }
    });

    listEl.appendChild(li);
  });

  if (resultsEl) {
    const foundLabel = formatAttractionCount(filtered.length);
    const totalLabel = formatAttractionCount(places.length);
    resultsEl.textContent = hasQuery
      ? translate('places.search.results', `Znaleziono ${foundLabel} (z ${totalLabel})`, {
          found: foundLabel,
          total: totalLabel,
        })
      : translate('places.search.total', `${totalLabel} w katalogu`, {
          total: totalLabel,
        });
  }

  startAttractionsLocationTracking();
  updateAllAttractionDistances();
}

function renderExplorer(filterValue) {
  if (filterValue) {
    explorerFilterValue = filterValue;
  }

  const grid = document.getElementById('explorerGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const filtered = places.filter((place) => {
    if (explorerFilterValue === 'available') {
      return !state.visited.has(place.id);
    }
    if (explorerFilterValue === 'visited') {
      return state.visited.has(place.id);
    }
    return true;
  });

  if (!filtered.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'explorer-empty';
    emptyState.textContent = translate(
      'explorer.empty',
      'Brak atrakcji do wyświetlenia dla wybranego filtra.',
    );
    grid.appendChild(emptyState);
    return;
  }

  filtered.forEach((place) => {
    const visited = state.visited.has(place.id);
    const isActive = state.selected && state.selected.id === place.id;
    const statusClass = visited ? 'status-visited' : 'status-unlocked';
    const statusLabel = visited
      ? translate('explorer.status.visited', 'Zdobyta odznaka')
      : translate('explorer.status.available', 'Do odwiedzenia');

    const localizedName = getPlaceName(place);
    const localizedDescription = getPlaceDescription(place);
    const localizedBadge = getPlaceBadge(place);

    const card = document.createElement('article');
    card.className = 'explorer-card';
    if (visited) card.classList.add('visited');
    if (isActive) card.classList.add('active');
    card.setAttribute('role', 'listitem');

    card.innerHTML = `
      <div class="explorer-card-header">
        <span class="explorer-status ${statusClass}">${statusLabel}</span>
        ${
          isActive
            ? `<span class="explorer-status status-active">${translate(
                'explorer.status.active',
                'Wybrana lokalizacja',
              )}</span>`
            : ''
        }
      </div>
      <h3>${localizedName}</h3>
      <p>${localizedDescription}</p>
      <div class="explorer-meta">
        <span>🏅 ${localizedBadge}</span>
        <span>✨ ${place.xp} XP</span>
      </div>
      <div class="explorer-actions">
        <button type="button" class="secondary">${translate(
          'places.viewOnMap',
          'Zobacz na mapie',
        )}</button>
        <a class="ghost-link" href="${place.googleMapsUrl}" target="_blank" rel="noopener">${translate(
          'places.googleMaps',
          'Google Maps',
        )}</a>
      </div>
    `;

    card.addEventListener('click', (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        return;
      }
      focusPlace(place.id);
    });

    const button = card.querySelector('button');
    if (button) {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        focusPlace(place.id);
      });
    }

    grid.appendChild(card);
  });
}

function renderTasks() {
  const listEl = document.getElementById('tasksList');
  if (!listEl) return;
  listEl.innerHTML = '';

  tasks.forEach((task) => {
    const unlocked = isTaskUnlocked(task);
    const completed = state.tasksCompleted.has(task.id);
    const li = document.createElement('li');
    li.className = 'task';
    if (completed) {
      li.classList.add('completed');
    }
    if (!unlocked) {
      li.classList.add('locked');
    }

    const info = document.createElement('div');
    info.className = 'task-info';

    const titleText = getTaskTitle(task);
    const descriptionText = getTaskDescription(task);

    const titleEl = document.createElement('p');
    titleEl.className = 'task-title';
    titleEl.textContent = titleText;
    info.appendChild(titleEl);

    if (descriptionText) {
      const descriptionEl = document.createElement('p');
      descriptionEl.className = 'task-description';
      descriptionEl.textContent = descriptionText;
      info.appendChild(descriptionEl);
    }

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const xp = document.createElement('span');
    xp.className = 'task-xp';
    xp.textContent = `+${task.xp} XP`;
    meta.appendChild(xp);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'task-action';
    button.setAttribute('aria-pressed', completed ? 'true' : 'false');

    if (completed) {
      button.textContent = translate('tasks.action.undo', 'Cofnij');
      button.classList.add('is-completed');
      button.addEventListener('click', () => revertTask(task));
    } else if (!unlocked) {
      button.textContent = translate('tasks.action.locked', 'Poziom {{level}}', {
        level: task.requiredLevel,
      });
      button.disabled = true;
    } else {
      button.textContent = translate('tasks.action.complete', 'Wykonaj');
      button.addEventListener('click', () => completeTask(task));
    }

    meta.appendChild(button);
    li.appendChild(info);
    li.appendChild(meta);
    listEl.appendChild(li);
  });
}

function formatCurrencyEUR(value) {
  const normalized = Number.isFinite(value) ? value : 0;
  const fraction = Number.isFinite(normalized) && Math.abs(normalized % 1) > 0 ? 2 : 0;
  const i18n = typeof window !== 'undefined' ? window.appI18n : null;
  const language = (i18n && i18n.language) || 'pl';
  const locale = language === 'en' ? 'en-GB' : 'pl-PL';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fraction,
    maximumFractionDigits: 2,
  }).format(normalized);
}

function createMediaTripCard(trip) {
  const card = document.createElement('article');
  card.className = 'vip-card surface-card package-card';
  card.setAttribute('role', 'listitem');

  const titleText = translate(`mediaTrips.items.${trip.id}.title`, trip?.title ?? '');
  const descriptionText = translate(`mediaTrips.items.${trip.id}.description`, trip?.description ?? '');
  const mediaTypeText = translate(`mediaTrips.items.${trip.id}.mediaType`, trip?.mediaType ?? '');
  const durationText = translate(`mediaTrips.items.${trip.id}.duration`, trip?.duration ?? '');
  const metaText = [mediaTypeText, durationText].filter(Boolean).join(' • ');

  const highlightsList = (trip.highlights ?? [])
    .map((item, index) => {
      const key = typeof item === 'object' && item !== null ? item.key ?? index : index;
      const fallback = typeof item === 'object' && item !== null ? item.text ?? '' : String(item ?? '');
      const text = translate(`mediaTrips.items.${trip.id}.highlights.${key}`, fallback);
      return `<li>${text}</li>`;
    })
    .join('');

  const variantOptions = (trip.pricingOptions ?? [])
    .map((option, index) => {
      const optionKey = option?.key ?? index;
      const optionLabel = translate(`mediaTrips.items.${trip.id}.pricing.${optionKey}`, option?.label ?? '');
      const priceLabel = formatCurrencyEUR(option?.price);
      const extraValue = Number.isFinite(option?.extraPerson)
        ? option.extraPerson
        : trip.additionalPersonPrice ?? 0;
      const extraLabel = extraValue > 0
        ? translate('mediaTrips.card.extraPersonSuffix', ' (+{{price}} / dodatkowa os.)', {
            price: formatCurrencyEUR(extraValue),
          })
        : '';
      const combinedLabel = translate(
        'mediaTrips.card.variantOption',
        '{{label}} — {{price}}{{extra}}',
        {
          label: optionLabel,
          price: priceLabel,
          extra: extraLabel,
        },
      );
      return `<option value="${index}" data-price="${option?.price}" data-extra="${option?.extraPerson ?? trip.additionalPersonPrice ?? 0}">${combinedLabel}</option>`;
    })
    .join('');

  const variantHelperId = `${trip.id}-variant-helper`;
  const titleId = `${trip.id}-title`;
  const highlightsTitleId = `${trip.id}-highlights`;
  const calculatorHeadingId = `${trip.id}-calculator`;

  const outputControlIds = [`${trip.id}-participants`];
  if ((trip.pricingOptions ?? []).length > 0) {
    outputControlIds.push(`${trip.id}-variant`);
  }
  const outputForAttribute = outputControlIds.join(' ');

  const detailsLabel = translate(
    `mediaTrips.items.${trip.id}.detailsLink`,
    trip.detailsLink?.label ?? '',
  );
  const detailsLink = trip.detailsLink?.href && detailsLabel
    ? `<a class="vip-link" href="${trip.detailsLink.href}" target="_blank" rel="noopener">${detailsLabel}<span aria-hidden="true">→</span></a>`
    : '';

  const basePriceLabel = formatCurrencyEUR(trip.basePrice);
  const includedLabel = trip.includedParticipants
    ? translate('mediaTrips.card.includedParticipants', ' (do {{count}} osób)', {
        count: trip.includedParticipants,
      })
    : '';
  const priceText = translate('mediaTrips.card.priceFrom', 'Ceny od{{included}}: <strong>{{price}}</strong>', {
    included: includedLabel,
    price: basePriceLabel,
  });

  const highlightsSection = highlightsList
    ? `
          <section class="vip-section" aria-labelledby="${highlightsTitleId}">
            <h4 class="vip-section-title" id="${highlightsTitleId}">${translate(
              'mediaTrips.card.highlightsTitle',
              'W pakiecie',
            )}</h4>
            <ul class="vip-highlights">
              ${highlightsList}
            </ul>
          </section>
        `
    : '';

  card.innerHTML = `
    <div class="vip-primary" aria-labelledby="${titleId}">
      <header class="vip-card-header">
        <p class="vip-meta">${metaText}</p>
        <h3 id="${titleId}">${titleText}</h3>
        <p class="vip-description">${descriptionText}</p>
      </header>
      <p class="vip-price">${priceText}</p>
      ${highlightsSection}
      ${detailsLink}
    </div>
    <form class="vip-form" aria-labelledby="${calculatorHeadingId}">
      <h4 class="vip-section-title" id="${calculatorHeadingId}">${translate(
        'mediaTrips.card.calculatorTitle',
        'Kalkulator pakietu',
      )}</h4>
      ${variantOptions
        ? `
            <div class="vip-field">
              <label for="${trip.id}-variant">${translate(
                'mediaTrips.card.variantLabel',
                'Wariant pakietu',
              )}</label>
              <select id="${trip.id}-variant" name="variant" aria-describedby="${variantHelperId}">
                ${variantOptions}
              </select>
              <p class="vip-helper" id="${variantHelperId}">${translate(
                'mediaTrips.card.variantHelper',
                'Kalkulator automatycznie przelicza cenę i dopłatę za dodatkowe osoby.',
              )}</p>
            </div>
          `
        : ''}
      <div class="vip-field">
        <label for="${trip.id}-participants">${translate(
          'mediaTrips.card.participantsLabel',
          'Liczba uczestników',
        )}</label>
        <input
          id="${trip.id}-participants"
          name="participants"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          value="${trip.defaultParticipants}"
        />
      </div>
      <dl class="vip-result" role="status" aria-live="polite">
        <div class="vip-result-row">
          <dt>${translate('mediaTrips.card.totalLabel', 'Łączny koszt pakietu')}</dt>
          <dd>
            <output class="vip-output" name="total" for="${outputForAttribute}"></output>
          </dd>
        </div>
        <div class="vip-result-row">
          <dt>${translate('mediaTrips.card.perPersonLabel', 'Koszt na osobę')}</dt>
          <dd>
            <output class="vip-output" name="perPerson" for="${outputForAttribute}"></output>
          </dd>
        </div>
      </dl>
    </form>
  `;

  const form = card.querySelector('.vip-form');
  const variantSelect = form?.querySelector('select[name="variant"]');
  const participantsInput = form?.querySelector('input[name="participants"]');
  const totalOutput = form?.querySelector('output[name="total"]');
  const perPersonOutput = form?.querySelector('output[name="perPerson"]');

  if (form instanceof HTMLFormElement) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
    });
  }

  function updateCalculation() {
    if (!(participantsInput instanceof HTMLInputElement)) {
      return;
    }

    const participantsValue = Number.parseInt(participantsInput.value, 10);
    const participants = Number.isFinite(participantsValue) && participantsValue > 0 ? participantsValue : 1;
    const includedParticipants = Math.max(trip.includedParticipants ?? 4, 1);

    let variantBasePrice = trip.basePrice;
    let variantExtraPrice = trip.additionalPersonPrice ?? 0;

    if (variantSelect instanceof HTMLSelectElement) {
      const selectedOption = variantSelect.selectedOptions[0];
      if (selectedOption) {
        const optionPrice = Number.parseFloat(selectedOption.dataset.price ?? '');
        const optionExtra = Number.parseFloat(selectedOption.dataset.extra ?? '');

        if (Number.isFinite(optionPrice)) {
          variantBasePrice = optionPrice;
        }

        if (Number.isFinite(optionExtra)) {
          variantExtraPrice = optionExtra;
        }
      }
    }

    const extraParticipants = Math.max(participants - includedParticipants, 0);
    const extraCost = extraParticipants * variantExtraPrice;
    const total = variantBasePrice + extraCost;
    const perPerson = participants > 0 ? total / participants : total;

    if (participantsInput.value !== String(participants)) {
      participantsInput.value = String(participants);
    }

    if (totalOutput instanceof HTMLOutputElement) {
      totalOutput.value = formatCurrencyEUR(total);
    }

    if (perPersonOutput instanceof HTMLOutputElement) {
      perPersonOutput.value = formatCurrencyEUR(perPerson);
    }
  }

  participantsInput?.addEventListener('input', updateCalculation);
  variantSelect?.addEventListener('change', updateCalculation);

  updateCalculation();

  return card;
}

function renderMediaTrips() {
  const list = document.getElementById('mediaTripsList');
  if (!list) return;

  list.innerHTML = '';
  mediaTrips.forEach((trip) => {
    const card = createMediaTripCard(trip);
    list.appendChild(card);
  });
}

function determineDefaultPackingSeason() {
  const currentMonth = new Date().getMonth() + 1;
  const match = packingGuide.seasons.find((season) => season.months.includes(currentMonth));
  return match ? match.id : packingGuide.seasons[0]?.id;
}

function getPackingSeasonLabel(season) {
  if (!season) {
    return '';
  }
  return translate(`packing.season.${season.id}.label`, season.label ?? '');
}

function getPackingSeasonSummary(season) {
  if (!season) {
    return '';
  }
  return translate(`packing.season.${season.id}.summary`, season.summary ?? '');
}

function renderSeasonButtonLabel(button, season) {
  if (!button || !season) {
    return;
  }
  const label = getPackingSeasonLabel(season);
  button.innerHTML = `<span class="packing-season-icon">${season.emoji}</span>${label}`;
  button.setAttribute('aria-label', `${label}`.trim());
}

function getPackingItemText(baseKey, item, field) {
  if (!item) {
    return '';
  }
  const fallback = item[field] ?? '';
  if (!item.key) {
    return fallback;
  }
  const key = `${baseKey}.${item.key}.${field}`;
  return translate(key, fallback);
}

function initializePackingPlanner() {
  const toggle = document.getElementById('packingSeasonToggle');
  const panel = document.getElementById('packingChecklist');
  if (!toggle || !panel) {
    return;
  }

  toggle.innerHTML = '';
  toggle.setAttribute('aria-label', translate('packing.season.toggleLabel', 'Wybierz sezon podróży'));

  packingGuide.seasons.forEach((season) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `packingSeasonTab-${season.id}`;
    button.dataset.season = season.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'packingChecklist');
    button.tabIndex = -1;
    button.className = 'packing-season-button';
    renderSeasonButtonLabel(button, season);

    button.addEventListener('click', () => {
      setPackingSeason(season.id);
    });

    button.addEventListener('keydown', handlePackingSeasonKeydown);

    toggle.appendChild(button);
  });

  const defaultSeason = determineDefaultPackingSeason();
  setPackingSeason(defaultSeason);
}

function handlePackingSeasonKeydown(event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
  if (!keys.includes(event.key)) {
    return;
  }

  const buttons = Array.from(document.querySelectorAll('#packingSeasonToggle button'));
  const currentIndex = buttons.indexOf(target);
  if (currentIndex === -1) {
    return;
  }

  event.preventDefault();

  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % buttons.length;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = buttons.length - 1;
  }

  const nextButton = buttons[nextIndex];
  if (nextButton instanceof HTMLButtonElement) {
    nextButton.focus();
    const seasonId = nextButton.dataset.season;
    if (seasonId) {
      setPackingSeason(seasonId);
    }
  }
}

function setPackingSeason(seasonId) {
  const season = packingGuide.seasons.find((item) => item.id === seasonId) || packingGuide.seasons[0];
  if (!season) {
    return;
  }

  selectedPackingSeasonId = season.id;
  renderPackingChecklist();
}

function renderPackingChecklist() {
  const panel = document.getElementById('packingChecklist');
  const toggle = document.getElementById('packingSeasonToggle');
  if (!panel || !toggle) {
    return;
  }

  const season = packingGuide.seasons.find((item) => item.id === selectedPackingSeasonId) || packingGuide.seasons[0];
  if (!season) {
    panel.innerHTML = '';
    return;
  }

  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'packing-season-header';
  const heading = document.createElement('h3');
  heading.textContent = `${season.emoji} ${getPackingSeasonLabel(season)}`;
  const summary = document.createElement('p');
  summary.textContent = getPackingSeasonSummary(season);
  header.append(heading, summary);
  panel.appendChild(header);

  const listsWrapper = document.createElement('div');
  listsWrapper.className = 'packing-lists';

  const universalSection = document.createElement('section');
  universalSection.className = 'packing-list-section';
  const universalTitle = document.createElement('h4');
  universalTitle.textContent = translate('packing.guide.universal.title', 'Uniwersalne niezbędniki');
  universalSection.appendChild(universalTitle);
  universalSection.appendChild(
    createPackingChecklist(packingGuide.universal, `packing-universal-${season.id}`, 'packing.guide.universal')
  );
  listsWrapper.appendChild(universalSection);

  const seasonalSection = document.createElement('section');
  seasonalSection.className = 'packing-list-section';
  const seasonalTitle = document.createElement('h4');
  seasonalTitle.textContent = translate('packing.guide.seasonal.title', 'Dodatki sezonowe');
  seasonalSection.appendChild(seasonalTitle);
  seasonalSection.appendChild(
    createPackingChecklist(season.items, `packing-season-${season.id}`, `packing.guide.seasons.${season.id}`)
  );
  listsWrapper.appendChild(seasonalSection);

  panel.appendChild(listsWrapper);

  const buttons = toggle.querySelectorAll('button');
  buttons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const isActive = button.dataset.season === season.id;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.tabIndex = isActive ? 0 : -1;
  });

  const activeTab = document.getElementById(`packingSeasonTab-${season.id}`);
  if (activeTab) {
    panel.setAttribute('aria-labelledby', activeTab.id);
  }
}

function createPackingChecklist(items, idPrefix, baseKey) {
  const list = document.createElement('ul');
  list.className = 'packing-checklist';

  items.forEach((item, index) => {
    const li = document.createElement('li');

    const input = document.createElement('input');
    input.type = 'checkbox';
    const inputId = `${idPrefix}-${index}`;
    input.id = inputId;

    const label = document.createElement('label');
    label.className = 'packing-check-label';
    label.setAttribute('for', inputId);

    const mainLine = document.createElement('div');
    mainLine.className = 'packing-check-main';
    const text = document.createElement('span');
    const labelText = baseKey ? getPackingItemText(baseKey, item, 'label') : item.label;
    text.textContent = labelText;
    mainLine.appendChild(text);

    if (item.optional) {
      const optional = document.createElement('span');
      optional.className = 'packing-optional';
      optional.textContent = translate('packing.guide.optional', 'opcjonalnie');
      mainLine.appendChild(optional);
    }

    label.appendChild(mainLine);

    if (item.hint) {
      const hint = document.createElement('small');
      const hintText = baseKey ? getPackingItemText(baseKey, item, 'hint') : item.hint;
      hint.textContent = hintText;
      label.appendChild(hint);
    }

    li.appendChild(input);
    li.appendChild(label);
    list.appendChild(li);
  });

  return list;
}

function updatePackingPlannerLanguage() {
  const toggle = document.getElementById('packingSeasonToggle');
  if (!toggle) {
    return;
  }

  toggle.setAttribute('aria-label', translate('packing.season.toggleLabel', 'Wybierz sezon podróży'));

  const buttons = toggle.querySelectorAll('button[data-season]');
  buttons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const seasonId = button.dataset.season;
    const season = packingGuide.seasons.find((item) => item.id === seasonId);
    if (season) {
      renderSeasonButtonLabel(button, season);
    }
  });

  renderPackingChecklist();
}

function syncMarkers() {
  if (!map) return;

  places.forEach((place) => {
    const hasMarker = markers.has(place.id);

    if (!hasMarker) {
      const marker = L.marker([place.lat, place.lng]).addTo(map);
      marker.bindPopup(
        `<strong>${getPlaceName(place)}</strong><br/>${getPlaceBadge(place)} • ${place.xp} XP`,
      );
      marker.on('click', () => focusPlace(place.id));
      markers.set(place.id, marker);
    } else {
      const marker = markers.get(place.id);
      marker.setPopupContent(
        `<strong>${getPlaceName(place)}</strong><br/>${getPlaceBadge(place)} • ${place.xp} XP`,
      );
    }
  });
}

function updatePlayerLocation(position) {
  if (!map) return;

  const { latitude, longitude, accuracy } = position.coords;
  const latlng = [latitude, longitude];

  if (!playerMarker) {
    playerMarker = L.circleMarker(latlng, {
      radius: 8,
      color: '#f97316',
      weight: 2,
      fillColor: '#fb923c',
      fillOpacity: 0.85,
    })
      .addTo(map)
      .bindTooltip(translate('map.playerLocation', 'Twoje położenie'), { direction: 'top', offset: [0, -8] });
  } else {
    playerMarker.setLatLng(latlng);
  }

  if (playerMarker) {
    playerMarker.bringToFront();
  }

  const numericAccuracy = Number.isFinite(accuracy) ? accuracy : 0;
  if (numericAccuracy > 0) {
    if (!playerAccuracyCircle) {
      playerAccuracyCircle = L.circle(latlng, {
        radius: numericAccuracy,
        color: '#f97316',
        weight: 1,
        fillColor: '#fb923c',
        fillOpacity: 0.15,
        interactive: false,
      }).addTo(map);
    } else {
      playerAccuracyCircle.setLatLng(latlng);
      playerAccuracyCircle.setRadius(numericAccuracy);
    }

    playerAccuracyCircle.bringToBack();
  }

  if (!hasCenteredOnPlayer) {
    const targetZoom = Math.max(map.getZoom(), 12);
    map.setView(latlng, targetZoom, { animate: true });
    hasCenteredOnPlayer = true;
  }
}

function handleLocationTrackingError(error) {
  console.warn('Błąd śledzenia lokalizacji', error);
  if (isGeolocationSecureContextError(error)) {
    setLevelStatus(
      translate(
        'map.geolocation.secureContextRequired',
        'Użyj zabezpieczonego połączenia (HTTPS), aby udostępnić swoją lokalizację.',
      ),
      6000,
    );
  } else if (isGeolocationPermissionDenied(error)) {
    setDefaultLocation();
    setLevelStatus(
      translate(
        'map.geolocation.enableSharing',
        'Włącz udostępnianie lokalizacji, aby zobaczyć swoją pozycję na mapie.',
      ),
      6000,
    );
  }
}

function startPlayerLocationTracking() {
  if (!('geolocation' in navigator)) {
    setLevelStatus(
      translate(
        'map.geolocation.noSupport',
        'Twoja przeglądarka nie obsługuje geolokalizacji – pozycja gracza nie będzie widoczna.',
      ),
      6000,
    );
    return;
  }

  try {
    locationWatchId = navigator.geolocation.watchPosition(
      updatePlayerLocation,
      (error) => {
        handleLocationTrackingError(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      },
    );
  } catch (error) {
    handleLocationTrackingError(error);
    locationWatchId = null;
  }
}

function updateSelectedObjective() {
  if (!state.selected) return;
  showObjective(state.selected);
}

function updateAfterStateChange(leveledUp = false) {
  syncMarkers();
  renderProgress();
  renderDailyStreak();
  renderDailyChallenge();
  renderLocations();
  renderAttractionsCatalog();
  renderTasks();
  renderExplorer();
  updateSelectedObjective();
  saveProgress();

  if (leveledUp) {
    showLevelUpMessage(state.level);
  }
}

function focusPlace(id) {
  const place = places.find((item) => item.id === id);
  if (!place) return;

  state.selected = place;

  if (map) {
    // Użyj flyTo dla bardziej niezawodnego centrowania
    map.flyTo([place.lat, place.lng], 13, { 
      animate: true,
      duration: 1.0,
      easeLinearity: 0.25
    });
    const marker = markers.get(place.id);
    if (marker) {
      // Opóźnij otwarcie popup aby mapa zdążyła się wycentrować
      setTimeout(() => {
        marker.openPopup();
      }, 1000);
    }
  }

  showObjective(place);
  renderExplorer();
}

function restoreSelectedPlaceFromStorage() {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    return;
  }

  try {
    const storedId = localStorage.getItem(SELECTED_PLACE_STORAGE_KEY);
    if (!storedId) {
      return;
    }

    const place = places.find((item) => item.id === storedId);
    if (place) {
      state.selected = place;
    }

    localStorage.removeItem(SELECTED_PLACE_STORAGE_KEY);
  } catch (error) {
    console.warn('Nie udało się odczytać zapisanego miejsca dla mapy.', error);
  }
}

function clampRating(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value)));
}

function createStarVisual(rating) {
  const span = document.createElement('span');
  span.className = 'star-visual';
  span.setAttribute('aria-hidden', 'true');
  const safe = clampRating(rating);
  span.textContent = '★'.repeat(safe) + '☆'.repeat(5 - safe);
  return span;
}

// formatReviewDate moved to src/utils/dates.js

function pluralizeReview(count) {
  if (count === 1) return 'oceny';
  const remainder100 = count % 100;
  if (remainder100 >= 12 && remainder100 <= 14) return 'ocen';
  const remainder10 = count % 10;
  if (remainder10 >= 2 && remainder10 <= 4) return 'oceny';
  return 'ocen';
}

function setReviewFormMessage(message = '', tone = 'info') {
  const messageEl = document.getElementById('reviewFormMessage');
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.dataset.tone = tone;
}

function updateReviewFormState(place) {
  const panel = document.getElementById('reviewsPanel');
  const form = document.getElementById('reviewForm');
  const loginPrompt = document.getElementById('reviewLoginPrompt');
  const photoPreview = document.getElementById('reviewPhotoPreview');
  const photoPreviewImage = document.getElementById('reviewPhotoPreviewImage');
  const removePhotoBtn = document.getElementById('reviewRemovePhoto');

  if (!panel || !(form instanceof HTMLFormElement) || !loginPrompt) {
    return;
  }

  panel.hidden = false;

  const previousPlaceId = form.dataset.placeId;
  const placeChanged = previousPlaceId !== place.id;

  if (!currentUserKey) {
    form.hidden = true;
    loginPrompt.hidden = false;
    form.dataset.placeId = place.id;
    form.dataset.removePhoto = 'false';
    form.dataset.hasExistingPhoto = 'false';
    form.reset();
    setReviewFormMessage('');
    if (photoPreview) {
      photoPreview.hidden = true;
    }
    if (photoPreviewImage instanceof HTMLImageElement) {
      photoPreviewImage.src = '';
    }
    if (removePhotoBtn instanceof HTMLButtonElement) {
      removePhotoBtn.disabled = true;
    }
    return;
  }

  form.hidden = false;
  loginPrompt.hidden = true;

  if (placeChanged) {
    setReviewFormMessage('');
  }

  form.dataset.placeId = place.id;
  form.dataset.removePhoto = 'false';

  const commentField = form.querySelector('#reviewComment');
  const ratingInputs = form.querySelectorAll('input[name="rating"]');
  const photoInput = form.querySelector('#reviewPhoto');

  form.reset();

  const placeReviews = getReviewsForPlace(place.id);
  const ownReview = placeReviews.find((item) => item.userKey === currentUserKey);

  ratingInputs.forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.checked = Boolean(ownReview) && input.value === String(ownReview.rating);
  });

  if (commentField instanceof HTMLTextAreaElement) {
    commentField.value = ownReview?.comment || '';
  }

  if (photoInput instanceof HTMLInputElement) {
    photoInput.value = '';
  }

  if (photoPreview && photoPreviewImage instanceof HTMLImageElement) {
    if (ownReview?.photoDataUrl) {
      photoPreviewImage.src = ownReview.photoDataUrl;
      photoPreview.hidden = false;
    } else {
      photoPreviewImage.src = '';
      photoPreview.hidden = true;
    }
  }

  if (removePhotoBtn instanceof HTMLButtonElement) {
    removePhotoBtn.disabled = !ownReview?.photoDataUrl;
  }

  form.dataset.hasExistingPhoto = ownReview?.photoDataUrl ? 'true' : 'false';

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton instanceof HTMLButtonElement) {
    submitButton.textContent = ownReview ? 'Zaktualizuj opinię' : 'Dodaj opinię';
  }
}

function renderReviewsSection(place) {
  const panel = document.getElementById('reviewsPanel');
  const summaryEl = document.getElementById('reviewsSummary');
  const listEl = document.getElementById('reviewsList');
  const emptyEl = document.getElementById('reviewsEmpty');

  if (!panel) {
    return;
  }

  const placeReviews = getReviewsForPlace(place.id);
  const totalRating = placeReviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0);
  const average = placeReviews.length ? totalRating / placeReviews.length : 0;

  if (summaryEl) {
    summaryEl.textContent = '';
    if (!placeReviews.length) {
      const paragraph = document.createElement('p');
      paragraph.textContent = 'Brak ocen dla tej lokalizacji.';
      summaryEl.appendChild(paragraph);
      const rewards = document.createElement('p');
      rewards.className = 'review-reward-copy';
      rewards.textContent =
        'Za wystawienie gwiazdek zdobędziesz 20 XP, komentarz to dodatkowe 15 XP, a zdjęcie nagrodzimy kolejnymi 25 XP.';
      summaryEl.appendChild(rewards);
    } else {
      const averageWrapper = document.createElement('div');
      averageWrapper.className = 'reviews-average';
      const stars = createStarVisual(average);
      averageWrapper.appendChild(stars);
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = `${average.toFixed(1)} na 5`;
      averageWrapper.appendChild(sr);
      const value = document.createElement('strong');
      value.textContent = `${average.toFixed(1)} / 5`;
      averageWrapper.appendChild(value);
      summaryEl.appendChild(averageWrapper);

      const countInfo = document.createElement('p');
      countInfo.textContent = `Na podstawie ${placeReviews.length} ${pluralizeReview(
        placeReviews.length,
      )}.`;
      summaryEl.appendChild(countInfo);

      const rewards = document.createElement('p');
      rewards.className = 'review-reward-copy';
      rewards.textContent =
        'Za wystawienie gwiazdek zdobędziesz 20 XP, komentarz to dodatkowe 15 XP, a zdjęcie nagrodzimy kolejnymi 25 XP.';
      summaryEl.appendChild(rewards);
    }
  }

  if (emptyEl) {
    emptyEl.hidden = Boolean(placeReviews.length);
  }

  if (listEl) {
    listEl.innerHTML = '';
    if (placeReviews.length) {
      placeReviews.forEach((entry) => {
        const item = document.createElement('li');
        item.className = 'review-item';

        const header = document.createElement('div');
        header.className = 'review-item-header';

        const author = document.createElement('span');
        author.className = 'review-author';
        author.textContent = entry.username || 'Gracz';
        header.appendChild(author);

        const ratingWrapper = document.createElement('div');
        ratingWrapper.className = 'review-rating';
        ratingWrapper.appendChild(createStarVisual(entry.rating));
        const sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = `${entry.rating} na 5`;
        ratingWrapper.appendChild(sr);
        header.appendChild(ratingWrapper);

        item.appendChild(header);

        const dateLabel = formatReviewDate(entry.updatedAt || entry.createdAt);
        if (dateLabel) {
          const meta = document.createElement('div');
          meta.className = 'review-meta';
          const edited = entry.updatedAt && entry.updatedAt !== entry.createdAt;
          meta.textContent = edited ? `${dateLabel} • edytowano` : dateLabel;
          item.appendChild(meta);
        }

        if (entry.comment) {
          const comment = document.createElement('p');
          comment.className = 'review-comment';
          comment.textContent = entry.comment;
          item.appendChild(comment);
        }

        if (entry.photoDataUrl) {
          const figure = document.createElement('figure');
          figure.className = 'review-photo';
          const img = document.createElement('img');
          img.src = entry.photoDataUrl;
          img.alt = `Zdjęcie dodane przez ${entry.username || 'gracza'}`;
          figure.appendChild(img);
          item.appendChild(figure);
        }

        listEl.appendChild(item);
      });
    }
  }

  updateReviewFormState(place);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Nie udało się odczytać pliku.'));
    reader.readAsDataURL(file);
  });
}

async function handleReviewFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;

  if (!currentUserKey) {
    setReviewFormMessage('Musisz być zalogowany, aby dodać opinię.', 'error');
    return;
  }

  const placeId = form.dataset.placeId;
  if (!placeId) {
    setReviewFormMessage('Wybierz lokalizację, którą chcesz ocenić.', 'error');
    return;
  }

  const ratingInput = form.querySelector('input[name="rating"]:checked');
  const ratingValue = ratingInput instanceof HTMLInputElement ? Number(ratingInput.value) : NaN;

  if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    setReviewFormMessage('Wybierz ocenę w gwiazdkach od 1 do 5.', 'error');
    return;
  }

  const commentField = form.querySelector('#reviewComment');
  const comment =
    commentField instanceof HTMLTextAreaElement ? commentField.value.trim() : '';

  const photoInput = form.querySelector('#reviewPhoto');
  const removePhoto = form.dataset.removePhoto === 'true';
  const hasExistingPhoto = form.dataset.hasExistingPhoto === 'true';

  const existingReviews = getReviewsForPlace(placeId);
  const existing = existingReviews.find((item) => item.userKey === currentUserKey);

  let photoDataUrl = existing?.photoDataUrl || null;
  const hasComment = comment.length > 0;

  if (photoInput instanceof HTMLInputElement && photoInput.files && photoInput.files[0]) {
    const file = photoInput.files[0];
    if (!file.type.startsWith('image/')) {
      setReviewFormMessage('Prześlij plik w formacie graficznym (JPG, PNG itp.).', 'error');
      return;
    }
    if (file.size > REVIEW_MAX_PHOTO_SIZE) {
      setReviewFormMessage('Zdjęcie może mieć maksymalnie 2 MB.', 'error');
      return;
    }
    try {
      photoDataUrl = await readFileAsDataUrl(file);
    } catch (error) {
      console.error('Nie udało się odczytać zdjęcia:', error);
      setReviewFormMessage('Nie udało się wczytać zdjęcia. Spróbuj ponownie.', 'error');
      return;
    }
  } else if (removePhoto && (hasExistingPhoto || existing?.photoDataUrl)) {
    photoDataUrl = null;
  }

  const clampedRating = Math.max(1, Math.min(5, Math.round(ratingValue)));
  const account = getAccount(currentUserKey);
  const username = account?.username || 'Gracz';

  upsertReview(placeId, {
    userKey: currentUserKey,
    username,
    rating: clampedRating,
    comment,
    photoDataUrl,
  });

  form.dataset.removePhoto = 'false';
  form.dataset.hasExistingPhoto = photoDataUrl ? 'true' : 'false';

  const place = places.find((item) => item.id === placeId);
  if (place) {
    renderReviewsSection(place);
  }

  const reviewXp = applyReviewRewardProgress(placeId, {
    hasComment,
    hasPhoto: Boolean(photoDataUrl),
  });

  if (reviewXp > 0) {
    const leveledUp = awardXp(reviewXp);
    updateAfterStateChange(leveledUp);
    setLevelStatus(`Twoja opinia przyniosła ${reviewXp} XP!`, 6000);
  }

  if (photoInput instanceof HTMLInputElement) {
    photoInput.value = '';
  }

  if (reviewXp > 0) {
    setReviewFormMessage(`Dziękujemy za dodanie opinii! (+${reviewXp} XP)`, 'success');
  } else {
    setReviewFormMessage('Dziękujemy za dodanie opinii!', 'success');
  }
}

function getPlaceById(id) {
  if (!id) return null;
  return places.find((item) => item.id === id) || null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371; // promień Ziemi w kilometrach
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return R * c;
}

function calculateTripDistance(startPlace, stops) {
  if (!startPlace || !Array.isArray(stops) || !stops.length) {
    return 0;
  }

  let totalDistance = 0;
  let previous = startPlace;

  stops.forEach((stop) => {
    totalDistance += calculateDistanceKm(previous, stop);
    previous = stop;
  });

  totalDistance += calculateDistanceKm(previous, startPlace);
  return totalDistance;
}

function calculateTripXpMultiplier(stopsCount) {
  if (!Number.isFinite(stopsCount) || stopsCount <= 1) {
    return 1;
  }

  const multiplier = 1 + (stopsCount - 1) * TRIP_PLANNER_MULTIPLIER_STEP;
  return Math.min(multiplier, TRIP_PLANNER_MAX_MULTIPLIER);
}

function estimateTripDurationHours(distanceKm, stopsCount) {
  const safeDistance = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  const safeStops = Number.isFinite(stopsCount) && stopsCount > 0 ? stopsCount : 0;

  const travelHours = safeDistance / TRIP_PLANNER_TRAVEL_SPEED_KMH;
  const visitHours = safeStops * TRIP_PLANNER_STOP_DURATION_HOURS;
  return travelHours + visitHours;
}

function formatTripDuration(totalHours) {
  if (!Number.isFinite(totalHours) || totalHours <= 0) {
    return 'mniej niż 1 h';
  }

  const totalMinutes = Math.max(0, Math.round(totalHours * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }

  return parts.length ? parts.join(' ') : 'mniej niż 1 h';
}

function formatTripDistance(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return '0 km';
  }

  if (distanceKm >= 10) {
    return `${distanceKm.toFixed(0)} km`;
  }

  if (distanceKm >= 1) {
    return `${distanceKm.toFixed(1)} km`;
  }

  return `${distanceKm.toFixed(2)} km`;
}

function renderTripPlanner(place) {
  const planner = document.getElementById('dailyTripPlanner');
  const startSelect = document.getElementById('tripPlannerStart');
  const optionsContainer = document.getElementById('tripPlannerPlaces');

  if (!planner || !(startSelect instanceof HTMLSelectElement) || !optionsContainer) {
    return;
  }

  if (!places.length) {
    planner.hidden = true;
    return;
  }

  planner.hidden = false;

  const currentPlaceId = place?.id ?? null;

  if (!tripPlannerState.startId || !getPlaceById(tripPlannerState.startId)) {
    tripPlannerState.startId = currentPlaceId || places[0].id;
  }

  const preservedSelections = new Set(tripPlannerState.selectedStops);
  if (tripPlannerState.startId) {
    preservedSelections.delete(tripPlannerState.startId);
  }

  if (!preservedSelections.size && currentPlaceId && currentPlaceId !== tripPlannerState.startId) {
    preservedSelections.add(currentPlaceId);
  }

  tripPlannerState.selectedStops = preservedSelections;

  startSelect.innerHTML = '';
  places.forEach((candidate) => {
    const option = document.createElement('option');
    option.value = candidate.id;
    option.textContent = getPlaceName(candidate);
    startSelect.appendChild(option);
  });

  if (tripPlannerState.startId) {
    startSelect.value = tripPlannerState.startId;
  }

  optionsContainer.innerHTML = '';

  places.forEach((candidate) => {
    const optionWrapper = document.createElement('label');
    optionWrapper.className = 'trip-planner-option';
    if (candidate.id === tripPlannerState.startId) {
      optionWrapper.classList.add('is-start');
    }

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'tripPlannerStops';
    input.value = candidate.id;
    input.disabled = candidate.id === tripPlannerState.startId;
    input.checked = tripPlannerState.selectedStops.has(candidate.id);
    optionWrapper.appendChild(input);

    const details = document.createElement('div');
    details.className = 'trip-planner-option-details';

    const title = document.createElement('span');
    title.className = 'trip-planner-option-title';
    title.textContent = getPlaceName(candidate);
    details.appendChild(title);

    const meta = document.createElement('span');
    meta.className = 'trip-planner-option-meta';
    meta.textContent = `+${candidate.xp} XP`;
    details.appendChild(meta);

    if (candidate.id === tripPlannerState.startId) {
      const badge = document.createElement('span');
      badge.className = 'trip-planner-start-badge';
      badge.textContent = translate('tripPlanner.startBadge', 'Start');
      details.appendChild(badge);
    }

    optionWrapper.appendChild(details);
    optionsContainer.appendChild(optionWrapper);
  });

  updateTripPlannerSummary();
}

function updateTripPlannerSummary() {
  const summary = document.getElementById('tripPlannerSummary');
  if (!summary) {
    return;
  }

  const defaultMessage = summary.dataset.defaultMessage;
  const startPlace = tripPlannerState.startId ? getPlaceById(tripPlannerState.startId) : null;

  if (!startPlace) {
    summary.innerHTML = defaultMessage ||
      `<p>${translate(
        'tripPlanner.selectStart',
        'Wybierz punkt startowy, aby przygotować plan dzienny.',
      )}</p>`;
    summary.classList.remove('has-results');
    return;
  }

  const stops = Array.from(tripPlannerState.selectedStops)
    .map((id) => getPlaceById(id))
    .filter(Boolean);

  if (!stops.length) {
    summary.innerHTML =
      defaultMessage ||
      `<p>${translate(
        'tripPlanner.selectStops',
        'Wybierz co najmniej jedną atrakcję, aby zobaczyć bonus XP i czas potrzebny na wycieczkę.',
      )}</p>`;
    summary.classList.remove('has-results');
    return;
  }

  const totalXpBase = stops.reduce((sum, item) => sum + (Number(item.xp) || 0), 0);
  const multiplier = calculateTripXpMultiplier(stops.length);
  const totalXpWithBonus = Math.round(totalXpBase * multiplier);
  const bonusXp = Math.max(0, totalXpWithBonus - totalXpBase);

  const distanceKm = calculateTripDistance(startPlace, stops);
  const durationHours = estimateTripDurationHours(distanceKm, stops.length);
  const formattedDuration = formatTripDuration(durationHours);
  const formattedDistance = formatTripDistance(distanceKm);

  const routeParts = [
    getPlaceName(startPlace),
    ...stops.map((stop) => getPlaceName(stop)),
    getPlaceName(startPlace),
  ];
  const routeText = routeParts.join(' → ');

  summary.innerHTML = '';

  const xpParagraph = document.createElement('p');
  xpParagraph.className = 'trip-planner-highlight';
  const multiplierLabel = multiplier.toFixed(2).replace('.', ',');
  const baseLabel = totalXpBase.toLocaleString('pl-PL');
  const totalLabel = totalXpWithBonus.toLocaleString('pl-PL');
  const bonusLabel = bonusXp.toLocaleString('pl-PL');
  xpParagraph.innerHTML = `🏆 Zdobywasz <strong>${totalLabel} XP</strong> (mnożnik ${multiplierLabel}×, baza ${baseLabel} XP${
    bonusXp ? `, bonus +${bonusLabel} XP` : ''
  }).`;
  summary.appendChild(xpParagraph);

  const timeParagraph = document.createElement('p');
  timeParagraph.textContent = `🕒 Szacowany czas: ${formattedDuration} (podróż około ${formattedDistance}).`;
  summary.appendChild(timeParagraph);

  const routeParagraph = document.createElement('p');
  routeParagraph.className = 'trip-planner-route';
  routeParagraph.textContent = `🗺️ Trasa: ${routeText}.`;
  summary.appendChild(routeParagraph);

  const tipParagraph = document.createElement('p');
  tipParagraph.className = 'trip-planner-tip';
  tipParagraph.textContent = 'Wliczamy około 1,5 godziny eksploracji na każdą atrakcję oraz drogę powrotną do punktu startowego.';
  summary.appendChild(tipParagraph);

  summary.classList.add('has-results');
}

function initializeTripPlannerUI() {
  const planner = document.getElementById('dailyTripPlanner');
  if (!planner) {
    return;
  }

  const summary = document.getElementById('tripPlannerSummary');
  if (summary && !summary.dataset.defaultMessage) {
    summary.dataset.defaultMessage = summary.innerHTML;
  }

  const startSelect = document.getElementById('tripPlannerStart');
  if (startSelect instanceof HTMLSelectElement) {
    startSelect.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      tripPlannerState.startId = target.value;
      tripPlannerState.selectedStops.delete(target.value);
      const referencePlace = state.selected || getPlaceById(tripPlannerState.startId);
      renderTripPlanner(referencePlace);
    });
  }

  const optionsContainer = document.getElementById('tripPlannerPlaces');
  optionsContainer?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') {
      return;
    }

    if (target.checked) {
      tripPlannerState.selectedStops.add(target.value);
    } else {
      tripPlannerState.selectedStops.delete(target.value);
    }

    updateTripPlannerSummary();
  });
}

function handleReviewPhotoChange(event) {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement)) return;

  const form = input.closest('form');
  if (!(form instanceof HTMLFormElement)) return;

  form.dataset.removePhoto = 'false';

  const file = input.files && input.files[0];
  const preview = document.getElementById('reviewPhotoPreview');
  const previewImage = document.getElementById('reviewPhotoPreviewImage');
  const removePhotoBtn = document.getElementById('reviewRemovePhoto');

  if (!file) {
    if (form.dataset.hasExistingPhoto === 'true') {
      const placeId = form.dataset.placeId;
      const existing = placeId
        ? getReviewsForPlace(placeId).find((item) => item.userKey === currentUserKey)
        : null;
      if (existing?.photoDataUrl && preview && previewImage instanceof HTMLImageElement) {
        previewImage.src = existing.photoDataUrl;
        preview.hidden = false;
      } else if (preview) {
        preview.hidden = true;
      }
    } else if (preview) {
      preview.hidden = true;
    }

    if (form.dataset.hasExistingPhoto !== 'true' && previewImage instanceof HTMLImageElement) {
      previewImage.src = '';
    }

    if (removePhotoBtn instanceof HTMLButtonElement) {
      removePhotoBtn.disabled = form.dataset.hasExistingPhoto !== 'true';
    }
    return;
  }

  if (!file.type.startsWith('image/')) {
    setReviewFormMessage('Wybierz plik w formacie graficznym.', 'error');
    input.value = '';
    return;
  }

  if (file.size > REVIEW_MAX_PHOTO_SIZE) {
    setReviewFormMessage('Zdjęcie może mieć maksymalnie 2 MB.', 'error');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    if (previewImage instanceof HTMLImageElement) {
      previewImage.src = typeof reader.result === 'string' ? reader.result : '';
    }
    if (preview) {
      preview.hidden = false;
    }
    if (removePhotoBtn instanceof HTMLButtonElement) {
      removePhotoBtn.disabled = false;
    }
  };
  reader.onerror = () => {
    setReviewFormMessage('Nie udało się wczytać zdjęcia. Spróbuj ponownie.', 'error');
    input.value = '';
  };
  reader.readAsDataURL(file);
}

function handleReviewRemovePhoto(event) {
  event.preventDefault();
  const form = document.getElementById('reviewForm');
  if (!(form instanceof HTMLFormElement)) return;

  const photoInput = document.getElementById('reviewPhoto');
  const preview = document.getElementById('reviewPhotoPreview');
  const previewImage = document.getElementById('reviewPhotoPreviewImage');
  const removePhotoBtn = document.getElementById('reviewRemovePhoto');

  if (photoInput instanceof HTMLInputElement) {
    photoInput.value = '';
  }

  if (preview) {
    preview.hidden = true;
  }

  if (previewImage instanceof HTMLImageElement) {
    previewImage.src = '';
  }

  const hadExistingPhoto = form.dataset.hasExistingPhoto === 'true';
  form.dataset.hasExistingPhoto = 'false';
  form.dataset.removePhoto = hadExistingPhoto ? 'true' : 'false';

  if (removePhotoBtn instanceof HTMLButtonElement) {
    removePhotoBtn.disabled = true;
  }

  setReviewFormMessage(
    hadExistingPhoto
      ? 'Zdjęcie zostanie usunięte po zapisaniu opinii.'
      : 'Usunięto wybrane zdjęcie.',
    'info',
  );
}

function initializeReviewUI() {
  const form = document.getElementById('reviewForm');
  const photoInput = document.getElementById('reviewPhoto');
  const removePhotoBtn = document.getElementById('reviewRemovePhoto');
  const loginButton = document.getElementById('reviewLoginButton');

  form?.addEventListener('submit', handleReviewFormSubmit);
  photoInput?.addEventListener('change', handleReviewPhotoChange);
  removePhotoBtn?.addEventListener('click', handleReviewRemovePhoto);
  loginButton?.addEventListener('click', () => {
    clearAuthForms();
    openAuthModal();
  });
}

function setJournalFormMessage(message = '', tone = 'info') {
  const messageEl = document.getElementById('journalFormMessage');
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.dataset.tone = tone;
}

function switchJournalTab(panelId, options = {}) {
  if (!panelId) return;

  const { force = false } = options;

  if (!force && panelId === 'journalFormPanel' && !currentUserKey) {
    setLevelStatus('Zaloguj się, aby dodać wpis w dzienniku podróży.', 5000);
    return;
  }
  const tabs = document.querySelectorAll('.journal-tab');
  const panels = document.querySelectorAll('.journal-tabpanel');

  tabs.forEach((tab) => {
    const controls = tab.getAttribute('aria-controls');
    const isActive = controls === panelId;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  panels.forEach((panel) => {
    panel.hidden = panel.id !== panelId;
  });

  if (panelId !== 'journalFormPanel') {
    setJournalFormMessage('');
  }

  if (panelId === 'journalFormPanel') {
    const form = document.getElementById('journalForm');
    if (form instanceof HTMLFormElement) {
      setJournalFormMessage('');
      const titleInput = form.querySelector('#journalTitle');
      if (titleInput instanceof HTMLInputElement) {
        titleInput.focus();
      }
    }
  }
}

function handleJournalTabClick(event) {
  const tab = event.currentTarget;
  if (!(tab instanceof HTMLButtonElement)) return;
  const panelId = tab.getAttribute('aria-controls');
  switchJournalTab(panelId);
}

function handleJournalTabKeydown(event) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
    return;
  }

  const tabs = Array.from(document.querySelectorAll('.journal-tab'));
  const current = event.currentTarget;
  const currentIndex = tabs.indexOf(current);
  if (currentIndex === -1) {
    return;
  }

  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  const nextTab = tabs[nextIndex];
  if (nextTab instanceof HTMLButtonElement) {
    nextTab.focus();
    const panelId = nextTab.getAttribute('aria-controls');
    switchJournalTab(panelId);
  }
  event.preventDefault();
}

function handleHeaderTabKeydown(event) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
    return;
  }

  const tabs = Array.from(document.querySelectorAll('.header-tab'));
  const current = event.currentTarget;
  const currentIndex = tabs.indexOf(current);
  if (currentIndex === -1) {
    return;
  }

  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  const nextTab = tabs[nextIndex];
  if (nextTab instanceof HTMLButtonElement) {
    nextTab.focus();
    const panelId = nextTab.getAttribute('aria-controls');
    switchAppView(panelId);
  }
  event.preventDefault();
}

function switchAppView(viewId) {
  if (!viewId) return;

  const views = document.querySelectorAll('.app-view');
  const tabs = document.querySelectorAll('.header-tab');
  const mobileTabs = document.querySelectorAll('.mobile-tabbar-btn');

  views.forEach((view) => {
    if (!(view instanceof HTMLElement)) return;
    view.hidden = view.id !== viewId;
  });

  tabs.forEach((tab) => {
    const controls = tab.getAttribute('aria-controls');
    const isActive = controls === viewId;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  mobileTabs.forEach((tab) => {
    const controls = tab.getAttribute('data-target') || tab.getAttribute('aria-controls');
    const isActive = controls === viewId;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const activeView = document.getElementById(viewId);
  activeView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openPackingPlannerView() {
  switchAppView(PACKING_VIEW_ID);
  const toggle = document.querySelector('#packingSeasonToggle button.is-active');
  const firstButton =
    toggle instanceof HTMLButtonElement
      ? toggle
      : document.querySelector('#packingSeasonToggle button');
  if (firstButton instanceof HTMLButtonElement) {
    firstButton.focus();
  }
}

function openTasksView() {
  switchAppView(TASKS_VIEW_ID);
  const firstTaskAction = document.querySelector('#tasksList .task-action');
  if (firstTaskAction instanceof HTMLButtonElement) {
    firstTaskAction.focus();
  }
}

function openMediaTripsView() {
  switchAppView(MEDIA_TRIPS_VIEW_ID);
  const firstInput = document.querySelector('#mediaTripsList input');
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function openAdventureView(options = {}) {
  switchAppView(ADVENTURE_VIEW_ID);

  // Scroll to current objective (map section)
  setTimeout(() => {
    const objectiveSection = document.getElementById('current-objective');
    if (objectiveSection) {
      objectiveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);

  const { showJournalForm = false } = options;
  if (showJournalForm) {
    if (!currentUserKey) {
      setLevelStatus('Zaloguj się, aby dodać wpis w dzienniku podróży.', 5000);
      openAuthModal();
      switchJournalTab('journalEntriesPanel', { force: true });
      return;
    }

    switchJournalTab('journalFormPanel', { force: true });
    const form = document.getElementById('journalForm');
    if (form instanceof HTMLFormElement) {
      const titleInput = form.querySelector('#journalTitle');
      const notesField = form.querySelector('#journalNotes');
      const focusTarget = titleInput || notesField;
      if (focusTarget instanceof HTMLElement) {
        focusTarget.focus();
      }
    }
  }
}

function formatJournalLikes(count) {
  const normalized = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (normalized === 1) {
    return '1 polubienie';
  }
  return `${normalized} polubień`;
}

function getEntryNotificationTitle(entry) {
  if (!entry || typeof entry !== 'object') {
    return 'Wpis w dzienniku';
  }

  if (typeof entry.title === 'string' && entry.title.trim()) {
    return entry.title.trim();
  }

  if (typeof entry.notes === 'string' && entry.notes.trim()) {
    const trimmed = entry.notes.trim();
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
  }

  return 'Wpis w dzienniku';
}

function findCommentInTree(comments, commentId) {
  if (!Array.isArray(comments)) {
    return null;
  }

  for (const comment of comments) {
    if (!comment) {
      continue;
    }

    if (comment.id === commentId) {
      return comment;
    }

    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    const found = findCommentInTree(replies, commentId);
    if (found) {
      return found;
    }
  }

  return null;
}

function updateCommentTree(comments, commentId, updater) {
  if (!Array.isArray(comments)) {
    return { comments: [], updated: null };
  }

  let updatedComment = null;

  const next = comments.map((comment) => {
    if (!comment || typeof comment !== 'object') {
      return comment;
    }

    if (comment.id === commentId) {
      const result = updater(comment);
      if (result) {
        updatedComment = result;
        return result;
      }
      return comment;
    }

    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    if (replies.length) {
      const childResult = updateCommentTree(replies, commentId, updater);
      if (childResult.updated) {
        updatedComment = childResult.updated;
        return { ...comment, replies: childResult.comments };
      }
    }

    return comment;
  });

  return { comments: next, updated: updatedComment };
}

function appendReplyToComment(comments, parentId, reply) {
  return updateCommentTree(comments, parentId, (comment) => {
    const replies = Array.isArray(comment.replies) ? [...comment.replies, reply] : [reply];
    return { ...comment, replies };
  });
}

function removeCommentFromTree(comments, commentId) {
  if (!Array.isArray(comments)) {
    return { comments: [], removed: null };
  }

  let removed = null;
  const filtered = [];

  comments.forEach((comment) => {
    if (removed) {
      filtered.push(comment);
      return;
    }

    if (comment?.id === commentId) {
      removed = comment;
      return;
    }

    const replies = Array.isArray(comment?.replies) ? comment.replies : [];
    if (replies.length) {
      const result = removeCommentFromTree(replies, commentId);
      if (result.removed) {
        removed = result.removed;
        filtered.push({ ...comment, replies: result.comments });
        return;
      }
    }

    filtered.push(comment);
  });

  return { comments: filtered, removed };
}

function createJournalEntryElement(entry, options = {}) {
  const { context = '' } = options;
  const item = document.createElement('li');
  item.className = 'journal-entry';
  if (entry.id) {
    item.dataset.entryId = entry.id;
  }

  const header = document.createElement('div');
  header.className = 'journal-entry-header';

  if (entry.title) {
    const titleEl = document.createElement('h3');
    titleEl.className = 'journal-entry-title';
    titleEl.textContent = entry.title;
    header.appendChild(titleEl);
  }

  const meta = document.createElement('div');
  meta.className = 'journal-entry-meta';

  const author = document.createElement('span');
  author.textContent = `Dodane przez ${entry.username || 'Podróżnik'}`;
  meta.appendChild(author);

  const dateLabel = formatReviewDate(entry.createdAt);
  if (dateLabel) {
    const dateSpan = document.createElement('span');
    dateSpan.textContent = dateLabel;
    meta.appendChild(dateSpan);
  }

  header.appendChild(meta);
  item.appendChild(header);

  const notes = document.createElement('p');
  notes.className = 'journal-entry-notes';
  notes.textContent = entry.notes;
  item.appendChild(notes);

  if (entry.photoDataUrl) {
    const figure = document.createElement('figure');
    figure.className = 'journal-entry-photo';
    const img = document.createElement('img');
    img.src = entry.photoDataUrl;
    img.alt = `Zdjęcie dodane przez ${entry.username || 'podróżnika'} w dzienniku podróży`;
    figure.appendChild(img);
    item.appendChild(figure);
  }

  const footer = document.createElement('div');
  footer.className = 'journal-entry-footer';

  const actions = document.createElement('div');
  actions.className = 'journal-entry-actions';

  const likesCount = Array.isArray(entry.likedBy) ? entry.likedBy.length : 0;
  const likesLabel = document.createElement('span');
  likesLabel.className = 'journal-entry-likes';
  likesLabel.textContent = formatJournalLikes(likesCount);

  const isOwnEntry = entry.userKey === currentUserKey;

  if (isOwnEntry) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ghost journal-entry-action journal-entry-edit';
    editBtn.textContent = 'Edytuj wpis';
    editBtn.addEventListener('click', () => startJournalEntryEdit(entry.id));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'ghost journal-entry-action journal-entry-delete is-danger';
    deleteBtn.textContent = 'Usuń wpis';
    deleteBtn.addEventListener('click', () => handleJournalEntryDelete(entry.id));
    actions.appendChild(deleteBtn);
  } else {
    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = 'ghost journal-entry-action journal-entry-like';
    const hasLiked = Boolean(currentUserKey) && Array.isArray(entry.likedBy)
      ? entry.likedBy.includes(currentUserKey)
      : false;
    likeBtn.textContent = hasLiked ? '❤️ Lubisz to' : '🤍 Polub wpis';
    likeBtn.setAttribute('aria-pressed', hasLiked ? 'true' : 'false');
    likeBtn.setAttribute(
      'aria-label',
      hasLiked
        ? `Cofnij polubienie wpisu. Obecnie ${formatJournalLikes(likesCount)}.`
        : `Polub wpis tego podróżnika. Obecnie ${formatJournalLikes(likesCount)}.`,
    );
    likeBtn.classList.toggle('is-liked', hasLiked);

    if (!currentUserKey) {
      likeBtn.disabled = true;
      likeBtn.title = 'Zaloguj się, aby polubić wpis w dzienniku.';
    } else {
      likeBtn.addEventListener('click', () => toggleJournalEntryLike(entry.id));
      likeBtn.title = hasLiked ? 'Cofnij polubienie wpisu.' : 'Polub wpis tego podróżnika.';
    }

    actions.appendChild(likeBtn);
  }

  footer.appendChild(actions);
  footer.appendChild(likesLabel);
  item.appendChild(footer);

  const shouldRenderComments = context !== 'placeJournalList';
  if (shouldRenderComments) {
    const commentsSection = document.createElement('div');
    commentsSection.className = 'journal-entry-comments';

    const titleEl = document.createElement('h4');
    titleEl.className = 'journal-entry-comments-title';
    titleEl.textContent = 'Komentarze w dzienniku';
    commentsSection.appendChild(titleEl);

    const comments = Array.isArray(entry.comments) ? entry.comments : [];

    if (!comments.length) {
      const empty = document.createElement('p');
      empty.className = 'journal-entry-comment-empty';
      empty.textContent = 'Nikt jeszcze nie skomentował tego wpisu.';
      commentsSection.appendChild(empty);
    }

    if (comments.length) {
      const commentsList = document.createElement('ul');
      commentsList.className = 'journal-entry-comments-list';
      comments.forEach((comment) => {
        commentsList.appendChild(createJournalCommentElement(entry, comment, { depth: 0 }));
      });
      commentsSection.appendChild(commentsList);
    }

    if (!currentUserKey) {
      const loginPrompt = document.createElement('div');
      loginPrompt.className = 'journal-entry-comment-login';

      const loginText = document.createElement('span');
      loginText.textContent = 'Zaloguj się, aby dodać komentarz i polubić wpis w dzienniku.';
      loginPrompt.appendChild(loginText);

      const loginButton = document.createElement('button');
      loginButton.type = 'button';
      loginButton.className = 'ghost';
      loginButton.textContent = '🔐 Otwórz logowanie';
      loginButton.addEventListener('click', () => openAuthModal());
      loginPrompt.appendChild(loginButton);

      commentsSection.appendChild(loginPrompt);
    } else {
      const form = createJournalCommentForm(entry.id, null, { depth: 0 });
      commentsSection.appendChild(form);
    }

    item.appendChild(commentsSection);
  }

  return item;
}

function createJournalCommentForm(entryId, parentCommentId = null, options = {}) {
  const { depth = 0 } = options;
  const form = document.createElement('form');
  form.className = 'journal-entry-comment-form';
  form.addEventListener('submit', (event) => handleJournalCommentSubmit(event, entryId, parentCommentId));

  if (parentCommentId) {
    form.classList.add('is-reply');
    form.style.setProperty('--comment-depth', String(depth));
    form.hidden = true;
  }

  const textareaId = parentCommentId
    ? `journalReply-${entryId}-${parentCommentId}-${depth}`
    : `journalComment-${entryId}-${depth}`;

  const label = document.createElement('label');
  label.className = 'sr-only';
  label.setAttribute('for', textareaId);
  label.textContent = parentCommentId ? 'Dodaj odpowiedź' : 'Dodaj komentarz';
  form.appendChild(label);

  const textarea = document.createElement('textarea');
  textarea.id = textareaId;
  textarea.name = 'comment';
  textarea.rows = parentCommentId ? 3 : 4;
  textarea.maxLength = JOURNAL_COMMENT_MAX_LENGTH;
  textarea.placeholder = parentCommentId
    ? 'Odpowiedz na ten komentarz…'
    : 'Podziel się swoimi wrażeniami…';
  form.appendChild(textarea);

  const actions = document.createElement('div');
  actions.className = 'journal-entry-comment-form-actions';

  if (parentCommentId) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ghost';
    cancelBtn.textContent = 'Anuluj';
    cancelBtn.addEventListener('click', () => {
      textarea.value = '';
      form.hidden = true;
    });
    actions.appendChild(cancelBtn);
  }

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = parentCommentId ? 'secondary' : 'primary';
  submitBtn.textContent = parentCommentId ? 'Dodaj odpowiedź' : 'Dodaj komentarz';
  actions.appendChild(submitBtn);

  form.appendChild(actions);
  return form;
}

function createJournalCommentElement(entry, comment, options = {}) {
  const { depth = 0 } = options;
  const item = document.createElement('li');
  item.className = 'journal-entry-comment';
  item.style.setProperty('--comment-depth', String(depth));
  if (comment?.id) {
    item.dataset.commentId = comment.id;
  }

  const header = document.createElement('div');
  header.className = 'journal-entry-comment-header';

  const meta = document.createElement('div');
  meta.className = 'journal-entry-comment-meta';

  const author = document.createElement('span');
  author.textContent = comment?.username || 'Podróżnik';
  meta.appendChild(author);

  const dateLabel = formatReviewDate(comment?.createdAt);
  if (dateLabel) {
    const date = document.createElement('span');
    date.textContent = dateLabel;
    meta.appendChild(date);
  }

  if (comment?.updatedAt && comment.updatedAt !== comment.createdAt) {
    const updatedLabel = formatReviewDate(comment.updatedAt);
    if (updatedLabel) {
      const edited = document.createElement('span');
      edited.textContent = `Edytowano: ${updatedLabel}`;
      meta.appendChild(edited);
    }
  }

  header.appendChild(meta);

  if (entry?.id && comment?.id && comment?.userKey && comment.userKey === currentUserKey) {
    const actions = document.createElement('div');
    actions.className = 'journal-entry-comment-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'journal-entry-comment-action';
    editBtn.textContent = 'Edytuj';
    editBtn.addEventListener('click', () => startJournalCommentEdit(entry.id, comment.id));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'journal-entry-comment-action is-danger';
    deleteBtn.textContent = 'Usuń';
    deleteBtn.addEventListener('click', () => handleJournalCommentDelete(entry.id, comment.id));
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
  }

  item.appendChild(header);

  const text = document.createElement('p');
  text.className = 'journal-entry-comment-text';
  text.textContent = comment?.text || '';
  item.appendChild(text);

  if (currentUserKey) {
    const actionsBar = document.createElement('div');
    actionsBar.className = 'journal-entry-comment-actions-bar';

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'journal-entry-comment-action';
    replyBtn.textContent = 'Odpowiedz';

    const replyForm = createJournalCommentForm(entry.id, comment.id, { depth: depth + 1 });
    replyBtn.addEventListener('click', () => {
      if (replyForm.hidden) {
        replyForm.hidden = false;
        const textarea = replyForm.querySelector('textarea');
        if (textarea instanceof HTMLTextAreaElement) {
          textarea.focus();
        }
      } else {
        replyForm.hidden = true;
      }
    });

    actionsBar.appendChild(replyBtn);
    item.appendChild(actionsBar);
    item.appendChild(replyForm);
  }

  const replies = Array.isArray(comment?.replies) ? comment.replies : [];
  if (replies.length) {
    const repliesList = document.createElement('ul');
    repliesList.className = 'journal-entry-replies';
    replies.forEach((reply) => {
      repliesList.appendChild(createJournalCommentElement(entry, reply, { depth: depth + 1 }));
    });
    item.appendChild(repliesList);
  }

  return item;
}

function startJournalCommentEdit(entryId, commentId) {
  if (!entryId || !commentId) {
    return;
  }

  if (!currentUserKey) {
    setLevelStatus('Zaloguj się, aby edytować komentarze w dzienniku.', 5000);
    openAuthModal();
    return;
  }

  const entryIndex = journalEntries.findIndex((item) => item.id === entryId);
  if (entryIndex === -1) {
    return;
  }

  const entry = journalEntries[entryIndex];
  const targetComment = findCommentInTree(entry.comments, commentId);
  if (!targetComment) {
    return;
  }

  if (!targetComment || targetComment.userKey !== currentUserKey) {
    setLevelStatus('Możesz edytować tylko własne komentarze.', 4000);
    return;
  }

  const result = window.prompt('Edytuj swój komentarz:', targetComment.text || '');
  if (result === null) {
    return;
  }

  const newText = result.trim();
  if (!newText) {
    setLevelStatus('Komentarz nie może być pusty.', 4000);
    return;
  }

  if (newText.length > JOURNAL_COMMENT_MAX_LENGTH) {
    setLevelStatus(`Komentarz może mieć maksymalnie ${JOURNAL_COMMENT_MAX_LENGTH} znaków.`, 5000);
    return;
  }

  if (newText === targetComment.text) {
    setLevelStatus('Treść komentarza pozostała bez zmian.', 4000);
    return;
  }

  const timestamp = new Date().toISOString();
  const existingComments = Array.isArray(entry.comments) ? entry.comments : [];
  const resultUpdate = updateCommentTree(existingComments, commentId, (comment) => ({
    ...comment,
    text: newText,
    updatedAt: timestamp,
  }));

  if (!resultUpdate.updated) {
    setLevelStatus('Nie udało się zapisać zmian komentarza.', 4000);
    return;
  }

  const updatedEntry = { ...entry, comments: resultUpdate.comments, updatedAt: timestamp };

  journalEntries[entryIndex] = updatedEntry;
  persistJournalEntries();
  renderJournalEntries();

  setLevelStatus('Komentarz został zaktualizowany.', 5000);
}

function handleJournalCommentDelete(entryId, commentId) {
  if (!entryId || !commentId) {
    return;
  }

  if (!currentUserKey) {
    setLevelStatus('Zaloguj się, aby usuwać komentarze w dzienniku.', 5000);
    openAuthModal();
    return;
  }

  const entryIndex = journalEntries.findIndex((item) => item.id === entryId);
  if (entryIndex === -1) {
    return;
  }

  const entry = journalEntries[entryIndex];
  const targetComment = findCommentInTree(entry.comments, commentId);
  if (!targetComment) {
    return;
  }

  if (!targetComment || targetComment.userKey !== currentUserKey) {
    setLevelStatus('Możesz usuwać tylko własne komentarze.', 4000);
    return;
  }

  const confirmed = window.confirm('Czy na pewno chcesz usunąć ten komentarz? Tego działania nie można cofnąć.');
  if (!confirmed) {
    return;
  }

  const existingComments = Array.isArray(entry.comments) ? entry.comments : [];
  const result = removeCommentFromTree(existingComments, commentId);
  if (!result.removed) {
    setLevelStatus('Nie udało się usunąć komentarza.', 4000);
    return;
  }

  const timestamp = new Date().toISOString();
  const updatedEntry = { ...entry, comments: result.comments, updatedAt: timestamp };

  journalEntries[entryIndex] = updatedEntry;
  persistJournalEntries();
  renderJournalEntries();

  setLevelStatus('Komentarz został usunięty.', 5000);
}

function startJournalEntryEdit(entryId) {
  if (!entryId) return;

  const entry = journalEntries.find((item) => item.id === entryId);
  if (!entry) return;

  if (entry.userKey !== currentUserKey) {
    setLevelStatus('Możesz edytować tylko własne wpisy.', 4000);
    return;
  }

  const form = document.getElementById('journalForm');
  const titleInput = form?.querySelector('#journalTitle');
  const notesField = form?.querySelector('#journalNotes');
  const photoInput = form?.querySelector('#journalPhoto');
  const preview = document.getElementById('journalPhotoPreview');
  const previewImage = document.getElementById('journalPhotoPreviewImage');
  const removePhotoBtn = document.getElementById('journalRemovePhoto');
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  editingJournalEntryId = entry.id;
  form.dataset.editingId = entry.id;
  form.dataset.removeExistingPhoto = 'false';

  if (titleInput instanceof HTMLInputElement) {
    titleInput.value = entry.title || '';
  }

  if (notesField instanceof HTMLTextAreaElement) {
    notesField.value = entry.notes || '';
  }

  if (photoInput instanceof HTMLInputElement) {
    photoInput.value = '';
  }

  if (entry.photoDataUrl && preview && previewImage instanceof HTMLImageElement) {
    preview.hidden = false;
    previewImage.src = entry.photoDataUrl;
  } else if (preview && previewImage instanceof HTMLImageElement) {
    preview.hidden = true;
    previewImage.src = '';
  }

  if (removePhotoBtn instanceof HTMLButtonElement) {
    removePhotoBtn.disabled = !entry.photoDataUrl;
  }

  if (submitBtn instanceof HTMLButtonElement) {
    submitBtn.textContent = 'Zapisz zmiany';
  }

  setJournalFormMessage('Edytujesz swój wpis. Zapisz zmiany lub wyczyść formularz, aby anulować.', 'info');
  openAdventureView({ showJournalForm: true });

  if (titleInput instanceof HTMLInputElement) {
    titleInput.focus();
  } else if (notesField instanceof HTMLTextAreaElement) {
    notesField.focus();
  }
}

function handleJournalEntryDelete(entryId) {
  if (!entryId) return;

  const entry = journalEntries.find((item) => item.id === entryId);
  if (!entry) return;

  if (entry.userKey !== currentUserKey) {
    setLevelStatus('Możesz usuwać tylko własne wpisy.', 4000);
    return;
  }

  const confirmed = window.confirm('Czy na pewno chcesz usunąć ten wpis? Tego działania nie można cofnąć.');
  if (!confirmed) {
    return;
  }

  journalEntries = journalEntries.filter((item) => item.id !== entryId);
  persistJournalEntries();
  renderJournalEntries();

  if (editingJournalEntryId === entryId) {
    resetJournalForm();
  }

  setLevelStatus('Wpis został usunięty z dziennika.', 6000);
}

function toggleJournalEntryLike(entryId) {
  if (!entryId) return;

  if (!currentUserKey) {
    setLevelStatus('Zaloguj się, aby polubić wpisy w dzienniku.', 5000);
    return;
  }

  const index = journalEntries.findIndex((item) => item.id === entryId);
  if (index === -1) {
    return;
  }

  const entry = journalEntries[index];
  if (!entry || entry.userKey === currentUserKey) {
    return;
  }

  const likedBy = Array.isArray(entry.likedBy) ? [...entry.likedBy] : [];
  const existingIndex = likedBy.indexOf(currentUserKey);
  let message = '';

  if (existingIndex >= 0) {
    likedBy.splice(existingIndex, 1);
    message = 'Cofnięto polubienie wpisu.';
  } else {
    likedBy.push(currentUserKey);
    message = 'Polubiłeś ten wpis w dzienniku!';
    if (entry.userKey && entry.userKey !== currentUserKey) {
      addNotificationForUser(entry.userKey, {
        type: 'like',
        entryId,
        actorKey: currentUserKey,
        actorName: getCurrentDisplayName(),
        message: `${getCurrentDisplayName()} polubił Twój wpis „${getEntryNotificationTitle(entry)}”.`,
      });
    }
  }

  journalEntries[index] = { ...entry, likedBy };
  persistJournalEntries();
  renderJournalEntries();

  if (message) {
    setLevelStatus(message, 4000);
  }
}

function handleJournalCommentSubmit(event, entryId, parentCommentId = null) {
  event.preventDefault();

  if (!entryId) {
    return;
  }

  if (!currentUserKey) {
    setLevelStatus('Zaloguj się, aby dodać komentarz w dzienniku podróży.', 5000);
    openAuthModal();
    return;
  }

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const textarea = form.querySelector('textarea[name="comment"]');
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const text = textarea.value.trim();
  if (!text) {
    setLevelStatus('Napisz komentarz, aby dołączyć do rozmowy.', 4000);
    textarea.focus();
    return;
  }

  if (text.length > JOURNAL_COMMENT_MAX_LENGTH) {
    setLevelStatus(`Komentarz może mieć maksymalnie ${JOURNAL_COMMENT_MAX_LENGTH} znaków.`, 5000);
    textarea.focus();
    return;
  }

  const index = journalEntries.findIndex((item) => item.id === entryId);
  if (index === -1) {
    return;
  }

  const entry = journalEntries[index];
  if (!entry) {
    return;
  }

  const timestamp = new Date().toISOString();
  const comment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: timestamp,
    userKey: currentUserKey,
    username: getCurrentDisplayName(),
    updatedAt: timestamp,
    replies: [],
  };

  const existingComments = Array.isArray(entry.comments) ? entry.comments : [];
  let updatedComments;
  let parentComment = null;

  if (parentCommentId) {
    const parentExists = findCommentInTree(existingComments, parentCommentId);
    if (!parentExists) {
      setLevelStatus('Nie udało się odnaleźć komentarza do odpowiedzi.', 4000);
      return;
    }

    const result = appendReplyToComment(existingComments, parentCommentId, comment);
    if (!result.updated) {
      setLevelStatus('Nie udało się dodać odpowiedzi. Odśwież stronę i spróbuj ponownie.', 5000);
      return;
    }
    updatedComments = result.comments;
    parentComment = result.updated;
  } else {
    updatedComments = [...existingComments, comment];
  }

  const updatedEntry = { ...entry, comments: updatedComments, updatedAt: timestamp };

  journalEntries[index] = updatedEntry;
  persistJournalEntries();
  renderJournalEntries();

  if (textarea) {
    textarea.value = '';
  }

  if (parentCommentId && form instanceof HTMLFormElement) {
    form.hidden = true;
  }

  const message = parentCommentId
    ? 'Twoja odpowiedź została opublikowana!'
    : 'Twój komentarz został dodany do rozmowy!';
  setLevelStatus(message, 5000);

  const actorName = getCurrentDisplayName();
  const entryOwner = entry.userKey;
  const entryTitle = getEntryNotificationTitle(entry);

  if (parentCommentId) {
    const parentOwner = parentComment?.userKey;
    if (parentOwner && parentOwner !== currentUserKey) {
      addNotificationForUser(parentOwner, {
        type: 'reply',
        entryId,
        actorKey: currentUserKey,
        actorName,
        message: `${actorName} odpowiedział na Twój komentarz we wpisie „${entryTitle}”.`,
      });
    }

    if (entryOwner && entryOwner !== currentUserKey && entryOwner !== parentComment?.userKey) {
      addNotificationForUser(entryOwner, {
        type: 'comment',
        entryId,
        actorKey: currentUserKey,
        actorName,
        message: `${actorName} dołączył do rozmowy we wpisie „${entryTitle}”.`,
      });
    }
  } else if (entryOwner && entryOwner !== currentUserKey) {
    addNotificationForUser(entryOwner, {
      type: 'comment',
      entryId,
      actorKey: currentUserKey,
      actorName,
      message: `${actorName} skomentował Twój wpis „${entryTitle}”.`,
    });
  }
}

function renderJournalEntries() {
  sortJournalEntries();

  const targets = [
    { listId: 'journalEntriesList', emptyId: 'journalEmptyMessage' },
    {
      listId: 'placeJournalList',
      emptyId: 'placeJournalEmptyMessage',
      limit: JOURNAL_PLACE_PREVIEW_LIMIT,
    },
  ];

  targets.forEach(({ listId, emptyId, limit }) => {
    const listEl = document.getElementById(listId);
    if (!listEl) {
      return;
    }

    const emptyMessage = emptyId ? document.getElementById(emptyId) : null;
    listEl.innerHTML = '';

    const entriesToRender =
      typeof limit === 'number' && limit >= 0 ? journalEntries.slice(0, limit) : journalEntries;

    if (!entriesToRender.length) {
      if (emptyMessage) {
        emptyMessage.hidden = false;
      }
      return;
    }

    if (emptyMessage) {
      emptyMessage.hidden = true;
    }

    entriesToRender.forEach((entry) => {
      listEl.appendChild(createJournalEntryElement(entry, { context: listId }));
    });
  });
}

function resetJournalForm() {
  const form = document.getElementById('journalForm');
  if (!(form instanceof HTMLFormElement)) return;
  form.reset();

  delete form.dataset.editingId;
  form.dataset.removeExistingPhoto = 'false';
  editingJournalEntryId = null;

  const preview = document.getElementById('journalPhotoPreview');
  const previewImage = document.getElementById('journalPhotoPreviewImage');
  const removePhotoBtn = document.getElementById('journalRemovePhoto');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (preview) {
    preview.hidden = true;
  }

  if (previewImage instanceof HTMLImageElement) {
    previewImage.src = '';
  }

  if (removePhotoBtn instanceof HTMLButtonElement) {
    removePhotoBtn.disabled = true;
  }

  if (submitBtn instanceof HTMLButtonElement) {
    submitBtn.textContent = 'Zapisz wpis';
  }

  setJournalFormMessage('');
}

async function handleJournalFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;

  const titleInput = form.querySelector('#journalTitle');
  const notesField = form.querySelector('#journalNotes');
  const photoInput = form.querySelector('#journalPhoto');
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalSubmitText =
    submitBtn instanceof HTMLButtonElement && submitBtn.textContent
      ? submitBtn.textContent
      : 'Zapisz wpis';

  if (
    !(titleInput instanceof HTMLInputElement) ||
    !(notesField instanceof HTMLTextAreaElement) ||
    !(photoInput instanceof HTMLInputElement)
  ) {
    return;
  }

  if (!currentUserKey) {
    setJournalFormMessage('Zaloguj się, aby dodać wpis w dzienniku podróży.', 'error');
    openAuthModal();
    return;
  }

  const title = titleInput.value.trim();
  const notes = notesField.value.trim();

  if (!notes) {
    setJournalFormMessage('Opisz swoje doświadczenie, aby pomóc innym podróżnikom.', 'error');
    return;
  }

  const editingId = form.dataset.editingId;
  const isEditing = Boolean(editingId);
  const removeExistingPhoto = form.dataset.removeExistingPhoto === 'true';
  const existingEntry = isEditing ? journalEntries.find((item) => item.id === editingId) : null;

  if (isEditing && !existingEntry) {
    setJournalFormMessage('Nie znaleziono wpisu do edycji. Spróbuj ponownie.', 'error');
    resetJournalForm();
    renderJournalEntries();
    return;
  }

  if (isEditing && existingEntry?.userKey !== currentUserKey) {
    setJournalFormMessage('Możesz edytować tylko własne wpisy.', 'error');
    return;
  }

  let photoDataUrl = existingEntry?.photoDataUrl || null;
  if (removeExistingPhoto) {
    photoDataUrl = null;
  }
  const file = photoInput.files && photoInput.files[0];

  if (file) {
    if (!file.type.startsWith('image/')) {
      setJournalFormMessage('Wybierz plik w formacie graficznym.', 'error');
      return;
    }

    if (file.size > JOURNAL_MAX_PHOTO_SIZE) {
      setJournalFormMessage('Zdjęcie może mieć maksymalnie 4 MB.', 'error');
      return;
    }

    try {
      photoDataUrl = await readFileAsDataUrl(file);
    } catch (error) {
      console.error('Nie udało się odczytać zdjęcia dziennika:', error);
      setJournalFormMessage('Nie udało się wczytać zdjęcia. Spróbuj ponownie.', 'error');
      return;
    }
  }

  if (isEditing && existingEntry) {
    const updatedAt = new Date().toISOString();
    const updatedEntry = {
      ...existingEntry,
      title,
      notes,
      photoDataUrl,
      updatedAt,
    };

    journalEntries = journalEntries.map((item) => (item.id === existingEntry.id ? updatedEntry : item));
    persistJournalEntries();
    renderJournalEntries();
    resetJournalForm();
    switchJournalTab('journalEntriesPanel');

    const listEl = document.getElementById('journalEntriesList');
    if (listEl?.firstElementChild instanceof HTMLElement) {
      listEl.firstElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    setLevelStatus('Wpis w dzienniku został zaktualizowany!', 6000);
    return;
  }

  const payload = {
    title,
    notes,
    photoDataUrl,
    userKey: currentUserKey,
    username: getCurrentDisplayName(),
  };

  if (submitBtn instanceof HTMLButtonElement) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publikuję wpis…';
  }

  setJournalFormMessage('Publikuję Twój wpis w dzienniku…', 'info');

  let savedEntry;
  try {
    savedEntry = await createCommunityJournalEntry(payload);
  } catch (error) {
    console.error('Nie udało się opublikować wpisu w dzienniku:', error);
    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : 'Nie udało się opublikować wpisu. Spróbuj ponownie.';
    setJournalFormMessage(errorMessage, 'error');

    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalSubmitText;
    }

    return;
  }

  if (submitBtn instanceof HTMLButtonElement) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalSubmitText;
  }

  mergeJournalEntries([savedEntry]);
  resetJournalForm();
  switchJournalTab('journalEntriesPanel');

  const listEl = document.getElementById('journalEntriesList');
  if (listEl?.firstElementChild instanceof HTMLElement) {
    listEl.firstElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  setJournalFormMessage('Twój wpis został opublikowany!', 'success');
  setLevelStatus('Dziękujemy za podzielenie się wpisem w dzienniku podróży!', 6000);
}

function handleJournalPhotoChange(event) {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement)) return;

  const form = input.closest('form');
  if (form instanceof HTMLFormElement) {
    form.dataset.removeExistingPhoto = 'false';
  }

  const editingId = form instanceof HTMLFormElement ? form.dataset.editingId : editingJournalEntryId;
  const editingEntry = editingId ? journalEntries.find((item) => item.id === editingId) : null;
  const file = input.files && input.files[0];
  const preview = document.getElementById('journalPhotoPreview');
  const previewImage = document.getElementById('journalPhotoPreviewImage');
  const removePhotoBtn = document.getElementById('journalRemovePhoto');

  if (!file) {
    if (editingEntry?.photoDataUrl && previewImage instanceof HTMLImageElement && preview) {
      preview.hidden = false;
      previewImage.src = editingEntry.photoDataUrl;
      if (removePhotoBtn instanceof HTMLButtonElement) {
        removePhotoBtn.disabled = false;
      }
      return;
    }

    if (preview) {
      preview.hidden = true;
    }
    if (previewImage instanceof HTMLImageElement) {
      previewImage.src = '';
    }
    if (removePhotoBtn instanceof HTMLButtonElement) {
      removePhotoBtn.disabled = true;
    }
    return;
  }

  if (!file.type.startsWith('image/')) {
    setJournalFormMessage('Wybierz plik w formacie graficznym.', 'error');
    input.value = '';
    return;
  }

  if (file.size > JOURNAL_MAX_PHOTO_SIZE) {
    setJournalFormMessage('Zdjęcie może mieć maksymalnie 4 MB.', 'error');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    if (previewImage instanceof HTMLImageElement) {
      previewImage.src = typeof reader.result === 'string' ? reader.result : '';
    }
    if (preview) {
      preview.hidden = false;
    }
    if (removePhotoBtn instanceof HTMLButtonElement) {
      removePhotoBtn.disabled = false;
    }
    setJournalFormMessage('Zdjęcie zostanie zapisane razem z wpisem.', 'info');
  };
  reader.onerror = () => {
    setJournalFormMessage('Nie udało się wczytać zdjęcia. Spróbuj ponownie.', 'error');
    input.value = '';
  };
  reader.readAsDataURL(file);
}

function handleJournalRemovePhoto(event) {
  event.preventDefault();
  const photoInput = document.getElementById('journalPhoto');
  const preview = document.getElementById('journalPhotoPreview');
  const previewImage = document.getElementById('journalPhotoPreviewImage');
  const removePhotoBtn = document.getElementById('journalRemovePhoto');
  const form = document.getElementById('journalForm');

  if (photoInput instanceof HTMLInputElement) {
    photoInput.value = '';
  }

  if (preview) {
    preview.hidden = true;
  }

  if (previewImage instanceof HTMLImageElement) {
    previewImage.src = '';
  }

  if (removePhotoBtn instanceof HTMLButtonElement) {
    removePhotoBtn.disabled = true;
  }

  if (form instanceof HTMLFormElement) {
    form.dataset.removeExistingPhoto = 'true';
    const isEditing = Boolean(form.dataset.editingId);
    setJournalFormMessage(
      isEditing ? 'Zdjęcie zostanie usunięte po zapisaniu zmian.' : 'Zdjęcie zostało usunięte.',
      'info',
    );
  } else {
    setJournalFormMessage('Zdjęcie zostało usunięte.', 'info');
  }
}

function initializeJournalUI() {
  journalEntries = loadJournalEntriesFromStorage();
  renderJournalEntries();

  refreshJournalEntriesFromServer();
  connectJournalRealtimeUpdates();

  const tabs = document.querySelectorAll('.journal-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', handleJournalTabClick);
    tab.addEventListener('keydown', handleJournalTabKeydown);
  });

  const form = document.getElementById('journalForm');
  const photoInput = document.getElementById('journalPhoto');
  const removePhotoBtn = document.getElementById('journalRemovePhoto');

  form?.addEventListener('submit', handleJournalFormSubmit);
  photoInput?.addEventListener('change', handleJournalPhotoChange);
  removePhotoBtn?.addEventListener('click', handleJournalRemovePhoto);

  resetJournalForm();
  switchJournalTab('journalEntriesPanel');
  setJournalFormMessage('');
}

function initializeNotifications() {
  notificationsByUser = loadNotificationsFromStorage();
  renderNotificationsUI();

  const toggleBtn = document.getElementById('notificationsToggle');
  const closeBtn = document.getElementById('notificationsClose');
  const panel = document.getElementById('notificationsPanel');
  const panelMarkAll = document.getElementById('notificationsMarkAll');
  const feedMarkAll = document.getElementById('notificationsFeedMarkAll');

  toggleBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleNotificationsPanel();
  });

  closeBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    closeNotificationsPanel();
  });

  panel?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  panelMarkAll?.addEventListener('click', () => {
    markAllNotificationsAsRead();
  });

  feedMarkAll?.addEventListener('click', () => {
    markAllNotificationsAsRead();
  });
}

function showObjective(place) {
  const panel = document.getElementById('currentObjective');
  if (!panel) return;

  const titleEl = document.getElementById('objectiveTitle');
  const descriptionEl = document.getElementById('objectiveDescription');
  const linkEl = document.getElementById('objectiveLink');
  const mapGoogleLink = document.getElementById('mapGoogleLink');
  const buttonEl = document.getElementById('checkInBtn');
  const statusEl = document.getElementById('checkInStatus');
  const previousBtn = document.getElementById('previousPlaceBtn');
  const nextBtn = document.getElementById('nextPlaceBtn');

  if (!titleEl || !descriptionEl || !linkEl || !buttonEl || !statusEl) return;

  clearManualConfirm();

  const visited = state.visited.has(place.id);

  const localizedName = getPlaceName(place);
  const localizedDescription = getPlaceDescription(place);
  const localizedBadge = getPlaceBadge(place);

  titleEl.textContent = localizedName;
  descriptionEl.textContent = localizedDescription;
  linkEl.href = place.googleMapsUrl;
  if (mapGoogleLink instanceof HTMLAnchorElement) {
    mapGoogleLink.href = place.googleMapsUrl;
  }

  buttonEl.disabled = visited;
  buttonEl.classList.remove('locked');
  buttonEl.textContent = visited
    ? translate('places.objective.completed', 'Odznaka zdobyta')
    : translate('places.objective.checkIn', 'Zamelduj się i zdobądź XP');

  const previousPlace = getAdjacentPlace(place, -1);
  if (previousBtn instanceof HTMLButtonElement) {
    previousBtn.disabled = !previousPlace;
    const previousName = previousPlace ? getPlaceName(previousPlace) : '';
    previousBtn.title = previousPlace
      ? translate('places.objective.previousTitle', `Przejdź do ${previousName}`, {
          name: previousName,
        })
      : translate('places.objective.previousNone', 'Brak poprzedniego miejsca');
    previousBtn.setAttribute(
      'aria-label',
      previousPlace
        ? translate('places.objective.previousAria', `Przejdź do poprzedniego miejsca: ${previousName}`, {
            name: previousName,
          })
        : translate('places.objective.previousNone', 'Brak poprzedniego miejsca'),
    );
  }

  const nextPlace = getAdjacentPlace(place, 1);
  if (nextBtn instanceof HTMLButtonElement) {
    nextBtn.disabled = !nextPlace;
    const nextName = nextPlace ? getPlaceName(nextPlace) : '';
    nextBtn.title = nextPlace
      ? translate('places.objective.nextTitle', `Przejdź do ${nextName}`, {
          name: nextName,
        })
      : translate('places.objective.nextNone', 'Brak kolejnego miejsca');
    nextBtn.setAttribute(
      'aria-label',
      nextPlace
        ? translate('places.objective.nextAria', `Przejdź do następnego miejsca: ${nextName}`, {
            name: nextName,
          })
        : translate('places.objective.nextNone', 'Brak kolejnego miejsca'),
    );
  }

  if (visited) {
    statusEl.textContent = translate(
      'places.objective.visited',
      'Już zdobyłeś tę odznakę – sprawdź kolejne miejsce!',
    );
  } else {
    statusEl.textContent = translate(
      'places.objective.hint',
      'Gdy dotrzesz na miejsce, kliknij „Zamelduj się”, aby zdobyć odznakę.',
    );
  }

  renderReviewsSection({ ...place, name: localizedName, badge: localizedBadge, description: localizedDescription });
  renderTripPlanner(place);
  panel.hidden = false;
}

function getAdjacentPlace(place, direction) {
  if (!place) return null;
  const index = places.findIndex((item) => item.id === place.id);
  if (index === -1) return null;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= places.length) {
    return null;
  }

  return places[targetIndex];
}

function focusAdjacentPlace(direction) {
  if (!state.selected) {
    return false;
  }

  const target = getAdjacentPlace(state.selected, direction);
  if (!target) {
    return false;
  }

  focusPlace(target.id);
  return true;
}

function clearManualConfirm() {
  const statusEl = document.getElementById('checkInStatus');
  if (!statusEl) return;
  statusEl.querySelectorAll('.manual-confirm-wrapper').forEach((wrapper) => wrapper.remove());
}

function showManualConfirm(place) {
  const statusEl = document.getElementById('checkInStatus');
  if (!statusEl) return;
  clearManualConfirm();

  const wrapper = document.createElement('div');
  wrapper.className = 'manual-confirm-wrapper';
  const button = document.createElement('button');
  button.className = 'primary manual-confirm';
  button.textContent = translate('checkIn.manualConfirm.action', 'Potwierdzam, jestem na miejscu');
  button.addEventListener('click', async () => {
    await completeCheckIn(place, true);
    statusEl.textContent = translate('checkIn.manualConfirm.success', 'Odznaka przyznana!');
    wrapper.remove();
  });
  wrapper.appendChild(button);
  statusEl.appendChild(wrapper);
}

async function tryCheckIn(place) {
  const statusEl = document.getElementById('checkInStatus');
  if (!statusEl) return;

  statusEl.textContent = translate('checkIn.status.checking', 'Sprawdzam Twoją lokalizację…');

  if (!('geolocation' in navigator)) {
    statusEl.textContent = translate(
      'checkIn.status.unsupported',
      'Twoja przeglądarka nie wspiera geolokalizacji. Możesz ręcznie potwierdzić wizytę klikając poniżej.',
    );
    showManualConfirm(place);
    return;
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  }).catch((error) => {
    console.warn('Błąd geolokalizacji', error);
    statusEl.textContent = translate(
      'checkIn.status.error',
      'Nie udało się uzyskać lokalizacji. Upewnij się, że wyraziłeś zgodę lub użyj ręcznego potwierdzenia.',
    );
    showManualConfirm(place);
    throw error;
  });

  if (!position) return;
  const { latitude, longitude } = position.coords;
  const distance = haversineDistance(latitude, longitude, place.lat, place.lng);
  const radius = 350; // metry

  if (distance <= radius) {
    await completeCheckIn(place);
    statusEl.textContent = translate(
      'checkIn.status.success',
      'Gratulacje! Zameldujesz się dokładnie na miejscu.',
    );
  } else {
    const distanceKm = (distance / 1000).toFixed(2);
    statusEl.textContent = translate(
      'checkIn.status.distance',
      `Jesteś około ${distanceKm} km od celu. Sprawdź wskazówki w Mapach Google, a jeśli naprawdę jesteś na miejscu, użyj ręcznego potwierdzenia.`,
      { distance: distanceKm },
    );
    showManualConfirm(place);
  }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371e3;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function completeCheckIn(place, manual = false) {
  if (state.visited.has(place.id)) return;

  try {
    state.visited.add(place.id);

    try {
      const { awardPoi } = await import('/js/xp.js');
      await awardPoi(place.id);
    } catch (error) {
      console.error('[XP] awardPoi failed', error);
    }

    const localizedName = getPlaceName(place);
    const localizedBadge = getPlaceBadge(place);
    state.badges.push({
      id: place.id,
      name: localizedBadge,
      description: manual
        ? translate('places.badge.manual', `${localizedName} • Odznaka przyznana ręcznie.`, {
            name: localizedName,
          })
        : translate('places.badge.geo', `${localizedName} • Potwierdzono geolokalizacją.`, {
            name: localizedName,
          }),
    });

    const streakResult = recordDailyCheckIn();
    const challengeCompleted = completeDailyChallengeIfNeeded(place);

    let leveledUp = awardXp(place.xp);
    if (challengeCompleted) {
      const leveledUpFromBonus = awardXp(DAILY_CHALLENGE_BONUS_XP);
      leveledUp = leveledUp || leveledUpFromBonus;
    }

    updateAfterStateChange(leveledUp);
    animateMarker(place.id);

    if (challengeCompleted) {
      showToast(
        translate('places.toast.dailyChallenge', `Ukończyłeś dzisiejsze wyzwanie w ${localizedName}! +${DAILY_CHALLENGE_BONUS_XP} XP`, {
          name: localizedName,
          xp: DAILY_CHALLENGE_BONUS_XP,
        }),
        {
          variant: 'success',
          icon: '🎯',
          duration: 7000,
        },
      );
    }

    if (!leveledUp) {
      let message = translate('places.toast.badge', `Zdobyłeś odznakę „${localizedBadge}”!`, {
        badge: localizedBadge,
      });

      if (challengeCompleted) {
        message = translate(
          'places.toast.dailyBonus',
          `🎯 Wyzwanie dnia ukończone! Bonus +${DAILY_CHALLENGE_BONUS_XP} XP już na Twoim koncie.`,
          { xp: DAILY_CHALLENGE_BONUS_XP },
        );
      } else if (streakResult.status === 'continued') {
        message = translate(
          'places.toast.streakContinue',
          `🔥 Seria trwa już ${state.dailyStreak.current} dni. Tak trzymaj!`,
          { days: state.dailyStreak.current },
        );
      } else if (streakResult.status === 'started') {
        message = translate(
          'places.toast.streakStart',
          'Rozpocząłeś serię codziennych przygód – wróć jutro po kolejny dzień!',
        );
      } else if (streakResult.status === 'reset') {
        message = translate(
          'places.toast.streakReset',
          `Nowa seria rozpoczęta. Cel: pobić rekord ${state.dailyStreak.best} dni!`,
          { days: state.dailyStreak.best },
        );
      }

      setLevelStatus(message, 7000);
    }
  } catch (error) {
    console.error('completeCheckIn failed', error);
  }
}

function completeTask(task) {
  if (state.tasksCompleted.has(task.id) || !isTaskUnlocked(task)) return;

  try {
    state.tasksCompleted.add(task.id);

    const leveledUp = awardXp(task.xp);
    updateAfterStateChange(leveledUp);

    if (!leveledUp) {
      const title = getTaskTitle(task);
      const message = translate('tasks.status.completed', 'Ukończyłeś zadanie „{{title}}” (+{{xp}} XP)', {
        title,
        xp: task.xp,
      });
      setLevelStatus(message, 6000);
    }

    if (currentUserKey) {
      const title = getTaskTitle(task);
      const notificationMessage = translate(
        'notifications.task.completed',
        '🎯 Ukończyłeś zadanie „{{title}}” (+{{xp}} XP).',
        { title, xp: task.xp },
      );
      addNotificationForUser(currentUserKey, {
        type: 'task-completed',
        message: notificationMessage,
      });
    }

    loadXpModule()
      .then((module) => {
        if (module?.awardTask) {
          return module.awardTask(task.id);
        }
        return null;
      })
      .catch((error) => {
        console.error('[XP] awardTask failed', error);
        showToast(
          translate(
            'tasks.sync.error',
            'Nie udało się zsynchronizować zadania. Spróbujemy ponownie, gdy połączenie wróci.',
          ),
          {
            variant: 'error',
            icon: '⚠️',
            duration: 6000,
          },
        );
      });
  } catch (error) {
    console.error('completeTask failed', error);
  }
}

function revertTask(task) {
  if (!state.tasksCompleted.has(task.id)) return;

  state.tasksCompleted.delete(task.id);
  const leveledDown = removeXp(task.xp);
  updateAfterStateChange(false);

  const title = getTaskTitle(task);
  const levelNote = leveledDown
    ? translate('tasks.status.levelReverted', ' Powróciłeś na poziom {{level}}.', { level: state.level })
    : '';
  const message = translate(
    'tasks.status.reverted',
    'Cofnięto oznaczenie zadania „{{title}}” (−{{xp}} XP).{{note}}',
    {
      title,
      xp: task.xp,
      note: levelNote,
    },
  );
  setLevelStatus(message.trim(), 6000);
}

function animateMarker(id) {
  const marker = markers.get(id);
  if (!marker) return;
  marker.setBouncingOptions({ bounceHeight: 15, bounceSpeed: 54 }).bounce(3);
}

function ensureSelectedObjective() {
  if (state.selected) {
    showObjective(state.selected);
    return;
  }

  if (!places.length) {
    return;
  }

  const firstUnlocked = places.find((place) => isPlaceUnlocked(place));
  if (firstUnlocked) {
    focusPlace(firstUnlocked.id);
  } else {
    state.selected = places[0];
    showObjective(places[0]);
  }
}

function renderAllForCurrentState() {
  // Jeśli użytkownik Supabase, poziom jest już ustawiony z bazy (generated column)
  // Nie przeliczaj lokalnie bo Supabase jest source of truth
  const isSupabaseUser = currentSupabaseUser && currentUserKey && currentUserKey.startsWith('supabase:');
  
  if (!isSupabaseUser) {
    recalculateLevel();
  }
  
  renderProgress();
  renderAccountStats('render-all');
  renderDailyStreak();
  renderDailyChallenge();
  renderAchievements();
  renderLocations();
  renderAttractionsCatalog();
  renderTasks();
  renderMediaTrips();
  renderExplorer();
  ensureSelectedObjective();
}

function setDocumentAuthState(state) {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  const nextState = AUTH_STATE_VALUES.has(state) ? state : 'guest';
  if (root.dataset.authState !== nextState) {
    root.dataset.authState = nextState;
  }
}

function getDocumentAuthState() {
  const root = document.documentElement;
  if (!root) {
    return 'guest';
  }

  const state = root.dataset.authState;
  return AUTH_STATE_VALUES.has(state) ? state : 'guest';
}

function setAuthMessage(message = '', tone = 'info') {
  const messageEl = document.getElementById('authMessage');
  if (!messageEl) return;
  messageEl.textContent = message;
  if (message) {
    messageEl.dataset.tone = tone;
  } else {
    messageEl.removeAttribute('data-tone');
  }
}

function setAccountMessage(message = '', tone = 'info') {
  const messageEl = document.getElementById('accountMessage');
  if (!messageEl) return;
  messageEl.textContent = message;
  if (message) {
    messageEl.dataset.tone = tone;
    messageEl.hidden = false;
  } else {
    messageEl.removeAttribute('data-tone');
    messageEl.hidden = true;
  }
}

function showAuthError(key, fallback, replacements = {}) {
  setAuthMessage(translate(key, fallback, replacements), 'error');
}

function showAccountError(key, fallback, replacements = {}) {
  setAccountMessage(translate(key, fallback, replacements), 'error');
}

function showAccountSuccess(key, fallback, replacements = {}) {
  setAccountMessage(translate(key, fallback, replacements), 'success');
}

function clearAuthForms() {
  const loginForm = document.getElementById('form-login');
  if (loginForm instanceof HTMLFormElement) {
    loginForm.reset();
  }

  const registerForm = document.getElementById('form-register');
  if (registerForm instanceof HTMLFormElement) {
    registerForm.reset();
  }
}

let previousBodyOverflow = '';
let previousBodyPosition = '';
let previousBodyTop = '';
let previousBodyWidth = '';
let scrollPositionBeforeLock = 0;
let bodyScrollLockCount = 0;

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    scrollPositionBeforeLock = window.scrollY || window.pageYOffset || 0;
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPosition = document.body.style.position;
    previousBodyTop = document.body.style.top;
    previousBodyWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionBeforeLock}px`;
    document.body.style.width = '100%';
  }

  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  if (bodyScrollLockCount === 0) return;

  bodyScrollLockCount -= 1;
  if (bodyScrollLockCount > 0) {
    return;
  }

  document.body.style.overflow = previousBodyOverflow;
  document.body.style.position = previousBodyPosition;
  document.body.style.top = previousBodyTop;
  document.body.style.width = previousBodyWidth;

  previousBodyOverflow = '';
  previousBodyPosition = '';
  previousBodyTop = '';
  previousBodyWidth = '';

  window.scrollTo(0, scrollPositionBeforeLock);
  scrollPositionBeforeLock = 0;
}

function setActiveAccountTab(tabId = 'stats') {
  const tabs = document.querySelectorAll('[data-account-tab]');
  const panels = document.querySelectorAll('[data-account-panel]');
  const availableTabs = Array.from(tabs).map((tab) => tab.dataset.accountTab);
  const targetTab = availableTabs.includes(tabId) ? tabId : availableTabs[0];

  tabs.forEach((tab) => {
    const id = tab.dataset.accountTab;
    const isActive = id === targetTab;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  panels.forEach((panel) => {
    const id = panel.dataset.accountPanel;
    const isActive = id === targetTab;
    panel.classList.toggle('is-active', isActive);
    if (isActive) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });

  try {
    document.dispatchEvent(new CustomEvent('ce-account:tab-change', { detail: { tab: targetTab } }));
  } catch (error) {
    console.warn('Nie udało się wysłać zdarzenia zmiany zakładki konta.', error);
  }

  return targetTab;
}

function openAccountModal(initialTab = 'stats') {
  const modal = document.getElementById('accountModal');
  if (!modal) {
    return;
  }

  const activeTab = setActiveAccountTab(initialTab);
  const alreadyOpen = !modal.hidden && modal.classList.contains('visible');

  if (alreadyOpen) {
    renderAccountStats('modal-reopen');
    try {
      document.dispatchEvent(
        new CustomEvent('ce-account:opened', { detail: { tab: activeTab, reopen: true } }),
      );
    } catch (error) {
      console.warn('Nie udało się wysłać zdarzenia ponownego otwarcia panelu konta.', error);
    }
    return;
  }

  const passwordForm = document.getElementById('accountPasswordForm');
  if (passwordForm instanceof HTMLFormElement) {
    passwordForm.reset();
  }

  setAccountMessage('');
  renderAccountStats('modal-open');
  
  // Load avatar from Supabase profile
  if (currentSupabaseUser) {
    const client = getSupabaseClient();
    if (client) {
      client
        .from('profiles')
        .select('avatar_url')
        .eq('id', currentSupabaseUser.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            const avatarImg = document.querySelector('#profileAvatarImg');
            const avatarRemoveBtn = document.querySelector('#btnRemoveAvatar');
            
            if (avatarImg) {
              if (data.avatar_url) {
                avatarImg.src = data.avatar_url;
                if (avatarRemoveBtn) {
                  avatarRemoveBtn.hidden = false;
                }
              } else {
                avatarImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e0e7ff'/%3E%3Cpath d='M50 45c8.284 0 15-6.716 15-15s-6.716-15-15-15-15 6.716-15 15 6.716 15 15 15zM20 75c0-16.569 13.431-30 30-30s30 13.431 30 30v10H20V75z' fill='%233b82f6'/%3E%3C/svg%3E";
                if (avatarRemoveBtn) {
                  avatarRemoveBtn.hidden = true;
                }
              }
            }
          }
        })
        .catch((err) => {
          console.warn('Nie udało się załadować avatara:', err);
        });
    }
  }
  
  lockBodyScroll();
  modal.hidden = false;
  requestAnimationFrame(() => {
    modal.classList.add('visible');
    try {
      document.dispatchEvent(new CustomEvent('ce-account:opened', { detail: { tab: activeTab } }));
    } catch (error) {
      console.warn('Nie udało się wysłać zdarzenia otwarcia panelu konta.', error);
    }
  });
}

function closeAccountModal() {
  const modal = document.getElementById('accountModal');
  if (!modal || modal.hidden) {
    return false;
  }

  modal.classList.remove('visible');
  modal.hidden = true;
  setAccountMessage('');
  unlockBodyScroll();

  try {
    const activeTab =
      modal.querySelector('[data-account-tab].is-active')?.dataset.accountTab || 'stats';
    document.dispatchEvent(new CustomEvent('ce-account:closed', { detail: { tab: activeTab } }));
  } catch (error) {
    console.warn('Nie udało się wysłać zdarzenia zamknięcia panelu konta.', error);
  }

  const passwordForm = document.getElementById('accountPasswordForm');
  if (passwordForm instanceof HTMLFormElement) {
    passwordForm.reset();
  }

  return true;
}

function openAuthModal(tabId = 'login') {
  const controller = window.__authModalController;
  if (!controller) return;
  controller.setActiveTab?.(tabId, { focus: controller.isOpen() });
  if (controller.isOpen()) {
    return;
  }
  setAuthMessage('');
  controller.open(tabId);
}

window.openAuthModal = openAuthModal;

function closeAuthModal(options = {}) {
  const { activateGuest = false, guestMessage, reason = 'programmatic' } = options;
  const controller = window.__authModalController;
  if (!controller) {
    if (activateGuest) {
      startGuestSession({ message: guestMessage });
    }
    return false;
  }

  if (!controller.isOpen()) {
    if (activateGuest) {
      startGuestSession({ message: guestMessage });
    }
    return false;
  }

  const closed = controller.close({ reason });
  if (!closed) {
    return false;
  }

  setAuthMessage('');
  if (activateGuest) {
    startGuestSession({ message: guestMessage });
  }
  return true;
}

window.closeAuthModal = closeAuthModal;

async function handleAccountPasswordSubmit(event) {
  event.preventDefault();

  if (!currentSupabaseUser) {
    showAccountError('account.error.password.loginRequired', 'Zaloguj się, aby zmienić hasło.');
    return;
  }

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const currentInput = form.querySelector('#accountCurrentPassword');
  const newInput = form.querySelector('#accountNewPassword');
  const confirmInput = form.querySelector('#accountConfirmPassword');

  if (
    !(currentInput instanceof HTMLInputElement) ||
    !(newInput instanceof HTMLInputElement) ||
    !(confirmInput instanceof HTMLInputElement)
  ) {
    return;
  }

  const currentPassword = currentInput.value;
  const newPassword = newInput.value;
  const confirmPassword = confirmInput.value;

  if (!currentPassword || !newPassword) {
    showAccountError('account.error.password.missingFields', 'Uzupełnij wszystkie pola hasła.');
    return;
  }

  if (newPassword.length < 8) {
    showAccountError('account.error.password.tooShort', 'Hasło powinno mieć co najmniej 8 znaków.');
    return;
  }

  if (newPassword !== confirmPassword) {
    showAccountError('account.error.password.mismatch', 'Nowe hasła nie są identyczne.');
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    showAccountError('account.error.password.loginRequired', 'Połączenie z logowaniem jest chwilowo niedostępne.');
    return;
  }

  const userEmail = currentSupabaseUser.email;
  if (!userEmail) {
    showAccountError('account.error.currentMissing', 'Nie udało się pobrać informacji o koncie.');
    return;
  }

  const { error: reauthError } = await client.auth.signInWithPassword({
    email: userEmail,
    password: currentPassword,
  });

  if (reauthError) {
    showAccountError('account.error.password.invalidCurrent', 'Obecne hasło jest nieprawidłowe.');
    return;
  }

  const { error: updateError } = await client.auth.updateUser({ password: newPassword });
  if (updateError) {
    showAccountError('account.error.password.updateFailed', updateError.message || 'Nie udało się zmienić hasła. Spróbuj ponownie.');
    return;
  }

  form.reset();
  showAccountSuccess('account.success.passwordUpdated', 'Hasło zostało pomyślnie zaktualizowane.');
}

async function handleAccountResetProgress(event) {
  // Zatrzymaj propagację eventu
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const confirmed = window.confirm(
    translate(
      'account.confirm.reset',
      'Czy na pewno chcesz zresetować postęp? Tej operacji nie można cofnąć.',
    ),
  );

  if (!confirmed) {
    return;
  }

  // NAJPIERW resetuj w Supabase (jeśli użytkownik zalogowany)
  try {
    const client = getSupabaseClient();
    
    if (client) {
      // Pobierz aktualnie zalogowanego użytkownika
      const { data: { user }, error: userError } = await client.auth.getUser();
      
      if (user?.id) {
        const { data, error } = await client
          .from('profiles')
          .update({
            xp: 0,
            // level jest obliczany automatycznie z xp - nie aktualizuj bezpośrednio
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .select();

        if (error) {
          console.error('Błąd resetowania profilu w Supabase:', error);
          alert(`Nie udało się zresetować w Supabase:\n${error.message}\nKod: ${error.code}`);
          showAccountError(
            'account.error.resetFailed',
            'Nie udało się zresetować postępu na serwerze.'
          );
          return; // Przerwij jeśli Supabase failed
        }
        
        // Odśwież dane z Supabase
        await syncProgressFromSupabase({ force: true });
      }
    }
  } catch (error) {
    console.error('Błąd podczas resetu w Supabase:', error);
    // Nie przerywamy - kontynuujemy z resetem lokalnym
  }

  // POTEM resetuj dane lokalne
  if (currentUserKey) {
    const account = getAccount(currentUserKey);
    if (!account) {
      showAccountError('account.error.currentMissing', 'Nie udało się odnaleźć bieżącego konta.');
      return;
    }

    account.progress = getDefaultProgress();
    persistAccounts();
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Odśwież UI
  loadProgress();
  renderAllForCurrentState();
  updateAuthUI();
  
  showAccountSuccess(
    'account.success.progressReset',
    'Postęp został zresetowany. Powodzenia w nowej przygodzie!',
  );
  setLevelStatus(
    translate('account.status.progressRestart', 'Rozpoczynasz grę od nowa – powodzenia!'),
    6000,
  );
}

function updateAuthUI() {
  const userMenu = document.getElementById('userMenu');
  const greeting = document.getElementById('userGreeting');
  const accountSettingsBtn = document.getElementById('accountSettingsBtn');
  const logoutBtn = document.querySelector('[data-auth="logout"]');
  const passwordForm = document.getElementById('accountPasswordForm');
  const guestPasswordNote = document.getElementById('accountGuestPasswordNote');
  const authStatusBadge = document.getElementById('authStatusBadge');
  const state = window.CE_STATE || {};
  const sessionUser = state.session?.user || null;
  const isLoggedIn = Boolean(currentSupabaseUser || sessionUser);
  const displayName = isLoggedIn ? getCurrentDisplayName() : '';
  const authState = state.status || getDocumentAuthState();

  if (logoutBtn instanceof HTMLElement) {
    logoutBtn.hidden = !isLoggedIn;
  }

  document.querySelectorAll('[data-auth-visible]').forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const mode = element.dataset.authVisible || '';
    if (mode === 'signed-in' || mode === 'authenticated') {
      element.hidden = !isLoggedIn;
      if (isLoggedIn) {
        element.removeAttribute('aria-hidden');
      } else {
        element.setAttribute('aria-hidden', 'true');
      }
    } else if (mode === 'guest' || mode === 'signed-out') {
      element.hidden = isLoggedIn;
      if (isLoggedIn) {
        element.setAttribute('aria-hidden', 'true');
      } else {
        element.removeAttribute('aria-hidden');
      }
    }
  });

  if (authStatusBadge) {
    let statusMessage = '';
    if (authState === 'loading') {
      statusMessage = translate(
        'auth.status.badge.loading',
        'Łączenie z zapisem chmurowym…',
      );
    } else if (authState === 'authenticated') {
      statusMessage = translate(
        'auth.status.badge.authenticated',
        'Zapis w chmurze aktywny',
      );
    } else {
      statusMessage = translate(
        'auth.status.badge.guest',
        'Tryb gościa – postęp tylko lokalny',
      );
    }

    authStatusBadge.textContent = statusMessage;
    authStatusBadge.dataset.state = authState;
  }

  if (userMenu) {
    userMenu.hidden = false;
  }

  if (accountSettingsBtn) {
    accountSettingsBtn.hidden = false;
  }

  if (greeting) {
    const fallbackName = translate('auth.status.playerFallback', 'użytkownik');
    const username = displayName || fallbackName;
    greeting.textContent = isLoggedIn
      ? translate('auth.status.loggedInAs', 'Grasz jako {{username}}', { username })
      : translate('auth.guest.banner', 'Grasz jako gość');
  }

  if (
    passwordForm instanceof HTMLFormElement &&
    passwordForm.dataset?.ceAccountHandler !== 'enhanced'
  ) {
    passwordForm.classList.toggle('is-disabled', !isLoggedIn);
    passwordForm.querySelectorAll('input, button').forEach((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLButtonElement) {
        element.disabled = !isLoggedIn;
      }
    });
  }

  if (guestPasswordNote && guestPasswordNote.dataset?.ceAccountEnhanced !== 'true') {
    guestPasswordNote.hidden = isLoggedIn;
  }

  renderNotificationsUI();
  renderAccountStats('auth-ui');
}

if (typeof window !== 'undefined') {
  const appApi = (window.CE_APP = window.CE_APP || {});
  appApi.refreshAuthUi = () => {
    try {
      updateAuthUI();
    } catch (error) {
      console.warn('[app] Nie udało się odświeżyć interfejsu konta.', error);
    }
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('ce-auth:state', () => {
    try {
      updateAuthUI();
    } catch (error) {
      console.warn(
        '[app] Nie udało się zaktualizować interfejsu po zmianie stanu konta.',
        error,
      );
    }
  });
}

function setBusy(form, busy, msg = '') {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton instanceof HTMLButtonElement || submitButton instanceof HTMLInputElement) {
    submitButton.disabled = !!busy;
  }

  const ariaTarget =
    form.querySelector('[data-auth="message"]') || document.getElementById('authMessage');
  const message = typeof msg === 'string' && msg ? msg : busy ? 'Łączenie z logowaniem…' : '';

  if (ariaTarget) {
    ariaTarget.textContent = message;
    try {
      if (message) {
        ariaTarget.setAttribute('aria-live', 'assertive');
        if (ariaTarget.dataset) {
          ariaTarget.dataset.tone = busy ? 'info' : ariaTarget.dataset.tone || 'info';
        }
      } else {
        ariaTarget.setAttribute('aria-live', 'polite');
        if (ariaTarget.dataset) {
          delete ariaTarget.dataset.tone;
        }
      }
    } catch {
      // ignore attribute errors
    }
  }
}

function showErr(msg) {
  const message = typeof msg === 'string' ? msg : String(msg ?? '');
  if (!message) {
    return;
  }

  const toast = window.Toast?.show;
  if (typeof toast === 'function') {
    try {
      toast.call(window.Toast, message, 'error');
    } catch (error) {
      console.warn('[toast:error]', error);
    }
  } else if (typeof window.alert === 'function') {
    window.alert(message);
  }

  const ariaTarget = document.getElementById('authMessage');
  if (ariaTarget) {
    ariaTarget.textContent = message;
    ariaTarget.setAttribute('aria-live', 'assertive');
    if (ariaTarget.dataset) {
      ariaTarget.dataset.tone = 'error';
    }
  }
}

function showOk(msg) {
  const message = typeof msg === 'string' ? msg : String(msg ?? '');
  if (!message) {
    return;
  }

  const toast = window.Toast?.show;
  if (typeof toast === 'function') {
    try {
      toast.call(window.Toast, message, 'success');
    } catch (error) {
      console.warn('[toast:success]', error);
    }
  }

  const ariaTarget = document.getElementById('authMessage');
  if (ariaTarget) {
    ariaTarget.textContent = message;
    ariaTarget.setAttribute('aria-live', 'polite');
    if (ariaTarget.dataset) {
      ariaTarget.dataset.tone = 'success';
    }
  }
}

function wireAuthForms() {
  const CE = window.CE_AUTH;
  const SB = window.getSupabase?.();

  const fallbackLogin = document.getElementById('form-login');
  if (fallbackLogin instanceof HTMLFormElement && !fallbackLogin.dataset.auth) {
    fallbackLogin.dataset.auth = 'login';
  }

  const fallbackRegister = document.getElementById('form-register');
  if (fallbackRegister instanceof HTMLFormElement && !fallbackRegister.dataset.auth) {
    fallbackRegister.dataset.auth = 'register';
  }

  const loginForms = document.querySelectorAll('form[data-auth="login"]');
  const regForms = document.querySelectorAll('form[data-auth="register"]');

  loginForms.forEach((form) => {
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    if (form.dataset.authWired === 'true') {
      return;
    }

    form.dataset.authWired = 'true';
    form.dataset.ceAuthHandler = form.dataset.ceAuthHandler || 'supabase';

    let ariaTarget = form.querySelector('[data-auth="message"]');
    if (!ariaTarget) {
      ariaTarget = document.createElement('div');
      ariaTarget.dataset.auth = 'message';
      ariaTarget.setAttribute('aria-live', 'polite');
      form.append(ariaTarget);
    }

    form.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();
        const email = form.querySelector('input[type="email"]')?.value?.trim() || '';
        const pass = form.querySelector('input[type="password"]')?.value || '';
        if (!email || !pass) {
          const message = 'Podaj e-mail i hasło';
          showErr(message);
          setBusy(form, false, message);
          return;
        }

        setBusy(form, true);
        try {
          let error = null;
          if (CE?.signIn) {
            ({ error } = await CE.signIn(email, pass));
          } else if (SB?.auth?.signInWithPassword) {
            ({ error } = await SB.auth.signInWithPassword({ email, password: pass }));
          } else {
            error = new Error('Brak klienta Supabase');
          }
          if (error) {
            throw error;
          }

          const successMessage = 'Zalogowano';
          showOk(successMessage);
          setBusy(form, false, successMessage);
          location.replace('/');
        } catch (err) {
          console.error('[login failed]', err);
          const message = 'Nie udało się zalogować. ' + (err?.message || 'Spróbuj ponownie.');
          showErr(message);
          setBusy(form, false, message);
        } finally {
          setTimeout(() => setBusy(form, false, ''), 6000);
        }
      },
      { once: false },
    );
  });

  regForms.forEach((form) => {
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    if (form.dataset.authWired === 'true') {
      return;
    }

    form.dataset.authWired = 'true';
    form.dataset.ceAuthHandler = form.dataset.ceAuthHandler || 'supabase';

    let ariaTarget = form.querySelector('[data-auth="message"]');
    if (!ariaTarget) {
      ariaTarget = document.createElement('div');
      ariaTarget.dataset.auth = 'message';
      ariaTarget.setAttribute('aria-live', 'polite');
      form.append(ariaTarget);
    }

    form.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();
        const email = form.querySelector('input[type="email"]')?.value?.trim() || '';
        const pass = form.querySelector('input[type="password"]')?.value || '';
        const name = form.querySelector('[name="firstName"]')?.value?.trim() || '';
        if (!email || !pass) {
          const message = 'Uzupełnij e-mail i hasło';
          showErr(message);
          setBusy(form, false, message);
          return;
        }

        setBusy(form, true);
        try {
          let error = null;
          if (CE?.signUp) {
            ({ error } = await CE.signUp(email, pass, name, 'https://cypruseye.com/auth/'));
          } else if (SB?.auth?.signUp) {
            ({ error } = await SB.auth.signUp({
              email,
              password: pass,
              options: {
                data: { name },
                emailRedirectTo: 'https://cypruseye.com/auth/',
              },
            }));
          } else {
            error = new Error('Brak klienta Supabase');
          }
          if (error) {
            throw error;
          }

          const successMessage = 'E-mail potwierdzający wysłany';
          showOk(successMessage);
          setBusy(form, false, successMessage);
        } catch (err) {
          console.error('[signup failed]', err);
          const message = 'Rejestracja nie powiodła się. ' + (err?.message || 'Spróbuj ponownie.');
          showErr(message);
          setBusy(form, false, message);
        } finally {
          setTimeout(() => setBusy(form, false, ''), 6000);
        }
      },
      { once: false },
    );
  });
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.getSupabase?.()) {
      wireAuthForms();
    } else {
      setTimeout(wireAuthForms, 300);
    }
  } catch (error) {
    console.error('[auth forms] failed to initialize', error);
  }

  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.addEventListener('auth:opened', () => {
      try {
        wireAuthForms();
      } catch (error) {
        console.error('[auth forms] failed to rewire after modal open', error);
      }
    });
  }
});

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;

  const emailInput = form.querySelector('#loginEmail');
  const passwordInput = form.querySelector('#loginPassword');
  if (!(emailInput instanceof HTMLInputElement) || !(passwordInput instanceof HTMLInputElement)) {
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const resetButton = document.getElementById('loginForgotPassword');

  const emailOrUsername = emailInput.value.trim();
  const password = passwordInput.value;

  if (!emailOrUsername || !password) {
    showAuthError('auth.error.missingCredentials', 'Podaj email/nazwę użytkownika i hasło, aby się zalogować.');
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    showAuthError('auth.error.unavailable', 'Logowanie jest chwilowo niedostępne. Spróbuj ponownie później.');
    return;
  }

  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true;
    submitButton.dataset.loading = 'true';
    submitButton.setAttribute('aria-busy', 'true');
  }

  if (resetButton instanceof HTMLButtonElement) {
    resetButton.disabled = true;
  }

  let loginSucceeded = false;
  setDocumentAuthState('loading');
  updateAuthUI();
  setAuthMessage(translate('auth.status.loggingIn', 'Łączenie z kontem…'), 'info');

  try {
    // Determine if input is email or username
    const isEmail = emailOrUsername.includes('@');
    let loginEmail = emailOrUsername;

    // If username, look up the email from profiles table
    if (!isEmail) {
      const { data: profile, error: lookupError } = await client
        .from('profiles')
        .select('email')
        .ilike('username', emailOrUsername)
        .maybeSingle();

      if (lookupError && lookupError.code !== 'PGRST116') {
        throw new Error('Nie udało się sprawdzić nazwy użytkownika.');
      }

      if (!profile || !profile.email) {
        showAuthError('auth.error.accountNotFound', 'Nie znaleziono użytkownika o podanej nazwie.');
        return;
      }

      loginEmail = profile.email;
    }

    const { error } = await client.auth.signInWithPassword({ email: loginEmail, password });
    if (error) {
      throw error;
    }

    clearAuthForms();
    setAuthMessage(translate('auth.status.welcomeBack', 'Witaj ponownie!'), 'success');
    loginSucceeded = true;
  } catch (error) {
    const errorMessage = error && typeof error.message === 'string' ? error.message : '';
    showAuthError(
      'auth.error.invalidPassword',
      errorMessage || 'Nie udało się zalogować. Spróbuj ponownie.',
    );
  } finally {
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = false;
      submitButton.removeAttribute('data-loading');
      submitButton.removeAttribute('aria-busy');
    }

    if (resetButton instanceof HTMLButtonElement) {
      resetButton.disabled = false;
    }

    if (!loginSucceeded && !currentSupabaseUser) {
      setDocumentAuthState('guest');
      updateAuthUI();
    }
  }
}

async function handlePasswordResetRequest(event) {
  event.preventDefault();

  const button = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  const form = document.getElementById('form-login');
  const emailInput = form?.querySelector('#loginEmail');

  if (!(emailInput instanceof HTMLInputElement)) {
    return;
  }

  const email = emailInput.value.trim();
  if (!email) {
    showAuthError(
      'auth.error.resetMissingEmail',
      'Podaj adres e-mail, aby wysłać link do resetu hasła.',
    );
    emailInput.focus();
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    showAuthError(
      'auth.error.unavailable',
      'Reset hasła jest chwilowo niedostępny. Spróbuj ponownie później.',
    );
    return;
  }

  if (button) {
    button.disabled = true;
    button.dataset.loading = 'true';
    button.setAttribute('aria-busy', 'true');
  }

  setAuthMessage(translate('auth.status.resetting', 'Wysyłamy e-mail resetujący…'), 'info');

  try {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${AUTH_RESET_REDIRECT_PATH}`,
    });

    if (error) {
      throw error;
    }

    setAuthMessage(
      translate('auth.reset.emailSent', 'Sprawdź skrzynkę – wysłaliśmy link do resetu hasła.'),
      'success',
    );
  } catch (error) {
    const errorMessage = error && typeof error.message === 'string' ? error.message : '';
    showAuthError(
      'auth.error.resetFailed',
      errorMessage || 'Nie udało się wysłać wiadomości resetującej. Spróbuj ponownie.',
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute('data-loading');
      button.removeAttribute('aria-busy');
    }
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;

  const firstNameInput = form.querySelector('#registerFirstName');
  const usernameInput = form.querySelector('#registerUsername');
  const emailInput = form.querySelector('#registerEmail');
  const passwordInput = form.querySelector('#registerPassword');
  const confirmInput = form.querySelector('#registerPasswordConfirm');

  if (
    !(firstNameInput instanceof HTMLInputElement) ||
    !(usernameInput instanceof HTMLInputElement) ||
    !(emailInput instanceof HTMLInputElement) ||
    !(passwordInput instanceof HTMLInputElement) ||
    !(confirmInput instanceof HTMLInputElement)
  ) {
    return;
  }

  const firstName = firstNameInput.value.trim();
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmInput.value;

  if (!firstName) {
    showAuthError('auth.error.registration.missingFirstName', 'Podaj imię, aby utworzyć konto.');
    return;
  }

  if (!username) {
    showAuthError('auth.error.registration.missingUsername', 'Podaj nazwę użytkownika.');
    return;
  }

  if (username.length < 3 || username.length > 20) {
    showAuthError('auth.error.username.invalidLength', 'Nazwa użytkownika musi mieć od 3 do 20 znaków.');
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showAuthError('auth.error.username.invalidFormat', 'Nazwa użytkownika może zawierać tylko litery, cyfry i znak podkreślenia.');
    return;
  }

  if (!email || !password) {
    showAuthError('auth.error.registration.missingCredentials', 'Podaj adres e-mail i hasło, aby utworzyć konto.');
    return;
  }

  if (password.length < 8) {
    showAuthError('auth.error.password.tooShort', 'Hasło powinno mieć co najmniej 8 znaków.');
    return;
  }

  if (password !== confirmPassword) {
    showAuthError('auth.error.password.mismatch', 'Hasła nie są identyczne.');
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    showAuthError('auth.error.unavailable', 'Rejestracja jest chwilowo niedostępna. Spróbuj ponownie później.');
    return;
  }

  // Check if username is already taken
  try {
    const { data: existingUser, error: checkError } = await client
      .from('profiles')
      .select('username')
      .ilike('username', username)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      showAuthError('auth.error.checkFailed', 'Nie udało się sprawdzić nazwy użytkownika. Spróbuj ponownie.');
      return;
    }

    if (existingUser) {
      showAuthError('auth.error.usernameTaken', 'Ta nazwa użytkownika jest już zajęta. Wybierz inną.');
      return;
    }
  } catch (error) {
    showAuthError('auth.error.checkFailed', 'Nie udało się sprawdzić nazwy użytkownika. Spróbuj ponownie.');
    return;
  }

  const origin = window.location.origin;
  const { error } = await client.auth.signUp({
    email,
    password,
    options: { 
      emailRedirectTo: `${origin}/auth/callback/`,
      data: {
        name: firstName,
        username: username
      }
    },
  });

  if (error) {
    showAuthError('auth.error.registration.failed', error.message || 'Nie udało się utworzyć konta.');
    return;
  }

  clearAuthForms();
  setAuthMessage('Konto utworzone! Sprawdź skrzynkę e-mail, aby potwierdzić adres.', 'success');
}

function startGuestSession(options = {}) {
  const { message, skipMessage = false } = options;
  const previousUser = currentUserKey;
  setDocumentAuthState('guest');
  currentSupabaseUser = null;
  currentUserKey = null;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  closeAccountModal();
  closeNotificationsPanel();
  loadProgress();
  renderAllForCurrentState();
  updateAuthUI();
  setAuthMessage('');

  let finalMessage = message;
  if (finalMessage === undefined && !skipMessage) {
    finalMessage = previousUser
      ? translate('auth.guest.switch', 'Wylogowano – grasz teraz jako gość.')
      : getGuestStatusMessage();
  }

  if (finalMessage) {
    setLevelStatus(finalMessage, 6000);
  }
}

function setupSupabaseAuth(client) {
  if (!client) {
    return false;
  }

  if (supabaseAuthInitialized) {
    return true;
  }

  supabaseAuthInitialized = true;

  if (supabaseAuthSubscription && typeof supabaseAuthSubscription.unsubscribe === 'function') {
    supabaseAuthSubscription.unsubscribe();
  }
  supabaseAuthSubscription = null;

  const authApi = window.CE_AUTH || {};
  const persistedSession = authApi.readPersistedSession?.() || null;

  const handleAuthEvent = (event, session) => {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      void applySupabaseUser(null, { reason: 'sign-out' });
      return;
    }

    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      void applySupabaseUser(session?.user, { reason: event });
    }
  };

  try {
    const { data } = client.auth.onAuthStateChange((event, session) => {
      handleAuthEvent(event, session);
    });
    if (data?.subscription) {
      supabaseAuthSubscription = data.subscription;
    }
  } catch (error) {
    console.error('Nie udało się zarejestrować nasłuchiwania Supabase auth:', error);
  }

  client.auth
    .getUser()
    .then(({ data }) => {
      if (data?.user) {
        void applySupabaseUser(data.user, { reason: 'init' });
        return;
      }

      if (persistedSession?.user && !currentSupabaseUser) {
        void applySupabaseUser(persistedSession.user, { reason: 'persisted' });
      }
    })
    .catch((error) => {
      console.warn('Błąd podczas odczytu użytkownika Supabase:', error);
      if (persistedSession?.user && !currentSupabaseUser) {
        void applySupabaseUser(persistedSession.user, { reason: 'persisted' });
      }
    });

  return true;
}

function handleSupabaseReady(event) {
  const detail = event?.detail;
  if (detail && detail.enabled === false) {
    document.removeEventListener('ce-auth-ready', handleSupabaseReady);
    supabaseReadyListenerAttached = false;
    return;
  }

  if (setupSupabaseAuth(getSupabaseClient())) {
    document.removeEventListener('ce-auth-ready', handleSupabaseReady);
    supabaseReadyListenerAttached = false;
  }
}

async function handleLogout() {
  const client = getSupabaseClient();
  if (client && currentSupabaseUser) {
    try {
      supabaseSignOutInProgress = true;
      setDocumentAuthState('loading');
      updateAuthUI();
      const { error } = await client.auth.signOut();
      if (error) {
        throw error;
      }
      window.CE_AUTH?.persistSession?.(null);
    } catch (error) {
      supabaseSignOutInProgress = false;
      setDocumentAuthState('authenticated');
      updateAuthUI();
      showAccountError('auth.error.logoutFailed', error.message || 'Nie udało się wylogować. Spróbuj ponownie.');
    }
    return;
  }

  startGuestSession({
    message: translate('auth.guest.switch', 'Wylogowano – grasz teraz jako gość.'),
  });
  window.CE_AUTH?.persistSession?.(null);
}

function initializeAuth() {
  accounts = loadAccountsFromStorage();

  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const loginForgotPasswordBtn = document.getElementById('loginForgotPassword');
  const authOpenBtn = document.getElementById('openAuthModal');
  const logoutBtn = document.querySelector('[data-auth="logout"]');
  const accountSettingsBtn = document.getElementById('accountSettingsBtn');
  const accountModal = document.getElementById('accountModal');
  const accountCloseBtn = document.getElementById('accountClose');
  const accountPasswordForm = document.getElementById('accountPasswordForm');
  const accountResetBtn = document.getElementById('accountResetProgress');
  const guestPlayButton = document.getElementById('btn-guest');
  const loginHandledExternally =
    loginForm instanceof HTMLFormElement && loginForm.dataset.ceAuthHandler === 'supabase';
  const registerHandledExternally =
    registerForm instanceof HTMLFormElement && registerForm.dataset.ceAuthHandler === 'supabase';
  const guestHandledExternally =
    guestPlayButton instanceof HTMLButtonElement && guestPlayButton.dataset.ceAuthHandler === 'supabase';
  const enhancedAccountModal = accountModal?.dataset?.ceAccountEnhanced === 'true';

  setDocumentAuthState('loading');

  if (!loginHandledExternally) {
    loginForm?.addEventListener('submit', handleLoginSubmit);
  }
  if (!registerHandledExternally) {
    registerForm?.addEventListener('submit', handleRegisterSubmit);
  }
  loginForgotPasswordBtn?.addEventListener('click', handlePasswordResetRequest);

  authOpenBtn?.addEventListener('click', () => {
    clearAuthForms();
  });

  if (logoutBtn instanceof HTMLElement) {
    logoutBtn.addEventListener('click', () => {
      void handleLogout();
    });
  }

  accountSettingsBtn?.addEventListener('click', () => {
    openAccountModal('stats');
  });

  accountCloseBtn?.addEventListener('click', () => {
    closeAccountModal();
  });

  if (accountModal) {
    accountModal.addEventListener('click', (event) => {
      if (event.target === accountModal) {
        closeAccountModal();
      }
    });
  }

  if (
    accountPasswordForm instanceof HTMLFormElement &&
    accountPasswordForm.dataset?.ceAccountHandler !== 'enhanced'
  ) {
    accountPasswordForm.addEventListener('submit', handleAccountPasswordSubmit);
  }
  accountResetBtn?.addEventListener('click', handleAccountResetProgress);
  
  // Avatar upload/remove handling
  const avatarUploadInput = document.querySelector('#avatarUpload');
  const avatarUploadBtn = document.querySelector('#btnUploadAvatar');
  const avatarRemoveBtn = document.querySelector('#btnRemoveAvatar');
  
  if (avatarUploadBtn && avatarUploadInput) {
    avatarUploadBtn.addEventListener('click', () => {
      avatarUploadInput.click();
    });
    
    avatarUploadInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      
      const client = getSupabaseClient();
      if (!client || !currentSupabaseUser) {
        setAccountMessage('Musisz być zalogowany aby zmienić avatar.', 'error');
        return;
      }
      
      // Walidacja
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        setAccountMessage('Plik jest za duży (maksymalnie 2MB)', 'error');
        avatarUploadInput.value = '';
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setAccountMessage('Tylko pliki graficzne są dozwolone', 'error');
        avatarUploadInput.value = '';
        return;
      }
      
      // Upload
      setAccountMessage('Przesyłanie zdjęcia...', 'info');
      avatarUploadBtn.disabled = true;
      
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${currentSupabaseUser.id}/avatar-${Date.now()}.${fileExt}`;
        
        // Usuń stary avatar
        try {
          const { data: files } = await client.storage.from('avatars').list(currentSupabaseUser.id);
          if (files && files.length > 0) {
            const filesToRemove = files.map((f) => `${currentSupabaseUser.id}/${f.name}`);
            await client.storage.from('avatars').remove(filesToRemove);
          }
        } catch (err) {
          console.warn('Nie udało się usunąć starego avatara:', err);
        }
        
        // Upload
        const { data, error } = await client.storage.from('avatars').upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });
        
        if (error) {
          console.error('Upload error:', error);
          if (error.message?.includes('Bucket not found') || error.statusCode === 404) {
            throw new Error('Bucket "avatars" nie istnieje. Sprawdź AVATAR_SETUP.md');
          }
          if (error.message?.includes('permission') || error.statusCode === 403) {
            throw new Error('Brak uprawnień. Sprawdź RLS policies w AVATAR_SETUP.md');
          }
          throw new Error(error.message || 'Upload nie powiódł się');
        }
        
        // Pobierz URL
        const { data: { publicUrl } } = client.storage.from('avatars').getPublicUrl(fileName);
        
        // Update profil
        const { error: updateError } = await client
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', currentSupabaseUser.id);
          
        if (updateError) {
          throw updateError;
        }
        
        // Update UI
        const avatarImg = document.querySelector('#profileAvatarImg');
        if (avatarImg) {
          avatarImg.src = publicUrl;
        }
        
        if (avatarRemoveBtn) {
          avatarRemoveBtn.hidden = false;
        }
        
        setAccountMessage('Zdjęcie profilowe zostało zaktualizowane.', 'success');
      } catch (error) {
        console.error('Avatar upload error:', error);
        setAccountMessage(`Nie udało się: ${error?.message || 'spróbuj ponownie'}`, 'error');
      } finally {
        avatarUploadBtn.disabled = false;
        avatarUploadInput.value = '';
      }
    });
  }
  
  if (avatarRemoveBtn) {
    avatarRemoveBtn.addEventListener('click', async () => {
      if (!confirm('Czy na pewno chcesz usunąć zdjęcie profilowe?')) {
        return;
      }
      
      const client = getSupabaseClient();
      if (!client || !currentSupabaseUser) {
        setAccountMessage('Musisz być zalogowany.', 'error');
        return;
      }
      
      setAccountMessage('Usuwanie zdjęcia...', 'info');
      avatarRemoveBtn.disabled = true;
      
      try {
        // Usuń z storage
        const { data: files } = await client.storage.from('avatars').list(currentSupabaseUser.id);
        if (files && files.length > 0) {
          const filesToRemove = files.map((f) => `${currentSupabaseUser.id}/${f.name}`);
          await client.storage.from('avatars').remove(filesToRemove);
        }
        
        // Update profil
        await client
          .from('profiles')
          .update({ avatar_url: null })
          .eq('id', currentSupabaseUser.id);
        
        // Update UI
        const avatarImg = document.querySelector('#profileAvatarImg');
        if (avatarImg) {
          avatarImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e0e7ff'/%3E%3Cpath d='M50 45c8.284 0 15-6.716 15-15s-6.716-15-15-15-15 6.716-15 15 6.716 15 15 15zM20 75c0-16.569 13.431-30 30-30s30 13.431 30 30v10H20V75z' fill='%233b82f6'/%3E%3C/svg%3E";
        }
        
        avatarRemoveBtn.hidden = true;
        setAccountMessage('Zdjęcie profilowe zostało usunięte.', 'success');
      } catch (error) {
        console.error('Avatar remove error:', error);
        setAccountMessage(`Nie udało się: ${error?.message || 'spróbuj ponownie'}`, 'error');
      } finally {
        avatarRemoveBtn.disabled = false;
      }
    });
  }
  
  document.querySelectorAll('[data-account-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.accountTab || 'stats';
      setActiveAccountTab(target);
      if (enhancedAccountModal) {
        return;
      }
      if (target === 'security' && !currentSupabaseUser) {
        setAccountMessage(
          translate('account.error.password.loginRequired', 'Zaloguj się, aby zmienić hasło.'),
          'info',
        );
      } else {
        setAccountMessage('');
      }
    });
  });
  if (!guestHandledExternally) {
    guestPlayButton?.addEventListener('click', () => {
      startGuestSession({});
      closeAuthModal({ reason: 'guest' });
    });
  }
  setActiveAccountTab('stats');
  updateAuthUI();

  const supabaseAvailable = setupSupabaseAuth(getSupabaseClient());
  if (!supabaseAvailable) {
    if (!supabaseReadyListenerAttached) {
      supabaseReadyListenerAttached = true;
      document.addEventListener('ce-auth-ready', handleSupabaseReady);
    }

    const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession && getAccount(savedSession)) {
      currentUserKey = savedSession;
    } else {
      currentUserKey = null;
    }

    startGuestSession({ skipMessage: true });
  }
}

function loadLeafletStylesheet() {
  // Sprawdź czy Leaflet CSS już jest załadowany (np. z HTML)
  const existingLeaflet = document.querySelector('link[href*="leaflet"]');
  if (existingLeaflet || document.querySelector('link[data-leaflet-stylesheet-loaded]')) {
    console.log('✅ Leaflet CSS already loaded');
    return Promise.resolve();
  }

  if (!leafletStylesheetPromise) {
    leafletStylesheetPromise = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_STYLESHEET_URL;
      link.crossOrigin = '';
      link.dataset.leafletStylesheetLoaded = 'true';
      link.addEventListener('load', () => {
        console.log('✅ Leaflet CSS loaded dynamically');
        resolve();
      });
      link.addEventListener('error', () => reject(new Error('Leaflet stylesheet failed to load.')));
      document.head.append(link);
    });
  }

  return leafletStylesheetPromise;
}

function loadLeafletScript() {
  // Sprawdź czy Leaflet JS już jest załadowany
  if (typeof window.L !== 'undefined') {
    console.log('✅ Leaflet JS already loaded');
    return Promise.resolve();
  }

  if (!leafletScriptPromise) {
    leafletScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LEAFLET_SCRIPT_URL;
      script.async = true;
      script.crossOrigin = '';
      script.dataset.leafletScript = 'true';
      script.addEventListener('load', () => {
        script.dataset.leafletScriptLoaded = 'true';
        console.log('✅ Leaflet JS loaded dynamically');
        resolve();
      });
      script.addEventListener('error', () => {
        reject(new Error('Leaflet script failed to load.'));
      });
      document.head.append(script);
    });
  }

  return leafletScriptPromise;
}

function applyLeafletEnhancements() {
  if (leafletEnhancementsApplied || typeof window.L === 'undefined' || !window.L?.Marker) {
    return;
  }

  const { L } = window;

  L.Marker.addInitHook(function initBouncingOptions() {
    this.options.bouncingOptions = this.options.bouncingOptions || {
      bounceHeight: 16,
      bounceSpeed: 48,
    };
  });

  L.Marker.include({
    setBouncingOptions(options) {
      this.options.bouncingOptions = { ...this.options.bouncingOptions, ...options };
      return this;
    },
    bounce(times = 1) {
      const marker = this;
      const original = marker.getLatLng();
      const { bounceHeight, bounceSpeed } = marker.options.bouncingOptions;
      const latOffset = bounceHeight ? bounceHeight / 100000 : 0.0001;
      let count = 0;

      function step() {
        count += 1;
        marker.setLatLng([original.lat + latOffset, original.lng]);
        setTimeout(() => marker.setLatLng(original), bounceSpeed);
        if (count < times) {
          setTimeout(step, bounceSpeed * 2);
        }
      }

      step();
      return marker;
    },
  });

  leafletEnhancementsApplied = true;
}

function loadLeafletResources() {
  return Promise.all([loadLeafletStylesheet(), loadLeafletScript()]).then(() => {
    applyLeafletEnhancements();
  });
}

function setDefaultLocation() {
  if (!map) {
    return;
  }

  hasCenteredOnPlayer = false;
  map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
}

function initMap() {
  const mapElement = document.getElementById('map');
  if (map || !mapElement) {
    return;
  }

  map = L.map(mapElement).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> współtwórcy',
  }).addTo(map);

  syncMarkers();
  startPlayerLocationTracking();
}

function setupMapLazyLoading() {
  const mapElement = document.getElementById('map');
  if (!mapElement || mapLazyLoadStarted) {
    return;
  }

  mapLazyLoadStarted = true;

  const loadAndInitMap = () => {
    loadLeafletResources()
      .then(() => {
        initMap();
        if (state.selected) {
          focusPlace(state.selected.id);
        }
      })
      .catch((error) => {
        console.error('Nie udało się wczytać mapy Leaflet.', error);
      });
  };

  // WYŁĄCZONO LAZY LOADING - zawsze ładuj mapę od razu
  // IntersectionObserver może nie wykryć elementu jeśli nie jest widoczny
  console.log('🗺️ Loading map immediately (lazy loading disabled)');
  loadAndInitMap();
  
  /* STARY KOD Z LAZY LOADING - zakomentowano
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries, observerInstance) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observerInstance.disconnect();
            loadAndInitMap();
          }
        });
      },
      { rootMargin: '200px 0px' },
    );

    observer.observe(mapElement);
  } else {
    loadAndInitMap();
  }
  */
}

function populateFooterYear() {
  const currentYear = String(new Date().getFullYear());
  document.querySelectorAll('[data-current-year]').forEach((element) => {
    if (element.textContent !== currentYear) {
      element.textContent = currentYear;
    }
  });

  const legacyYearElement = document.getElementById('year');
  if (legacyYearElement && legacyYearElement.textContent !== currentYear) {
    legacyYearElement.textContent = currentYear;
  }
}

function bootstrap() {
  if (typeof window.ensureMobileTabbar === 'function') {
    window.ensureMobileTabbar();
  }
  initializeAuth();
  initializeNotifications();
  reviews = loadReviewsFromStorage();
  initializeReviewUI();
  initializeJournalUI();
  loadProgress();
  restoreSelectedPlaceFromStorage();
  initializeTripPlannerUI();
  setupMapLazyLoading();
  renderAllForCurrentState();
  initializePackingPlanner();
  window.CarRental?.initializeSection?.();
  if (state.selected) {
    focusPlace(state.selected.id);
  } else {
    ensureSelectedObjective();
  }

  // Sprawdź, czy użytkownik został przekierowany przez przycisk "Skocz do aktualnego celu"
  try {
    const shouldScrollToObjective = sessionStorage.getItem('wakacjecypr-scroll-to-objective');
    if (shouldScrollToObjective === 'true') {
      sessionStorage.removeItem('wakacjecypr-scroll-to-objective');
      // Przewiń do mapy po krótkim opóźnieniu, aby dać czas na załadowanie
      setTimeout(() => {
        const objectiveSection = document.getElementById('current-objective');
        if (objectiveSection instanceof HTMLElement) {
          objectiveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const objectiveHeading = document.getElementById('currentObjectiveHeading');
          if (objectiveHeading instanceof HTMLElement) {
            requestAnimationFrame(() => {
              objectiveHeading.focus({ preventScroll: true });
            });
          }
        }
      }, 300);
    }
  } catch (error) {
    console.warn('Nie udało się sprawdzić flagi przewijania do celu.', error);
  }

  populateFooterYear();

  const checkInBtn = document.getElementById('checkInBtn');
  if (checkInBtn) {
    checkInBtn.addEventListener('click', () => {
      if (!state.selected) return;
      tryCheckIn(state.selected).catch(() => {
        // błąd obsłużony w tryCheckIn
      });
    });
  }

  const previousPlaceBtn = document.getElementById('previousPlaceBtn');
  const nextPlaceBtn = document.getElementById('nextPlaceBtn');

  previousPlaceBtn?.addEventListener('click', () => {
    focusAdjacentPlace(-1);
  });

  nextPlaceBtn?.addEventListener('click', () => {
    focusAdjacentPlace(1);
  });

  const explorerToggle = document.getElementById('explorerToggle');
  const explorerModal = document.getElementById('explorerModal');
  const explorerClose = document.getElementById('explorerClose');
  const explorerFilter = document.getElementById('explorerFilter');
  const jumpToObjectiveBtn = document.getElementById('jumpToObjective');
  const currentObjectiveSection = document.getElementById('current-objective');
  const currentObjectiveHeading = document.getElementById('currentObjectiveHeading');
  const sosModal = document.getElementById('sosModal');
  const sosDialog = sosModal?.querySelector('.sos-dialog');
  const sosClose = document.getElementById('sosClose');
  const sosToggleButtons = document.querySelectorAll('[aria-controls="sosModal"]');
  console.log('SOS Toggle Buttons found:', sosToggleButtons.length, sosToggleButtons);
  const dailyChallengeFocus = document.getElementById('dailyChallengeFocus');
  const dailyChallengeShuffle = document.getElementById('dailyChallengeShuffle');

  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');
  let sosPreviouslyFocusedElement = null;
  dailyChallengeFocus?.addEventListener('click', () => {
    const place = getDailyChallengePlace();
    if (!place) {
      return;
    }
    openAdventureView();
    focusPlace(place.id);
    const localizedName = getPlaceName(place);
    showToast(translate('dailyChallenge.focusSet', `Cel ustawiony na ${localizedName}.`, {
      name: localizedName,
    }), {
      icon: '📍',
      duration: 4800,
    });
  });

  dailyChallengeShuffle?.addEventListener('click', () => {
    skipDailyChallenge();
  });

  function openExplorer() {
    if (!explorerModal) return;
    if (!explorerModal.hidden && explorerModal.classList.contains('visible')) {
      return;
    }
    renderExplorer();
    lockBodyScroll();
    explorerModal.hidden = false;
    requestAnimationFrame(() => {
      explorerModal.classList.add('visible');
    });
  }

  function closeExplorer() {
    if (!explorerModal) return;
    const wasVisible = explorerModal.classList.contains('visible');
    explorerModal.classList.remove('visible');

    let isFinalized = false;
    function finalizeExplorerClose() {
      if (isFinalized) return;
      isFinalized = true;
      explorerModal.hidden = true;
      explorerModal.removeEventListener('transitionend', handleTransitionEnd);
      unlockBodyScroll();
    }

    function handleTransitionEnd(event) {
      if (event.target !== explorerModal) return;
      finalizeExplorerClose();
    }

    if (!wasVisible) {
      finalizeExplorerClose();
      return;
    }

    explorerModal.addEventListener('transitionend', handleTransitionEnd);
    setTimeout(() => {
      if (explorerModal && !explorerModal.classList.contains('visible')) {
        finalizeExplorerClose();
      }
    }, 320);
  }

  function getSosFocusableElements() {
    if (!sosModal) return [];
    const container = sosDialog ?? sosModal;
    return Array.from(container.querySelectorAll(focusableSelectors)).filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false;
      }
      return element.offsetParent !== null || style.position === 'fixed';
    });
  }

  function focusFirstElementInSos() {
    if (!sosModal) return;
    const focusableElements = getSosFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus({ preventScroll: true });
      return;
    }
    if (sosDialog instanceof HTMLElement) {
      sosDialog.focus({ preventScroll: true });
    }
  }

  function handleSosKeydown(event) {
    if (!sosModal || sosModal.hidden || !sosModal.classList.contains('visible')) {
      return;
    }

    if (event.key === 'PageDown' || event.key === 'PageUp') {
      if (!(sosDialog instanceof HTMLElement)) {
        return;
      }

      if (sosDialog.scrollHeight <= sosDialog.clientHeight) {
        return;
      }

      event.preventDefault();
      const direction = event.key === 'PageDown' ? 1 : -1;
      sosDialog.scrollBy({
        top: direction * sosDialog.clientHeight,
        behavior: 'auto',
      });
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = getSosFocusableElements();
    if (focusableElements.length === 0) {
      event.preventDefault();
      if (sosDialog instanceof HTMLElement) {
        sosDialog.focus({ preventScroll: true });
      }
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (event.shiftKey) {
      if (activeElement === firstElement || !activeElement || !sosModal.contains(activeElement)) {
        event.preventDefault();
        lastElement.focus({ preventScroll: true });
      }
      return;
    }

    if (activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
    }
  }

  function finalizeSosClose() {
    if (!sosModal) return;
    sosModal.hidden = true;
    unlockBodyScroll();
    if (sosPreviouslyFocusedElement instanceof HTMLElement) {
      sosPreviouslyFocusedElement.focus({ preventScroll: true });
    }
    sosPreviouslyFocusedElement = null;
  }

  function openSosModal(triggerElement) {
    console.log('openSosModal called, sosModal:', sosModal);
    if (!sosModal) {
      console.error('SOS Modal not found!');
      return;
    }
    if (!sosModal.hidden && sosModal.classList.contains('visible')) {
      console.log('SOS Modal already visible');
      return;
    }

    if (triggerElement instanceof HTMLElement) {
      sosPreviouslyFocusedElement = triggerElement;
    } else if (document.activeElement instanceof HTMLElement) {
      sosPreviouslyFocusedElement = document.activeElement;
    } else {
      sosPreviouslyFocusedElement = null;
    }

    lockBodyScroll();
    sosModal.hidden = false;
    requestAnimationFrame(() => {
      sosModal.classList.add('visible');
      focusFirstElementInSos();
    });
  }

  function closeSosModal() {
    if (!sosModal) return;
    const wasVisible = sosModal.classList.contains('visible');
    sosModal.classList.remove('visible');

    if (!wasVisible) {
      finalizeSosClose();
      return;
    }

    const handleTransitionEnd = (event) => {
      if (event.target !== sosModal) return;
      sosModal.removeEventListener('transitionend', handleTransitionEnd);
      finalizeSosClose();
    };

    sosModal.addEventListener('transitionend', handleTransitionEnd);

    setTimeout(() => {
      if (sosModal && !sosModal.classList.contains('visible')) {
        sosModal.removeEventListener('transitionend', handleTransitionEnd);
        finalizeSosClose();
      }
    }, 320);
  }

  explorerToggle?.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent tab navigation behavior
    event.stopPropagation(); // Stop event bubbling
    openExplorer();
  });

  explorerClose?.addEventListener('click', () => {
    closeExplorer();
  });

  explorerModal?.addEventListener('click', (event) => {
    if (event.target === explorerModal) {
      closeExplorer();
    }
  });

  sosToggleButtons.forEach((button) => {
    console.log('Adding click listener to SOS button:', button.id);
    button.addEventListener('click', (event) => {
      console.log('SOS button clicked!');
      event.preventDefault();
      event.stopPropagation();
      const trigger = event.currentTarget;
      if (trigger instanceof HTMLElement) {
        openSosModal(trigger);
        return;
      }
      openSosModal();
    });
  });

  sosClose?.addEventListener('click', () => {
    closeSosModal();
  });

  sosModal?.addEventListener('click', (event) => {
    if (event.target === sosModal) {
      closeSosModal();
    }
  });

  sosModal?.addEventListener('keydown', handleSosKeydown);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const controller = window.__authModalController;
    if (controller?.isOpen()) {
      if (closeAuthModal({ reason: 'escape' })) return;
    }

    if (explorerModal && !explorerModal.hidden) {
      closeExplorer();
      return;
    }

    if (sosModal && !sosModal.hidden) {
      closeSosModal();
    }
  });

  explorerFilter?.addEventListener('change', (event) => {
    const select = event.target;
    if (select instanceof HTMLSelectElement) {
      renderExplorer(select.value);
    }
  });

  jumpToObjectiveBtn?.addEventListener('click', () => {
    // Jeśli nie ma mapy/sekcji z celem, przekieruj do strony głównej
    if (!currentObjectiveSection) {
      try {
        // Zapisz informację o wybranym miejscu (jeśli istnieje)
        if (state.selected) {
          storeSelectedPlaceForRedirect(state.selected.id);
        } else {
          // Znajdź pierwsze odblokowane miejsce
          const firstUnlocked = places.find((place) => isPlaceUnlocked(place));
          if (firstUnlocked) {
            storeSelectedPlaceForRedirect(firstUnlocked.id);
          }
        }
        // Ustaw flagę, żeby przewinąć do mapy po załadowaniu strony głównej
        sessionStorage.setItem('wakacjecypr-scroll-to-objective', 'true');
      } catch (error) {
        console.warn('Nie udało się zapisać stanu przed przekierowaniem.', error);
      }
      // Przekieruj do strony głównej
      window.location.href = '/index.html';
      return;
    }

    // Jesteśmy na stronie głównej - przewiń do mapy
    if (currentObjectiveSection instanceof HTMLElement) {
      currentObjectiveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (currentObjectiveHeading instanceof HTMLElement) {
      requestAnimationFrame(() => {
        currentObjectiveHeading.focus({ preventScroll: true });
      });
    }

    if (state.selected) {
      focusPlace(state.selected.id);
      return;
    }
    const firstUnlocked = places.find((place) => isPlaceUnlocked(place));
    if (firstUnlocked) {
      focusPlace(firstUnlocked.id);
    }
  });

  const locationsToggle = document.getElementById('locationsToggle');
  if (locationsToggle) {
    locationsToggle.addEventListener('click', async () => {
      if (locationsFullVisible) {
        closeFullLocationsSection();
      } else {
        await openFullLocationsSection();
      }
    });
  }

  const attractionsSearchInput = document.getElementById('attractionsSearch');
  if (attractionsSearchInput instanceof HTMLInputElement) {
    attractionsSearchInput.addEventListener('input', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) {
        renderAttractionsCatalog(target.value);
      }
    });
  }

  if (document.getElementById('attractionsCatalog')) {
    const initialQuery =
      attractionsSearchInput instanceof HTMLInputElement ? attractionsSearchInput.value : '';
    renderAttractionsCatalog(initialQuery);
  }

  const navigationMode = document.body?.dataset?.navigation || 'single-page';

  updateBackLinksHref();

  function setupNavigationButton(element, openFn, options = {}) {
    const { enableKeydown = false } = options;
    if (!element) {
      return;
    }

    const isAnchor = element instanceof HTMLAnchorElement;
    const isButton = element instanceof HTMLButtonElement;

    element.addEventListener('click', (event) => {
      const targetPage = element.dataset?.pageUrl?.trim();
      console.log('Navigation click:', element.id, 'targetPage:', targetPage, 'mode:', navigationMode);
      if (navigationMode === 'multi-page') {
        if (targetPage) {
          event.preventDefault();
          console.log('Navigating to:', targetPage);
          window.location.href = targetPage;
          return;
        }

        if (isAnchor && element.hasAttribute('href')) {
          return;
        }
      }

      if (!document.querySelector('.app-view') && targetPage) {
        event.preventDefault();
        window.location.href = targetPage;
        return;
      }

      if (isAnchor) {
        event.preventDefault();
      }

      if (typeof openFn === 'function') {
        openFn();
        return;
      }

      if (targetPage) {
        window.location.href = targetPage;
      }
    });

    if (!isButton) {
      element.addEventListener('keydown', (event) => {
        const isEnter = event.key === 'Enter';
        const isSpace = event.key === ' ';
        if (!isEnter && !isSpace) {
          return;
        }

        if (isSpace) {
          event.preventDefault();
        }

        if (isEnter && isAnchor && navigationMode === 'multi-page') {
          return;
        }

        element.click();
      });
    }

    if (enableKeydown && navigationMode !== 'multi-page') {
      element.addEventListener('keydown', handleHeaderTabKeydown);
    }
  }

  const adventureTab = document.getElementById('headerAdventureTab');
  const packingTab = document.getElementById('headerPackingTab');
  const tasksTab = document.getElementById('headerTasksTab');
  const mobileAdventureTab = document.getElementById('mobileAdventureTab');
  const mobilePackingTab = document.getElementById('mobilePackingTab');
  const mobileTasksTab = document.getElementById('mobileTasksTab');
  const mobileMediaTripsTab = document.getElementById('mobileMediaTripsTab');
  const mobileCarRentalTab = document.getElementById('mobileCarRentalTab');
  const mobileCouponsTab = document.getElementById('mobileCouponsTab');

  setupNavigationButton(adventureTab, openAdventureView, { enableKeydown: true });
  setupNavigationButton(packingTab, null, { enableKeydown: true }); // Will use data-page-url
  setupNavigationButton(tasksTab, null, { enableKeydown: true }); // Will use data-page-url
  setupNavigationButton(mobileAdventureTab, openAdventureView);
  setupNavigationButton(mobilePackingTab, openPackingPlannerView);
  setupNavigationButton(mobileTasksTab, openTasksView);
  setupNavigationButton(mobileMediaTripsTab, openMediaTripsView);
  setupNavigationButton(mobileCarRentalTab);
  setupNavigationButton(mobileCouponsTab);

  const openPackingFromAdventure = document.getElementById('openPackingFromAdventure');
  setupNavigationButton(openPackingFromAdventure, openPackingPlannerView);

  const openTasksFromAdventure = document.getElementById('openTasksFromAdventure');
  setupNavigationButton(openTasksFromAdventure, openTasksView);

  const openAdventureFromPacking = document.getElementById('openAdventureFromPacking');
  setupNavigationButton(openAdventureFromPacking, openAdventureView);

  const openAdventureFromTasks = document.getElementById('openAdventureFromTasks');
  setupNavigationButton(openAdventureFromTasks, openAdventureView);

  const openAdventureFromMediaTrips = document.getElementById('openAdventureFromMediaTrips');
  setupNavigationButton(openAdventureFromMediaTrips, openAdventureView);

  const initialView = document.body?.dataset?.initialView;
  if (initialView) {
    switchAppView(initialView);
  } else {
    switchAppView(ADVENTURE_VIEW_ID);
  }

  if (window.appTutorial && typeof window.appTutorial.init === 'function') {
    window.appTutorial.init();
  }

  if (areTranslationsReady()) {
    refreshLocalizedUI();
  }

}

window.addEventListener('beforeunload', () => {
  if (locationWatchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(locationWatchId);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentSupabaseUser?.id) {
    // Sync progress from Supabase when user returns to the tab
    const timeSinceLastFetch = lastSupabaseProgressFetchTime 
      ? Date.now() - lastSupabaseProgressFetchTime 
      : Infinity;
    
    // Only fetch if it's been more than 30 seconds since last fetch
    if (timeSinceLastFetch > 30000) {
      void syncProgressFromSupabase();
    }
  }
});

document.addEventListener('DOMContentLoaded', bootstrap);

document.addEventListener('wakacjecypr:languagechange', refreshLocalizedUI);
