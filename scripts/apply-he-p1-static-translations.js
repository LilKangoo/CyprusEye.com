#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const enPath = path.join(rootDir, 'translations', 'en.json');
const hePath = path.join(rootDir, 'translations', 'he.json');
const auditPath = path.join(rootDir, 'translations', 'audit-he-vs-en.json');
const reviewPath = path.join(rootDir, 'docs', 'he-p1-human-review.md');

const STAGE = 'stage24_p1_public_static';

const PUBLIC_MISSING_ROOTS = [
  'badges',
  'blogUi',
  'community',
  'coupon',
  'currentPlace',
  'home',
  'legal',
  'map',
  'plan',
  'recommendations',
  'referral',
  'sos',
  'tasks',
  'tutorial',
];

const SAME_AS_EN_ROOTS = [
  'coupon',
  'notFound',
  'sos',
  'tasks',
  'tutorial',
];

const INTENTIONALLY_DEFERRED_ROOTS = [
  'advertise',
  'dashboard',
  'seo',
  'shop',
];

const TRANSLATIONS = {
  'badges.landmark': 'אתר חשוב',

  'blogUi.admin.allowComments': 'לאפשר תגובות',
  'blogUi.admin.approve': 'לאשר',
  'blogUi.admin.featured': 'מומלץ',
  'blogUi.admin.newPost': 'פוסט חדש',
  'blogUi.admin.reject': 'לדחות',
  'blogUi.admin.submissionStatus': 'סטטוס הגשה',
  'blogUi.admin.title': 'בלוג',
  'blogUi.list.all': 'כל הפוסטים',
  'blogUi.list.featured': 'מומלצים',
  'blogUi.list.filteredEmpty': 'אין עדיין פוסטים שמתאימים למסנן הזה.',
  'blogUi.list.heroEyebrow': 'יומן CyprusEye',
  'blogUi.list.heroSubtitle': 'מאמרים נבחרים, מדריכים וטיפים שמחוברים לשירותים שאפשר להזמין באפליקציה.',
  'blogUi.list.heroTitle': 'סיפורים, מדריכים וטיפים מעשיים מקפריסין.',
  'blogUi.list.next': 'הבא',
  'blogUi.list.previous': 'הקודם',
  'blogUi.list.readMore': 'קריאת המאמר',
  'blogUi.post.byline': 'נכתב על ידי',
  'blogUi.post.ctaEyebrow': 'המשיכו עם CyprusEye',
  'blogUi.post.ctaTitle': 'שירותים שימושיים שקשורים למאמר הזה.',
  'blogUi.post.kicker': 'סיפור CyprusEye',
  'blogUi.post.missingSlug': 'קישור המאמר אינו שלם.',
  'blogUi.post.notFound': 'לא הצלחנו למצוא את פוסט הבלוג הזה.',
  'blogUi.post.sidebarHeading': 'סקירה מהירה',

  'community.action.cancel': 'ביטול',
  'community.action.delete': '🗑️ מחיקה',
  'community.action.edit': '✏️ עריכה',
  'community.action.reply': '💬 תגובה',
  'community.action.respond': 'להגיב',
  'community.action.save': 'שמירה',
  'community.checkin.alreadyVisited': 'כבר ביקרתם',
  'community.checkin.button': 'צ׳ק-אין',
  'community.checkin.denied': 'הרשאת המיקום נדחתה',
  'community.checkin.far': 'מרחק: {{distance}} ק״מ',
  'community.checkin.locating': 'מחפשים את המיקום שלכם...',
  'community.checkin.loginRequired': 'התחברו כדי לבצע צ׳ק-אין',
  'community.checkin.near': 'אתם קרובים למקום הזה!',
  'community.checkin.noGeo': 'שירות המיקום אינו זמין',
  'community.checkin.tooFar': 'אתם רחוקים מדי מהמקום הזה. התקרבו קצת!',
  'community.checkin.visited': 'ביקרתם',
  'community.checkin.you': 'המיקום שלכם',
  'community.comments.beFirst': 'היו הראשונים לשתף את ההתרשמות שלכם!',
  'community.comments.count.multiple': '{{count}} תגובות',
  'community.comments.count.one': 'תגובה אחת',
  'community.comments.count.zero': '0 תגובות',
  'community.comments.noComments': 'אין תגובות',
  'community.gallery.openPhoto': 'פתיחת תמונה {{index}}',
  'community.gallery.panoramaBadge': '360°',
  'community.gallery.panoramaBadgeAria': 'תמונת 360',
  'community.gallery.panoramaHint': 'זו תמונת 360°. גררו כדי להסתכל מסביב. הקישו פעם אחת כדי להתחיל.',
  'community.gallery.title': 'תמונות מהמקום',
  'community.photo.add': '📷 הוספת תמונות',
  'community.photos.count.multiple': '{{count}} תמונות',
  'community.photos.count.one': 'תמונה אחת',
  'community.photos.count.zero': '0 תמונות',
  'community.placeholder.reply': 'כתבו תגובה...',
  'community.ranking.title': '🏆 100 המשתמשים המובילים',
  'community.rating.beFirst': 'היו הראשונים לדרג את המקום הזה!',
  'community.rating.multipleRatings': 'דירוגים',
  'community.rating.noRatings': 'אין דירוגים',
  'community.rating.oneRating': 'דירוג',
  'community.rating.prompt': 'לחצו על הכוכבים כדי לדרג',
  'community.rating.title': 'דרגו את המקום הזה',
  'community.rating.yourRating': 'הדירוג שלכם: {{rating}}★',
  'community.rsvp.go': 'אני בפנים',
  'community.rsvp.no': 'לא הפעם',
  'community.viewComments': 'הצגת תגובות',
  'community.viewToggle.list': '📋 רשימה',
  'community.viewToggle.ranking': '🏆 דירוג',

  'coupon.conditions.rules.cash': 'לא ניתן להמיר קופונים למזומן - הם בונוס, לא אמצעי תשלום.',
  'coupon.conditions.rules.combine': 'אי אפשר לשלב הנחות עם מבצעים או קודים אחרים - האפשרות הטובה יותר תחול.',
  'coupon.conditions.rules.groupIntro': 'חלק מההנחות חלות על כל הקבוצה, ואחרות רק על אדם אחד - ראו את הפרטים ליד כל הצעה:',
  'coupon.conditions.rules.groupMultiple': {
    html: '<strong>✅ סיורים - €5 הנחה</strong> חלים לכל אדם.',
  },
  'coupon.conditions.rules.groupStay': {
    html: '<strong>✅ אירוח בלפקרה - 15% או 20% הנחה</strong> מחושב ממחיר השהייה הכולל.',
  },
  'coupon.conditions.rules.named': 'הקופון אישי ואינו ניתן לפיצול - אי אפשר לחלק הנחה אחת בין כמה עסקאות.',
  'coupon.conditions.rules.show': 'הציגו את הקופון לפני השימוש בשירות - בטלפון או מודפס.',
  'coupon.conditions.rules.usage': 'כל קופון תקף פעם אחת אצל כל שותף - אפשר לממש הנחות אצל כמה ספקים, אבל רק פעם אחת באותו מקום.',
  'coupon.conditions.rules.verify': 'השותפים יכולים לבדוק את תוקף הקופון - לאחר שימוש, ההנחה מסומנת כמומשה.',
  'coupon.conditions.title': '🏝️ תנאי שימוש בקופון',
  'coupon.hero_kicker': 'הצעה לזמן מוגבל',
  'coupon.how.step1.description': 'השתמשו בקישור למעלה כדי לבחור לכמה אנשים הקופון צריך להתאים.',
  'coupon.how.step1.noteMultiple': {
    html: '<strong>מתי כדאי לקנות כמה קופונים?</strong> לקבוצות גדולות יותר, למשל שייט או סיור, כשכל אחד צריך לקבל את ההנחה.',
  },
  'coupon.how.step1.noteSingle': {
    html: '<strong>מתי קופון אחד מספיק?</strong> אם אתם מתכננים להשתמש רק בהנחות לרכב ולהסעות.',
  },
  'coupon.how.step1.title': 'הזמינו את הקופון',
  'coupon.how.step2.description': 'הזינו את האימייל בזמן התשלום. בתוך חמש דקות תקבלו קופון מוכן לשימוש עבור שירותים שונים באי.',
  'coupon.how.step2.title': 'בדקו את האימייל',
  'coupon.how.step3.description': 'לכל קופון יש מספר ייחודי. הזינו אותו בטפסים אונליין או הציגו אותו לשותפים במקום. אפשר להשתמש בקופון אחד פעם אחת אצל כל שותף במהלך הטיול.',
  'coupon.how.step3.title': 'מימוש הקופון',
  'coupon.how.subtitle': 'בצעו את השלבים כדי לממש הנחות ולעבור לתשלום ב-Stripe. כל שלב לוקח רגע קצר.',
  'coupon.how.title': 'איך קונים קופון?',
  'coupon.offers.items.davinci.benefit': '10% הנחה מעל €50',
  'coupon.offers.items.davinci.category': 'מסעדת Da Vinci’s Garden',
  'coupon.offers.items.davinci.title': 'מטבח קפריסאי',
  'coupon.offers.items.lefkaraLong.benefit': '20% הנחה מ-3 לילות',
  'coupon.offers.items.lefkaraLong.category': 'אירוח Lefkara 7 Kamares',
  'coupon.offers.items.lefkaraLong.title': 'שהיות מ-3 לילות',
  'coupon.offers.items.lefkaraShort.benefit': '15% הנחה עד 2 לילות',
  'coupon.offers.items.lefkaraShort.category': 'אירוח Lefkara 7 Kamares',
  'coupon.offers.items.lefkaraShort.title': 'שהיות עד 2 לילות',
  'coupon.offers.items.noDeposit.benefit': '€10 הנחה על השכרה',
  'coupon.offers.items.noDeposit.category': 'Auto Bez Kaucji',
  'coupon.offers.items.noDeposit.title': 'בכל האי',
  'coupon.offers.items.noDepositPaphos.benefit': '€10 הנחה על השכרה',
  'coupon.offers.items.noDepositPaphos.category': 'Auto Bez Kaucji',
  'coupon.offers.items.noDepositPaphos.title': 'פאפוס',
  'coupon.offers.items.photo.benefit': '5% עד 20% הנחה לכל צילום',
  'coupon.offers.items.photo.category': 'צילומים בלפקרה',
  'coupon.offers.items.photo.title': 'סשני צילום',
  'coupon.offers.items.privateCruise.benefit': '€20 הנחה על שייט',
  'coupon.offers.items.privateCruise.category': 'שייט פרטי באיה נאפה',
  'coupon.offers.items.privateCruise.title': 'שייט פרטי',
  'coupon.offers.items.silver.benefit': '20% הנחה בקנייה',
  'coupon.offers.items.silver.category': 'כסף בלפקרה',
  'coupon.offers.items.silver.title': 'תכשיטים ומזכרות',
  'coupon.offers.items.tours.benefit': '€5 הנחה לכל סיור',
  'coupon.offers.items.tours.category': 'סיורים בקפריסין',
  'coupon.offers.items.tours.title': 'טיולים ברחבי האי',
  'coupon.offers.items.transport.benefit': '€5 הנחה לכל משלוח',
  'coupon.offers.items.transport.category': 'תחבורה בקפריסין',
  'coupon.offers.items.transport.title': 'משלוחים ונסיעות',
  'coupon.offers.subtitle': 'הקופון עובד עם שותפים ברחבי האי. בחרו שירות, שתפו את מספר הקופון וקבלו את ההנחה במקום או בזמן הזמנה אונליין.',
  'coupon.offers.title': 'איפה אפשר לממש את ההנחה',
  'coupon.recommendations.seo.description': 'גלו שותפים אמינים בקפריסין עם הנחות ובונוסים בלעדיים. עיינו בהמלצות הנבחרות ותכננו את הטיול.',
  'coupon.recommendations.seo.title': 'CyprusEye - המלצות',
  'coupon.smallprint': 'תקבלו את הקופון בתוך כמה דקות לאימייל ששימש לתשלום.',
  'coupon.subtitle': 'הדרך הפשוטה ביותר להשתמש בהצעה שלנו - בלי סיבוכים.',
  'coupon.summary.instant': 'הפעלת קופון מיידית',
  'coupon.summary.price_current': '€7.99',
  'coupon.summary.price_label': 'מחיר הקופון',
  'coupon.summary.price_note': 'תשלום חד-פעמי עבור חבילת ההנחות המלאה',
  'coupon.summary.price_original': '€12',
  'coupon.summary.secure': 'תשלום מאובטח ב-Stripe',
  'coupon.summary.secure_note': 'לחיצה על הכפתור תעביר אתכם לתשלום מוצפן ב-Stripe.',
  'coupon.summary.support': 'תמיכה מהצוות שלנו לאחר הרכישה',
  'coupon.title': 'קופון מיוחד - הזמנה מהירה',

  'currentPlace.badge.recommended': 'מומלץ',
  'currentPlace.checkIn': 'צ׳ק-אין',
  'currentPlace.comments': 'תגובות',
  'currentPlace.details': 'פרטים',
  'currentPlace.filter.noItems': 'אין מקומות זמינים במסנן הזה. עברו לתצוגת מפה אחרת.',
  'currentPlace.filter.noVisitPoints': 'אין נקודות ביקור במסנן הזה. עברו ל״הכול״ או ״נקודות ביקור״.',
  'currentPlace.filter.visibleCount': '{{count}} מקומות בתצוגה הנוכחית',
  'currentPlace.heading': 'המקום הנוכחי',
  'currentPlace.info': 'מידע',
  'currentPlace.map': 'מפה',
  'currentPlace.next': 'הבא ←',
  'currentPlace.prev': '→ הקודם',
  'currentPlace.recommendation.offer': 'הצעה',

  'home.blog.badge': 'בלוג',
  'home.blog.cta': 'כל הפוסטים ←',
  'home.blog.description': 'המדריכים, הטיפים והמאמרים האחרונים שאפשר לפתוח ולקרוא מיד.',
  'home.blog.readMore': 'קריאת המאמר',
  'home.blog.title': '📰 מהבלוג של CyprusEye',
  'home.carousel.next': 'הבא',
  'home.carousel.prev': 'הקודם',
  'home.cars.cta': 'כל הרכבים ←',
  'home.cars.description': 'בחרו עיר והזמינו רכב עם תמיכה מלאה 24/7',
  'home.cars.title': '🚗 רכבים ללא פיקדון',
  'home.hotels.cta': 'כל מקומות האירוח ←',
  'home.hotels.description': 'גלו את המלונות, הווילות והדירות הטובים ביותר בקפריסין',
  'home.hotels.title': '🏨 מקומות אירוח',
  'home.trips.cta': 'כל הטיולים ←',
  'home.trips.description': 'בחרו עיר וגלו את הטיולים הטובים ביותר בקפריסין',
  'home.trips.title': '🚤 טיולים',

  'legal.termsLink': 'תנאי שימוש',

  'map.filter.all': 'הכול',
  'map.filter.aria': 'מסנני מפה',
  'map.filter.counter': 'מוצגות {{visible}} מתוך {{total}} נקודות',
  'map.filter.counterBreakdown': 'נקודות ביקור {{poiVisible}}/{{poiTotal}} • מומלצים {{recommendationsVisible}}/{{recommendationsTotal}}',
  'map.filter.hotelsOnly': 'מלונות',
  'map.filter.poiOnly': 'נקודות ביקור',
  'map.filter.recommendationsOnly': 'מקומות מומלצים',

  'notFound.badge': 'שגיאה 404',
  'notFound.description': 'לא הצלחנו לאתר את הדף שחיפשתם. ייתכן שהקישור מיושן או שיש טעות בכתובת.',
  'notFound.help.contact': 'צרו איתנו קשר אם אתם צריכים עזרה נוספת.',
  'notFound.help.home': 'חזרו לדף הבית והתחילו לתכנן את ההרפתקה שלכם בקפריסין.',
  'notFound.help.search': 'השתמשו בחיפוש הקופונים והשירותים כדי למצוא במהירות את החוויה שאתם צריכים.',
  'notFound.help.title': 'מה אפשר לעשות?',
  'notFound.primaryCta': 'חזרה לדף הבית',
  'notFound.secondaryCta': 'עיון במפת האתר',
  'notFound.title': 'הדף לא נמצא',

  'plan.actions.delete': 'מחיקה',
  'plan.actions.email': 'שליחת התוכנית באימייל',
  'plan.actions.pdf': 'הורדת PDF',
  'plan.actions.refresh': 'רענון',
  'plan.booking.dialog.close': 'סגירה',
  'plan.booking.dialog.submit': 'שליחת בקשה',
  'plan.booking.dialog.title': 'בקשת הזמנה',
  'plan.booking.requestAll': 'בקשת הזמנה לכול',
  'plan.catalog.addToDay': 'הוספה ליום:',
  'plan.cost.title': 'סיכום עלויות',
  'plan.days.title': 'ימים',
  'plan.details.title': 'פרטי התוכנית',
  'plan.edit.adults.label': 'מבוגרים',
  'plan.edit.baseCity.label': 'עיר בסיס',
  'plan.edit.children.label': 'ילדים',
  'plan.edit.endDate.label': 'תאריך סיום',
  'plan.edit.includeNorth': 'לכלול את צפון קפריסין',
  'plan.edit.people.label': 'אנשים',
  'plan.edit.regenDays': 'יצירת ימים מחדש',
  'plan.edit.save': 'שמירת שינויים',
  'plan.edit.startDate.label': 'תאריך התחלה',
  'plan.edit.title.label': 'כותרת',
  'plan.footer.label': 'מתכנן טיול.',
  'plan.form.adults.label': 'מבוגרים',
  'plan.form.baseCity.label': 'עיר בסיס',
  'plan.form.baseCity.placeholder': 'למשל פאפוס',
  'plan.form.children.label': 'ילדים',
  'plan.form.create': 'יצירת תוכנית',
  'plan.form.endDate.label': 'תאריך סיום',
  'plan.form.includeNorth': 'לכלול את צפון קפריסין',
  'plan.form.startDate.label': 'תאריך התחלה',
  'plan.form.title.label': 'כותרת',
  'plan.form.title.placeholder': 'למשל קפריסין ב-7 ימים',
  'plan.hero.backToApp': 'חזרה לאפליקציה',
  'plan.hero.login': 'התחברות',
  'plan.hero.register': 'יצירת חשבון',
  'plan.hero.subtitle': 'התחברו כדי ליצור ולנהל את תוכניות הטיול שלכם.',
  'plan.hero.title': 'מתכנן טיול',
  'plan.print.adults': 'מבוגרים',
  'plan.print.base': 'בסיס',
  'plan.print.children': 'ילדים',
  'plan.print.day': 'יום',
  'plan.print.generated': 'נוצר',
  'plan.print.noItems': 'אין פריטים.',
  'plan.print.people': 'אנשים',
  'plan.print.title': 'תוכנית טיול',
  'plan.sidebar.back': 'חזרה',
  'plan.sidebar.title': 'מתכנן טיול',
  'plan.sidebar.yourPlans': 'התוכניות שלכם',
  'plan.ui.booking.collectedPrefix': 'נאסף:',
  'plan.ui.booking.requestSent': 'הבקשה נשלחה. בדקו את האימייל ואת תיקיית הספאם בתוך 24 שעות.',
  'plan.ui.catalog.add': 'הוספה',
  'plan.ui.catalog.addRange': 'הוספת טווח',
  'plan.ui.catalog.allCities': 'כל הערים',
  'plan.ui.catalog.days': 'ימים',
  'plan.ui.catalog.loadingServices': 'טוען שירותים...',
  'plan.ui.catalog.north': 'צפון',
  'plan.ui.catalog.northOk': 'מתאים לצפון',
  'plan.ui.catalog.noServices': 'לא נמצאו שירותים.',
  'plan.ui.catalog.searchPlaceholder': 'חיפוש...',
  'plan.ui.catalog.tabs.cars': 'רכבים',
  'plan.ui.catalog.tabs.hotels': 'מלונות',
  'plan.ui.catalog.tabs.pois': 'מקומות לראות',
  'plan.ui.catalog.tabs.recommendations': 'המלצות',
  'plan.ui.catalog.tabs.trips': 'טיולים',
  'plan.ui.common.day': 'יום',
  'plan.ui.common.delete': 'מחיקה',
  'plan.ui.common.moreInfo': 'מידע נוסף',
  'plan.ui.common.open': 'פתיחה',
  'plan.ui.confirm.deletePlan': 'למחוק את התוכנית הזו? אי אפשר לבטל את הפעולה.',
  'plan.ui.confirm.regenerateDays': 'ליצור את הימים מחדש? פעולה זו תסיר את הימים והפריטים הקיימים.',
  'plan.ui.cost.accommodation': 'אירוח',
  'plan.ui.cost.cars': 'רכבים',
  'plan.ui.cost.note': 'מלונות: לילות = (ימי הטווח פחות 1). רכבים: מינימום 3 ימים.',
  'plan.ui.cost.peopleLinePrefix': 'אנשים',
  'plan.ui.cost.total': 'סה״כ',
  'plan.ui.cost.trips': 'טיולים',
  'plan.ui.days.addCar': 'הוספת רכב',
  'plan.ui.days.addHotel': 'הוספת מלון',
  'plan.ui.days.addPlaces': 'הוספת מקומות',
  'plan.ui.days.addTrip': 'הוספת טיול',
  'plan.ui.days.city': 'עיר',
  'plan.ui.days.dayNotes': 'הערות ליום',
  'plan.ui.days.end': 'סיום',
  'plan.ui.days.noDays': 'עדיין לא נוצרו ימים.',
  'plan.ui.days.notesPlaceholder': 'הערות',
  'plan.ui.days.placeFallback': 'מקום',
  'plan.ui.days.placesSchedule': 'מקומות (לוח זמנים)',
  'plan.ui.days.saveDay': 'שמירת יום',
  'plan.ui.days.saveTime': 'שמירת שעה',
  'plan.ui.days.services': 'שירותים',
  'plan.ui.days.start': 'התחלה',
  'plan.ui.details.descriptionTitle': 'תיאור',
  'plan.ui.email.sending': 'שולח...',
  'plan.ui.itemType.car': 'רכב',
  'plan.ui.itemType.hotel': 'מלון',
  'plan.ui.itemType.item': 'פריט',
  'plan.ui.itemType.note': 'הערה',
  'plan.ui.itemType.place': 'מקום',
  'plan.ui.itemType.poi': 'מקום לראות',
  'plan.ui.itemType.poiShort': 'POI',
  'plan.ui.itemType.trip': 'טיול',
  'plan.ui.poi.areaPrefix': 'אזור:',
  'plan.ui.pricing.from': 'החל מ-',
  'plan.ui.pricing.perDay': '/ יום',
  'plan.ui.pricing.perNight': '/ לילה',
  'plan.ui.recommendations.openMaps': 'פתיחה במפות',
  'plan.ui.recommendations.showCode': 'הצגת קוד',
  'plan.ui.toast.addedToPlan': 'נוסף לתוכנית שלכם.',
  'plan.ui.toast.addedToPlanRangePrefix': 'נוסף לתוכנית שלכם (יום',
  'plan.ui.toast.bookingFormUnavailable': 'טופס ההזמנה אינו זמין בדפדפן הזה.',
  'plan.ui.toast.bookingRequestSent': 'בקשת ההזמנה נשלחה.',
  'plan.ui.toast.emailFailed': 'שליחת האימייל נכשלה.',
  'plan.ui.toast.emailFunctionUnavailable': 'פונקציית האימייל אינה זמינה (Edge Function לא נפרסה או חסומה).',
  'plan.ui.toast.emailSent': 'התוכנית נשלחה לאימייל שלכם.',
  'plan.ui.toast.emailSimulated': 'האימייל הודמה (SMTP לא מוגדר).',
  'plan.ui.toast.failedToAddItem': 'הוספת הפריט נכשלה',
  'plan.ui.toast.failedToAddNote': 'הוספת ההערה נכשלה',
  'plan.ui.toast.failedToAddRange': 'הוספת הטווח נכשלה',
  'plan.ui.toast.failedToCreatePlan': 'יצירת התוכנית נכשלה',
  'plan.ui.toast.failedToDeleteDayItems': 'מחיקת פריטי היום נכשלה',
  'plan.ui.toast.failedToDeleteDays': 'מחיקת הימים נכשלה',
  'plan.ui.toast.failedToDeleteItem': 'מחיקת הפריט נכשלה',
  'plan.ui.toast.failedToDeletePlan': 'מחיקת התוכנית נכשלה',
  'plan.ui.toast.failedToDeleteRange': 'מחיקת הטווח נכשלה',
  'plan.ui.toast.failedToLoadDays': 'טעינת הימים נכשלה',
  'plan.ui.toast.failedToLoadPlan': 'טעינת התוכנית נכשלה',
  'plan.ui.toast.failedToLoadPlanDays': 'טעינת ימי התוכנית נכשלה',
  'plan.ui.toast.failedToLoadPlanItems': 'טעינת פריטי התוכנית נכשלה',
  'plan.ui.toast.failedToLoadPlans': 'טעינת התוכניות נכשלה',
  'plan.ui.toast.failedToRegenerate': 'יצירה מחדש נכשלה',
  'plan.ui.toast.failedToSave': 'השמירה נכשלה',
  'plan.ui.toast.failedToSendRequest': 'שליחת הבקשה נכשלה.',
  'plan.ui.toast.failedToUpdateDay': 'עדכון היום נכשל',
  'plan.ui.toast.failedToUpdateItem': 'עדכון הפריט נכשל',
  'plan.ui.toast.invalidDates': 'תאריכים לא תקינים.',
  'plan.ui.toast.invalidDayRange': 'טווח ימים לא תקין.',
  'plan.ui.toast.loginFirst': 'אנא התחברו קודם.',
  'plan.ui.toast.planDeleted': 'התוכנית נמחקה.',
  'plan.ui.toast.popupBlocked': 'החלון הקופץ נחסם. אפשרו חלונות קופצים כדי להוריד PDF.',
  'plan.ui.toast.selectDayFirst': 'בחרו קודם יום.',
  'plan.ui.toast.selectPlanFirst': 'בחרו קודם תוכנית.',
  'plan.ui.toast.selectStartEndDay': 'בחרו יום התחלה ויום סיום.',
  'plan.ui.toast.setStartEndDateFirst': 'הגדירו קודם תאריך התחלה וסיום.',
  'plan.ui.toast.supabaseNotReady': 'Supabase לא מוכן. רעננו את הדף.',

  'recommendations.card.openMap': 'פתיחה במפות',
  'recommendations.card.showCode': 'הצגת קוד',
  'recommendations.home.cta': 'כל ההמלצות ←',
  'recommendations.home.filters.clear': 'ניקוי מסננים',
  'recommendations.home.filters.title': 'סינון לפי קטגוריה',
  'recommendations.home.subtitle': 'שותפים אמינים בקפריסין עם הנחות בלעדיות',
  'recommendations.home.title': '✨ ההמלצות שלנו',

  'referral.approved': 'אושר',
  'referral.bookingHint': 'אופציונלי. קוד ההפניה עובד בנפרד מקופונים.',
  'referral.change': 'שינוי',
  'referral.checking': 'בודקים קוד הפניה...',
  'referral.fromLink': 'קוד ההפניה מולא מהקישור שפתחתם.',
  'referral.fromManual': 'קוד ההפניה אושר.',
  'referral.fromStorage': 'משתמשים בקוד ההפניה השמור שלכם.',
  'referral.label': 'קוד הפניה',
  'referral.placeholder': 'הזינו קוד הפניה',

  'sos.close': { text: 'X', attributes: { 'aria-label': 'סגירת SOS' } },
  'sos.description': 'גישה מהירה למספרי חירום, אנשי קשר בשגרירות והכוונה רפואית.',
  'sos.embassy.address': {
    html: 'רחוב Ifigenias 14, ניקוסיה 2007 • <a href="https://maps.google.com/?q=Embassy+of+Poland+in+Cyprus" target="_blank" rel="noopener">קבלת הוראות הגעה</a>',
  },
  'sos.embassy.addressTitle': 'כתובת',
  'sos.embassy.email': {
    html: '<a href="mailto:nicosia.info@msz.gov.pl">nicosia.info@msz.gov.pl</a>',
  },
  'sos.embassy.emailTitle': 'אימייל',
  'sos.embassy.hotline': {
    html: '<a href="tel:+35799660451">+357 99 660 451</a> (סיוע חירום לאזרחי פולין).',
  },
  'sos.embassy.hotlineTitle': 'מוקד חירום',
  'sos.embassy.reception': {
    html: '<a href="tel:+35722751777">+357 22 751 777</a> (בימים שני-שישי בשעות העבודה).',
  },
  'sos.embassy.receptionTitle': 'קבלה',
  'sos.embassy.title': '🛡️ שגרירות פולין בניקוסיה',
  'sos.emergency.cyprus': {
    html: 'מספר החירום הקפריסאי - פועל לצד 112. <a href="tel:199">התקשרו</a>',
  },
  'sos.emergency.eu': {
    html: 'מספר חירום אירופי (משטרה, אמבולנס, כיבוי אש). <a href="tel:112">התקשרו עכשיו</a>',
  },
  'sos.emergency.police': {
    html: 'מוקד משטרה 24/7 (בחו״ל חייגו את הקוד המלא). <a href="tel:+35722802020">התקשרו</a>',
  },
  'sos.emergency.title': '🚑 מספרי חירום בקפריסין',
  'sos.healthcare.hospital': {
    html: 'חדר מיון 24/7, Anavargos, פאפוס. <a href="tel:+35726803000">+357 26 803 000</a> • <a href="https://maps.google.com/?q=Paphos+General+Hospital" target="_blank" rel="noopener">הוראות הגעה</a>',
  },
  'sos.healthcare.hospitalTitle': 'בית החולים הכללי בפאפוס',
  'sos.healthcare.note': 'במצבי סכנת חיים תמיד התקשרו ל-112 וציינו בבירור את המיקום שלכם. הפעילו שיתוף מיקום באפליקציה כדי למצוא עזרה מהר יותר במפה.',
  'sos.healthcare.pharmacy': {
    html: 'בדקו בתי מרקחת תורנים באתר <a href="https://pharmacy.dl.moh.gov.cy/" target="_blank" rel="noopener">משרד הבריאות</a> או חפשו <a href="https://www.google.com/maps/search/pharmacy+near+me/" target="_blank" rel="noopener">בית מרקחת קרוב</a>.',
  },
  'sos.healthcare.pharmacyTitle': 'בית מרקחת תורן',
  'sos.healthcare.search': {
    html: '<a href="https://www.google.com/maps/search/hospital+near+me/" target="_blank" rel="noopener">פתחו את רשימת בתי החולים ב-Google Maps</a> ושתפו את המיקום כדי לראות אפשרויות קרובות.',
  },
  'sos.healthcare.searchTitle': 'חיפוש בית חולים קרוב',
  'sos.healthcare.sos.healthcare.hospital': {
    html: 'חדר מיון 24/7, Anavargos, פאפוס. <a href="tel:+35726803000">+357 26 803 000</a> • <a href="https://maps.google.com/?q=Paphos+General+Hospital" target="_blank" rel="noopener">הוראות הגעה</a>',
  },
  'sos.healthcare.sos.healthcare.pharmacy': {
    html: 'בדקו בתי מרקחת תורנים באתר <a href="https://pharmacy.dl.moh.gov.cy/" target="_blank" rel="noopener">משרד הבריאות</a> או חפשו <a href="https://www.google.com/maps/search/pharmacy+near+me/" target="_blank" rel="noopener">בית מרקחת קרוב</a>.',
  },
  'sos.healthcare.sos.healthcare.pharmacyTitle': 'בית מרקחת תורן',
  'sos.healthcare.sos.healthcare.search': {
    html: '<a href="https://www.google.com/maps/search/hospital+near+me/" target="_blank" rel="noopener">פתחו את רשימת בתי החולים ב-Google Maps</a> ושתפו את המיקום כדי לראות אפשרויות קרובות.',
  },
  'sos.healthcare.sos.healthcare.searchTitle': 'חיפוש בית חולים קרוב',
  'sos.healthcare.sos.healthcare.title': '🏥 עזרה רפואית קרובה',
  'sos.healthcare.title': '🏥 עזרה רפואית קרובה',
  'sos.quick.ambulance': 'אמבולנס',
  'sos.quick.callUs': 'התקשרו אלינו',
  'sos.quick.fireBrigade': 'כיבוי אש',
  'sos.quick.whatsapp': 'WhatsApp',
  'sos.quick.whatsappDetail': 'עזרה מיידית',
  'sos.title': 'SOS',

  'tasks.action.complete': 'השלמה',
  'tasks.action.locked': 'רמה {{level}}',
  'tasks.action.undo': 'ביטול',
  'tasks.code.placeholder': 'הזינו קוד',
  'tasks.code.verify': 'אימות',
  'tasks.details.hide': 'הסתרת פרטים',
  'tasks.details.location': 'מיקום',
  'tasks.details.openMaps': 'פתיחה ב-Google Maps',
  'tasks.details.radius': 'רדיוס אימות',
  'tasks.details.show': 'הצגת פרטים',
  'tasks.details.typeBoth': 'נדרש אימות קוד ומיקום',
  'tasks.details.typeCode': 'בקשו מהשותף קוד והזינו אותו למטה',
  'tasks.details.typeLocation': 'לחצו על ״אני כאן״ כשתגיעו למיקום',
  'tasks.header.back': '→ חזרה להרפתקה',
  'tasks.header.subtitle': 'התכוננו לטיול עם משימות שמעניקות XP ושומרות על התכנון מסודר.',
  'tasks.header.title': 'משימות להשלמה',
  'tasks.instruction.code': 'בקשו מהצוות את הקוד כדי להרוויח XP!',
  'tasks.instruction.location': 'הגיעו למיקום ולחצו על הכפתור כדי להרוויח XP!',
  'tasks.items.akamas-jeep-safari.title': 'ספארי 4x4 באקאמאס',
  'tasks.items.ayia-napa-sunset-cruise.title': 'שייט שקיעה באיה נאפה',
  'tasks.items.family-waterpark-day.description': 'קנו חבילה משפחתית לאחד מפארקי המים המומלצים שלנו עם הסעות מהמלון.',
  'tasks.items.family-waterpark-day.title': 'יום משפחתי בפארק מים',
  'tasks.items.halloumi-farm-visit.title': 'ביקור בחוות חלומי',
  'tasks.items.karpaz-donkey-care.description': 'רכשו חוויית התנדבות במקלט קרפס ובילו בוקר בהאכלה וטיפול בחמורים.',
  'tasks.items.karpaz-donkey-care.title': 'עזרה במקלט החמורים',
  'tasks.items.larnaca-art-walk.description': 'בקרו בשלוש גלריות או ציורי קיר ותארו ביומן הטיול את היצירה האהובה עליכם.',
  'tasks.items.larnaca-art-walk.title': 'סיור אמנות בלרנקה',
  'tasks.items.limassol-bike-promenade.description': 'שכרו אופניים ורכבו לפחות 8 ק״מ לאורך הטיילת של לימסול.',
  'tasks.items.limassol-bike-promenade.title': 'רכיבה בטיילת מולוס',
  'tasks.items.loukoumi-workshop.description': 'הצטרפו לסדנת ממתקים מסורתית וקחו הביתה מארז מזכרת.',
  'tasks.items.loukoumi-workshop.title': 'סדנת לוקומי בגרוסקיפו',
  'tasks.items.nicosia-day-trip.description': 'תכננו ביקור של חצי יום בבירת קפריסין והיכנסו לפחות למוזיאון או גלריה אחת.',
  'tasks.items.nicosia-day-trip.title': 'טיול יום לניקוסיה',
  'tasks.items.nicosia-famagusta-combo.title': 'סיור משולב ניקוסיה ופמגוסטה',
  'tasks.items.nicosia-green-line-walk.description': 'גלו את ההיסטוריה של החלוקה בניקוסיה בהליכה עם מדריך מקומי.',
  'tasks.items.nicosia-green-line-walk.title': 'הליכה לאורך הקו הירוק',
  'tasks.items.premium-car-rental.description': 'השתמשו בהשכרת הרכב שלנו עם ביטוח מלא וקבלו את הרכב בשדה התעופה בפאפוס או בלרנקה.',
  'tasks.items.premium-car-rental.title': 'איסוף רכב שכור בשדה התעופה',
  'tasks.items.private-blue-lagoon-charter.title': 'שייט פרטי ללגונה הכחולה',
  'tasks.items.sea-adventure.description': 'בחרו אחת מחוויות הים שלנו (קיאק, שנורקלינג, שייט) והזמינו אותה בקייפ גרקו.',
  'tasks.items.sea-adventure.title': 'הרפתקת ים בקייפ גרקו',
  'tasks.items.sunrise-challenge.description': 'קומו לפני הזריחה וצאו להליכה קצרה באחד מחופי קפריסין.',
  'tasks.items.sunrise-challenge.title': 'הליכת זריחה על החוף',
  'tasks.items.sunset-yoga-nissi.description': 'הירשמו לשיעור יוגה בשקיעה והקליטו סיפור אודיו קצר.',
  'tasks.items.sunset-yoga-nissi.title': 'יוגה בשקיעה בחוף ניסי',
  'tasks.items.taste-halloumi.description': 'בקרו בטברנה וטעמו חלומי טרי על הגריל - שמרו את המקום ביומן הטיול.',
  'tasks.items.taste-halloumi.title': 'לטעום חלומי מקומי',
  'tasks.items.troodos-private-tour.description': 'תאמו טיול יום מלא להרי טרודוס עם מדריך שלנו והסעה נוחה.',
  'tasks.items.troodos-private-tour.title': 'סיור פרטי בטרודוס',
  'tasks.items.troodos-stargazing.description': 'הזמינו מפגש אסטרונומיה בטרודוס וספרו קבוצות כוכבים מעל הר אולימפוס עם מומחה.',
  'tasks.items.troodos-stargazing.title': 'צפייה בכוכבים בלילה בטרודוס',
  'tasks.items.troodos-wine-route.title': 'טעימות יין בהרים',
  'tasks.items.wedding-photoshoot-cyprus.description': 'השתמשו בשירות החתונות והצילום שלנו ותאמו צילום חוץ עם צלם וסטייליסט.',
  'tasks.items.wedding-photoshoot-cyprus.title': 'צילומי חתונה בקפריסין',
  'tasks.items.zenobia-dive-challenge.description': 'הצטרפו לצלילה מאורגנת באתר הספינה Zenobia עם מדריך מוסמך וציוד כלול.',
  'tasks.items.zenobia-dive-challenge.title': 'אתגר צלילה בזנוביה',
  'tasks.location.verify': '📍 אני כאן',
  'tasks.referral.copied': 'הועתק!',
  'tasks.referral.copy': '📋 העתקה',
  'tasks.referral.invited': 'הוזמנו',
  'tasks.referral.subtitle': 'הזמינו חברים והרווחו XP על כל משתמש חדש!',
  'tasks.referral.title': 'תגמולי הפניה',
  'tasks.referral.xpEarned': 'XP שנצבר',
  'tasks.referral.yourLink': 'קישור ההפניה שלכם:',

  'tutorial.finish': 'סיום',
  'tutorial.next': 'הבא',
  'tutorial.prev': 'חזרה',
  'tutorial.skip': 'דילוג',
  'tutorial.step6.description': 'בחרו לשונית עיר -> השוו מלונות/דירות/וילות -> פתחו ״הצגת כל המלונות״ -> בחרו אפשרות אירוח.',
  'tutorial.step6.title': 'אירוח: תהליך הזמנה',
  'tutorial.step7.description': 'החליפו עיר, השוו רכבים ומחירים זמינים ואז המשיכו לתהליך הזמנת הרכב המלא.',
  'tutorial.step7.title': 'רכבים ללא פיקדון',
  'tutorial.step8.description': 'שלב 1 מסלול/שעה -> שלב 2 נוסעים/תוספות -> שלב 3 פרטי קשר/הערות -> שלב 4 מחיר סופי והזמנה.',
  'tutorial.step8.title': 'תחבורה ב-4 שלבים ברורים',
  'tutorial.step9.description': 'השתמשו באזור הזה כדי לגלות מקומות אמינים, מותגים מקומיים והצעות נבחרות לפני בחירת שאר הטיול.',
  'tutorial.step9.title': 'ההמלצות שלנו',
  'tutorial.step10.description': 'קראו מדריכים מעשיים, רעיונות למסלולים וטיפים מקומיים. פתחו מאמר כשאתם רוצים יותר הקשר לפני הזמנת שירותים.',
  'tutorial.step10.title': 'בלוג CyprusEye',
  'tutorial.step11.description': 'המדריך מסתיים שוב בחלק העליון, כדי שתוכלו להחליף שפה, להתחבר אם צריך ולהתחיל להשתמש בשירותים מההתחלה.',
  'tutorial.step11.title': 'סיימנו. מתחילים מלמעלה',
  'tutorial.step12.description': 'עקבו אחרי הזמנות, מסמכים ומשימות טיול עם התקדמות ברורה במקום אחד.',
  'tutorial.step12.title': 'רשימת משימות',
  'tutorial.step13.description': 'הכרטיס הזה פותח את עמוד התחבורה הייעודי עם אותו מנוע הזמנות בתצוגת עמוד מלאה.',
  'tutorial.step13.title': 'קיצור דרך: עמוד תחבורה',
  'tutorial.step14.description': 'הכרטיס הזה פותח את מודול השכרת הרכב הייעודי כשאתם רוצים להזמין בתהליך המפורט.',
  'tutorial.step14.title': 'קיצור דרך: עמוד השכרת רכב',
  'tutorial.step15.description': 'המדריך מסתיים בחלק העליון כדי שתוכלו להתחיל מיד. השתמשו ב-״🔁 הצגת הוראות״ בפוטר בכל זמן.',
  'tutorial.step15.title': 'סיימנו. חזרה למעלה',
  'tutorial.stepCounter': 'מדריך שלב אחר שלב · {{current}}/{{total}}',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTranslationLeaf(value) {
  if (!isPlainObject(value)) return true;
  return typeof value.text === 'string' || typeof value.html === 'string';
}

function flattenTranslations(value, prefix = '', output = {}) {
  if (prefix && isTranslationLeaf(value)) {
    output[prefix] = value;
    return output;
  }

  Object.entries(value || {}).forEach(([key, child]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    flattenTranslations(child, nextKey, output);
  });

  return output;
}

function sortObject(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right, 'en')),
  );
}

