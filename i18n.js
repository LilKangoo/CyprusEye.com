(function () {
  'use strict';

  const DEFAULT_LANGUAGE = 'pl';
  const STORAGE_KEY = 'wakacjecypr-language';
  const SUPPORTED_LANGUAGES = {
    pl: { label: 'Polski', flag: '🇵🇱', dir: 'ltr' },
    en: { label: 'English', flag: '🇬🇧', dir: 'ltr' },
  };

  const translations = {
    en: {
      'language.switcher.label': 'Language',
      'language.option.pl': '🇵🇱 Polish',
      'language.option.en': '🇬🇧 English',
      'header.notifications': '🔔 Notifications',
      'header.login': '🔐 Sign in',
      'header.accountSettings': '⚙️ Account settings',
      'header.logout': 'Log out',
      'header.brand': {
        html: '<h1>HolidayCyprus <span>Quest</span></h1><p class="tagline">Explore Cyprus in an interactive way – earn badges, experience, and discover our best offers.</p>',
      },
      'header.jumpToObjective': 'Jump to current objective',
      'header.carRentalLink': '🚗 Car rental',
      'header.explorerToggle': '🌍 Browse attractions',
      'header.sosToggle': '🚨 SOS',
      'metrics.level.label': 'Level',
      'metrics.level.subtext': 'Get your first check-ins to level up!',
      'metrics.level.defaultStatus.initial': 'Get your first check-ins to level up!',
      'metrics.level.defaultStatus.progress': 'Keep exploring to earn more rewards.',
      'metrics.xp.label': 'Experience',
      'metrics.xp.progress': '0 / 150 XP to the next level',
      'metrics.xp.progressTemplate': '{{current}} / {{total}} XP to the next level',
      'metrics.xp.maxLevel': 'You have reached the maximum level – congratulations!',
      'metrics.xp.keepEarning': 'Keep earning experience to level up.',
      'metrics.badges.label': 'Badges',
      'metrics.badges.subtext': 'Explore attractions and collect souvenirs.',
      'achievements.emptyBadges': 'No badges yet – time for your first adventure!',
      'nav.adventure': '🎯 Your adventure',
      'nav.packing': '🎒 Packing planner',
      'nav.tasks': '✅ Tasks to complete',
      'nav.mediaTrips': '✨ VIP individual trips',
      'objective.title': 'Current location',
      'objective.mapLink': 'View on Google Maps',
      'objective.previous': '← Previous place',
      'objective.next': 'Next place →',
      'objective.checkIn': 'Check in to earn XP',
      'objective.hint': 'Tip: allow the app to use your location to confirm you are on site.',
      'shortcuts.packing.title': '🎒 Packing planner',
      'shortcuts.packing.description': 'Plan your suitcase with dedicated lists for each travel season.',
      'shortcuts.packing.action': 'Go to planner',
      'shortcuts.tasks.title': '✅ Task list',
      'shortcuts.tasks.description': 'Review pre-trip challenges and log your progress in a separate tab.',
      'shortcuts.tasks.action': 'Open tasks',
      'shortcuts.car.title': '🚗 Car rental in Cyprus',
      'shortcuts.car.description': 'Explore the fleet, compare prices, and book a car on the dedicated page.',
      'shortcuts.car.action': 'Go to rental',
      'discovery.title': 'Attractions to discover',
      'discovery.subtitle': 'Browse in-game locations and plan your next check-ins from the map.',
      'discovery.toggle': 'Show more attractions',
      'discovery.catalog': '📚 Attractions catalogue',
      'packing.header.title': 'Packing planner',
      'packing.header.subtitle': 'Take everything you need for Cyprus – pick the season and tick off each item.',
      'packing.header.back': '← Back to adventure',
      'packing.panel.title': 'Packing planner',
      'packing.panel.subtitle': 'Choose a travel season and tick items that will be useful during your Cyprus holidays.',
      'packing.note': 'Check items as you pack – refresh the list for your next trip.',
      'tasks.header.title': 'Tasks to complete',
      'tasks.header.subtitle': 'Prepare for the trip with missions that grant XP and keep your planning organised.',
      'tasks.header.back': '← Back to adventure',
      'tasks.hint': 'Complete tasks to earn extra XP and prepare your Cyprus adventures.',
      'mediaTrips.header.title': 'VIP photo and video trips',
      'mediaTrips.header.subtitle': 'Book individual photo or video packages with the WakacjeCypr.com crew and instantly see the per-person cost for your group.',
      'mediaTrips.header.back': '← Back to adventure',
      'mediaTrips.intro': 'Choose a photo or video package, enter the number of participants, and see the total cost and price per person. Up to 4 people are covered by the base price; add more using the calculator below.',
      'services.title': 'Discover Cyprus with us',
      'services.description': 'WakacjeCypr.com are local experts ready to organise unforgettable holidays, private tours, wine tastings, and cruises for you.',
      'services.itemOne': 'Tailor-made itineraries aligned with your check-ins.',
      'services.itemTwo': 'Guided tours in the places you have already unlocked.',
      'services.itemThree': 'Contact us straight from the app – tap the button below.',
      'services.cta': 'Discover our services',
      'mobile.nav.adventure': 'Adventure',
      'mobile.nav.packing': 'Packing',
      'mobile.nav.tasks': 'Missions',
      'mobile.nav.mediaTrips': 'VIP',
      'footer.app': '© <span id="year"></span> WakacjeCypr.com • Play, explore and plan your holidays at the same time.',
      'notifications.title': 'Notifications',
      'notifications.markAll': 'Mark all as read',
      'notifications.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close notifications' },
      },
      'notifications.empty': 'Sign in to see your notifications.',
      'explorer.title': 'Interactive Cyprus guide',
      'explorer.subtitle': 'Browse all our locations and pick where you want to go next.',
      'explorer.filterLabel': 'Filter attractions',
      'explorer.filter.all': 'All places',
      'explorer.filter.available': 'To visit',
      'explorer.filter.visited': 'Earned badges',
      'explorer.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close window' },
      },
      'auth.title': 'Sign in or create an account',
      'auth.subtitle': 'Save your stats and continue adventures on any device.',
      'auth.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close sign-in window' },
      },
      'auth.login.title': 'Sign in',
      'auth.login.username': 'Email address or username',
      'auth.login.password': 'Password',
      'auth.login.submit': 'Sign in',
      'auth.divider': 'OR',
      'auth.register.title': 'Create account',
      'auth.register.username': 'Email address or username',
      'auth.register.password': 'Password',
      'auth.register.confirm': 'Repeat password',
      'auth.register.hint': 'Your current progress will be saved to the new account.',
      'auth.register.submit': 'Create account',
      'auth.guest.button': '🎮 Continue as guest',
      'auth.guest.description': 'You can use the app without an account – progress will stay on this device.',
      'sos.title': 'SOS',
      'sos.description': 'Quick access to emergency numbers, embassy contacts, and medical guidance.',
      'sos.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close SOS window' },
      },
      'sos.emergency.title': '🚑 Emergency numbers in Cyprus',
      'sos.emergency.eu': 'EU emergency number (police, ambulance, fire). <a href="tel:112">Call now</a>',
      'sos.emergency.cyprus': 'Cypriot emergency number – works alongside 112. <a href="tel:199">Call</a>',
      'sos.emergency.police': '24/7 police line (dial the full code when abroad). <a href="tel:+35722802020">Call</a>',
      'sos.embassy.title': '🛡️ Embassy of Poland in Nicosia',
      'sos.embassy.hotline': '<a href="tel:+35799660451">+357 99 660 451</a> (emergency support for Polish citizens).',
      'sos.embassy.reception': '<a href="tel:+35722751777">+357 22 751 777</a> (Mon–Fri during office hours).',
      'sos.embassy.address': '14, Ifigenias Street, 2007 Nicosia • <a href="https://maps.google.com/?q=Embassy+of+Poland+in+Cyprus" target="_blank" rel="noopener">Get directions</a>',
      'sos.embassy.email': '<a href="mailto:nicosia.info@msz.gov.pl">nicosia.info@msz.gov.pl</a>',
      'sos.healthcare.title': '🏥 Closest medical help',
      'sos.healthcare.hospital': '24/7 emergency department, Anavargos, Paphos. <a href="tel:+35726803000">+357 26 803 000</a> • <a href="https://maps.google.com/?q=Paphos+General+Hospital" target="_blank" rel="noopener">Directions</a>',
      'sos.healthcare.search': '<a href="https://www.google.com/maps/search/hospital+near+me/" target="_blank" rel="noopener">Open the hospital list on Google Maps</a> and share your location to see nearby options.',
      'sos.healthcare.pharmacy': 'Check duty pharmacies on the <a href="https://pharmacy.dl.moh.gov.cy/" target="_blank" rel="noopener">Ministry of Health website</a> or search for a <a href="https://www.google.com/maps/search/pharmacy+near+me/" target="_blank" rel="noopener">pharmacy nearby</a>.',
      'sos.healthcare.note': 'In life-threatening situations always call 112 and clearly state your location. Enable location sharing in the app to find help faster on the map.',
      'account.title': 'Account settings',
      'account.subtitle': 'Update your login details or start the adventure from scratch.',
      'account.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close account settings' },
      },
      'account.username.title': 'Change username',
      'account.username.label': 'New username',
      'account.username.hint': 'Changes are saved instantly and will appear in the greeting.',
      'account.username.submit': 'Save name',
      'account.password.title': 'Update password',
      'account.password.current': 'Current password',
      'account.password.new': 'New password',
      'account.password.confirm': 'Repeat new password',
      'account.password.hint': 'Password must be at least 8 characters long.',
      'account.password.submit': 'Change password',
      'account.reset.title': 'Restart game',
      'account.reset.description': 'Reset collected badges and experience to start again from level one.',
      'account.reset.action': '🔄 Reset progress',
      'places.viewOnMap': 'View on map',
      'places.googleMaps': 'Google Maps',
      'places.search.results': 'Found {{found}} (of {{total}})',
      'places.search.total': '{{total}} in the catalogue',
      'places.distance.unavailable': '📍 Location unavailable',
      'places.distance.pending': '📍 Determining position…',
      'explorer.empty': 'No attractions match this filter.',
      'explorer.status.visited': 'Badge collected',
      'explorer.status.available': 'To visit',
      'explorer.status.active': 'Selected location',
      'locations.highlight.title': 'Car rental in Cyprus',
      'locations.highlight.subtitle': 'Collect your car at the airport or directly from your hotel',
      'locations.highlight.aria': 'Go to the Cyprus car rental section',
      'locations.toggle.hide': 'Hide part of the list',
      'locations.toggle.showAll': 'Show all {{total}} attractions',
      'places.objective.completed': 'Badge collected',
      'places.objective.checkIn': 'Check in to earn XP',
      'places.objective.previousTitle': 'Go to {{name}}',
      'places.objective.previousNone': 'No previous location',
      'places.objective.previousAria': 'Go to previous location: {{name}}',
      'places.objective.nextTitle': 'Go to {{name}}',
      'places.objective.nextNone': 'No next location',
      'places.objective.nextAria': 'Go to next location: {{name}}',
      'places.objective.visited': 'You already collected this badge—check the next location!',
      'places.objective.hint': 'When you arrive, tap “Check in” to earn the badge.',
      'places.badge.manual': '{{name}} • Badge awarded manually.',
      'places.badge.geo': '{{name}} • Confirmed via geolocation.',
      'places.toast.dailyChallenge': 'You completed today’s challenge at {{name}}! +{{xp}} XP',
      'places.toast.badge': 'You earned the “{{badge}}” badge!',
      'places.toast.dailyBonus': '🎯 Daily challenge complete! Bonus +{{xp}} XP added.',
      'places.toast.streakContinue': '🔥 Your streak is now {{days}} days long. Keep going!',
      'places.toast.streakStart': '🔥 You’ve started a daily streak! Remember to check in each day.',
      'places.toast.streakReset': 'A new streak has begun. Aim to beat your record of {{days}} days!',
      'places.toast.levelUp': '🎉 Level up! Claim extra XP from the daily challenge.',
      'tripPlanner.startBadge': 'Start',
      'tripPlanner.selectStart': 'Choose a starting point to plan your day.',
      'tripPlanner.selectStops': 'Select at least one attraction to see bonus XP and trip duration.',
      'dailyChallenge.focusSet': 'Objective set to {{name}}.',
      'dailyChallenge.noneAvailable': 'No challenges available. Unlock more attractions to receive daily missions.',
      'dailyChallenge.placeholderTitle': 'Discover a new place',
      'dailyChallenge.placeholderDescription': 'Check in at any attraction to start today’s mission.',
      'dailyChallenge.status.completed': 'Completed! Bonus +{{bonus}} XP added.',
      'dailyChallenge.status.locked': 'Reach a higher level to unlock this challenge or draw another one.',
      'dailyChallenge.status.visited': 'You already have this badge. Draw a new challenge or come back tomorrow.',
      'dailyChallenge.status.active': 'Check in at this attraction today to earn extra experience points!',
      'dailyChallenge.toast.new': 'New challenge: {{name}}.',
      'dailyChallenge.noneToShuffle': 'No other challenges to draw. Unlock more attractions to get new missions.',
      'dailyStreak.message.start': 'Check in at any attraction to start your adventure streak.',
      'dailyStreak.message.today': 'Great! Today’s check-in kept your streak alive. Come back tomorrow for another day.',
      'dailyStreak.message.warning': 'You still have time today to keep the streak going—visit any place and earn XP.',
      'dailyStreak.message.reset': 'Start a new streak and beat your record of {{best}} days.',
      'dailyStreak.message.keepGoing': 'Keep exploring to extend your check-in streak.',
      'map.playerLocation': 'Your location',
      'map.geolocation.enableSharing': 'Enable location sharing to see your position on the map.',
      'map.geolocation.noSupport': 'Your browser does not support geolocation—the player marker will not be shown.',
      'checkIn.manualConfirm.action': 'I confirm I am on site',
      'checkIn.manualConfirm.success': 'Badge awarded!',
      'checkIn.status.checking': 'Checking your location…',
      'checkIn.status.unsupported': 'Your browser does not support geolocation. You can confirm your visit manually below.',
      'checkIn.status.error': 'We could not obtain your location. Make sure you granted permission or confirm manually.',
      'checkIn.status.success': 'Congratulations! You are exactly at the right spot.',
      'checkIn.status.distance':
        'You are about {{distance}} km from the target. Check Google Maps for directions and confirm manually if you really are on site.',
      'places.kato-pafos-archaeological-park.name': 'Kato Paphos Archaeological Park (Nea Paphos)',
      'places.kato-pafos-archaeological-park.description': 'Expansive UNESCO site with famous mosaics and the ruins of the ancient city of Nea Paphos.',
      'places.kato-pafos-archaeological-park.badge': 'Nea Paphos Curator',
      'places.tombs-of-the-kings.name': 'Tombs of the Kings in Paphos',
      'places.tombs-of-the-kings.description': 'Monumental rock-cut tombs from the Hellenistic and Roman periods adorned with Doric columns.',
      'places.tombs-of-the-kings.badge': 'Necropolis Guardian',
      'places.coral-bay.name': 'Coral Bay Beach',
      'places.coral-bay.description': 'Golden sand, gentle entry into the sea and crystal-clear water—the classic spot to relax near Peyia.',
      'places.coral-bay.badge': 'Beach Explorer',
      'places.aphrodite-rock.name': 'Aphrodite\'s Rock (Petra tou Romiou)',
      'places.aphrodite-rock.description': 'Legend says Aphrodite was born among the turquoise waves at this rock—a perfect sunset viewpoint.',
      'places.aphrodite-rock.badge': 'Myth Keeper',
      'places.blue-lagoon-akamas.name': 'Blue Lagoon (Akamas)',
      'places.blue-lagoon-akamas.description': 'Crystal-clear bay surrounded by the wild nature of the Akamas peninsula—a snorkelling paradise.',
      'places.blue-lagoon-akamas.badge': 'Turquoise Hunter',
      'places.kourion-archaeological-site.name': 'Kourion Archaeological Site',
      'places.kourion-archaeological-site.description': 'Clifftop ruins of an ancient city with a theatre, baths and mosaics from the House of Eustolios.',
      'places.kourion-archaeological-site.badge': 'Kourion Defender',
      'places.kolossi-castle.name': 'Kolossi Castle',
      'places.kolossi-castle.description': '13th-century Hospitaller fortress that once oversaw the production of Commandaria sweet wine.',
      'places.kolossi-castle.badge': 'Knight of Kolossi',
      'places.molos-promenade.name': 'Molos Promenade in Limassol',
      'places.molos-promenade.description': 'Seaside park lined with palms, sculptures and cafés—the residents\' favourite stroll in Limassol.',
      'places.molos-promenade.badge': 'Promenade Master',
      'places.amathus-ruins.name': 'Ancient Amathus Ruins',
      'places.amathus-ruins.description': 'Remains of one of Cyprus\' royal cities with an agora, Temple of Aphrodite and early Christian basilica.',
      'places.amathus-ruins.badge': 'Amathus Curator',
      'places.limassol-castle.name': 'Limassol Castle (Medieval Museum)',
      'places.limassol-castle.description': 'Stone castle in the heart of the old town, now home to a collection of medieval artefacts.',
      'places.limassol-castle.badge': 'Guardian of Limassol',
      'places.saint-lazarus-church.name': 'Church of Saint Lazarus in Larnaca',
      'places.saint-lazarus-church.description': '9th-century stone church built over Saint Lazarus\' tomb, famed for its ornate iconostasis.',
      'places.saint-lazarus-church.badge': 'Relic Keeper',
      'places.larnaca-salt-lake-hala-sultan.name': 'Larnaca Salt Lake and Hala Sultan Tekke',
      'places.larnaca-salt-lake-hala-sultan.description': 'Winter flamingos and the mystical Hala Sultan Tekke mosque shape a unique lakeside landscape.',
      'places.larnaca-salt-lake-hala-sultan.badge': 'Flamingo Observer',
      'places.finikoudes-beach.name': 'Finikoudes Beach in Larnaca',
      'places.finikoudes-beach.description': 'City beach with a palm-lined promenade, lively cafés and a gentle entry into the sea.',
      'places.finikoudes-beach.badge': 'Palm Master',
      'places.chirokitia-archaeological-site.name': 'Choirokoitia Archaeological Site',
      'places.chirokitia-archaeological-site.description': 'UNESCO-listed Neolithic settlement with reconstructions of circular stone dwellings.',
      'places.chirokitia-archaeological-site.badge': 'Neolithic Pioneer',
      'places.lefkara-village.name': 'Lefkara Village',
      'places.lefkara-village.description': 'Mountain village famed for lefkaritiko lace and silver handicrafts in stone houses.',
      'places.lefkara-village.badge': 'Lace Master',
      'places.nissi-beach.name': 'Nissi Beach (Ayia Napa)',
      'places.nissi-beach.description': 'Bright sand, shallow lagoon and the Nissi islet make it an icon of leisure and water sports.',
      'places.nissi-beach.badge': 'Sun Chaser',
      'places.cape-greco.name': 'Cape Greco',
      'places.cape-greco.description': 'National park of cliffs, sea caves and the famous natural Bridge of Lovers.',
      'places.cape-greco.badge': 'Horizon Hunter',
      'places.fig-tree-bay.name': 'Fig Tree Bay Beach (Protaras)',
      'places.fig-tree-bay.description': 'Azure bay with golden sand and a solitary fig tree symbolising the area.',
      'places.fig-tree-bay.badge': 'Sands Guardian',
      'places.ayia-napa-monastery.name': 'Ayia Napa Monastery',
      'places.ayia-napa-monastery.description': '17th-century monastery with a courtyard and sycamore—a spiritual oasis in lively Ayia Napa.',
      'places.ayia-napa-monastery.badge': 'Monastery Curator',
      'places.ayia-napa-sculpture-park.name': 'Ayia Napa Sculpture Park',
      'places.ayia-napa-sculpture-park.description': 'Open-air art gallery with over a hundred sculptures overlooking the sea and a neighbouring cactus park.',
      'places.ayia-napa-sculpture-park.badge': 'Sculpture Curator',
      'places.troodos-olympos.name': 'Mount Olympus (Olympos)',
      'places.troodos-olympos.description': 'Cyprus\' highest peak with the Artemis trail in summer and ski slopes in winter.',
      'places.troodos-olympos.badge': 'Troodos Conqueror',
      'places.kykkos-monastery.name': 'Kykkos Monastery',
      'places.kykkos-monastery.description': 'Cyprus\' wealthiest monastery with mosaics, golden icons and a sacred art museum.',
      'places.kykkos-monastery.badge': 'Heritage Keeper',
      'places.omodos-village.name': 'Omodos Village (Centre)',
      'places.omodos-village.description': 'Historic village with the Holy Cross Monastery, cobbled lanes and local crafts.',
      'places.omodos-village.badge': 'Omodos Sommelier',
      'places.kakopetria-village.name': 'Kakopetria Village',
      'places.kakopetria-village.description': 'Mountain settlement with traditional houses and a stream—perfect for Troodos walks.',
      'places.kakopetria-village.badge': 'Mountain Village Guardian',
      'places.caledonia-waterfall.name': 'Caledonia Waterfall',
      'places.caledonia-waterfall.description': 'One of Cyprus\' highest cascades hidden in a shaded gorge near Platres.',
      'places.caledonia-waterfall.badge': 'Waterfall Tamer',
      'places.kyrenia-old-harbour.name': 'Kyrenia Old Harbour (Girne)',
      'places.kyrenia-old-harbour.description': 'Historic harbour with tavernas and yachts beneath the medieval castle, lively after dark.',
      'places.kyrenia-old-harbour.badge': 'Mediterranean Captain',
      'places.kyrenia-castle.name': 'Kyrenia Castle',
      'places.kyrenia-castle.description': 'Venetian fortress with a shipwreck museum and views over the harbour and Mediterranean Sea.',
      'places.kyrenia-castle.badge': 'Bastion Guardian',
      'places.st-hilarion-castle.name': 'St Hilarion Castle',
      'places.st-hilarion-castle.description': 'Mountain fortress spread across three rocky levels with legendary coastal views.',
      'places.st-hilarion-castle.badge': 'Kyrenia Mountains Knight',
      'places.famagusta-old-town.name': 'Famagusta Old Town (Gazimağusa)',
      'places.famagusta-old-town.description': 'Fortified city with Venetian walls, St Nicholas Cathedral and Othello Castle by the port.',
      'places.famagusta-old-town.badge': 'Famagusta Chronicler',
      'places.karpaz-golden-beach.name': 'Golden Beach on the Karpas Peninsula',
      'places.karpaz-golden-beach.description': 'Wild, wide beach of fine sand framed by dunes and roaming wild donkeys.',
      'places.karpaz-golden-beach.badge': 'Dune Warden',
      'places.zenobia-wreck.name': 'Zenobia Wreck',
      'places.zenobia-wreck.description': 'Sunken ferry off Larnaca\'s coast—one of the island\'s most famous dive sites.',
      'places.zenobia-wreck.badge': 'Wreck Master',
      'places.avakas-gorge.name': 'Avakas Gorge',
      'places.avakas-gorge.description': 'Dramatic canyon on the Akamas peninsula with towering rock formations and trekking paths.',
      'places.avakas-gorge.badge': 'Gorge Wanderer',
      'places.aphrodites-baths.name': 'Baths of Aphrodite',
      'places.aphrodites-baths.description': 'Romantic natural pool on the Akamas peninsula linked to the legend of Aphrodite.',
      'places.aphrodites-baths.badge': 'Aphrodite Legend Keeper',
      'places.polis-latchi-marina.name': 'Polis & Latchi Marina',
      'places.polis-latchi-marina.description': 'Coastal town and marina serving as the launch point for cruises to the Blue Lagoon.',
      'places.polis-latchi-marina.badge': 'Lagoon Captain',
      'places.st-hilarion-vantage-point.name': 'St Hilarion Castle Viewpoint',
      'places.st-hilarion-vantage-point.description': 'Lookout below St Hilarion Castle with sweeping views across the Kyrenia coast.',
      'places.st-hilarion-vantage-point.badge': 'Horizon Chaser',
      'places.buffavento-castle.name': 'Buffavento Castle',
      'places.buffavento-castle.description': 'Hilltop castle ruins overlooking the Mediterranean, near the St Hilarion stronghold.',
      'places.buffavento-castle.badge': 'Buffavento Guardian',
      'places.lania-village.name': 'Lania Village',
      'places.lania-village.description': 'Picturesque settlement at the foot of Troodos known for winemaking, galleries and a tranquil pace.',
      'places.lania-village.badge': 'Lania Artist',
      'places.trooditissa-monastery.name': 'Trooditissa Monastery',
      'places.trooditissa-monastery.description': 'Mountain monastery in the Troodos range surrounded by forests, icons and pilgrims.',
      'places.trooditissa-monastery.badge': 'Trooditissa Pilgrim',
      'places.soli-ancient-site.name': 'Ancient City of Soli',
      'places.soli-ancient-site.description': 'Ruins of an ancient city with an amphitheatre and remnants of the harbour near Famagusta.',
      'places.soli-ancient-site.badge': 'Soli Archaeologist',
      'places.limassol-municipal-aquarium.name': 'Limassol Municipal Aquarium',
      'places.limassol-municipal-aquarium.description': 'Intimate educational aquarium showcasing local marine life and conservation programmes.',
      'places.limassol-municipal-aquarium.badge': 'Limassol Reef Guardian',
      'places.dasoudi-beach.name': 'Dasoudi Beach',
      'places.dasoudi-beach.description': 'Sandy beach in Limassol with a coastal park, walking paths and shady green areas.',
      'places.dasoudi-beach.badge': 'Dasoudi Enthusiast',
      'places.governors-beach.name': 'Governor\'s Beach',
      'places.governors-beach.description': 'Beach between Limassol and Larnaca with white rocks, mixed sand and gravel, and reefs near the shore.',
      'places.governors-beach.badge': 'Cliff Explorer',
      'places.macronissos-beach.name': 'Macronissos Beach',
      'places.macronissos-beach.description': 'Sheltered bay with pale sand and calm waters near Ayia Napa—ideal for families.',
      'places.macronissos-beach.badge': 'Macronissos Beachgoer',
      'places.yeroskipou-town.name': 'Yeroskipou (Kouklia)',
      'places.yeroskipou-town.description': 'Town near Paphos with Agios Georgios church and the island\'s famous pastelli sweets.',
      'places.yeroskipou-town.badge': 'Pastelli Taster',
      'places.agios-neophytos-monastery.name': 'Agios Neophytos Monastery',
      'places.agios-neophytos-monastery.description': 'Hermit monastery carved into the rock, decorated with frescoes founded by Saint Neophytos.',
      'places.agios-neophytos-monastery.badge': 'Neophytos Chronicler',
      'places.vouni-ancient-house.name': 'Ancient Assembly House in Vouni',
      'places.vouni-ancient-house.description': 'Hilltop archaeological ruins at Vouni overlooking the bays and former royal residences.',
      'places.vouni-ancient-house.badge': 'Vouni Guardian',
      'places.nicosia-archaeological-museum.name': 'Nicosia Archaeological Museum',
      'places.nicosia-archaeological-museum.description': 'Museum tracing Cyprus\' history from prehistory to the Middle Ages with a rich artefact collection.',
      'places.nicosia-archaeological-museum.badge': 'Nicosia Curator',
      'places.buyuk-han.name': 'Büyük Han in Nicosia',
      'places.buyuk-han.description': 'Ottoman-era caravanserai courtyard filled with artisan workshops and cafés.',
      'places.buyuk-han.badge': 'Han Merchant',
      'places.ledra-street.name': 'Ledra Street and Gate',
      'places.ledra-street.description': 'One of Old Nicosia\'s main streets crossing the Green Line between south and north.',
      'places.ledra-street.badge': 'Ledra Wanderer',
      'places.eleftheria-square.name': 'Eleftheria Square',
      'places.eleftheria-square.description': 'Zaha Hadid-designed square in Nicosia that bridges the city\'s historic and contemporary layers.',
      'places.eleftheria-square.badge': 'Eleftheria Explorer',
      'places.anexartisias-street.name': 'Anexartisias Street in Limassol',
      'places.anexartisias-street.description': 'Limassol\'s main shopping street, loved by locals and visitors for boutiques and cafés.',
      'places.anexartisias-street.badge': 'Window Shopper',
      'places.fasouri-watermania.name': 'Fasouri Watermania Waterpark',
      'places.fasouri-watermania.description': 'Cyprus\' largest waterpark with numerous slides, themed pools and relaxation zones.',
      'places.fasouri-watermania.badge': 'Slide Master',
      'places.akamas-national-park.name': 'Akamas National Park',
      'places.akamas-national-park.description': 'Expansive wilderness with viewpoints, trails and turtle nesting beaches.',
      'places.akamas-national-park.badge': 'Akamas Ranger',
      'places.panagia-kykkos-viewpoint.name': 'Panagia Kykkos Monastery Viewpoint',
      'places.panagia-kykkos-viewpoint.description': 'High viewpoint beside Kykkos Monastery with panoramic Troodos mountain vistas.',
      'places.panagia-kykkos-viewpoint.badge': 'Kykkos Pilgrim',
      'places.troodos-square.name': 'Troodos Square',
      'places.troodos-square.description': 'Central hub of the Troodos mountains with trailheads and a winter ski base.',
      'places.troodos-square.badge': 'Troodos Explorer',
      'places.avakas-gorge-west-entrance.name': 'Avakas Gorge West Entrance',
      'places.avakas-gorge-west-entrance.description': 'Alternative entry to Avakas Gorge offering quieter trekking and different rock formations.',
      'places.avakas-gorge-west-entrance.badge': 'Avakas Tracker',
      'places.cape-greco-sea-caves.name': 'Cape Greco Sea Caves',
      'places.cape-greco-sea-caves.description': 'Spectacular sea caves in the cliffs of Cape Greco, reachable by boat, kayak or snorkel.',
      'places.cape-greco-sea-caves.badge': 'Cave Seeker',
      'places.cyprus-museum.name': 'Cyprus Museum in Nicosia',
      'places.cyprus-museum.description': 'Cyprus\' national archaeological museum with collections spanning every historical era.',
      'places.cyprus-museum.badge': 'Heritage Guardian',
    },
  };

  const defaultHtml = new WeakMap();
  const attributeDefaults = new WeakMap();
  let currentLanguage = DEFAULT_LANGUAGE;

  function storeDefaultHtml(element) {
    if (!defaultHtml.has(element)) {
      defaultHtml.set(element, element.innerHTML);
    }
  }

  function storeDefaultAttributes(element, attributes) {
    if (!attributeDefaults.has(element)) {
      attributeDefaults.set(element, {});
    }
    const stored = attributeDefaults.get(element);
    attributes.forEach((name) => {
      if (!(name in stored)) {
        stored[name] = element.getAttribute(name);
      }
    });
  }

  function restoreAttributes(element) {
    const stored = attributeDefaults.get(element);
    if (!stored) return;
    Object.entries(stored).forEach(([name, value]) => {
      if (value === null || value === undefined) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value);
      }
    });
  }

  function applyAttributes(element, attributes) {
    const names = Object.keys(attributes);
    if (!names.length) {
      restoreAttributes(element);
      return;
    }
    storeDefaultAttributes(element, names);
    names.forEach((name) => {
      const value = attributes[name];
      if (value === null || value === undefined) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value);
      }
    });
  }

  function applyElementTranslation(element, language) {
    storeDefaultHtml(element);
    if (language === DEFAULT_LANGUAGE) {
      element.innerHTML = defaultHtml.get(element);
      restoreAttributes(element);
      return;
    }

    const key = element.dataset.i18nKey;
    const translation = translations[language] && translations[language][key];

    if (!translation) {
      element.innerHTML = defaultHtml.get(element);
      restoreAttributes(element);
      return;
    }

    if (typeof translation === 'string') {
      element.innerHTML = translation;
      restoreAttributes(element);
      return;
    }

    if (translation.html !== undefined) {
      element.innerHTML = translation.html;
    } else if (translation.text !== undefined) {
      element.textContent = translation.text;
    } else {
      element.innerHTML = defaultHtml.get(element);
    }

    if (translation.attributes) {
      applyAttributes(element, translation.attributes);
    } else {
      restoreAttributes(element);
    }
  }

  function applyLanguage(language) {
    const lang = SUPPORTED_LANGUAGES[language] ? language : DEFAULT_LANGUAGE;
    currentLanguage = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = SUPPORTED_LANGUAGES[lang].dir || 'ltr';

    document.querySelectorAll('[data-i18n-key]').forEach((element) => {
      applyElementTranslation(element, lang);
    });
  }

  function persistLanguage(language) {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      console.warn('Unable to persist language preference', error);
    }
  }

  function loadLanguagePreference() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGUAGES[stored]) {
        return stored;
      }
    } catch (error) {
      console.warn('Unable to load language preference', error);
    }
    return DEFAULT_LANGUAGE;
  }

  function setLanguage(language) {
    const next = SUPPORTED_LANGUAGES[language] ? language : DEFAULT_LANGUAGE;
    if (currentLanguage === next) {
      return;
    }
    persistLanguage(next);
    applyLanguage(next);
    updateSwitcherValue(next);
    document.dispatchEvent(
      new CustomEvent('wakacjecypr:languagechange', {
        detail: { language: next },
      })
    );
  }

  function updateSwitcherValue(language) {
    const select = document.getElementById('languageSwitcherSelect');
    if (select && select.value !== language) {
      select.value = language;
    }
  }

  function createLanguageSwitcher() {
    if (document.getElementById('languageSwitcherSelect')) {
      return;
    }

    const container = document.createElement('div');
    container.className = 'language-switcher';

    const label = document.createElement('label');
    label.className = 'language-switcher-label';
    label.htmlFor = 'languageSwitcherSelect';
    label.dataset.i18nKey = 'language.switcher.label';
    label.textContent = 'Język';

    const select = document.createElement('select');
    select.id = 'languageSwitcherSelect';
    select.className = 'language-switcher-select';
    select.setAttribute('aria-label', 'Language selector');

    Object.entries(SUPPORTED_LANGUAGES).forEach(([code, info]) => {
      const option = document.createElement('option');
      option.value = code;
      option.dataset.i18nKey = `language.option.${code}`;
      option.textContent = `${info.flag} ${info.label}`;
      select.append(option);
    });

    select.addEventListener('change', (event) => {
      const value = event.target.value;
      setLanguage(value);
    });

    container.append(label, select);
    document.body.append(container);
  }

  function init() {
    createLanguageSwitcher();
    const initialLanguage = loadLanguagePreference();
    updateSwitcherValue(initialLanguage);
    applyLanguage(initialLanguage);
  }

  document.addEventListener('DOMContentLoaded', init);

  window.appI18n = {
    get language() {
      return currentLanguage;
    },
    setLanguage,
    applyLanguage,
    translations,
  };
})();
