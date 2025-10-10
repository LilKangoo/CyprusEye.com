import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const SERVICES = [
  {
    title: 'Prywatne wycieczki po Cyprze',
    summary:
      'Indywidualnie przygotowane trasy z lokalnym opiekunem, który pomoże zaplanować każdy dzień urlopu.',
    highlights: [
      'Elastyczne godziny startu oraz dopasowanie długości i tempa zwiedzania.',
      'Wsparcie kierowcy-przewodnika znającego lokalne realia oraz najlepsze punkty widokowe.',
      'Możliwość dobrania atrakcji dla rodzin z dziećmi, par, grup znajomych lub podróżujących solo.',
    ],
  },
  {
    title: 'Akamas i zachodnie wybrzeże',
    summary:
      'Wycieczki w rejon rezerwatu Akamas, Błękitnej Laguny oraz malowniczych zatok w okolicach Pafos.',
    highlights: [
      'Odkrywanie dzikich plaż i punktów widokowych niedostępnych komunikacją publiczną.',
      'Opcjonalne rejsy łodzią lub safari terenowe po ścieżkach Akamasu.',
      'Czas na kąpiele i relaks w najpiękniejszych zakątkach zachodniego Cypru.',
    ],
  },
  {
    title: 'Troodos i cypryjskie wioski',
    summary:
      'Górskie wyprawy przez Troodos, Lefkarę i ukryte klasztory łączące naturę z lokalną kulturą.',
    highlights: [
      'Chłodniejszy klimat, wodospady Kalidonia oraz spacer po tradycyjnych kamiennych uliczkach.',
      'Degustacja lokalnych przysmaków: serów, słodyczy z róż i pieczywa wypiekanego na miejscu.',
      'Możliwość odwiedzenia klasztoru Kykkos lub innych zabytków wpisanych na listę UNESCO.',
    ],
  },
  {
    title: 'Szlaki winne i smaki Cypru',
    summary:
      'Degustacje win kommandaria, xynisteri oraz spotkania z winiarzami i producentami oliwy.',
    highlights: [
      'Zwiedzanie butikowych winiarni z prywatnymi prezentacjami i możliwością zakupów na miejscu.',
      'Łączenie degustacji z lokalnymi serami, meze oraz słodkimi deserami.',
      'Transport między punktami zapewniony przez lokalnego kierowcę, dzięki czemu można degustować bez stresu.',
    ],
  },
  {
    title: 'Rejsy i atrakcje wodne',
    summary:
      'Relaksujące rejsy o zachodzie słońca, wyprawy snorkelingowe oraz prywatne łodzie dla małych grup.',
    highlights: [
      'Elastyczny dobór portu wypłynięcia: Pafos, Latchi, Ayia Napa lub Limassol.',
      'Szansa na snorkeling w przejrzystych zatokach oraz obserwację żółwi karetta.',
      'Możliwość organizacji kolacji na pokładzie lub urodzin na morzu.',
    ],
  },
  {
    title: 'Transfery i concierge na miejscu',
    summary:
      'Obsługa pobytu od przylotu po codzienne rekomendacje – idealna dla osób, które chcą mieć opiekę na miejscu.',
    highlights: [
      'Transfery lotniskowe z pomocą w zakwaterowaniu i pierwszych zakupach.',
      'Wsparcie w rezerwacji restauracji, plaż z serwisem leżakowym oraz lokalnych atrakcji.',
      'Szybki kontakt w razie potrzeby tłumaczenia lub pomocy w nagłych sytuacjach.',
    ],
  },
  {
    title: 'Wydarzenia i okazjonalne wyjazdy',
    summary:
      'Organizacja wyjątkowych momentów: zaręczyn, rocznic, sesji zdjęciowych czy wyjazdów integracyjnych.',
    highlights: [
      'Dobór miejsca – od plażowych altan po ekskluzywne wille i tarasy z widokiem na morze.',
      'Koordynacja dekoracji, cateringu, fotografa i dodatkowych atrakcji.',
      'Opieka dedykowanego koordynatora od planowania po realizację.',
    ],
  },
];