function rootOf(key) {
  return String(key || '').split('.')[0] || '';
}

function keyInRoots(key, roots) {
  const root = rootOf(key);
  return roots.includes(root);
}

function collectTokens(value) {
  const text = typeof value === 'string'
    ? value
    : (value?.html || value?.text || JSON.stringify(value || ''));
  return [...String(text).matchAll(/\{\{[^}]+\}\}/g)].map((match) => match[0]).sort();
}

function sameTokens(source, target) {
  const left = collectTokens(source);
  const right = collectTokens(target);
  return left.length === right.length && left.every((token, index) => token === right[index]);
}

const en = readJson(enPath);
const he = readJson(hePath);
const audit = readJson(auditPath);
const enFlat = flattenTranslations(en);

const stageKeys = new Set([
  ...audit.missingKeys.filter((key) => keyInRoots(key, PUBLIC_MISSING_ROOTS)),
  ...audit.sameAsBaseKeys.filter((key) => keyInRoots(key, SAME_AS_EN_ROOTS)),
]);

const applied = [];
const unresolved = [];
const deferred = audit.missingKeys.filter((key) => keyInRoots(key, INTENTIONALLY_DEFERRED_ROOTS));

[...stageKeys].sort((a, b) => a.localeCompare(b, 'en')).forEach((key) => {
  if (!Object.prototype.hasOwnProperty.call(TRANSLATIONS, key)) {
    unresolved.push({ key, source: enFlat[key] });
    return;
  }

  const translation = TRANSLATIONS[key];
  if (!sameTokens(enFlat[key], translation)) {
    unresolved.push({ key, source: enFlat[key], reason: 'placeholder mismatch' });
    return;
  }

  he[key] = translation;
  applied.push(key);
});

