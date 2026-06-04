#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const translationDir = path.join(rootDir, 'translations');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTranslationLeaf(value) {
  if (!isPlainObject(value)) {
    return true;
  }

  return (
    typeof value.text === 'string'
    || typeof value.html === 'string'
  );
}

function flattenTranslations(value, prefix = '', output = {}, sources = {}, source = 'nested') {
  if (!prefix && !isPlainObject(value)) {
    return output;
  }

  if (prefix && isTranslationLeaf(value)) {
    if (sources[prefix] === 'direct' && source !== 'direct') {
      return output;
    }
    output[prefix] = value;
    sources[prefix] = source;
    return output;
  }

  Object.entries(value || {}).forEach(([key, child]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    const nextSource = !prefix && key.includes('.') ? 'direct' : source;
    flattenTranslations(child, nextKey, output, sources, nextSource);
  });

  return output;
}

function hasHebrew(value) {
  return /[\u0590-\u05FF]/.test(String(value || ''));
}

async function readJson(language) {
  const filePath = path.join(translationDir, `${language}.json`);
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(language, value) {
  const filePath = path.join(translationDir, `${language}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function setValue(target, key, value, mode = 'missing') {
  if (mode === 'missing' && Object.prototype.hasOwnProperty.call(target, key)) {
    return false;
  }
  target[key] = value;
  return true;
}

const enManual = {
  'account.profile.changeAvatar': '📷 Change photo',
  'account.profile.removeAvatar': '🗑️ Remove',
  'auth.close.aria': 'Close',
  'auth.close.label': 'Close sign-in modal',
  'carRental.common.close': 'Close',
  'community.comment.refreshing': 'Refreshing...',
  'community.comment.sending': 'Sending...',
  'community.comment.sendingPhotos': 'Uploading photos...',
  'header.profile': 'My Profile',
  'nav.mediaTrips': '✨ VIP private trips',
  'plan.ui.catalog.checkInDay': 'Check-in day',
  'plan.ui.catalog.checkOutDay': 'Check-out day',
  'plan.ui.catalog.confirmRange': 'Confirm range',
  'plan.ui.catalog.daysCount': 'days',
  'plan.ui.catalog.dropoffDay': 'Drop-off day',
  'plan.ui.catalog.pickupDay': 'Pick-up day',
  'plan.ui.details.address': 'Address',
  'plan.ui.details.category': 'Category',
  'plan.ui.details.checkIn': 'Check-in',
  'plan.ui.details.checkOut': 'Check-out',
  'plan.ui.details.city': 'City',
  'plan.ui.details.coordinates': 'Coordinates',
  'plan.ui.details.deposit': 'Deposit',
  'plan.ui.details.duration': 'Duration',
  'plan.ui.details.features': 'Features',
  'plan.ui.details.fromPrice': 'From',
  'plan.ui.details.fuel': 'Fuel',
  'plan.ui.details.included': 'Included',
  'plan.ui.details.location': 'Location',
  'plan.ui.details.model': 'Model',
  'plan.ui.details.notIncluded': 'Not included',
  'plan.ui.details.price': 'Price',
  'plan.ui.details.pricingModel': 'Pricing model',
  'plan.ui.details.seats': 'Seats',
  'plan.ui.details.startCity': 'Start city',
  'plan.ui.details.transmission': 'Transmission',
  'plan.ui.details.type': 'Type',
  'profile.basicInfo': 'Basic information',
  'profile.email.change': 'Change email',
  'profile.email.label': 'Email address',
  'profile.error.generic': 'Something went wrong. Try again.',
  'profile.error.passwordMismatch': 'Passwords do not match',
  'profile.modal.delete.confirm': 'Yes, delete my account',
  'profile.modal.delete.title': 'Are you sure?',
  'profile.modal.email.info': 'We will send a confirmation link to the new address.',
  'profile.modal.email.new': 'New email address',
  'profile.modal.email.title': 'Change email address',
  'profile.modal.password.confirm': 'Confirm new password',
  'profile.modal.password.new': 'New password',
  'profile.modal.password.submit': 'Change password',
  'profile.modal.password.title': 'Change password',
  'profile.name.label': 'Name / Display name',
  'profile.profile': 'Profile',
  'profile.referral': 'Refer friends',
  'profile.referral.copied': 'Copied!',
  'profile.referral.copy': 'Copy link',
  'profile.referral.desc': 'Share your referral link and earn bonuses when friends join CyprusEye.',
  'profile.referral.earned': 'XP earned',
  'profile.referral.invited': 'Invited',
  'profile.save': 'Save changes',
  'profile.security': 'Security',
  'profile.security.delete': 'Delete account',
  'profile.security.delete.warning': 'Deleting your account is irreversible. You will lose all progress and badges.',
  'profile.security.password.change': 'Change password',
  'profile.success.email': 'Confirmation link sent to the new address',
  'profile.success.password': 'Password changed',
  'profile.success.updated': 'Profile updated successfully',
  'profile.username.label': 'Username',
  'shop.filters.tags': 'Popular tags',
  'shop.footer.about_text': 'CyprusEye Shop delivers authentic Cypriot products directly from local producers. We carefully select each product to ensure top quality and the real taste of Cyprus.',
  'shop.hero.subtitle': 'Discover authentic tastes and handmade goods from Cyprus, from premium olive oil and halloumi to local wines and handmade cosmetics.',
  'shop.pageTitle': 'CyprusEye Shop - Traditional Products from Cyprus',
  'shop.sort.popular': 'Most popular',
};

const heManual = {
  'account.profile.changeAvatar': '📷 החלפת תמונה',
  'account.profile.removeAvatar': '🗑️ הסרה',
  'carRental.common.close': 'סגור',
  'community.comment.refreshing': 'מרענן...',
  'community.comment.sending': 'שולח...',
  'community.comment.sendingPhotos': 'מעלה תמונות...',
  'header.profile': 'הפרופיל שלי',
  'plan.ui.catalog.checkInDay': 'יום צ׳ק-אין',
  'plan.ui.catalog.checkOutDay': 'יום צ׳ק-אאוט',
  'plan.ui.catalog.confirmRange': 'אישור טווח',
  'plan.ui.catalog.daysCount': 'ימים',
  'plan.ui.catalog.dropoffDay': 'יום החזרה',
  'plan.ui.catalog.pickupDay': 'יום איסוף',
  'plan.ui.details.address': 'כתובת',
  'plan.ui.details.category': 'קטגוריה',
  'plan.ui.details.checkIn': 'צ׳ק-אין',
  'plan.ui.details.checkOut': 'צ׳ק-אאוט',
  'plan.ui.details.city': 'עיר',
  'plan.ui.details.coordinates': 'קואורדינטות',
  'plan.ui.details.deposit': 'פיקדון',
  'plan.ui.details.duration': 'משך',
  'plan.ui.details.features': 'מאפיינים',
  'plan.ui.details.fromPrice': 'החל מ-',
  'plan.ui.details.fuel': 'דלק',
  'plan.ui.details.included': 'כלול',
  'plan.ui.details.location': 'מיקום',
  'plan.ui.details.model': 'דגם',
  'plan.ui.details.notIncluded': 'לא כלול',
  'plan.ui.details.price': 'מחיר',
  'plan.ui.details.pricingModel': 'מודל תמחור',
  'plan.ui.details.seats': 'מושבים',
  'plan.ui.details.startCity': 'עיר התחלה',
  'plan.ui.details.transmission': 'תיבת הילוכים',
  'plan.ui.details.type': 'סוג',
  'profile.basicInfo': 'מידע בסיסי',
  'profile.email.change': 'שינוי אימייל',
  'profile.email.label': 'כתובת אימייל',
  'profile.error.generic': 'משהו השתבש. נסו שוב.',
  'profile.error.passwordMismatch': 'הסיסמאות אינן תואמות',
  'profile.modal.delete.confirm': 'כן, למחוק את החשבון שלי',
  'profile.modal.delete.title': 'האם אתם בטוחים?',
  'profile.modal.email.info': 'נשלח קישור אישור לכתובת החדשה.',
  'profile.modal.email.new': 'כתובת אימייל חדשה',
  'profile.modal.email.title': 'שינוי כתובת אימייל',
  'profile.modal.password.confirm': 'אישור סיסמה חדשה',
  'profile.modal.password.new': 'סיסמה חדשה',
  'profile.modal.password.submit': 'שינוי סיסמה',
  'profile.modal.password.title': 'שינוי סיסמה',
  'profile.name.label': 'שם / שם לתצוגה',
  'profile.profile': 'פרופיל',
  'profile.referral': 'הזמנת חברים',
  'profile.referral.copied': 'הועתק!',
  'profile.referral.copy': 'העתקת קישור',
  'profile.referral.desc': 'שתפו את קישור ההפניה שלכם וקבלו בונוסים כשחברים מצטרפים ל-CyprusEye.',
  'profile.referral.earned': 'XP שנצבר',
  'profile.referral.invited': 'הוזמנו',
  'profile.save': 'שמירת שינויים',
  'profile.security': 'אבטחה',
  'profile.security.delete': 'מחיקת חשבון',
  'profile.security.delete.warning': 'מחיקת החשבון אינה הפיכה. תאבדו את כל ההתקדמות והתגים.',
  'profile.security.password.change': 'שינוי סיסמה',
  'profile.success.email': 'קישור אישור נשלח לכתובת החדשה',
  'profile.success.password': 'הסיסמה שונתה',
  'profile.success.updated': 'הפרופיל עודכן בהצלחה',
  'profile.username.label': 'שם משתמש',
  'shop.filters.tags': 'תגים פופולריים',
  'shop.sort.popular': 'הפופולריים ביותר',
};

const runtimeSafetyOverrides = {
  pl: {
    'auth.status.loggedInAs': 'Grasz jako {{username}}',
    'auth.status.welcome': 'Witaj w grze, {{username}}!',
    'auth.status.welcomeBack': 'Witaj ponownie, {{username}}!',
    'dailyChallenge.focusSet': 'Cel ustawiony na {{name}}.',
    'dailyChallenge.status.completed': 'Ukończono! Dodano bonus +{{bonus}} XP.',
    'dailyChallenge.toast.new': 'Nowe wyzwanie: {{name}}.',
    'dailyStreak.message.reset': 'Rozpocznij nową serię i spróbuj pobić rekord {{best}} dni.',
    'locations.toggle.showAll': 'Pokaż wszystkie atrakcje ({{total}})',
    'mediaTrips.card.extraPersonSuffix': ' (+{{price}} / dodatkowa osoba)',
    'mediaTrips.card.includedParticipants': ' (do {{count}} osób)',
    'mediaTrips.card.priceFrom': 'Cena od{{included}}: <strong>{{price}}</strong>',
    'mediaTrips.card.variantOption': '{{label}} — {{price}}{{extra}}',
    'notifications.level.up': '🏆 Poziom w górę! Osiągnięto poziom {{level}}.',
    'notifications.task.completed': '🎯 Zadanie ukończone: „{{title}}” (+{{xp}} XP).',
    'places.badge.geo': '{{name}} • Potwierdzono przez geolokalizację.',
    'places.badge.manual': '{{name}} • Odznaka przyznana ręcznie.',
    'places.objective.nextAria': 'Przejdź do następnego miejsca: {{name}}',
    'places.objective.nextTitle': 'Przejdź do {{name}}',
    'places.objective.previousAria': 'Przejdź do poprzedniego miejsca: {{name}}',
    'places.objective.previousTitle': 'Przejdź do {{name}}',
    'places.search.results': 'Znaleziono {{found}} z {{total}}',
    'places.search.total': '{{total}} w katalogu',
    'places.toast.badge': 'Zdobyto odznakę „{{badge}}”!',
    'places.toast.dailyBonus': '🎯 Wyzwanie dnia ukończone! Dodano bonus +{{xp}} XP.',
    'places.toast.dailyChallenge': 'Ukończono dzisiejsze wyzwanie w {{name}}! +{{xp}} XP',
    'places.toast.streakContinue': '🔥 Twoja seria ma już {{days}} dni. Tak trzymaj!',
    'places.toast.streakReset': 'Rozpoczęto nową serię. Spróbuj pobić rekord {{days}} dni!',
    'sync.progress.updated': 'Zsynchronizowano postęp: +{{xp}} XP z innego urządzenia',
    'vip.calculator.output.estimate': 'Szacunkowa cena: {{amount}}',
    'vip.reservation.price.estimate': 'Szacunkowa cena: {{amount}}',
  },
  en: {
    'dailyChallenge.focusSet': 'Objective set to {{name}}.',
    'dailyChallenge.status.completed': 'Completed! Bonus +{{bonus}} XP added.',
    'dailyChallenge.toast.new': 'New challenge: {{name}}.',
    'dailyStreak.message.reset': 'Start a new streak and beat your record of {{best}} days.',
    'locations.toggle.showAll': 'Show all {{total}} attractions',
  },
  he: {
    'auth.status.loggedInAs': 'אתם משחקים בתור {{username}}',
    'auth.status.welcome': 'ברוכים הבאים למשחק, {{username}}!',
    'auth.status.welcomeBack': 'ברוכים השבים, {{username}}!',
    'carRental.calculator.breakdown.base': 'בסיס',
    'dailyChallenge.focusSet': 'היעד הוגדר ל-{{name}}.',
    'dailyChallenge.status.completed': 'הושלם! נוסף בונוס של +{{bonus}} XP.',
    'dailyChallenge.toast.new': 'אתגר חדש: {{name}}.',
    'dailyStreak.message.reset': 'התחילו רצף חדש ונסו לשבור את השיא של {{best}} ימים.',
    'locations.toggle.showAll': 'הצגת כל האטרקציות ({{total}})',
    'mediaTrips.card.extraPersonSuffix': ' (+{{price}} / אדם נוסף)',
    'mediaTrips.card.includedParticipants': ' (עד {{count}} אנשים)',
    'mediaTrips.card.priceFrom': 'מחיר החל מ-{{included}}: <strong>{{price}}</strong>',
    'mediaTrips.card.variantOption': '{{label}} — {{price}}{{extra}}',
    'metrics.xp.progress': 'התקדמות XP',
    'metrics.xp.progressTemplate': '{{current}} / {{target}} XP',
    'notifications.level.up': '🏆 עליתם רמה! הגעתם לרמה {{level}}.',
    'notifications.task.completed': '🎯 המשימה הושלמה: “{{title}}” (+{{xp}} XP).',
    'places.badge.geo': '{{name}} • אושר באמצעות מיקום.',
    'places.badge.manual': '{{name}} • התג הוענק ידנית.',
    'places.objective.nextAria': 'מעבר למקום הבא: {{name}}',
    'places.objective.nextTitle': 'מעבר אל {{name}}',
    'places.objective.previousAria': 'מעבר למקום הקודם: {{name}}',
    'places.objective.previousTitle': 'מעבר אל {{name}}',
    'places.search.results': 'נמצאו {{found}} מתוך {{total}}',
    'places.search.total': '{{total}} בקטלוג',
    'places.toast.badge': 'קיבלתם את התג “{{badge}}”!',
    'places.toast.dailyBonus': '🎯 האתגר היומי הושלם! נוסף בונוס של +{{xp}} XP.',
    'places.toast.dailyChallenge': 'השלמתם את האתגר היומי ב-{{name}}! +{{xp}} XP',
    'places.toast.streakContinue': '🔥 הרצף שלכם הוא עכשיו {{days}} ימים. המשיכו כך!',
    'places.toast.streakReset': 'רצף חדש התחיל. נסו לשבור את השיא של {{days}} ימים!',
    'sync.progress.updated': 'ההתקדמות סונכרנה: +{{xp}} XP ממכשיר אחר',
    'vip.calculator.output.estimate': 'מחיר משוער: {{amount}}',
    'vip.reservation.price.estimate': 'מחיר משוער: {{amount}}',
  },
};

const copyEnglishFromExistingHePrefixes = [
  'account.confirm.',
  'account.status.',
  'achievements.',
  'auth.close.',
  'carRental.categories.',
  'carRental.fleet.',
  'carRental.included.',
  'carRental.locations.',
  'checkIn.',
  'coupon.',
  'dailyChallenge.',
  'dailyStreak.',
  'locations.',
  'map.',
  'nav.mediaTrips',
  'objective.',
  'tripPlanner.',
];

const heShortOverrides = {
  'account.confirm.guestReset': 'האם למחוק את התקדמות האורח? לא ניתן לבטל פעולה זו.',
  'account.confirm.reset': 'האם לאפס את ההתקדמות? לא ניתן לבטל פעולה זו.',
  'account.status.guestProgressReset': 'סטטיסטיקת האורח נמחקה. חזרתם לרמה 1!',
  'account.status.progressRestart': 'אתם מתחילים את המשחק מחדש — בהצלחה!',
  'account.status.resetNotAvailable': 'אתם מחוברים — השתמשו בהגדרות החשבון כדי לאפס התקדמות.',
  'achievements.back': '← חזרה לאפליקציה',
  'achievements.brand.logoAlt': 'CyprusEye.com - עין עם קווי מתאר של האי קפריסין בפנים.',
  'achievements.brand.overline': 'משחק הטיול שלכם בקפריסין',
  'achievements.brand.title': 'CyprusEye Save & Travel',
  'achievements.emptyBadges': 'עדיין אין תגים — זמן להרפתקה הראשונה!',
  'achievements.footer': '© <span id="year"></span> CyprusEye.com – שחקו, טיילו והשרו מטיילים נוספים.',
  'achievements.hero.badges': 'תגים שנאספו',
  'achievements.hero.intro': 'עקבו אחר ההתקדמות, בדקו תגים שהרווחתם ותכננו את ההרפתקאות הבאות. כל הנתונים מסתנכרנים אוטומטית עם אפליקציית CyprusEye Save & Travel.',
  'achievements.hero.level': 'רמת המטייל הנוכחית',
  'achievements.hero.level.suffix': 'רמה',
  'achievements.hero.statsLabel': 'סטטיסטיקות נוכחיות',
  'achievements.hero.title': 'התגים והרמות שלכם',
  'achievements.hero.visited': 'מקומות שביקרתם בהם',
  'achievements.history.empty': 'עדיין אין תגים — זמן להרפתקה הראשונה!',
  'achievements.history.subtitle': 'הרשימה מתעדכנת אחרי כל צ׳ק-אין. לחצו על כל פריט באפליקציה הראשית כדי לראות אותו במפה או לתכנן ביקור נוסף.',
  'achievements.history.title': 'מקומות שביקרתם בהם ותגים שהרווחתם',
  'achievements.meta.title': 'CyprusEye Save & Travel – ההישגים שלכם',
  'achievements.nav.aria': 'ניווט קיצורי דרך',
  'achievements.nav.current': '🏅 הישגים',
  'achievements.progress.chartLabel': 'סרגל התקדמות XP',
  'achievements.progress.empty': 'התחילו לגלות את קפריסין כדי לצבור את ה-XP הראשון שלכם!',
  'achievements.progress.next.description': 'בדקו כמה נשאר עד הרמה הבאה — השלימו משימות או בקרו במקום חדש.',
  'achievements.progress.subtitle': 'צברו XP כדי לפתוח משימות, אתגרים ומיקומים חדשים — כל צ׳ק-אין מקדם אתכם.',
  'achievements.progress.title': 'התקדמות XP',
  'achievements.progress.total.description': 'סך נקודות ה-XP שנצברו בכל הפעילויות.',
  'achievements.progress.total.suffix': 'XP סה״כ',
  'checkIn.manualConfirm.action': 'אני מאשר/ת שאני במקום',
  'checkIn.manualConfirm.success': 'התג הוענק!',
  'coupon.hero.aria': 'אזור קידום',
  'coupon.hero.ctaAria': 'הצגת ההצעות',
  'coupon.hero.priceAria': 'מחיר לאחר הנחה',
  'coupon.hero.savings': 'אתם חוסכים',
  'coupon.info.subtitle': 'קופון אחד, הרבה הנחות — השתמשו במקומות מורשים.',
  'coupon.info.title': 'איך הקופון עובד',
  'coupon.nav.mediaTrips': 'טיולי מדיה',
  'coupon.nav.services': 'שירותים',
  'dailyChallenge.noneAvailable': 'אין אתגרים זמינים. פתחו עוד אטרקציות כדי לקבל משימות.',
  'dailyChallenge.noneToShuffle': 'אין אתגרים נוספים להגרלה. פתחו עוד אטרקציות כדי לקבל משימות חדשות.',
  'dailyChallenge.placeholderDescription': 'עשו צ׳ק-אין בכל אטרקציה כדי להתחיל את המשימה היומית.',
  'dailyChallenge.placeholderTitle': 'גלו מקום חדש',
  'dailyChallenge.status.active': 'עשו צ׳ק-אין באטרקציה הזו היום כדי לקבל XP נוסף!',
  'dailyChallenge.status.locked': 'הגיעו לרמה גבוהה יותר כדי לפתוח את האתגר הזה או הגרילו אחר.',
  'dailyChallenge.status.visited': 'כבר יש לכם את התג הזה. הגרילו אתגר חדש או חזרו מחר.',
  'dailyStreak.message.keepGoing': 'המשיכו לגלות מקומות כדי להאריך את רצף הצ׳ק-אין.',
  'dailyStreak.message.start': 'עשו צ׳ק-אין בכל אטרקציה כדי להתחיל רצף.',
  'dailyStreak.message.today': 'מעולה! הצ׳ק-אין של היום שמר על הרצף. חזרו מחר ליום נוסף.',
  'dailyStreak.message.warning': 'עדיין יש לכם זמן היום לשמור על הרצף — בקרו במקום כלשהו וצברו XP.',
  'locations.highlight.aria': 'מעבר לאזור השכרת הרכב בקפריסין',
  'locations.highlight.subtitle': 'אספו את הרכב בשדה התעופה או ישירות מהמלון',
  'locations.highlight.title': 'השכרת רכב בקפריסין',
  'locations.toggle.hide': 'הסתרת חלק מהרשימה',
  'map.geolocation.enableSharing': 'הפעילו שיתוף מיקום כדי לראות את המיקום שלכם במפה.',
  'map.geolocation.noSupport': 'הדפדפן שלכם אינו תומך במיקום גיאוגרפי — מיקום השחקן לא יוצג.',
  'map.geolocation.secureContextRequired': 'השתמשו בחיבור מאובטח (HTTPS) כדי לשתף את המיקום שלכם.',
  'map.playerLocation': 'המיקום שלכם',
  'nav.mediaTrips': 'טיולי VIP',
  'nav.mediaTrips.ariaLabel': 'פתיחת עמוד טיולי ה-VIP האישיים',
  'objective.next': 'המקום הבא ←',
  'tripPlanner.selectStart': 'בחרו נקודת התחלה כדי לתכנן את היום.',
  'tripPlanner.selectStops': 'הוסיפו לפחות אטרקציה אחת כדי לראות בונוס XP וזמן טיול.',
  'tripPlanner.startBadge': 'התחלה',
};

function shouldCopyEnglishFromHe(key, heValue) {
  if (typeof heValue !== 'string' || hasHebrew(heValue)) {
    return false;
  }
  return copyEnglishFromExistingHePrefixes.some((prefix) => key === prefix || key.startsWith(prefix));
}

async function main() {
  const pl = await readJson('pl');
  const en = await readJson('en');
  const he = await readJson('he');

  const flatPl = flattenTranslations(pl);
  const flatEn = flattenTranslations(en);
  const flatHe = flattenTranslations(he);

  const stats = {
    enManual: 0,
    enCopiedFromExistingHe: 0,
    heManual: 0,
    heShortOverrides: 0,
    runtimeSafety: 0,
  };

  Object.entries(enManual).forEach(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(flatEn, key) && setValue(en, key, value)) {
      stats.enManual += 1;
    }
  });

  Object.entries(heManual).forEach(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(flatHe, key) && setValue(he, key, value)) {
      stats.heManual += 1;
    }
  });

  Object.keys(flatPl).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(flatEn, key)) {
      return;
    }
    const heValue = flatHe[key];
    if (shouldCopyEnglishFromHe(key, heValue) && setValue(en, key, heValue)) {
      stats.enCopiedFromExistingHe += 1;
    }
  });

  Object.entries(heShortOverrides).forEach(([key, value]) => {
    if (setValue(he, key, value, 'override')) {
      stats.heShortOverrides += 1;
    }
  });

  Object.entries(runtimeSafetyOverrides).forEach(([language, values]) => {
    const target = { pl, en, he }[language];
    Object.entries(values).forEach(([key, value]) => {
      if (setValue(target, key, value, 'override')) {
        stats.runtimeSafety += 1;
      }
    });
  });

  await writeJson('pl', pl);
  await writeJson('en', en);
  await writeJson('he', he);

  console.log('Stage44 static translations applied.');
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