const TOUR_PACKAGES = [
  {
    title: 'Wyjazdy indywidualne VIP',
    tagline: 'od 220 € / dzień',
    summary:
      'Prywatna opieka kierowcy-przewodnika oraz elastyczny plan zwiedzania dopasowany do Twojego tempa i zainteresowań na całej wyspie.',
    highlights: [
      'Odbiór i odwiezienie pod wskazany adres – jedziemy wyłącznie z Twoją grupą.',
      'Wspólnie układamy trasę, aby wykorzystać dzień w 100% i zobaczyć tylko interesujące miejsca.',
      'Dostępne pakiety foto i video z profesjonalnym fotografem, aby zatrzymać wspomnienia na lata.',
    ],
  },
  {
    title: 'Off-road Pafos i Akamas',
    tagline: '75–95 € / osoba',
    summary:
      'Całodniowe wyprawy jeepami po niedostępnych szlakach półwyspu Akamas i okolic Pafos prowadzone przez polskojęzycznych przewodników.',
    highlights: [
      'Wyłącznie kameralne grupy w jednym aucie z odbiorem z hoteli w rejonie Pafos.',
      'Trasy do wyboru: Blue Lagoon, Kanion Avakas, Skała Afrodyty czy dzikie Troodos.',
      'W cenie przekąski oraz chłodzone napoje – w samochodach czekają lodówki.',
    ],
  },
  {
    title: 'Rejsy z Ayia Napy',
    tagline: 'od 350 € / godz.',
    summary:
      'Indywidualne czartery łodzi ze startem w Ayia Napa, dzięki którym sam decydujesz o trasie, tempie i atrakcjach na pokładzie.',
    highlights: [
      'Na pokładzie tylko Twoja ekipa – plan rejsu układamy wspólnie przed wypłynięciem.',
      'Możliwość dodania bufetu, open baru, sprzętu SUP i masek do snorkelingu.',
      'Pakiety od szybkiej godziny relaksu po kilkugodzinne rejsy z poszukiwaniem żółwi.',
    ],
  },
  {
    title: 'Moto Trip po Cyprze',
    tagline: 'od 120 € / osoba',
    summary:
      'Dzienna wyprawa na motocyklach CF MOTO 450 MT z przewodnikiem – także dla osób bez prawa jazdy dzięki opcji pasażera.',
    highlights: [
      'Nowoczesne motocykle, kaski i pełny zestaw ochronny wliczone w wybrane pakiety.',
      'Trasy prowadzą przez najpiękniejsze zakątki wyspy z przerwą na kawę i zdjęcia.',
      'Opcja z kierowcą dla pasażera: wskakujesz z przewodnikiem i ruszasz w drogę bez stresu.',
    ],
  },
];

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Usługi na miejscu</Text>
          <Text style={styles.lead}>
            Oferujemy wsparcie w organizacji pobytu na Cyprze dla osób, które chcą odkrywać wyspę z lokalnym
            przewodnikiem i kierowcą. Każdą wycieczkę dopasowujemy do oczekiwań, budżetu oraz tempa podróży.
          </Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              void Linking.openURL('https://wakacjecypr.com/wycieczki');
            }}
          >
            <Text style={styles.linkLabel}>Zobacz więcej na wakacjecypr.com/wycieczki</Text>
          </TouchableOpacity>
        </View>

        {SERVICES.map((service) => (
          <View key={service.title} style={styles.card}>
            <Text style={styles.cardTitle}>{service.title}</Text>
            <Text style={styles.cardSummary}>{service.summary}</Text>
            <View style={styles.divider} />
            {service.highlights.map((highlight) => (
              <View key={highlight} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{highlight}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.sectionIntro}>
          <Text style={styles.sectionTitle}>Wycieczki zorganizowane</Text>
          <Text style={styles.sectionDescription}>
            Przetestowane pakiety tematyczne prowadzone przez nasz zespół na miejscu. Wybierz gotową przygodę,
            a my zajmiemy się logistyką, rezerwacjami oraz opieką przewodnika w języku polskim.
          </Text>
        </View>

        {TOUR_PACKAGES.map((tour) => (
          <View key={tour.title} style={styles.card}>
            <View style={styles.tourHeader}>
              <Text style={styles.cardTitle}>{tour.title}</Text>
              <Text style={styles.tagline}>{tour.tagline}</Text>
            </View>
            <Text style={styles.cardSummary}>{tour.summary}</Text>
            <View style={styles.divider} />
            {tour.highlights.map((highlight) => (
              <View key={highlight} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{highlight}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Jak zarezerwować?</Text>
          <Text style={styles.footerText}>
            Skontaktuj się z nami poprzez stronę internetową lub wiadomość na social media. Przygotujemy propozycję
            programu w ciągu 24 godzin wraz z wyceną oraz rekomendacjami transportu, noclegów i atrakcji dodatkowych.
          </Text>
          <Text style={styles.footerText}>
            Dla każdej rezerwacji zapewniamy wsparcie koordynatora na miejscu, który pomoże w zmianach planów,
            rezerwacjach stolików i bieżących pytaniach podczas całego pobytu.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 20,
  },
  header: {
    backgroundColor: '#1a73e8',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#1a73e8',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: '#e0ecff',
    marginBottom: 16,
  },
  linkButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  linkLabel: {
    color: '#1a73e8',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  cardSummary: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
    marginBottom: 12,
  },
  sectionIntro: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  tourHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  tagline: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e0ecff',
    color: '#1a73e8',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1a73e8',
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  footerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#cbd5f5',
    marginBottom: 12,
  },
});