const reviewLines = [
  '# HE P1 Human Review Notes',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Stage: ${STAGE}`,
  '',
  'HE remains hidden/public-off. This report tracks Stage 24 public static UI translation follow-up only.',
  '',
  '## Summary',
  '',
  `- Missing HE keys before Stage 24: ${audit.counts.missingKeys}`,
  `- Same-as-EN keys before Stage 24: ${audit.counts.sameAsBaseKeys}`,
  `- Stage 24 public static keys considered: ${stageKeys.size}`,
  `- Stage 24 translations applied: ${applied.length}`,
  `- Stage 24 unresolved keys: ${unresolved.length}`,
  `- Deferred non-stage roots still missing: ${deferred.length}`,
  '',
  '## Applied Public Static Groups',
  '',
  ...PUBLIC_MISSING_ROOTS.map((root) => {
    const count = applied.filter((key) => rootOf(key) === root).length;
    return `- \`${root}\`: ${count}`;
  }),
  '',
  '## Same-as-EN Cleanup Groups',
  '',
  ...SAME_AS_EN_ROOTS.map((root) => {
    const count = applied.filter((key) => rootOf(key) === root).length;
    return `- \`${root}\`: ${count}`;
  }),
  '',
  '## Human Review Required',
  '',
  'These Hebrew values are production-prep translations and should still be reviewed by a Hebrew speaker before public launch. Pay special attention to:',
  '',
  '- Plan/trip-planner action labels and PDF/email wording.',
  '- Community/check-in/rating wording.',
  '- Coupon terms and discount wording.',
  '- SOS/emergency copy and embassy/healthcare links.',
  '- Task gamification copy and route names.',
  '- Direction-sensitive arrows in RTL labels.',
  '',
  '## Deferred On Purpose',
  '',
  'These roots remain out of Stage 24 scope:',
  '',
  '- `shop`: Shop/checkout is still a full-launch blocker and must be handled after dynamic Shop HE is ready.',
  '- `seo`: HE SEO stays disabled until content readiness is complete.',
  '- `advertise`: partner/advertise public content needs a dedicated pass.',
  '- `dashboard`: internal/account dashboard copy is not part of this public static UI batch.',
  '',
  '## Unresolved Stage Keys',
  '',
  ...(unresolved.length
    ? unresolved.map((item) => `- \`${item.key}\`${item.reason ? ` (${item.reason})` : ''}: ${JSON.stringify(item.source)}`)
    : ['- None.']),
  '',
];

fs.writeFileSync(hePath, `${JSON.stringify(sortObject(he), null, 2)}\n`, 'utf8');
fs.writeFileSync(reviewPath, `${reviewLines.join('\n')}\n`, 'utf8');

console.log(`Stage keys considered: ${stageKeys.size}`);
console.log(`Translations applied: ${applied.length}`);
console.log(`Unresolved: ${unresolved.length}`);
console.log(`Updated: ${path.relative(rootDir, hePath)}`);
console.log(`Review report: ${path.relative(rootDir, reviewPath)}`);

if (unresolved.length > 0) {
  process.exitCode = 1;
}
