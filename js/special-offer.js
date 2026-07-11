import { supabase } from '/js/supabaseClient.js';
import { enhancePhoneInput } from '/js/phone-input.js';

const LANGUAGES = ['pl', 'en', 'he'];
const FALLBACK_ORDER = ['pl', 'en', 'he'];
const PUBLIC_STATUS = 'active';
const ENDED_PUBLIC_STATUSES = new Set(['active', 'ended', 'locked']);
const PUBLIC_VISIBILITY = 'public';

const TEXT = {
  pl: {
    mode: 'Special Offer',
    previewMode: 'Admin preview',
    unavailableTitle: 'Kampania nie jest jeszcze dostępna.',
    unavailableCopy: 'Ta kampania nie jest obecnie publiczna.',
    home: 'Wróć do CyprusEye',
    about: 'O kampanii',
    prize: 'Nagroda',
    rules: 'Regulamin',
    faq: 'FAQ',
    links: 'Powiązane usługi',
    noFaq: 'Brak pytań FAQ.',
    noPrize: 'Opis nagrody nie jest jeszcze dostępny.',
    noRules: 'Regulamin nie jest jeszcze dostępny.',
    noLinks: 'Linki do usług nie są jeszcze dostępne.',
    linkCta: 'Otwórz link',
    entryTitle: 'Formularz zgłoszeniowy',
    notConfigured: 'Formularz nie został jeszcze skonfigurowany.',
    noFormRequired: 'Ta kampania nie wymaga formularza zgłoszeniowego.',
    previewMessage: 'Podgląd formularza. Wysyłanie zgłoszeń nie jest jeszcze dostępne.',
    submitLabel: 'Wyślij zgłoszenie',
    submittingLabel: 'Wysyłanie...',
    authChecking: 'Sprawdzamy dostęp do formularza...',
    loginRequiredTitle: 'Zaloguj się, aby wysłać zgłoszenie',
    loginRequiredCopy: 'Strona kampanii jest publiczna, ale formularz jest dostępny tylko dla zalogowanych uczestników.',
    loginButton: 'Wypełnij formularz',
    emailNotConfirmedTitle: 'Potwierdź adres e-mail',
    emailNotConfirmedCopy: 'Formularz odblokuje się po potwierdzeniu adresu e-mail konta. Sprawdź skrzynkę i wróć na tę stronę.',
    refreshAccess: 'Sprawdziłem e-mail / Odśwież dostęp',
    authUnavailable: 'Logowanie nie jest teraz dostępne na tej stronie. Spróbuj ponownie za chwilę.',
    formErrorTitle: 'Sprawdź pola formularza',
    accountEmailHint: 'Zgłoszenie zostanie przypisane do zalogowanego konta.',
    cancel: 'Anuluj',
    successTitle: 'Zgłoszenie zapisane',
    successReference: 'Numer zgłoszenia',
    successStatus: 'Status',
    pendingReview: 'Zgłoszenie zostało zapisane i oczekuje na ręczną weryfikację.',
    submittedSuccess: 'Zgłoszenie zostało zapisane.',
    alreadySubmittedTitle: 'Twoje zgłoszenie zostało już wysłane.',
    alreadySubmittedCopy: 'W tej kampanii można wysłać tylko jedno główne zgłoszenie. Nadal możesz śledzić status, aktywności i punkty poniżej.',
    viewSubmittedForm: 'Wyświetl formularz',
    editSubmittedForm: 'Edytuj formularz',
    oneCorrectionUsed: 'Jedyna korekta została już wykorzystana.',
    oneCorrectionWarning: 'Możesz zapisać poprawki tylko jeden raz. Po ponownym zapisaniu formularz zostanie zablokowany do edycji. Przed zapisaniem dokładnie sprawdź wszystkie dane.',
    saveOnlyCorrection: 'Zapisz jedyną poprawkę',
    correctionSaved: 'Korekta została zapisana i wróciła do ręcznej weryfikacji.',
    correctionUnavailable: 'Korekta nie jest dostępna dla tego zgłoszenia.',
    correctionDiscardConfirm: 'Zamknąć edycję bez zapisywania zmian?',
    closeDialog: 'Zamknij',
    campaignEndedTitle: 'Kampania zakończona',
    campaignEndedCopy: 'Zgłoszenia do tej kampanii są już zamknięte. Publiczne informacje pozostają dostępne.',
    winnerResultTitle: 'Zwycięzca kampanii',
    winnerResultPendingTitle: 'Wynik zostanie ogłoszony po zakończeniu kampanii',
    winnerResultPendingCopy: 'Po ręcznym potwierdzeniu i publikacji wynik pojawi się w tej sekcji.',
    winnerPublishedAt: 'Data publikacji wyniku',
    winnerManualSelectionCopy: 'Zwycięzca został wybrany ręcznie. Punkty były wyłącznie kryterium pomocniczym.',
    entryLookupErrorTitle: 'Nie udało się sprawdzić Twojego zgłoszenia',
    entryLookupErrorCopy: 'Odśwież dostęp przed ponowną próbą wysłania formularza.',
    retry: 'Spróbuj ponownie',
    activityTitle: 'Moja aktywność',
    activityLockedTitle: 'Zaloguj się, aby zgłaszać aktywności',
    activityLockedCopy: 'Po wysłaniu głównego zgłoszenia możesz dodawać dowody udostępnień i komentarzy.',
    activityLoginButton: 'Zaloguj się lub zarejestruj',
    activityChecking: 'Sprawdzamy dostęp do aktywności...',
    activityEmailTitle: 'Potwierdź adres e-mail',
    activityEmailCopy: 'Zgłaszanie aktywności jest dostępne po potwierdzeniu adresu e-mail.',
    activityUnavailable: 'Aktywności będą dostępne po publicznym uruchomieniu kampanii.',
    activityCampaignClosed: 'Zadania bonusowe są zamknięte, ponieważ kampania została zakończona.',
    activityNoEntryTitle: 'Najpierw wyślij główne zgłoszenie',
    activityNoEntryCopy: 'Aktywności można przypisać tylko do Twojego własnego zgłoszenia w tej kampanii.',
    activityMultipleEntriesTitle: 'Nie można jednoznacznie wybrać zgłoszenia',
    activityMultipleEntriesCopy: 'Skontaktuj się z administratorem, aby sprawdzić zgłoszenia w tej kampanii.',
    activityEntryBlockedTitle: 'Aktywności są zablokowane dla tego zgłoszenia',
    activityEntryBlockedCopy: 'Nowe aktywności można zgłaszać tylko dla zgłoszeń submitted, pending review lub approved.',
    myEntry: 'Moje zgłoszenie',
    myScore: 'Moje punkty',
    officialPosts: 'Oficjalne posty',
    noOfficialPosts: 'Nie ma jeszcze aktywnych oficjalnych postów dla tej kampanii.',
    openOfficialPost: 'Otwórz post',
    shareProof: 'Udostępnienie',
    commentProof: 'Komentarz',
    addProof: 'Dodaj dowód',
    submitEvidence: 'Wyślij dowód',
    submittingEvidence: 'Wysyłanie...',
    evidenceUrl: 'Link do dowodu',
    evidenceText: 'Opis dowodu',
    participantReportedAt: 'Deklarowany czas publikacji',
    optional: 'opcjonalnie',
    commentDeadline: 'Deadline komentarza',
    manualReviewNotice: 'Dowód zostanie sprawdzony ręcznie. Punkt nie jest przyznawany automatycznie.',
    manualSelectionNotice: 'Punkty są kryterium pomocniczym. Zwycięzca jest wybierany ręcznie przez administratora kampanii.',
    activityPending: 'Oczekuje',
    activityApproved: 'Zatwierdzone',
    activityRejected: 'Odrzucone',
    activityInvalid: 'Nieprawidłowe',
    points: 'Punkty',
    totalPoints: 'Razem',
    basePoints: 'Zgłoszenie',
    sharePoints: 'Udostępnienia',
    commentPoints: 'Komentarze',
    bonusPoints: 'Bonus',
    approvedActivities: 'Zatwierdzone aktywności',
    activitySuccess: 'Dowód został wysłany do ręcznej weryfikacji.',
    activityDuplicate: 'Taka aktywność została już zgłoszona. Pokazujemy jej aktualny status.',
    activityErrorTitle: 'Nie udało się wysłać dowodu',
    errors: {
      login_required: 'Zaloguj się, aby wysłać zgłoszenie.',
      email_not_confirmed: 'Potwierdź adres e-mail przed wysłaniem zgłoszenia.',
      authenticated_email_missing: 'Nie udało się potwierdzić adresu e-mail konta. Zaloguj się ponownie.',
      campaign_not_available: 'Ta kampania nie jest obecnie dostępna.',
      campaign_not_open: 'Kampania jeszcze się nie rozpoczęła.',
      campaign_closed: 'Kampania została zakończona.',
      form_not_configured: 'Formularz nie został jeszcze skonfigurowany.',
      required_field_missing: 'Uzupełnij wymagane pole.',
      invalid_email_field: 'Podaj poprawny adres e-mail.',
      invalid_phone_field: 'Podaj poprawny numer telefonu z kierunkowym.',
      invalid_url_field: 'Podaj poprawny link zaczynający się od http:// lub https://.',
      min_age_field: 'Nie spełniasz minimalnego wieku wymaganego w tej kampanii.',
      must_be_true_field: 'Ta zgoda jest wymagana.',
      invalid_option: 'Wybierz jedną z dostępnych opcji.',
      duplicate_entry: 'Masz już zapisane zgłoszenie w tej kampanii.',
      max_entries_reached: 'Osiągnięto maksymalną liczbę zgłoszeń dla tej kampanii.',
      admin_entries_blocked: 'Konta administracyjne nie mogą wysyłać zgłoszeń w tej kampanii.',
      partner_entries_blocked: 'Konta partnerów nie mogą wysyłać zgłoszeń w tej kampanii.',
      submission_not_accepted: 'Nie można przyjąć tego zgłoszenia. Odśwież stronę i spróbuj ponownie.',
      client_correction_id_required: 'Nie udało się przygotować bezpiecznej korekty. Odśwież stronę i spróbuj ponownie.',
      correction_already_used: 'Jedyna korekta została już wykorzystana.',
      entry_not_correctable: 'Tego zgłoszenia nie można już edytować.',
      entry_not_found: 'Nie udało się znaleźć Twojego zgłoszenia.',
      answers_must_be_object: 'Nie udało się odczytać danych formularza.',
      answers_payload_too_large: 'Dane formularza są zbyt duże.',
      unknown_or_inactive_field: 'Formularz zawiera pole, którego nie można edytować.',
      network_error: 'Problem z połączeniem. Spróbuj ponownie.',
      temporary_error: 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.',
      invalid_activity_url: 'Podaj poprawny link zaczynający się od http:// lub https://.',
      evidence_text_too_long: 'Opis dowodu jest zbyt długi.',
      client_submission_id_required: 'Nie udało się przygotować bezpiecznej wysyłki. Odśwież stronę i spróbuj ponownie.',
      invalid_activity_type: 'Ten typ aktywności nie jest obsługiwany.',
      entry_not_eligible_for_activity: 'To zgłoszenie nie może już dodawać aktywności.',
      official_post_inactive: 'Ten post nie przyjmuje już nowych aktywności.',
      official_post_not_available: 'Ten post nie jest dostępny.',
      activity_claim_not_allowed: 'Nie można zgłosić aktywności dla tego zgłoszenia.',
      activity_claim_not_available: 'Zgłaszanie aktywności nie jest teraz dostępne.',
      activity_claim_duplicate: 'Taka aktywność została już zgłoszona.',
      activity_claim_not_accepted: 'Nie można przyjąć tego dowodu. Sprawdź dane i spróbuj ponownie.',
    },
    selectPlaceholder: 'Wybierz opcję',
    genericField: 'Pole formularza',
    starts: 'Start',
    ends: 'Koniec',
    winner: 'Ogłoszenie zwycięzcy',
  },
  en: {
    mode: 'Special Offer',
    previewMode: 'Admin preview',
    unavailableTitle: 'Campaign is not available yet.',
    unavailableCopy: 'This campaign is not public at the moment.',
    home: 'Back to CyprusEye',
    about: 'About this campaign',
    prize: 'Prize',
    rules: 'Rules',
    faq: 'FAQ',
    links: 'Linked services',
    noFaq: 'No FAQ items.',
    noPrize: 'Prize copy is not available yet.',
    noRules: 'Rules are not available yet.',
    noLinks: 'Linked services are not available yet.',
    linkCta: 'Open link',
    entryTitle: 'Entry form',
    notConfigured: 'The entry form has not been configured yet.',
    noFormRequired: 'This campaign does not require an entry form.',
    previewMessage: 'Form preview. Entry submission is not available yet.',
    submitLabel: 'Submit entry',
    submittingLabel: 'Submitting...',
    authChecking: 'Checking form access...',
    loginRequiredTitle: 'Sign in to submit your entry',
    loginRequiredCopy: 'The campaign page is public, but the entry form is available only to signed-in participants.',
    loginButton: 'Fill in the form',
    emailNotConfirmedTitle: 'Confirm your email address',
    emailNotConfirmedCopy: 'The form will unlock after your account email is confirmed. Check your inbox and return to this page.',
    refreshAccess: 'I confirmed my email / Refresh access',
    authUnavailable: 'Sign-in is not available on this page right now. Please try again shortly.',
    formErrorTitle: 'Check the form fields',
    accountEmailHint: 'Your entry will be linked to the signed-in account.',
    cancel: 'Cancel',
    successTitle: 'Entry saved',
    successReference: 'Entry reference',
    successStatus: 'Status',
    pendingReview: 'Your entry has been saved and is awaiting manual review.',
    submittedSuccess: 'Your entry has been saved.',
    alreadySubmittedTitle: 'Your entry has already been submitted.',
    alreadySubmittedCopy: 'Only one main entry is allowed for this campaign. You can still follow your status, activity and points below.',
    viewSubmittedForm: 'View form',
    editSubmittedForm: 'Edit form',
    oneCorrectionUsed: 'The only correction has already been used.',
    oneCorrectionWarning: 'You can save corrections only once. After saving again, the form will be locked for editing. Check every field carefully before saving.',
    saveOnlyCorrection: 'Save the only correction',
    correctionSaved: 'Your correction has been saved and returned to manual review.',
    correctionUnavailable: 'Correction is not available for this entry.',
    correctionDiscardConfirm: 'Close editing without saving changes?',
    closeDialog: 'Close',
    campaignEndedTitle: 'Campaign ended',
    campaignEndedCopy: 'Entries for this campaign are now closed. Public campaign information remains available.',
    winnerResultTitle: 'Campaign winner',
    winnerResultPendingTitle: 'The result will be announced after the campaign ends',
    winnerResultPendingCopy: 'After manual confirmation and publication, the result will appear in this section.',
    winnerPublishedAt: 'Result publication date',
    winnerManualSelectionCopy: 'The winner was selected manually. Points were only a supporting criterion.',
    entryLookupErrorTitle: 'Your entry could not be checked',
    entryLookupErrorCopy: 'Refresh access before trying to submit the form again.',
    retry: 'Try again',
    activityTitle: 'My Activity',
    activityLockedTitle: 'Sign in to claim activity',
    activityLockedCopy: 'After submitting the main entry, you can add proof of shares and comments.',
    activityLoginButton: 'Sign in or register',
    activityChecking: 'Checking activity access...',
    activityEmailTitle: 'Confirm your email address',
    activityEmailCopy: 'Activity claims are available after your account email is confirmed.',
    activityUnavailable: 'Activity claims will be available after the campaign is public.',
    activityCampaignClosed: 'Bonus tasks are closed because the campaign has ended.',
    activityNoEntryTitle: 'Submit the main entry first',
    activityNoEntryCopy: 'Activities can only be linked to your own entry in this campaign.',
    activityMultipleEntriesTitle: 'Your entry cannot be selected safely',
    activityMultipleEntriesCopy: 'Contact the administrator to check your campaign entries.',
    activityEntryBlockedTitle: 'Activities are locked for this entry',
    activityEntryBlockedCopy: 'New activities can be claimed only for submitted, pending review or approved entries.',
    myEntry: 'My entry',
    myScore: 'My score',
    officialPosts: 'Official posts',
    noOfficialPosts: 'There are no active official posts for this campaign yet.',
    openOfficialPost: 'Open post',
    shareProof: 'Share proof',
    commentProof: 'Comment proof',
    addProof: 'Add proof',
    submitEvidence: 'Submit evidence',
    submittingEvidence: 'Submitting...',
    evidenceUrl: 'Evidence link',
    evidenceText: 'Evidence notes',
    participantReportedAt: 'Reported publish time',
    optional: 'optional',
    commentDeadline: 'Comment deadline',
    manualReviewNotice: 'This proof will be reviewed manually. Points are not awarded automatically.',
    manualSelectionNotice: 'Points are a supporting criterion. The winner is selected manually by the campaign owner.',
    activityPending: 'Pending',
    activityApproved: 'Approved',
    activityRejected: 'Rejected',
    activityInvalid: 'Invalid',
    points: 'Points',
    totalPoints: 'Total',
    basePoints: 'Entry',
    sharePoints: 'Shares',
    commentPoints: 'Comments',
    bonusPoints: 'Bonus',
    approvedActivities: 'Approved activities',
    activitySuccess: 'Your proof has been submitted for manual review.',
    activityDuplicate: 'This activity has already been claimed. Showing its current status.',
    activityErrorTitle: 'Evidence could not be submitted',
    errors: {
      login_required: 'Please sign in to submit your entry.',
      email_not_confirmed: 'Confirm your email address before submitting your entry.',
      authenticated_email_missing: 'Could not confirm your account email. Please sign in again.',
      campaign_not_available: 'This campaign is not available right now.',
      campaign_not_open: 'This campaign has not started yet.',
      campaign_closed: 'This campaign has ended.',
      form_not_configured: 'The entry form has not been configured yet.',
      required_field_missing: 'Complete this required field.',
      invalid_email_field: 'Enter a valid email address.',
      invalid_phone_field: 'Enter a valid phone number with country code.',
      invalid_url_field: 'Enter a valid link starting with http:// or https://.',
      min_age_field: 'You do not meet the minimum age required for this campaign.',
      must_be_true_field: 'This consent is required.',
      invalid_option: 'Choose one of the available options.',
      duplicate_entry: 'You already have an entry for this campaign.',
      max_entries_reached: 'The maximum number of entries for this campaign has been reached.',
      admin_entries_blocked: 'Admin accounts cannot submit entries for this campaign.',
      partner_entries_blocked: 'Partner accounts cannot submit entries for this campaign.',
      submission_not_accepted: 'This entry could not be accepted. Refresh the page and try again.',
      client_correction_id_required: 'Could not prepare a safe correction. Refresh the page and try again.',
      correction_already_used: 'The only correction has already been used.',
      entry_not_correctable: 'This entry can no longer be edited.',
      entry_not_found: 'Your entry could not be found.',
      answers_must_be_object: 'The form data could not be read.',
      answers_payload_too_large: 'The form data is too large.',
      unknown_or_inactive_field: 'The form contains a field that cannot be edited.',
      network_error: 'Connection problem. Please try again.',
      temporary_error: 'Your entry could not be submitted. Please try again shortly.',
      invalid_activity_url: 'Enter a valid link starting with http:// or https://.',
      evidence_text_too_long: 'Evidence notes are too long.',
      client_submission_id_required: 'Could not prepare a safe submission. Refresh the page and try again.',
      invalid_activity_type: 'This activity type is not supported.',
      entry_not_eligible_for_activity: 'This entry can no longer claim activities.',
      official_post_inactive: 'This post no longer accepts new activity claims.',
      official_post_not_available: 'This post is not available.',
      activity_claim_not_allowed: 'This activity cannot be claimed for this entry.',
      activity_claim_not_available: 'Activity claims are not available right now.',
      activity_claim_duplicate: 'This activity has already been claimed.',
      activity_claim_not_accepted: 'This evidence could not be accepted. Check it and try again.',
    },
    selectPlaceholder: 'Select an option',
    genericField: 'Form field',
    starts: 'Starts',
    ends: 'Ends',
    winner: 'Winner announcement',
  },
  he: {
    mode: 'Special Offer',
    previewMode: 'תצוגה מקדימה למנהל',
    unavailableTitle: 'הקמפיין עדיין לא זמין.',
    unavailableCopy: 'הקמפיין אינו ציבורי כרגע.',
    home: 'חזרה ל-CyprusEye',
    about: 'על הקמפיין',
    prize: 'פרס',
    rules: 'כללים',
    faq: 'שאלות נפוצות',
    links: 'שירותים קשורים',
    noFaq: 'אין פריטי FAQ.',
    noPrize: 'תיאור הפרס עדיין לא זמין.',
    noRules: 'הכללים עדיין לא זמינים.',
    noLinks: 'קישורי השירותים עדיין לא זמינים.',
    linkCta: 'פתיחת הקישור',
    entryTitle: 'טופס הרשמה',
    notConfigured: 'טופס ההרשמה עדיין לא הוגדר.',
    noFormRequired: 'הקמפיין הזה אינו דורש טופס הרשמה.',
    previewMessage: 'תצוגה מקדימה של הטופס. שליחת הרשמות עדיין אינה זמינה.',
    submitLabel: 'שליחת הרשמה',
    submittingLabel: 'שולחים...',
    authChecking: 'בודקים גישה לטופס...',
    loginRequiredTitle: 'התחברו כדי לשלוח הרשמה',
    loginRequiredCopy: 'עמוד הקמפיין פתוח לכולם, אך הטופס זמין רק למשתתפים מחוברים.',
    loginButton: 'מילוי הטופס',
    emailNotConfirmedTitle: 'אשרו את כתובת האימייל',
    emailNotConfirmedCopy: 'הטופס ייפתח לאחר אישור כתובת האימייל של החשבון. בדקו את תיבת הדואר וחזרו לעמוד הזה.',
    refreshAccess: 'אישרתי אימייל / רענון גישה',
    authUnavailable: 'ההתחברות אינה זמינה כרגע בעמוד זה. נסו שוב בעוד רגע.',
    formErrorTitle: 'בדקו את שדות הטופס',
    accountEmailHint: 'ההרשמה תשויך לחשבון המחובר.',
    cancel: 'ביטול',
    successTitle: 'ההרשמה נשמרה',
    successReference: 'מספר הרשמה',
    successStatus: 'סטטוס',
    pendingReview: 'ההרשמה נשמרה וממתינה לבדיקה ידנית.',
    submittedSuccess: 'ההרשמה נשמרה.',
    alreadySubmittedTitle: 'ההרשמה שלכם כבר נשלחה.',
    alreadySubmittedCopy: 'ניתן לשלוח הרשמה ראשית אחת בלבד בקמפיין זה. עדיין אפשר לעקוב אחר הסטטוס, הפעילות והנקודות בהמשך.',
    viewSubmittedForm: 'הצגת הטופס',
    editSubmittedForm: 'עריכת הטופס',
    oneCorrectionUsed: 'התיקון היחיד כבר נוצל.',
    oneCorrectionWarning: 'אפשר לשמור תיקונים פעם אחת בלבד. לאחר השמירה הטופס יינעל לעריכה. בדקו היטב את כל הנתונים לפני השמירה.',
    saveOnlyCorrection: 'שמירת התיקון היחיד',
    correctionSaved: 'התיקון נשמר וחזר לבדיקה ידנית.',
    correctionUnavailable: 'תיקון אינו זמין להרשמה זו.',
    correctionDiscardConfirm: 'לסגור את העריכה בלי לשמור שינויים?',
    closeDialog: 'סגירה',
    campaignEndedTitle: 'הקמפיין הסתיים',
    campaignEndedCopy: 'ההרשמה לקמפיין הזה סגורה כעת. המידע הציבורי על הקמפיין נשאר זמין.',
    winnerResultTitle: 'הזוכה בקמפיין',
    winnerResultPendingTitle: 'התוצאה תפורסם לאחר סיום הקמפיין',
    winnerResultPendingCopy: 'לאחר אישור ופרסום ידניים, התוצאה תופיע באזור זה.',
    winnerPublishedAt: 'תאריך פרסום התוצאה',
    winnerManualSelectionCopy: 'הזוכה נבחר ידנית. הנקודות היו קריטריון מסייע בלבד.',
    entryLookupErrorTitle: 'לא ניתן לבדוק את ההרשמה שלכם',
    entryLookupErrorCopy: 'רעננו את הגישה לפני ניסיון נוסף לשלוח את הטופס.',
    retry: 'נסו שוב',
    activityTitle: 'הפעילות שלי',
    activityLockedTitle: 'התחברו כדי לדווח על פעילות',
    activityLockedCopy: 'לאחר שליחת ההרשמה הראשית אפשר להוסיף הוכחות לשיתופים ולתגובות.',
    activityLoginButton: 'התחברות או הרשמה',
    activityChecking: 'בודקים גישה לפעילות...',
    activityEmailTitle: 'אשרו את כתובת האימייל',
    activityEmailCopy: 'דיווח פעילות זמין לאחר אישור כתובת האימייל של החשבון.',
    activityUnavailable: 'דיווח פעילות יהיה זמין לאחר שהקמפיין יהיה ציבורי.',
    activityCampaignClosed: 'משימות הבונוס סגורות כי הקמפיין הסתיים.',
    activityNoEntryTitle: 'שלחו קודם את ההרשמה הראשית',
    activityNoEntryCopy: 'אפשר לשייך פעילות רק להרשמה שלכם בקמפיין הזה.',
    activityMultipleEntriesTitle: 'לא ניתן לבחור הרשמה באופן בטוח',
    activityMultipleEntriesCopy: 'פנו למנהל כדי לבדוק את ההרשמות בקמפיין.',
    activityEntryBlockedTitle: 'פעילויות חסומות להרשמה זו',
    activityEntryBlockedCopy: 'אפשר לדווח פעילות חדשה רק להרשמות במצב submitted, pending review או approved.',
    myEntry: 'ההרשמה שלי',
    myScore: 'הנקודות שלי',
    officialPosts: 'פוסטים רשמיים',
    noOfficialPosts: 'עדיין אין פוסטים רשמיים פעילים לקמפיין הזה.',
    openOfficialPost: 'פתיחת הפוסט',
    shareProof: 'הוכחת שיתוף',
    commentProof: 'הוכחת תגובה',
    addProof: 'הוספת הוכחה',
    submitEvidence: 'שליחת הוכחה',
    submittingEvidence: 'שולחים...',
    evidenceUrl: 'קישור להוכחה',
    evidenceText: 'הערות להוכחה',
    participantReportedAt: 'זמן פרסום מדווח',
    optional: 'אופציונלי',
    commentDeadline: 'מועד אחרון לתגובה',
    manualReviewNotice: 'ההוכחה תיבדק ידנית. נקודות אינן מוענקות אוטומטית.',
    manualSelectionNotice: 'נקודות הן קריטריון מסייע. הזוכה נבחר ידנית על ידי מנהל הקמפיין.',
    activityPending: 'ממתין',
    activityApproved: 'אושר',
    activityRejected: 'נדחה',
    activityInvalid: 'לא תקין',
    points: 'נקודות',
    totalPoints: 'סה״כ',
    basePoints: 'הרשמה',
    sharePoints: 'שיתופים',
    commentPoints: 'תגובות',
    bonusPoints: 'בונוס',
    approvedActivities: 'פעילויות שאושרו',
    activitySuccess: 'ההוכחה נשלחה לבדיקה ידנית.',
    activityDuplicate: 'פעילות זו כבר דווחה. מוצג הסטטוס הנוכחי שלה.',
    activityErrorTitle: 'לא ניתן לשלוח את ההוכחה',
    errors: {
      login_required: 'יש להתחבר כדי לשלוח הרשמה.',
      email_not_confirmed: 'יש לאשר את כתובת האימייל לפני שליחת הרשמה.',
      authenticated_email_missing: 'לא ניתן לאשר את כתובת האימייל של החשבון. התחברו שוב.',
      campaign_not_available: 'הקמפיין אינו זמין כרגע.',
      campaign_not_open: 'הקמפיין עדיין לא התחיל.',
      campaign_closed: 'הקמפיין הסתיים.',
      form_not_configured: 'טופס ההרשמה עדיין לא הוגדר.',
      required_field_missing: 'יש למלא שדה חובה זה.',
      invalid_email_field: 'הזינו כתובת אימייל תקינה.',
      invalid_phone_field: 'הזינו מספר טלפון תקין עם קידומת מדינה.',
      invalid_url_field: 'הזינו קישור תקין שמתחיל ב-http:// או https://.',
      min_age_field: 'אינכם עומדים בגיל המינימלי הנדרש לקמפיין זה.',
      must_be_true_field: 'נדרשת הסכמה זו.',
      invalid_option: 'בחרו אחת מהאפשרויות הזמינות.',
      duplicate_entry: 'כבר קיימת הרשמה שלכם לקמפיין זה.',
      max_entries_reached: 'הגעתם למספר ההרשמות המקסימלי לקמפיין זה.',
      admin_entries_blocked: 'חשבונות מנהלים אינם יכולים לשלוח הרשמות לקמפיין זה.',
      partner_entries_blocked: 'חשבונות שותפים אינם יכולים לשלוח הרשמות לקמפיין זה.',
      submission_not_accepted: 'לא ניתן לקבל את ההרשמה הזו. רעננו את העמוד ונסו שוב.',
      client_correction_id_required: 'לא ניתן להכין תיקון בטוח. רעננו את העמוד ונסו שוב.',
      correction_already_used: 'התיקון היחיד כבר נוצל.',
      entry_not_correctable: 'לא ניתן לערוך עוד הרשמה זו.',
      entry_not_found: 'לא ניתן למצוא את ההרשמה שלכם.',
      answers_must_be_object: 'לא ניתן לקרוא את נתוני הטופס.',
      answers_payload_too_large: 'נתוני הטופס גדולים מדי.',
      unknown_or_inactive_field: 'הטופס מכיל שדה שלא ניתן לערוך.',
      network_error: 'בעיה בחיבור. נסו שוב.',
      temporary_error: 'לא ניתן היה לשלוח את ההרשמה. נסו שוב בעוד רגע.',
      invalid_activity_url: 'הזינו קישור תקין שמתחיל ב-http:// או https://.',
      evidence_text_too_long: 'הערות ההוכחה ארוכות מדי.',
      client_submission_id_required: 'לא ניתן להכין שליחה בטוחה. רעננו את העמוד ונסו שוב.',
      invalid_activity_type: 'סוג פעילות זה אינו נתמך.',
      entry_not_eligible_for_activity: 'הרשמה זו אינה יכולה להוסיף פעילות.',
      official_post_inactive: 'הפוסט הזה כבר לא מקבל דיווחי פעילות חדשים.',
      official_post_not_available: 'הפוסט הזה אינו זמין.',
      activity_claim_not_allowed: 'לא ניתן לדווח פעילות עבור הרשמה זו.',
      activity_claim_not_available: 'דיווח פעילות אינו זמין כרגע.',
      activity_claim_duplicate: 'פעילות זו כבר דווחה.',
      activity_claim_not_accepted: 'לא ניתן לקבל את ההוכחה הזו. בדקו את הפרטים ונסו שוב.',
    },
    selectPlaceholder: 'בחרו אפשרות',
    genericField: 'שדה טופס',
    starts: 'התחלה',
    ends: 'סיום',
    winner: 'הכרזת הזוכה',
  },
};

const refs = {
  loading: document.querySelector('[data-special-offer-loading]'),
  unavailable: document.querySelector('[data-special-offer-unavailable]'),
  unavailableKicker: document.querySelector('[data-special-offer-unavailable-kicker]'),
  unavailableTitle: document.querySelector('[data-special-offer-unavailable-title]'),
  unavailableCopy: document.querySelector('[data-special-offer-unavailable-copy]'),
  home: document.querySelector('[data-special-offer-home]'),
  content: document.querySelector('[data-special-offer-content]'),
  modeLabel: document.querySelector('[data-special-offer-mode-label]'),
  title: document.querySelector('[data-special-offer-title]'),
  short: document.querySelector('[data-special-offer-short]'),
  dates: document.querySelector('[data-special-offer-dates]'),
  full: document.querySelector('[data-special-offer-full]'),
  prizes: document.querySelector('[data-special-offer-prizes]'),
  rules: document.querySelector('[data-special-offer-rules]'),
  faq: document.querySelector('[data-special-offer-faq]'),
  links: document.querySelector('[data-special-offer-links]'),
  winnerSection: document.querySelector('[data-special-offer-winner-section]'),
  winnerTitle: document.querySelector('[data-special-offer-winner-title]'),
  winnerBody: document.querySelector('[data-special-offer-winner-body]'),
  entrySection: document.querySelector('[data-special-offer-entry-placeholder]'),
  entryTitle: document.querySelector('[data-special-offer-entry-title]'),
  entryCopy: document.querySelector('[data-special-offer-entry-copy]'),
  activitySection: document.querySelector('[data-special-offer-activity-placeholder]'),
  activityTitle: document.querySelector('[data-special-offer-activity-title]'),
  activityBody: document.querySelector('[data-special-offer-activity-body]'),
  languageButtons: Array.from(document.querySelectorAll('[data-special-offer-lang]')),
  labels: Array.from(document.querySelectorAll('[data-special-offer-label]')),
};

let currentState = null;
let currentSlug = '';
let submitting = false;
let formStatus = 'idle';
let formDraft = {};
let lastValidationErrors = [];
let activeSubmitErrorCode = '';
let activityState = {
  loading: false,
  errorCode: '',
  posts: [],
  entries: [],
  entry: null,
  activities: [],
  score: null,
  initializedFor: '',
};
let ownEntryState = {
  loading: false,
  loaded: false,
  errorCode: '',
  entries: [],
  entry: null,
  answers: [],
  initializedFor: '',
};
let activitySubmitting = false;
let activeClaimModal = null;
let activeEntryFormModal = null;
let activityClaimDrafts = {};
let authState = {
  checking: true,
  session: null,
  user: null,
  confirmed: false,
};
let authRefreshPromise = null;

function normalizeLang(value) {
  const lang = String(value || '').trim().toLowerCase().split('-')[0];
  return LANGUAGES.includes(lang) ? lang : 'pl';
}

function readRequestedLang() {
  const url = new URL(window.location.href);
  return normalizeLang(url.searchParams.get('lang') || localStorage.getItem('ce_lang') || document.documentElement.lang);
}

function readSlug() {
  const url = new URL(window.location.href);
  const querySlug = String(url.searchParams.get('slug') || '').trim();
  if (querySlug) return querySlug;

  const parts = url.pathname.split('/').filter(Boolean);
  const specialOffersIndex = parts.indexOf('special-offers');
  if (specialOffersIndex >= 0 && parts[specialOffersIndex + 1]) {
    return decodeURIComponent(parts[specialOffersIndex + 1]);
  }
  return '';
}

function isAdminPreview() {
  const url = new URL(window.location.href);
  return ['1', 'true', 'admin'].includes(String(url.searchParams.get('admin_preview') || url.searchParams.get('preview') || '').toLowerCase());
}

function getSafeCurrentAuthRedirect() {
  try {
    const url = new URL(window.location.href);
    const allowedPath = url.pathname === '/special-offer.html'
      || /^\/special-offers\/[A-Za-z0-9][A-Za-z0-9_-]*(?:\/)?$/.test(url.pathname);
    if (!allowedPath) return '/';
    ['access_token', 'token', 'refresh_token', 'expires_in', 'expires_at', 'token_hash', 'type', 'code', 'error', 'error_description', 'provider_token', 'provider_refresh_token', 'state'].forEach((key) => {
      url.searchParams.delete(key);
    });
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (_error) {
    return '/';
  }
}

function configureAuthRedirectTarget() {
  const redirect = getSafeCurrentAuthRedirect();
  try {
    if (window.CE_AUTH && typeof window.CE_AUTH.setReturnTo === 'function') {
      window.CE_AUTH.setReturnTo(redirect);
    } else {
      window.sessionStorage.setItem('ce_auth_return_to_v1', redirect);
    }
  } catch (_error) {
    // Return-to support is best-effort; auth still works through the existing callback.
  }
  document.documentElement.dataset.authRedirect = redirect;
  document.body.dataset.authRedirect = redirect;
  let meta = document.querySelector('meta[name="ce-auth-redirect"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'ce-auth-redirect');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', redirect);
  document.querySelectorAll('#form-login, #form-register').forEach((form) => {
    if (form instanceof HTMLFormElement) {
      form.dataset.authRedirect = redirect;
    }
  });
}

function isConfirmedAuthUser(user) {
  if (!user?.id) return false;
  return Boolean(user.email_confirmed_at || user.confirmed_at || user.app_metadata?.email_confirmed_at);
}

async function refreshSpecialOfferAuthState() {
  if (authRefreshPromise) return authRefreshPromise;
  authRefreshPromise = (async () => {
    authState = { ...authState, checking: true };
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session || null;
    } catch (_error) {
      session = window.CE_STATE?.session || null;
    }
    const user = session?.user || window.CE_STATE?.session?.user || null;
    authState = {
      checking: false,
      session: session || null,
      user: user || null,
      confirmed: isConfirmedAuthUser(user),
    };
    return authState;
  })().finally(() => {
    authRefreshPromise = null;
  });
  return authRefreshPromise;
}

function rerenderEntryFormIfPossible({ scroll = false } = {}) {
  if (!currentState?.data) return;
  renderEntryForm(currentState.data, currentState.lang);
  if (scroll && refs.entrySection) {
    refs.entrySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function getText(lang) {
  return TEXT[lang] || TEXT.pl;
}

function setPageLanguage(lang) {
  const safeLang = normalizeLang(lang);
  const dir = safeLang === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = safeLang;
  document.documentElement.dir = dir;
  document.body.setAttribute('dir', dir);
  document.body.classList.toggle('is-rtl', dir === 'rtl');
  refs.languageButtons.forEach((button) => {
    const active = button.getAttribute('data-special-offer-lang') === safeLang;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateStaticText(lang) {
  const t = getText(lang);
  if (refs.unavailableKicker) refs.unavailableKicker.textContent = t.mode;
  if (refs.unavailableTitle) refs.unavailableTitle.textContent = t.unavailableTitle;
  if (refs.unavailableCopy) refs.unavailableCopy.textContent = t.unavailableCopy;
  if (refs.home) refs.home.textContent = t.home;
  if (refs.entryTitle) refs.entryTitle.textContent = t.entryTitle;
  if (refs.entryCopy) refs.entryCopy.textContent = t.entryCopy;
  refs.labels.forEach((node) => {
    const key = node.getAttribute('data-special-offer-label');
    if (key && t[key]) node.textContent = t[key];
  });
}

function setRobotsNoIndex(enabled) {
  let meta = document.querySelector('meta[name="robots"][data-special-offer-robots]');
  if (!enabled) {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('data-special-offer-robots', 'true');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', 'noindex, nofollow');
}

function ensureHeadElement(selector, create) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = create();
    document.head.appendChild(node);
  }
  return node;
}

function setNamedMeta(name, content) {
  const safeContent = cleanText(content);
  if (!safeContent) return;
  const node = ensureHeadElement(`meta[name="${CSS.escape(name)}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    return meta;
  });
  node.setAttribute('content', safeContent);
}

function setPropertyMeta(property, content) {
  const safeContent = cleanText(content);
  if (!safeContent) return;
  const node = ensureHeadElement(`meta[property="${CSS.escape(property)}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', property);
    return meta;
  });
  node.setAttribute('content', safeContent);
}

function getAbsoluteUrl(path) {
  try {
    return new URL(path, window.location.origin).toString();
  } catch (_error) {
    return path;
  }
}

function getCampaignCleanPath(campaign, lang = 'pl') {
  const slug = cleanText(campaign?.slug || currentSlug || readSlug());
  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, '');
  const safeLang = normalizeLang(lang);
  const path = safeSlug ? `/special-offers/${encodeURIComponent(safeSlug)}` : '/special-offer.html';
  return `${path}?lang=${encodeURIComponent(safeLang)}`;
}

function setCanonicalAndAlternates(campaign, lang) {
  const canonical = getAbsoluteUrl(getCampaignCleanPath(campaign, lang));
  const canonicalNode = ensureHeadElement('link[rel="canonical"]', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    return link;
  });
  canonicalNode.setAttribute('href', canonical);

  document.head.querySelectorAll('link[rel="alternate"][data-special-offer-hreflang]').forEach((node) => node.remove());
  LANGUAGES.forEach((code) => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', code);
    link.setAttribute('href', getAbsoluteUrl(getCampaignCleanPath(campaign, code)));
    link.setAttribute('data-special-offer-hreflang', 'true');
    document.head.appendChild(link);
  });
  const fallback = document.createElement('link');
  fallback.setAttribute('rel', 'alternate');
  fallback.setAttribute('hreflang', 'x-default');
  fallback.setAttribute('href', getAbsoluteUrl(getCampaignCleanPath(campaign, 'pl')));
  fallback.setAttribute('data-special-offer-hreflang', 'true');
  document.head.appendChild(fallback);
  return canonical;
}

function getOgImage(data) {
  const linkImage = (Array.isArray(data?.links) ? data.links : [])
    .map((link) => cleanText(link?.image_url))
    .find((image) => isSafeImageSrc(image));
  return getAbsoluteUrl(linkImage || '/assets/cyprus_logo-1000x1054.png');
}

function showLoading() {
  refs.loading.hidden = false;
  refs.unavailable.hidden = true;
  refs.content.hidden = true;
}

function showUnavailable(lang) {
  setPageLanguage(lang);
  updateStaticText(lang);
  refs.loading.hidden = true;
  refs.unavailable.hidden = false;
  refs.content.hidden = true;
  setRobotsNoIndex(true);
  document.title = `${getText(lang).unavailableTitle} • CyprusEye`;
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function hasText(value) {
  return cleanText(value).length > 0;
}

function byLang(rows) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const lang = normalizeLang(row?.lang);
    if (lang) map.set(lang, row);
  });
  return map;
}

function pickTranslation(rows, requestedLang) {
  const map = byLang(rows);
  const candidates = [requestedLang, ...FALLBACK_ORDER].filter((lang, index, list) => list.indexOf(lang) === index);
  for (const lang of candidates) {
    const row = map.get(lang);
    if (row) return { row, lang };
  }
  const first = Array.isArray(rows) ? rows.find(Boolean) : null;
  return { row: first || null, lang: requestedLang };
}

function formatDate(value, lang, timezone) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : lang === 'pl' ? 'pl-PL' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || 'Asia/Nicosia',
    }).format(date);
  } catch (_error) {
    return date.toLocaleString();
  }
}

function renderDates(campaign, lang) {
  const t = getText(lang);
  const items = [
    [t.starts, campaign?.start_at],
    [t.ends, campaign?.end_at],
    [t.winner, campaign?.winner_announce_at],
  ]
    .map(([label, value]) => {
      const formatted = formatDate(value, lang, campaign?.timezone);
      return formatted ? `<span>${escapeHtml(label)}: ${escapeHtml(formatted)}</span>` : '';
    })
    .filter(Boolean);
  refs.dates.innerHTML = items.join('');
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setText(node, value) {
  if (!node) return;
  node.textContent = cleanText(value);
}

function setParagraphs(node, value) {
  if (!node) return;
  const text = cleanText(value);
  node.replaceChildren();
  if (!text) return;
  text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const p = document.createElement('p');
    p.textContent = part;
    node.appendChild(p);
  });
}

function isSafeHref(value) {
  const href = cleanText(value);
  if (!href) return false;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  return /^https?:\/\//i.test(href);
}

function isSafeImageSrc(value) {
  if (value === null || value === undefined) return false;
  const source = String(value);
  if (!source || source.length > 2048) return false;
  if (/[ \t\r\n\f\v\u0000-\u001F\u007F]/.test(source)) return false;
  return /^https:\/\/[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?(?:[/?#][^\s\u0000-\u001F\u007F]*)?$/i.test(source)
    || /^\/[^/\s\u0000-\u001F\u007F?#][^\s\u0000-\u001F\u007F]*$/.test(source);
}

function sanitizeHtml(html) {
  const source = cleanText(html);
  if (!source) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, svg, link, meta').forEach((node) => node.remove());
  const allowedTags = new Set(['SECTION', 'P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'A', 'BR']);
  Array.from(doc.body.querySelectorAll('*')).forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        node.removeAttribute(attr.name);
      } else if (node.tagName === 'A' && name === 'href') {
        if (!isSafeHref(attr.value)) node.removeAttribute('href');
      } else if (!(node.tagName === 'A' && name === 'target')) {
        node.removeAttribute(attr.name);
      }
    });
    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return doc.body.innerHTML;
}

function parseFaq(value) {
  const source = typeof value === 'string'
    ? (() => {
        try { return JSON.parse(value); } catch (_error) { return []; }
      })()
    : value;
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => ({
      question: cleanText(item?.question),
      answer: cleanText(item?.answer),
    }))
    .filter((item) => item.question && item.answer);
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function normalizeOptions(value) {
  const source = typeof value === 'string'
    ? (() => {
        try { return JSON.parse(value); } catch (_error) { return []; }
      })()
    : value;
  if (!Array.isArray(source)) return [];
  return source
    .map((option) => ({
      value: cleanText(option?.value),
      label: cleanText(option?.label),
    }))
    .filter((option) => option.value || option.label);
}

function getFieldTranslation(field, translationsByField, lang) {
  const picked = pickTranslation(translationsByField.get(field?.id) || [], lang).row || {};
  return {
    label: cleanText(picked.label),
    placeholder: cleanText(picked.placeholder),
    help_text: cleanText(picked.help_text),
    options_json: normalizeOptions(picked.options_json),
  };
}

function getMaxDateForMinAge(minAge) {
  const age = Number(minAge);
  if (!Number.isFinite(age) || age < 0) return '';
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  return date.toISOString().slice(0, 10);
}

function getTextValidationAttributes(validation) {
  const attrs = [];
  if (Number.isFinite(Number(validation.min_length)) && Number(validation.min_length) >= 0) {
    attrs.push(`minlength="${escapeHtml(Number(validation.min_length))}"`);
  }
  if (Number.isFinite(Number(validation.max_length)) && Number(validation.max_length) >= 0) {
    attrs.push(`maxlength="${escapeHtml(Number(validation.max_length))}"`);
  }
  return attrs.join(' ');
}

function getActiveFields(data = currentState?.data) {
  return (Array.isArray(data?.formFields) ? data.formFields : [])
    .filter((field) => field?.active === true)
    .slice()
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
}

function getActiveFieldMap(data = currentState?.data) {
  const map = new Map();
  getActiveFields(data).forEach((field) => {
    const key = cleanText(field?.field_key);
    if (key) map.set(key, field);
  });
  return map;
}

function getFormElement() {
  return refs.entrySection?.querySelector('[data-special-offer-entry-form]') || null;
}

function getFieldWrapper(fieldKey) {
  if (!refs.entrySection) return null;
  const selector = `[data-special-offer-form-field="${CSS.escape(fieldKey)}"]`;
  return refs.entrySection.querySelector(selector);
}

function getFieldInputs(form, fieldKey) {
  if (!(form instanceof HTMLFormElement)) return [];
  return Array.from(form.elements).filter((element) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
      return false;
    }
    return element.name === fieldKey;
  });
}

function getFieldValue(form, field) {
  const key = cleanText(field?.field_key);
  const type = cleanText(field?.field_type);
  const inputs = getFieldInputs(form, key);
  if (!inputs.length) return type === 'checkbox_group' ? [] : type === 'checkbox' || type === 'consent' ? false : '';

  if (type === 'checkbox_group') {
    return inputs
      .filter((input) => input instanceof HTMLInputElement && input.checked)
      .map((input) => input.value);
  }
  if (type === 'checkbox' || type === 'consent') {
    const input = inputs.find((item) => item instanceof HTMLInputElement);
    return input instanceof HTMLInputElement ? input.checked : false;
  }
  const input = inputs[0];
  if (type === 'phone' && input instanceof HTMLInputElement && input.__cePhoneInputController?.sync) {
    input.__cePhoneInputController.sync();
  }
  return cleanText(input.value);
}

function setFieldValue(form, field, value) {
  const key = cleanText(field?.field_key);
  const type = cleanText(field?.field_type);
  const inputs = getFieldInputs(form, key);
  if (!inputs.length) return;

  if (type === 'checkbox_group') {
    const values = Array.isArray(value) ? value.map(String) : [];
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement) input.checked = values.includes(input.value);
    });
    return;
  }
  if (type === 'checkbox' || type === 'consent') {
    const input = inputs.find((item) => item instanceof HTMLInputElement);
    if (input instanceof HTMLInputElement) input.checked = value === true;
    return;
  }
  const input = inputs[0];
  if (input instanceof HTMLInputElement && type === 'phone' && input.__cePhoneInputController?.setFullNumber) {
    input.__cePhoneInputController.setFullNumber(cleanText(value));
  } else {
    input.value = cleanText(value);
  }
}

function saveCurrentFormDraft() {
  const form = getFormElement();
  if (!(form instanceof HTMLFormElement) || !currentState?.data) return;
  const nextDraft = { ...formDraft };
  getActiveFields(currentState.data).forEach((field) => {
    const key = cleanText(field?.field_key);
    if (!key) return;
    nextDraft[key] = getFieldValue(form, field);
  });
  formDraft = nextDraft;
}

function restoreFormDraft() {
  const form = getFormElement();
  if (!(form instanceof HTMLFormElement) || !currentState?.data) return;
  getActiveFields(currentState.data).forEach((field) => {
    const key = cleanText(field?.field_key);
    if (!key || !(key in formDraft)) return;
    setFieldValue(form, field, formDraft[key]);
  });
}

function clearFieldErrors() {
  refs.entrySection?.querySelectorAll('.special-offer-form-field--error').forEach((node) => {
    node.classList.remove('special-offer-form-field--error');
  });
  refs.entrySection?.querySelectorAll('[data-special-offer-field-error]').forEach((node) => node.remove());
  refs.entrySection?.querySelector('[data-special-offer-error-summary]')?.remove();
}

function getErrorMessage(code, lang) {
  const t = getText(lang);
  return t.errors?.[code] || t.errors?.temporary_error || TEXT.en.errors.temporary_error;
}

function showFormStatus(message, tone = 'info') {
  const node = refs.entrySection?.querySelector('[data-special-offer-form-status]');
  if (!(node instanceof HTMLElement)) return;
  node.textContent = message || '';
  node.dataset.tone = tone;
}

function showValidationErrors(errors, lang) {
  clearFieldErrors();
  lastValidationErrors = errors;
  if (!errors.length) return;

  const t = getText(lang);
  const summary = document.createElement('div');
  summary.className = 'special-offer-form-error-summary';
  summary.dataset.specialOfferErrorSummary = 'true';
  summary.setAttribute('role', 'alert');
  summary.setAttribute('tabindex', '-1');
  summary.dir = lang === 'he' ? 'rtl' : 'ltr';
  summary.innerHTML = `
    <strong>${escapeHtml(t.formErrorTitle)}</strong>
    <ul>${errors.map((error) => `<li>${escapeHtml(error.label || error.fieldKey)}: ${escapeHtml(error.message)}</li>`).join('')}</ul>
  `;
  const form = getFormElement();
  const grid = form?.querySelector('.special-offer-form-grid');
  if (form && grid) form.insertBefore(summary, grid);

  errors.forEach((error) => {
    const wrapper = getFieldWrapper(error.fieldKey);
    if (!(wrapper instanceof HTMLElement)) return;
    wrapper.classList.add('special-offer-form-field--error');
    const errorNode = document.createElement('p');
    errorNode.className = 'special-offer-form-error';
    errorNode.dataset.specialOfferFieldError = 'true';
    errorNode.textContent = error.message;
    wrapper.appendChild(errorNode);
  });

  const firstWrapper = getFieldWrapper(errors[0]?.fieldKey);
  const focusTarget = firstWrapper?.querySelector('input, textarea, select, button');
  if (focusTarget instanceof HTMLElement) {
    focusTarget.focus({ preventScroll: true });
    firstWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function bindValidationClearHandlers(form) {
  if (!(form instanceof HTMLFormElement)) return;
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    const key = target.name;
    const wrapper = key ? getFieldWrapper(key) : null;
    wrapper?.classList.remove('special-offer-form-field--error');
    wrapper?.querySelectorAll('[data-special-offer-field-error]').forEach((node) => node.remove());
  });
  form.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    const key = target.name;
    const wrapper = key ? getFieldWrapper(key) : null;
    wrapper?.classList.remove('special-offer-form-field--error');
    wrapper?.querySelectorAll('[data-special-offer-field-error]').forEach((node) => node.remove());
  });
}

function validateFieldValue(field, value, translation, lang) {
  const validation = parseJsonObject(field?.validation_json);
  const type = cleanText(field?.field_type) || 'text';
  const required = field?.required === true;
  const label = translation?.label || cleanText(field?.field_key) || getText(lang).genericField;
  const options = normalizeOptions(translation?.options_json);
  const allowedValues = new Set(options.map((option) => option.value).filter(Boolean));
  const stringValue = typeof value === 'string' ? value.trim() : '';
  const missing = type === 'checkbox_group'
    ? !Array.isArray(value) || value.length === 0
    : type === 'checkbox' || type === 'consent'
      ? value !== true
      : stringValue === '';

  if (required && missing) return { code: type === 'consent' ? 'must_be_true_field' : 'required_field_missing', label };
  if (!required && missing) return null;

  if (type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(stringValue)) return { code: 'invalid_email_field', label };
  if (['url', 'facebook_profile_url', 'shared_post_url'].includes(type) && !/^https?:\/\/[^\s]+$/i.test(stringValue)) return { code: 'invalid_url_field', label };
  if (type === 'phone' && !/^\+[1-9][0-9]{0,3}\s+[0-9][0-9\s().-]{3,39}$/.test(stringValue)) return { code: 'invalid_phone_field', label };
  if (type === 'date_of_birth') {
    const date = new Date(`${stringValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return { code: 'invalid_field', label };
    const minAge = Number(validation.min_age);
    if (Number.isFinite(minAge) && minAge >= 0) {
      const maxDate = getMaxDateForMinAge(minAge);
      if (maxDate && stringValue > maxDate) return { code: 'min_age_field', label };
    }
  }
  if (validation.must_be_true === true && value !== true) return { code: 'must_be_true_field', label };
  if (Number.isFinite(Number(validation.min_length)) && stringValue.length < Number(validation.min_length)) return { code: 'required_field_missing', label };
  if (Number.isFinite(Number(validation.max_length)) && stringValue.length > Number(validation.max_length)) return { code: 'temporary_error', label };
  if (type === 'select' && !allowedValues.has(stringValue)) return { code: 'invalid_option', label };
  if (type === 'checkbox_group') {
    if (!Array.isArray(value)) return { code: 'invalid_option', label };
    if (value.some((item) => !allowedValues.has(String(item)))) return { code: 'invalid_option', label };
  }
  return null;
}

function collectSpecialOfferAnswers() {
  const form = getFormElement();
  const data = currentState?.data;
  const lang = currentState?.lang || readRequestedLang();
  if (!(form instanceof HTMLFormElement) || !data) return { answers: {}, errors: [] };
  const translationsByField = new Map();
  (Array.isArray(data.formFieldTranslations) ? data.formFieldTranslations : []).forEach((row) => {
    if (!row?.field_id) return;
    if (!translationsByField.has(row.field_id)) translationsByField.set(row.field_id, []);
    translationsByField.get(row.field_id).push(row);
  });
  const answers = {};
  const errors = [];
  getActiveFields(data).forEach((field) => {
    const key = cleanText(field?.field_key);
    if (!key) return;
    const translation = getFieldTranslation(field, translationsByField, lang);
    const value = getFieldValue(form, field);
    const error = validateFieldValue(field, value, translation, lang);
    if (error) {
      errors.push({
        fieldKey: key,
        label: error.label,
        code: error.code,
        message: getErrorMessage(error.code, lang),
      });
      return;
    }
    const type = cleanText(field?.field_type);
    const isEmptyOptional = field?.required !== true
      && type !== 'checkbox'
      && type !== 'consent'
      && type !== 'checkbox_group'
      && cleanText(value) === '';
    if (isEmptyOptional) return;
    answers[key] = value;
  });
  return { answers, errors };
}

function getSubmissionStorageKey() {
  return `ce_special_offer_submission_id:${currentSlug || readSlug() || 'unknown'}`;
}

function createUuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getSubmissionId() {
  const key = getSubmissionStorageKey();
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const next = createUuid();
    sessionStorage.setItem(key, next);
    return next;
  } catch (_error) {
    return createUuid();
  }
}

function clearSubmissionId() {
  try {
    sessionStorage.removeItem(getSubmissionStorageKey());
  } catch (_error) {
    // ignore storage errors
  }
}

function parseCampaignDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPublicReadableCampaign(campaign) {
  return campaign?.visibility === PUBLIC_VISIBILITY && ENDED_PUBLIC_STATUSES.has(cleanText(campaign?.status));
}

function getCampaignWindowState(campaign, now = new Date()) {
  const start = parseCampaignDate(campaign?.start_at);
  const end = parseCampaignDate(campaign?.end_at);
  const status = cleanText(campaign?.status);
  if (!isPublicReadableCampaign(campaign) || !start || !end) return 'unavailable';
  if (now < start) return 'upcoming';
  if (now > end || status === 'ended' || status === 'locked') return 'ended';
  return status === PUBLIC_STATUS ? 'open' : 'unavailable';
}

function isCampaignOpenForSubmissions(data = currentState?.data) {
  return getCampaignWindowState(data?.campaign) === 'open';
}

function isActivityCampaignAvailable(data = currentState?.data) {
  const campaign = data?.campaign || {};
  return isCampaignOpenForSubmissions(data)
    && campaign.allow_bonus_points === true;
}

function canEntryClaimActivity(entry) {
  return ['submitted', 'pending_review', 'approved'].includes(cleanText(entry?.status));
}

function getActivityStatusLabel(status, lang) {
  const t = getText(lang);
  const normalized = cleanText(status);
  if (normalized === 'approved') return t.activityApproved;
  if (normalized === 'rejected') return t.activityRejected;
  if (normalized === 'invalid') return t.activityInvalid;
  return t.activityPending;
}

function getActivityMap(activities = activityState.activities) {
  const map = new Map();
  (Array.isArray(activities) ? activities : []).forEach((activity) => {
    const key = `${cleanText(activity?.official_post_id)}:${cleanText(activity?.activity_type)}`;
    if (key !== ':') map.set(key, activity);
  });
  return map;
}

function isValidActivityEvidenceUrl(value) {
  if (value === null || value === undefined) return false;
  const url = String(value);
  if (!url || url.length > 2048) return false;
  if (/[ \t\r\n\f\v\u0000-\u001F\u007F]/.test(url)) return false;
  return /^https?:\/\/[^/?#\s\u0000-\u001F\u007F]+(?:[/?#][^\s\u0000-\u001F\u007F]*)?$/i.test(url);
}

function getActivitySubmissionStorageKey(entryId, postId, type) {
  return `ce_special_offer_activity_submission_id:${currentSlug || readSlug() || 'unknown'}:${entryId || 'entry'}:${postId || 'post'}:${type || 'activity'}`;
}

function getActivitySubmissionId(entryId, postId, type) {
  const key = getActivitySubmissionStorageKey(entryId, postId, type);
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const next = createUuid();
    sessionStorage.setItem(key, next);
    return next;
  } catch (_error) {
    return createUuid();
  }
}

function clearActivitySubmissionId(entryId, postId, type) {
  try {
    sessionStorage.removeItem(getActivitySubmissionStorageKey(entryId, postId, type));
  } catch (_error) {
    // ignore storage errors
  }
}

function mapActivityError(error) {
  const raw = cleanText(error?.message || error?.details || error?.hint || error?.code || error);
  if (!raw) return 'temporary_error';
  const normalized = raw.toLowerCase();
  const known = [
    'login_required',
    'email_not_confirmed',
    'client_submission_id_required',
    'invalid_activity_type',
    'invalid_evidence_url',
    'evidence_text_too_long',
    'activity_claim_not_allowed',
    'entry_not_eligible_for_activity',
    'official_post_not_available',
    'official_post_inactive',
    'activity_claim_not_available',
    'activity_claim_duplicate',
    'activity_claim_not_accepted',
  ];
  for (const code of known) {
    if (normalized.includes(code)) {
      return code === 'invalid_evidence_url' ? 'invalid_activity_url' : code;
    }
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) return 'network_error';
  return 'temporary_error';
}

function getActivityDraftKey(postId, type) {
  return `${cleanText(postId)}:${cleanText(type)}`;
}

function saveActiveClaimDraft() {
  const modal = activeClaimModal;
  if (!modal?.postId || !modal?.type || !modal.node) return;
  const form = modal.node.querySelector('[data-special-offer-activity-claim-form]');
  if (!(form instanceof HTMLFormElement)) return;
  const draft = {
    evidence_url: cleanText(form.elements.namedItem('evidence_url')?.value),
    evidence_text: cleanText(form.elements.namedItem('evidence_text')?.value),
    participant_reported_at: cleanText(form.elements.namedItem('participant_reported_at')?.value),
  };
  activityClaimDrafts[getActivityDraftKey(modal.postId, modal.type)] = draft;
}

async function fetchPublicOfficialPosts(offerId) {
  const { data, error } = await supabase
    .from('special_offer_official_posts')
    .select('id,offer_id,post_order,week_number,admin_title,platform,official_url,published_at,comment_deadline_at,active,created_at,updated_at')
    .eq('offer_id', offerId)
    .eq('active', true)
    .order('post_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchOwnEntry(offerId, userId) {
  const { data, error } = await supabase
    .from('special_offer_entries')
    .select('id,offer_id,user_id,reference,status,submitted_lang,created_at,reviewed_at,correction_count,corrected_at')
    .eq('offer_id', offerId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(2);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchOwnEntryAnswers(entryId) {
  const { data, error } = await supabase
    .from('special_offer_entry_answers')
    .select('id,entry_id,field_id,field_key,value_text,value_json,field_snapshot_json,created_at')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchOwnActivities(offerId, entryId) {
  const { data, error } = await supabase
    .from('special_offer_entry_activities')
    .select('id,offer_id,entry_id,official_post_id,activity_type,status,points_awarded,participant_reported_at,verified_activity_at,created_at,updated_at')
    .eq('offer_id', offerId)
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchOwnScore(offerId, entryId) {
  const { data, error } = await supabase.rpc('special_offer_entry_score_summary', {
    p_offer_id: offerId,
    p_entry_id: entryId,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.find((row) => cleanText(row?.entry_id) === cleanText(entryId)) || rows[0] || null;
}

function resetOwnEntryState(offerId = '') {
  ownEntryState = {
    loading: false,
    loaded: false,
    errorCode: '',
    entries: [],
    entry: null,
    answers: [],
    initializedFor: cleanText(offerId),
  };
}

async function refreshOwnEntryData({ render = true, scroll = false } = {}) {
  const state = currentState;
  const data = state?.data;
  const lang = state?.lang || readRequestedLang();
  const offerId = cleanText(data?.campaign?.id);
  if (!data || !offerId || state?.previewMode || data.campaign?.requires_form !== true) {
    resetOwnEntryState(offerId);
    if (render) renderEntryForm(data, lang);
    return;
  }

  const canReadOwnEntry = isPublicReadableCampaign(data.campaign);
  if (!canReadOwnEntry || !authState.confirmed || !authState.user?.id) {
    resetOwnEntryState(offerId);
    if (render) renderEntryForm(data, lang);
    return;
  }

  ownEntryState = { ...ownEntryState, loading: true, errorCode: '', initializedFor: offerId };
  if (render) renderEntryForm(data, lang);

  try {
    const entries = await fetchOwnEntry(offerId, authState.user.id);
    const entry = entries.length === 1 ? entries[0] : null;
    const answers = entry?.id ? await fetchOwnEntryAnswers(entry.id) : [];
    ownEntryState = {
      loading: false,
      loaded: true,
      errorCode: '',
      entries,
      entry,
      answers,
      initializedFor: offerId,
    };
  } catch (error) {
    console.warn('Special Offer own entry load failed:', error);
    ownEntryState = {
      ...ownEntryState,
      loading: false,
      loaded: false,
      errorCode: 'temporary_error',
      initializedFor: offerId,
    };
  }

  if (render) {
    renderEntryForm(data, lang);
    if (scroll && refs.entrySection && !refs.entrySection.hidden) {
      refs.entrySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

async function refreshActivityData({ render = true, scroll = false } = {}) {
  const state = currentState;
  const data = state?.data;
  const lang = state?.lang || readRequestedLang();
  if (!data || !refs.activitySection) return;

  if (!isActivityCampaignAvailable(data) || state.previewMode) {
    activityState = {
      loading: false,
      errorCode: '',
      posts: [],
      entries: [],
      entry: null,
      activities: [],
      score: null,
      initializedFor: cleanText(data.campaign?.id),
    };
    if (render) renderActivitySection(data, lang);
    return;
  }

  activityState = { ...activityState, loading: true, errorCode: '', initializedFor: cleanText(data.campaign?.id) };
  if (render) renderActivitySection(data, lang);

  try {
    const offerId = data.campaign.id;
    const posts = await fetchPublicOfficialPosts(offerId);
    let entries = [];
    let entry = null;
    let activities = [];
    let score = null;

    if (authState.confirmed && authState.user?.id) {
      if (ownEntryState.initializedFor === offerId && ownEntryState.loaded && !ownEntryState.loading && !ownEntryState.errorCode) {
        entries = ownEntryState.entries;
        entry = ownEntryState.entry;
      } else {
        entries = await fetchOwnEntry(offerId, authState.user.id);
        entry = entries.length === 1 ? entries[0] : null;
        ownEntryState = {
          loading: false,
          loaded: true,
          errorCode: '',
          entries,
          entry,
          initializedFor: offerId,
        };
      }
      if (entry?.id) {
        [activities, score] = await Promise.all([
          fetchOwnActivities(offerId, entry.id),
          fetchOwnScore(offerId, entry.id),
        ]);
      }
    }

    activityState = {
      loading: false,
      errorCode: '',
      posts,
      entries,
      entry,
      activities,
      score,
      initializedFor: offerId,
    };
  } catch (error) {
    console.warn('Special Offer activity load failed:', error);
    activityState = { ...activityState, loading: false, errorCode: 'temporary_error' };
  }

  if (render) {
    renderEntryForm(data, lang);
    renderActivitySection(data, lang);
    if (scroll && refs.activitySection && !refs.activitySection.hidden) {
      refs.activitySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

async function getCurrentSession() {
  if (authState?.session?.user?.id) return authState.session;
  const cached = window.CE_STATE?.session || null;
  if (cached?.user?.id) return cached;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch (_error) {
    return null;
  }
}

function openAuthGate(lang, code = 'login_required') {
  saveCurrentFormDraft();
  saveActiveClaimDraft();
  configureAuthRedirectTarget();
  formStatus = 'login_required';
  activeSubmitErrorCode = code;
  showFormStatus(getErrorMessage(code, lang), 'warning');
  const opened = (() => {
    try {
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
        return true;
      }
      const controller = window.__authModalController;
      if (controller && typeof controller.open === 'function') {
        controller.setActiveTab?.('login', { focus: false });
        controller.open('login');
        return true;
      }
    } catch (error) {
      console.warn('Special Offer auth modal failed:', error);
    }
    return false;
  })();
  if (!opened) {
    showFormStatus(getText(lang).authUnavailable, 'error');
  }
}

function setSubmitButtonState(state, lang) {
  const button = refs.entrySection?.querySelector('[data-special-offer-submit]');
  if (!(button instanceof HTMLButtonElement)) return;
  const t = getText(lang);
  const disabled = state === 'submitting' || state === 'validating' || currentState?.previewMode;
  button.disabled = disabled;
  button.textContent = state === 'submitting' ? t.submittingLabel : t.submitLabel;
  button.setAttribute('aria-busy', state === 'submitting' ? 'true' : 'false');
}

function mapSubmitError(error) {
  const raw = cleanText(error?.message || error?.details || error?.hint || error?.code || error);
  if (!raw) return 'temporary_error';
  const normalized = raw.toLowerCase();
  const known = [
    'login_required',
    'email_not_confirmed',
    'authenticated_email_missing',
    'campaign_not_available',
    'campaign_not_open',
    'campaign_closed',
    'form_not_configured',
    'required_field_missing',
    'invalid_email_field',
    'invalid_phone_field',
    'invalid_url_field',
    'min_age_field',
    'must_be_true_field',
    'invalid_option',
    'duplicate_entry',
    'max_entries_reached',
    'admin_entries_blocked',
    'partner_entries_blocked',
    'submission_not_accepted',
    'client_correction_id_required',
    'correction_already_used',
    'entry_not_correctable',
    'entry_not_found',
    'answers_must_be_object',
    'answers_payload_too_large',
    'unknown_or_inactive_field',
  ];
  for (const code of known) {
    if (normalized.includes(code)) return code;
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) return 'network_error';
  return 'temporary_error';
}

function showSuccessState(result, lang) {
  const t = getText(lang);
  const payload = Array.isArray(result) ? result[0] : result;
  const status = cleanText(payload?.status || 'submitted');
  const reference = cleanText(payload?.reference || '');
  refs.entrySection.innerHTML = `
    <div class="special-offer-form-success" data-special-offer-success dir="${lang === 'he' ? 'rtl' : 'ltr'}" role="status">
      <h2>${escapeHtml(t.successTitle)}</h2>
      ${reference ? `<p><strong>${escapeHtml(t.successReference)}:</strong> ${escapeHtml(reference)}</p>` : ''}
      <p><strong>${escapeHtml(t.successStatus)}:</strong> ${escapeHtml(status)}</p>
      <p>${escapeHtml(status === 'pending_review' ? t.pendingReview : t.submittedSuccess)}</p>
    </div>
  `;
}

function renderExistingEntryState(entry, lang) {
  const t = getText(lang);
  const reference = cleanText(entry?.reference || '');
  const status = cleanText(entry?.status || '');
  const correctionUsed = Number(entry?.correction_count || 0) >= 1;
  const canEdit = !correctionUsed && !['disqualified', 'withdrawn'].includes(status);
  refs.entrySection.innerHTML = `
    <div class="special-offer-form-success" data-special-offer-existing-entry dir="${lang === 'he' ? 'rtl' : 'ltr'}" role="status">
      <h2>${escapeHtml(t.alreadySubmittedTitle)}</h2>
      ${reference ? `<p><strong>${escapeHtml(t.successReference)}:</strong> ${escapeHtml(reference)}</p>` : ''}
      ${status ? `<p><strong>${escapeHtml(t.successStatus)}:</strong> ${escapeHtml(status)}</p>` : ''}
      <p>${escapeHtml(t.alreadySubmittedCopy)}</p>
      ${correctionUsed ? `<p><strong>${escapeHtml(t.oneCorrectionUsed)}</strong></p>` : ''}
      <div class="special-offer-form-actions">
        <button type="button" class="special-offer-button special-offer-button--secondary" data-special-offer-entry-view>${escapeHtml(t.viewSubmittedForm)}</button>
        ${canEdit ? `<button type="button" class="special-offer-button" data-special-offer-entry-edit>${escapeHtml(t.editSubmittedForm)}</button>` : ''}
      </div>
    </div>
  `;
  const viewButton = refs.entrySection.querySelector('[data-special-offer-entry-view]');
  const editButton = refs.entrySection.querySelector('[data-special-offer-entry-edit]');
  if (viewButton instanceof HTMLButtonElement) {
    viewButton.addEventListener('click', () => openEntryFormModal('view', lang, viewButton));
  }
  if (editButton instanceof HTMLButtonElement) {
    editButton.addEventListener('click', () => openEntryFormModal('edit', lang, editButton));
  }
}

function getAnswerSnapshot(answer) {
  return answer?.field_snapshot_json && typeof answer.field_snapshot_json === 'object' ? answer.field_snapshot_json : {};
}

function getAnswerSortOrderPublic(answer) {
  const snapshot = getAnswerSnapshot(answer);
  return Number(snapshot.sort_order ?? 9999);
}

function getAnswerDisplayValue(answer) {
  const value = answer?.value_json ?? answer?.value_text ?? null;
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderStoredAnswerView(answer, lang) {
  const snapshot = getAnswerSnapshot(answer);
  const label = cleanText(snapshot.label || answer.field_key);
  const type = cleanText(snapshot.field_type || '');
  const value = getAnswerDisplayValue(answer);
  const safeUrl = ['url', 'facebook_profile_url', 'shared_post_url'].includes(type) && isSafeHref(value);
  return `
    <article class="special-offer-activity-card">
      <h3>${escapeHtml(label)}</h3>
      <p>${safeUrl ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>` : escapeHtml(value || '-')}</p>
    </article>
  `;
}

function renderCorrectionField(answer, index, lang) {
  const snapshot = getAnswerSnapshot(answer);
  const fieldKey = cleanText(answer.field_key || snapshot.field_key || `field_${index + 1}`);
  const type = cleanText(snapshot.field_type || '');
  const label = cleanText(snapshot.label || fieldKey);
  const required = snapshot.required === true;
  const value = answer?.value_json ?? answer?.value_text ?? '';
  const inputId = `specialOfferCorrection${index}_${fieldKey.replace(/[^a-z0-9_]/gi, '_')}`;
  const common = `id="${escapeHtml(inputId)}" name="${escapeHtml(fieldKey)}" data-field-type="${escapeHtml(type)}" ${required ? 'required aria-required="true"' : ''}`;
  const options = Array.isArray(snapshot.options_json) ? snapshot.options_json : [];
  let control = '';
  if (type === 'textarea' || type === 'contest_answer') {
    control = `<textarea rows="4" ${common}>${escapeHtml(String(value || ''))}</textarea>`;
  } else if (type === 'checkbox' || type === 'consent') {
    control = `<label class="special-offer-form-choice special-offer-form-choice--standalone"><input type="checkbox" ${common} ${value === true ? 'checked' : ''} /><span>${escapeHtml(label)}</span></label>`;
  } else if (type === 'checkbox_group') {
    const values = Array.isArray(value) ? value.map(String) : [];
    control = `<div class="special-offer-form-options">${options.map((option) => `<label class="special-offer-form-choice"><input type="checkbox" name="${escapeHtml(fieldKey)}" value="${escapeHtml(option.value)}" data-field-type="${escapeHtml(type)}" ${values.includes(String(option.value)) ? 'checked' : ''} /><span>${escapeHtml(option.label || option.value)}</span></label>`).join('')}</div>`;
  } else if (type === 'select') {
    control = `<select ${common}><option value=""></option>${options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(value || '') === String(option.value) ? 'selected' : ''}>${escapeHtml(option.label || option.value)}</option>`).join('')}</select>`;
  } else {
    const inputType = type === 'email' ? 'email' : type === 'phone' ? 'tel' : type === 'date' || type === 'date_of_birth' ? 'date' : ['url', 'facebook_profile_url', 'shared_post_url'].includes(type) ? 'url' : 'text';
    const readonly = fieldKey === 'email' ? 'readonly' : '';
    control = `<input type="${escapeHtml(inputType)}" ${common} value="${escapeHtml(String(value || ''))}" ${readonly} />`;
  }
  return `<div class="special-offer-form-field" data-correction-field="${escapeHtml(fieldKey)}">${type === 'checkbox' || type === 'consent' ? '' : `<label for="${escapeHtml(inputId)}">${escapeHtml(label)}${required ? ' *' : ''}</label>`}${control}</div>`;
}

function collectCorrectionAnswers(form) {
  const answers = {};
  ownEntryState.answers.forEach((answer) => {
    const snapshot = getAnswerSnapshot(answer);
    const key = cleanText(answer.field_key || snapshot.field_key);
    const type = cleanText(snapshot.field_type || '');
    if (!key) return;
    if (type === 'checkbox' || type === 'consent') {
      const input = form.elements.namedItem(key);
      answers[key] = input instanceof HTMLInputElement ? input.checked : false;
    } else if (type === 'checkbox_group') {
      answers[key] = Array.from(form.querySelectorAll(`[name="${CSS.escape(key)}"]:checked`)).map((node) => node.value);
    } else {
      const input = form.elements.namedItem(key);
      answers[key] = input ? cleanText(input.value) : '';
    }
  });
  return answers;
}

function getCorrectionStorageKey(entryId) {
  return `ce_special_offer_correction_id:${currentSlug || readSlug() || 'unknown'}:${entryId || 'entry'}`;
}

function getCorrectionId(entryId) {
  const key = getCorrectionStorageKey(entryId);
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const next = createUuid();
    sessionStorage.setItem(key, next);
    return next;
  } catch (_error) {
    return createUuid();
  }
}

function clearCorrectionId(entryId) {
  try {
    sessionStorage.removeItem(getCorrectionStorageKey(entryId));
  } catch (_error) {
    // ignore storage errors
  }
}

function isEntryFormCorrectionDirty() {
  const modal = activeEntryFormModal?.node;
  if (!modal || activeEntryFormModal.mode !== 'edit') return false;
  const form = modal.querySelector('[data-special-offer-entry-correction-form]');
  if (!(form instanceof HTMLFormElement)) return false;
  try {
    return JSON.stringify(collectCorrectionAnswers(form)) !== activeEntryFormModal.initialAnswersJson;
  } catch (_error) {
    return true;
  }
}

function closeEntryFormModal({ restoreFocus = true, force = false } = {}) {
  if (!activeEntryFormModal?.node) return;
  if (!force && isEntryFormCorrectionDirty()) {
    const lang = currentState?.lang || readRequestedLang();
    if (!window.confirm(getText(lang).correctionDiscardConfirm)) return;
  }
  const previousFocus = activeEntryFormModal.previousFocus;
  activeEntryFormModal.node.remove();
  activeEntryFormModal = null;
  if (restoreFocus && previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
}

function openEntryFormModal(mode, lang, trigger = null) {
  closeEntryFormModal({ restoreFocus: false });
  const t = getText(lang);
  const entry = ownEntryState.entry || {};
  const answers = ownEntryState.answers.slice().sort((a, b) => getAnswerSortOrderPublic(a) - getAnswerSortOrderPublic(b));
  const modal = document.createElement('div');
  modal.className = 'special-offer-claim-modal';
  modal.dataset.specialOfferEntryFormModal = mode;
  modal.dir = lang === 'he' ? 'rtl' : 'ltr';
  const isEdit = mode === 'edit';
  modal.innerHTML = `
    <div class="special-offer-claim-modal__backdrop" data-special-offer-entry-form-close></div>
    <div class="special-offer-claim-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="specialOfferEntryFormModalTitle">
      <button type="button" class="special-offer-claim-modal__close" data-special-offer-entry-form-close aria-label="${escapeHtml(t.closeDialog)}">×</button>
      <h2 id="specialOfferEntryFormModalTitle">${escapeHtml(isEdit ? t.editSubmittedForm : t.viewSubmittedForm)}</h2>
      ${isEdit ? `<div class="special-offer-activity-message"><h3>${escapeHtml(t.oneCorrectionWarning)}</h3></div>` : ''}
      ${isEdit ? `
        <form class="special-offer-activity-claim-form" data-special-offer-entry-correction-form>
          ${answers.map((answer, index) => renderCorrectionField(answer, index, lang)).join('')}
          <div class="special-offer-claim-modal__actions">
            <button type="submit" class="special-offer-button" data-special-offer-entry-correction-submit>${escapeHtml(t.saveOnlyCorrection)}</button>
            <button type="button" class="special-offer-button special-offer-button--secondary" data-special-offer-entry-form-close>${escapeHtml(t.cancel)}</button>
          </div>
          <p class="special-offer-form-help" data-special-offer-entry-correction-status role="status" aria-live="polite"></p>
        </form>
      ` : `
        <div class="special-offer-activity-placeholder">
          ${answers.map((answer) => renderStoredAnswerView(answer, lang)).join('') || `<p class="special-offer-empty">${escapeHtml(t.notConfigured)}</p>`}
        </div>
      `}
    </div>
  `;
  document.body.appendChild(modal);
  const correctionForm = modal.querySelector('[data-special-offer-entry-correction-form]');
  const initialAnswersJson = correctionForm instanceof HTMLFormElement
    ? JSON.stringify(collectCorrectionAnswers(correctionForm))
    : '';
  activeEntryFormModal = { node: modal, previousFocus: trigger || document.activeElement, mode, initialAnswersJson };
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offer-entry-form-close]')) closeEntryFormModal();
  });
  modal.addEventListener('submit', (event) => {
    const form = event.target instanceof Element ? event.target.closest('[data-special-offer-entry-correction-form]') : null;
    if (!form) return;
    event.preventDefault();
    submitEntryCorrection(form, lang);
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeEntryFormModal();
    }
    if (event.key === 'Tab') {
      const focusables = Array.from(modal.querySelectorAll('button, input, textarea, select, a[href]'))
        .filter((node) => node instanceof HTMLElement && !node.hasAttribute('disabled'));
      if (!focusables.length) return;
      const firstNode = focusables[0];
      const lastNode = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    }
  });
  const first = modal.querySelector('button, input, select, textarea, a');
  if (first instanceof HTMLElement) first.focus({ preventScroll: true });
}

async function submitEntryCorrection(form, lang) {
  const t = getText(lang);
  const entry = ownEntryState.entry;
  if (!entry?.id || Number(entry.correction_count || 0) >= 1) {
    form.querySelector('[data-special-offer-entry-correction-status]').textContent = t.correctionUnavailable;
    return;
  }
  if (!window.confirm(t.oneCorrectionWarning)) return;
  const button = form.querySelector('[data-special-offer-entry-correction-submit]');
  const status = form.querySelector('[data-special-offer-entry-correction-status]');
  if (button instanceof HTMLButtonElement) button.disabled = true;
  if (status) status.textContent = '';
  try {
    const correctionId = getCorrectionId(entry.id);
    const answers = collectCorrectionAnswers(form);
    const { error } = await supabase.rpc('update_special_offer_entry_once', {
      p_entry_id: entry.id,
      p_answers: answers,
      p_client_correction_id: correctionId,
    });
    if (error) throw error;
    clearCorrectionId(entry.id);
    await refreshOwnEntryData({ render: true });
    await refreshActivityData({ render: true });
    closeEntryFormModal({ restoreFocus: true, force: true });
    showFormStatus(t.correctionSaved, 'success');
  } catch (error) {
    const code = mapSubmitError(error);
    if (status) status.textContent = getErrorMessage(code, lang);
  } finally {
    if (button instanceof HTMLButtonElement) button.disabled = false;
  }
}

function renderEntryLookupError(lang) {
  const t = getText(lang);
  refs.entrySection.innerHTML = `
    <h2>${escapeHtml(t.entryTitle)}</h2>
    <div class="special-offer-form-locked" data-special-offer-entry-lookup-error dir="${lang === 'he' ? 'rtl' : 'ltr'}">
      <h3>${escapeHtml(t.entryLookupErrorTitle)}</h3>
      <p>${escapeHtml(t.entryLookupErrorCopy)}</p>
      <button type="button" class="special-offer-button" data-special-offer-entry-lookup-retry>${escapeHtml(t.retry)}</button>
    </div>
  `;
  const button = refs.entrySection.querySelector('[data-special-offer-entry-lookup-retry]');
  if (button instanceof HTMLButtonElement) {
    button.addEventListener('click', () => {
      void refreshOwnEntryData({ render: true, scroll: true });
    });
  }
}

async function applyAuthenticatedEmailToForm() {
  const form = getFormElement();
  if (!(form instanceof HTMLFormElement)) return;
  const fieldMap = getActiveFieldMap();
  if (!fieldMap.has('email')) return;
  const session = await getCurrentSession();
  const email = cleanText(session?.user?.email);
  const input = form.elements.namedItem('email');
  const wrapper = getFieldWrapper('email');
  wrapper?.querySelector('[data-special-offer-account-email-hint]')?.remove();
  if (input instanceof HTMLInputElement && email) {
    input.value = email;
    input.readOnly = true;
    formDraft.email = email;
    const hint = document.createElement('p');
    hint.className = 'special-offer-form-help special-offer-form-account-hint';
    hint.dataset.specialOfferAccountEmailHint = 'true';
    hint.textContent = getText(currentState?.lang || readRequestedLang()).accountEmailHint;
    wrapper?.appendChild(hint);
  } else if (input instanceof HTMLInputElement) {
    input.readOnly = false;
  }
}

async function handleEntrySubmit(event) {
  event?.preventDefault();
  const state = currentState;
  const lang = state?.lang || readRequestedLang();
  const data = state?.data;
  if (!state || !data || submitting) return;
  if (state.previewMode) return;
  if (!isCampaignOpenForSubmissions(data)) {
    activeSubmitErrorCode = getCampaignWindowState(data.campaign) === 'ended' ? 'campaign_closed' : 'campaign_not_open';
    showFormStatus(getErrorMessage(activeSubmitErrorCode, lang), 'error');
    return;
  }
  if (data.campaign?.requires_form !== true || !getActiveFields(data).length) return;

  submitting = true;
  saveCurrentFormDraft();
  clearFieldErrors();
  formStatus = 'validating';
  setSubmitButtonState('validating', lang);

  await refreshSpecialOfferAuthState();
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    submitting = false;
    setSubmitButtonState('idle', lang);
    openAuthGate(lang);
    return;
  }
  if (!isConfirmedAuthUser(session.user)) {
    submitting = false;
    formStatus = 'login_required';
    activeSubmitErrorCode = 'email_not_confirmed';
    setSubmitButtonState('idle', lang);
    showFormStatus(getErrorMessage('email_not_confirmed', lang), 'warning');
    openAuthGate(lang, 'email_not_confirmed');
    return;
  }

  await refreshOwnEntryData({ render: false });
  if (ownEntryState.errorCode || ownEntryState.loading || ownEntryState.entries.length > 0) {
    submitting = false;
    formStatus = 'idle';
    setSubmitButtonState('idle', lang);
    if (ownEntryState.entries.length === 1) {
      renderExistingEntryState(ownEntryState.entry, lang);
    } else if (ownEntryState.entries.length > 1) {
      renderEntryLookupError(lang);
    } else {
      renderEntryLookupError(lang);
    }
    return;
  }

  await applyAuthenticatedEmailToForm();
  saveCurrentFormDraft();
  const { answers, errors } = collectSpecialOfferAnswers();
  if (errors.length) {
    submitting = false;
    formStatus = 'non_retryable_error';
    setSubmitButtonState('idle', lang);
    showValidationErrors(errors, lang);
    showFormStatus(getText(lang).formErrorTitle, 'error');
    return;
  }

  const submissionId = getSubmissionId();
  formStatus = 'submitting';
  setSubmitButtonState('submitting', lang);
  showFormStatus('', 'info');
  try {
    const { data: result, error } = await supabase.rpc('submit_special_offer_entry', {
      p_offer_slug: currentSlug,
      p_lang: lang,
      p_answers: answers,
      p_client_submission_id: submissionId,
    });
    if (error) throw error;
    clearSubmissionId();
    formDraft = {};
    activeSubmitErrorCode = '';
    formStatus = 'success';
    showSuccessState(result, lang);
    void refreshOwnEntryData({ render: false }).then(() => refreshActivityData({ render: true }));
  } catch (error) {
    console.warn('Special Offer entry submit failed:', error);
    const code = mapSubmitError(error);
    activeSubmitErrorCode = code;
    const retryable = code === 'network_error' || code === 'temporary_error';
    formStatus = retryable ? 'retryable_error' : 'non_retryable_error';
    showFormStatus(getErrorMessage(code, lang), retryable ? 'warning' : 'error');
  } finally {
    submitting = false;
    if (formStatus !== 'success') setSubmitButtonState('idle', lang);
  }
}

function renderRequiredMarker(required) {
  return required ? '<span class="special-offer-form-required" aria-hidden="true">*</span>' : '';
}

function renderFormField(field, translationsByField, lang, index) {
  const t = getText(lang);
  const translation = getFieldTranslation(field, translationsByField, lang);
  const label = translation.label || t.genericField;
  const placeholder = translation.placeholder;
  const helpText = translation.help_text;
  const options = translation.options_json;
  const validation = parseJsonObject(field?.validation_json);
  const fieldType = cleanText(field?.field_type) || 'text';
  const fieldKey = cleanText(field?.field_key) || `field_${index + 1}`;
  const inputId = `specialOfferField${index + 1}_${fieldKey.replace(/[^a-z0-9_]/gi, '_')}`;
  const required = field?.required === true;
  const commonAttrs = [
    `id="${escapeHtml(inputId)}"`,
    `name="${escapeHtml(fieldKey)}"`,
    `data-special-offer-field-key="${escapeHtml(fieldKey)}"`,
    required ? 'required aria-required="true"' : '',
    placeholder ? `placeholder="${escapeHtml(placeholder)}"` : '',
    `dir="${lang === 'he' ? 'rtl' : 'ltr'}"`,
  ].filter(Boolean).join(' ');
  const textAttrs = getTextValidationAttributes(validation);
  let control = '';

  if (fieldType === 'textarea' || fieldType === 'contest_answer') {
    control = `<textarea rows="4" ${commonAttrs} ${textAttrs}></textarea>`;
  } else if (fieldType === 'select') {
    control = `
      <select ${commonAttrs}>
        <option value="">${escapeHtml(placeholder || t.selectPlaceholder)}</option>
        ${options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`).join('')}
      </select>
    `;
  } else if (fieldType === 'checkbox_group') {
    control = options.length
      ? `<div class="special-offer-form-options" role="group" aria-labelledby="${escapeHtml(inputId)}Label">
          ${options.map((option, optionIndex) => `
            <label class="special-offer-form-choice">
              <input type="checkbox" name="${escapeHtml(fieldKey)}" value="${escapeHtml(option.value)}" ${required ? 'data-required-group="true"' : ''} />
              <span>${escapeHtml(option.label || option.value)}</span>
            </label>
          `).join('')}
        </div>`
      : `<p class="special-offer-empty">${escapeHtml(t.notConfigured)}</p>`;
  } else if (fieldType === 'checkbox' || fieldType === 'consent') {
    control = `
      <label class="special-offer-form-choice special-offer-form-choice--standalone">
        <input id="${escapeHtml(inputId)}" name="${escapeHtml(fieldKey)}" type="checkbox" ${required || validation.must_be_true ? 'required aria-required="true"' : ''} />
        <span>${escapeHtml(label)} ${renderRequiredMarker(required)}</span>
      </label>
    `;
  } else {
    const inputType = fieldType === 'email'
      ? 'email'
      : fieldType === 'phone'
        ? 'tel'
        : fieldType === 'date' || fieldType === 'date_of_birth'
          ? 'date'
          : ['url', 'facebook_profile_url', 'shared_post_url'].includes(fieldType)
            ? 'url'
            : 'text';
    const dobMax = fieldType === 'date_of_birth' && validation.min_age !== undefined
      ? `max="${escapeHtml(getMaxDateForMinAge(validation.min_age))}" data-min-age="${escapeHtml(validation.min_age)}"`
      : '';
    const phoneAttrs = fieldType === 'phone'
      ? `data-special-offer-phone="true" data-placeholder="${escapeHtml(placeholder)}"`
      : '';
    const autocomplete = fieldType === 'email'
      ? 'autocomplete="email"'
      : fieldType === 'phone'
        ? 'autocomplete="tel"'
        : fieldType === 'country'
          ? 'autocomplete="country-name"'
          : fieldType === 'city'
            ? 'autocomplete="address-level2"'
            : '';
    control = `<input type="${escapeHtml(inputType)}" ${commonAttrs} ${textAttrs} ${dobMax} ${phoneAttrs} ${autocomplete} />`;
  }

  return `
    <div class="special-offer-form-field special-offer-form-field--${escapeHtml(fieldType)}" data-special-offer-form-field="${escapeHtml(fieldKey)}">
      ${fieldType === 'checkbox' || fieldType === 'consent' ? '' : `
        <label id="${escapeHtml(inputId)}Label" for="${escapeHtml(inputId)}">
          <span>${escapeHtml(label)}</span>
          ${renderRequiredMarker(required)}
        </label>
      `}
      ${control}
      ${helpText ? `<p class="special-offer-form-help">${escapeHtml(helpText)}</p>` : ''}
    </div>
  `;
}

function enhanceFormPhoneInputs(lang) {
  document.querySelectorAll('[data-special-offer-phone]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    enhancePhoneInput(input, {
      language: () => lang,
      fieldSelector: '.special-offer-form-field',
      fieldClass: 'special-offer-form-field--phone-enhanced',
      required: input.required,
      placeholder: input.dataset.placeholder || '',
    });
  });
}

function renderLockedFormState(lang, state) {
  const t = getText(lang);
  const isEmailConfirmation = state === 'email_not_confirmed';
  const title = state === 'checking'
    ? t.authChecking
    : isEmailConfirmation
      ? t.emailNotConfirmedTitle
      : t.loginRequiredTitle;
  const copy = state === 'checking'
    ? ''
    : isEmailConfirmation
      ? t.emailNotConfirmedCopy
      : t.loginRequiredCopy;
  const buttonLabel = isEmailConfirmation ? t.refreshAccess : t.loginButton;
  refs.entrySection.innerHTML = `
    <h2>${escapeHtml(t.entryTitle)}</h2>
    <div class="special-offer-form-locked" data-special-offer-form-locked dir="${lang === 'he' ? 'rtl' : 'ltr'}">
      <h3>${escapeHtml(title)}</h3>
      ${copy ? `<p>${escapeHtml(copy)}</p>` : ''}
      ${state === 'checking' ? `<p class="special-offer-form-help">${escapeHtml(t.authChecking)}</p>` : `
        <button type="button" class="special-offer-button" data-special-offer-auth-open>${escapeHtml(buttonLabel)}</button>
      `}
    </div>
  `;
  const button = refs.entrySection.querySelector('[data-special-offer-auth-open]');
  if (button instanceof HTMLButtonElement) {
    button.addEventListener('click', async () => {
      if (isEmailConfirmation) {
        await refreshSpecialOfferAuthState();
        if (authState.confirmed) {
          activeSubmitErrorCode = '';
          formStatus = 'idle';
          rerenderEntryFormIfPossible({ scroll: true });
          return;
        }
      }
      openAuthGate(lang, isEmailConfirmation ? 'email_not_confirmed' : 'login_required');
    });
  }
}

function renderEntryForm(data, lang) {
  const t = getText(lang);
  if (!refs.entrySection) return;
  refs.entrySection.hidden = false;
  refs.entrySection.dir = lang === 'he' ? 'rtl' : 'ltr';
  const requiresForm = data.campaign?.requires_form === true;
  if (!requiresForm) {
    refs.entrySection.innerHTML = `
      <h2>${escapeHtml(t.entryTitle)}</h2>
      <p class="special-offer-empty">${escapeHtml(t.noFormRequired)}</p>
    `;
    return;
  }

  const translationsByField = new Map();
  (Array.isArray(data.formFieldTranslations) ? data.formFieldTranslations : []).forEach((row) => {
    if (!row?.field_id) return;
    if (!translationsByField.has(row.field_id)) translationsByField.set(row.field_id, []);
    translationsByField.get(row.field_id).push(row);
  });
  const activeFields = (Array.isArray(data.formFields) ? data.formFields : [])
    .filter((field) => field?.active === true)
    .slice()
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));

  if (!activeFields.length) {
    refs.entrySection.innerHTML = `
      <h2>${escapeHtml(t.entryTitle)}</h2>
      <p class="special-offer-empty">${escapeHtml(t.notConfigured)}</p>
    `;
    return;
  }

  const previewMode = currentState?.previewMode === true;
  const canSubmit = !previewMode
    && isCampaignOpenForSubmissions(data);
  const canReadOwnEntry = !previewMode && isPublicReadableCampaign(data.campaign);
  if (canReadOwnEntry) {
    if (authState.checking) {
      if (canSubmit) {
        renderLockedFormState(lang, 'checking');
        return;
      }
    } else if (!authState.user?.id) {
      if (canSubmit) {
        renderLockedFormState(lang, 'login_required');
        return;
      }
    } else if (!authState.confirmed) {
      if (canSubmit) {
        renderLockedFormState(lang, 'email_not_confirmed');
        return;
      }
    } else {
      const offerId = cleanText(data.campaign?.id);
      if (ownEntryState.initializedFor !== offerId || ownEntryState.loading || !ownEntryState.loaded) {
        renderLockedFormState(lang, 'checking');
        return;
      }
      if (ownEntryState.errorCode) {
        renderEntryLookupError(lang);
        return;
      }
      if (ownEntryState.entries.length > 1) {
        refs.entrySection.innerHTML = `
          <h2>${escapeHtml(t.entryTitle)}</h2>
          <div class="special-offer-form-locked" data-special-offer-entry-multiple dir="${lang === 'he' ? 'rtl' : 'ltr'}">
            <h3>${escapeHtml(t.activityMultipleEntriesTitle)}</h3>
            <p>${escapeHtml(t.activityMultipleEntriesCopy)}</p>
          </div>
        `;
        return;
      }
      if (ownEntryState.entry?.id) {
        renderExistingEntryState(ownEntryState.entry, lang);
        return;
      }
    }
  }
  if (!canSubmit && !previewMode) {
    const windowState = getCampaignWindowState(data.campaign);
    refs.entrySection.innerHTML = `
      <h2>${escapeHtml(t.entryTitle)}</h2>
      <div class="special-offer-form-locked" data-special-offer-campaign-closed dir="${lang === 'he' ? 'rtl' : 'ltr'}">
        <h3>${escapeHtml(windowState === 'ended' ? t.campaignEndedTitle : getErrorMessage('campaign_not_open', lang))}</h3>
        <p>${escapeHtml(windowState === 'ended' ? t.campaignEndedCopy : getErrorMessage('campaign_not_open', lang))}</p>
      </div>
    `;
    return;
  }
  const statusMessage = previewMode ? t.previewMessage : activeSubmitErrorCode ? getErrorMessage(activeSubmitErrorCode, lang) : '';

  refs.entrySection.innerHTML = `
    <h2>${escapeHtml(t.entryTitle)}</h2>
    <form class="special-offer-entry-form" data-special-offer-entry-form aria-describedby="specialOfferFormPreviewNotice" novalidate>
      <div class="special-offer-form-status" data-special-offer-form-status role="status" aria-live="polite" data-tone="${activeSubmitErrorCode ? 'error' : 'info'}">${escapeHtml(statusMessage)}</div>
      <div class="special-offer-form-grid">
        ${activeFields.map((field, index) => renderFormField(field, translationsByField, lang, index)).join('')}
      </div>
      <div class="special-offer-form-submit">
        <p id="specialOfferFormPreviewNotice">${escapeHtml(previewMode ? t.previewMessage : '')}</p>
        <button class="special-offer-button" type="${canSubmit ? 'submit' : 'button'}" ${canSubmit ? '' : 'disabled'} data-special-offer-submit>${escapeHtml(t.submitLabel)}</button>
      </div>
    </form>
  `;
  const form = refs.entrySection.querySelector('[data-special-offer-entry-form]');
  if (form) {
    form.addEventListener('submit', handleEntrySubmit);
    bindValidationClearHandlers(form);
  }
  enhanceFormPhoneInputs(lang);
  restoreFormDraft();
  void applyAuthenticatedEmailToForm();
  setSubmitButtonState(formStatus, lang);
}

function renderActivityLocked(lang, state) {
  const t = getText(lang);
  const isEmail = state === 'email_not_confirmed';
  const title = state === 'checking'
    ? t.activityChecking
    : isEmail
      ? t.activityEmailTitle
      : t.activityLockedTitle;
  const copy = state === 'checking'
    ? ''
    : isEmail
      ? t.activityEmailCopy
      : t.activityLockedCopy;
  const buttonLabel = isEmail ? t.refreshAccess : t.activityLoginButton;
  return `
    <div class="special-offer-activity-locked" data-special-offer-activity-locked>
      <h3>${escapeHtml(title)}</h3>
      ${copy ? `<p>${escapeHtml(copy)}</p>` : ''}
      ${state === 'checking' ? `<p class="special-offer-form-help">${escapeHtml(t.activityChecking)}</p>` : `
        <button type="button" class="special-offer-button" data-special-offer-activity-auth-open>${escapeHtml(buttonLabel)}</button>
      `}
    </div>
  `;
}

function renderActivityMessage(title, copy = '') {
  return `
    <div class="special-offer-activity-message">
      <h3>${escapeHtml(title)}</h3>
      ${copy ? `<p>${escapeHtml(copy)}</p>` : ''}
    </div>
  `;
}

function renderScoreCard(score, lang) {
  const t = getText(lang);
  const safeScore = score || {};
  const items = [
    [t.basePoints, Number(safeScore.base_points || 0)],
    [t.sharePoints, Number(safeScore.share_points || 0)],
    [t.commentPoints, Number(safeScore.comment_points || 0)],
    [t.bonusPoints, Number(safeScore.bonus_points || 0)],
    [t.approvedActivities, Number(safeScore.approved_activity_count || 0)],
  ];
  return `
    <article class="special-offer-activity-card special-offer-activity-card--score" data-special-offer-score-card>
      <h3>${escapeHtml(t.myScore)}</h3>
      <div class="special-offer-score-total">
        <span>${escapeHtml(t.totalPoints)}</span>
        <strong>${escapeHtml(Number(safeScore.total_points || 0))}</strong>
      </div>
      <dl class="special-offer-score-breakdown">
        ${items.map(([label, value]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>
        `).join('')}
      </dl>
      <p class="special-offer-form-help">${escapeHtml(t.manualSelectionNotice)}</p>
    </article>
  `;
}

function renderEntrySummaryCard(entry, lang) {
  const t = getText(lang);
  return `
    <article class="special-offer-activity-card" data-special-offer-own-entry>
      <h3>${escapeHtml(t.myEntry)}</h3>
      <dl class="special-offer-activity-facts">
        <div>
          <dt>${escapeHtml(t.successReference)}</dt>
          <dd>${escapeHtml(entry?.reference || '')}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t.successStatus)}</dt>
          <dd>${escapeHtml(cleanText(entry?.status) || '-')}</dd>
        </div>
      </dl>
    </article>
  `;
}

function renderActivityStatus(activity, lang) {
  const t = getText(lang);
  if (!activity) return '';
  const status = cleanText(activity.status) || 'pending';
  const points = Number(activity.points_awarded || 0);
  return `
    <div class="special-offer-activity-status" data-status="${escapeHtml(status)}">
      <strong>${escapeHtml(getActivityStatusLabel(status, lang))}</strong>
      <span>${escapeHtml(t.points)}: ${escapeHtml(points)}</span>
      ${status === 'pending' ? `<span>${escapeHtml(t.manualReviewNotice)}</span>` : ''}
    </div>
  `;
}

function renderActivityClaimBlock(post, type, existingActivity, entry, lang) {
  const t = getText(lang);
  const label = type === 'comment' ? t.commentProof : t.shareProof;
  const eligible = canEntryClaimActivity(entry);
  if (existingActivity) {
    return `
      <div class="special-offer-activity-claim" data-special-offer-claim="${escapeHtml(type)}">
        <h4>${escapeHtml(label)}</h4>
        ${renderActivityStatus(existingActivity, lang)}
      </div>
    `;
  }
  return `
    <div class="special-offer-activity-claim" data-special-offer-claim="${escapeHtml(type)}">
      <h4>${escapeHtml(label)}</h4>
      ${type === 'comment' ? `<p class="special-offer-form-help">${escapeHtml(t.manualReviewNotice)}</p>` : ''}
      <button
        type="button"
        class="special-offer-button special-offer-button--secondary"
        data-special-offer-activity-open
        data-post-id="${escapeHtml(post.id)}"
        data-activity-type="${escapeHtml(type)}"
        ${eligible ? '' : 'disabled'}
      >${escapeHtml(t.addProof)}</button>
    </div>
  `;
}

function renderOfficialPostCard(post, activityMap, entry, lang) {
  const t = getText(lang);
  const postId = cleanText(post?.id);
  const title = cleanText(post?.admin_title) || `${t.officialPosts} ${cleanText(post?.post_order)}`;
  const officialUrl = cleanText(post?.official_url);
  const shareActivity = activityMap.get(`${postId}:share`);
  const commentActivity = activityMap.get(`${postId}:comment`);
  const safeOfficialUrl = isSafeHref(officialUrl) && /^https?:\/\//i.test(officialUrl);
  return `
    <article class="special-offer-official-post" data-special-offer-official-post="${escapeHtml(postId)}">
      <div class="special-offer-official-post__header">
        <div>
          <p class="special-offer-kicker">${escapeHtml(cleanText(post?.platform) || 'facebook')}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <span class="special-offer-post-order">#${escapeHtml(post?.post_order || '')}</span>
      </div>
      <dl class="special-offer-activity-facts">
        ${post?.week_number ? `<div><dt>Week</dt><dd>${escapeHtml(post.week_number)}</dd></div>` : ''}
        <div><dt>${escapeHtml(t.starts)}</dt><dd>${escapeHtml(formatDate(post?.published_at, lang, currentState?.data?.campaign?.timezone))}</dd></div>
        <div><dt>${escapeHtml(t.commentDeadline)}</dt><dd>${escapeHtml(formatDate(post?.comment_deadline_at, lang, currentState?.data?.campaign?.timezone))}</dd></div>
      </dl>
      ${safeOfficialUrl ? `
        <a class="special-offer-link-card__cta" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.openOfficialPost)}</a>
      ` : officialUrl ? `<p class="special-offer-form-help">${escapeHtml(officialUrl)}</p>` : ''}
      <div class="special-offer-activity-claims">
        ${renderActivityClaimBlock(post, 'share', shareActivity, entry, lang)}
        ${renderActivityClaimBlock(post, 'comment', commentActivity, entry, lang)}
      </div>
    </article>
  `;
}

function bindActivitySectionHandlers(lang) {
  refs.activitySection?.querySelector('[data-special-offer-activity-auth-open]')?.addEventListener('click', async () => {
    if (!authState.user?.id || !authState.confirmed) {
      await refreshSpecialOfferAuthState();
    }
    if (authState.confirmed) {
      await refreshActivityData({ render: true, scroll: true });
      return;
    }
    openAuthGate(lang, authState.user?.id ? 'email_not_confirmed' : 'login_required');
  });
  refs.activitySection?.querySelectorAll('[data-special-offer-activity-open]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener('click', () => {
      openActivityClaimModal(button.dataset.postId, button.dataset.activityType, lang);
    });
  });
  refs.activitySection?.querySelector('[data-special-offer-activity-retry]')?.addEventListener('click', () => {
    void refreshActivityData({ render: true, scroll: true });
  });
}

function renderActivitySection(data, lang) {
  if (!refs.activitySection || !refs.activityBody) return;
  const t = getText(lang);
  refs.activityTitle.textContent = t.activityTitle;
  refs.activitySection.dir = lang === 'he' ? 'rtl' : 'ltr';

  if (!isActivityCampaignAvailable(data)) {
    refs.activitySection.hidden = true;
    refs.activityBody.replaceChildren();
    return;
  }

  refs.activitySection.hidden = false;

  if (currentState?.previewMode) {
    refs.activityBody.innerHTML = renderActivityMessage(t.activityTitle, t.activityUnavailable);
    return;
  }
  if (authState.checking) {
    refs.activityBody.innerHTML = renderActivityLocked(lang, 'checking');
    bindActivitySectionHandlers(lang);
    return;
  }
  if (!authState.user?.id) {
    refs.activityBody.innerHTML = renderActivityLocked(lang, 'login_required');
    bindActivitySectionHandlers(lang);
    return;
  }
  if (!authState.confirmed) {
    refs.activityBody.innerHTML = renderActivityLocked(lang, 'email_not_confirmed');
    bindActivitySectionHandlers(lang);
    return;
  }
  if (activityState.loading) {
    refs.activityBody.innerHTML = renderActivityMessage(t.activityChecking);
    return;
  }
  if (activityState.errorCode) {
    refs.activityBody.innerHTML = `
      ${renderActivityMessage(t.activityErrorTitle, getErrorMessage(activityState.errorCode, lang))}
      <button type="button" class="special-offer-button special-offer-button--secondary" data-special-offer-activity-retry>${escapeHtml(t.retry)}</button>
    `;
    bindActivitySectionHandlers(lang);
    return;
  }
  if (activityState.entries.length > 1) {
    refs.activityBody.innerHTML = renderActivityMessage(t.activityMultipleEntriesTitle, t.activityMultipleEntriesCopy);
    return;
  }
  if (!activityState.entry?.id) {
    refs.activityBody.innerHTML = renderActivityMessage(t.activityNoEntryTitle, t.activityNoEntryCopy);
    return;
  }

  const entry = activityState.entry;
  const activityMap = getActivityMap(activityState.activities);
  const blocked = !canEntryClaimActivity(entry);
  const posts = Array.isArray(activityState.posts) ? activityState.posts : [];

  refs.activityBody.innerHTML = `
    <div class="special-offer-activity-overview">
      ${renderEntrySummaryCard(entry, lang)}
      ${renderScoreCard(activityState.score, lang)}
    </div>
    ${blocked ? renderActivityMessage(t.activityEntryBlockedTitle, t.activityEntryBlockedCopy) : ''}
    <div class="special-offer-official-posts">
      <h3>${escapeHtml(t.officialPosts)}</h3>
      ${posts.length ? posts.map((post) => renderOfficialPostCard(post, activityMap, entry, lang)).join('') : `<p class="special-offer-empty">${escapeHtml(t.noOfficialPosts)}</p>`}
    </div>
  `;
  bindActivitySectionHandlers(lang);
}

function closeActivityClaimModal({ restoreFocus = true } = {}) {
  if (!activeClaimModal?.node) return;
  saveActiveClaimDraft();
  const previousFocus = activeClaimModal.previousFocus;
  activeClaimModal.node.remove();
  activeClaimModal = null;
  if (restoreFocus && previousFocus instanceof HTMLElement) {
    previousFocus.focus({ preventScroll: true });
  }
}

function buildActivityClaimModal(post, type, lang) {
  const t = getText(lang);
  const label = type === 'comment' ? t.commentProof : t.shareProof;
  const draft = activityClaimDrafts[getActivityDraftKey(post.id, type)] || {};
  const modal = document.createElement('div');
  modal.className = 'special-offer-claim-modal';
  modal.dataset.specialOfferClaimModal = 'true';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'specialOfferClaimTitle');
  modal.dir = lang === 'he' ? 'rtl' : 'ltr';
  modal.innerHTML = `
    <div class="special-offer-claim-modal__backdrop" data-special-offer-claim-close></div>
    <div class="special-offer-claim-modal__dialog" role="document">
      <button type="button" class="special-offer-claim-modal__close" data-special-offer-claim-close aria-label="Close">x</button>
      <h2 id="specialOfferClaimTitle">${escapeHtml(label)}</h2>
      <p class="special-offer-form-help">${escapeHtml(t.manualReviewNotice)}</p>
      ${type === 'comment' ? `
        <p class="special-offer-form-help">${escapeHtml(t.commentDeadline)}: ${escapeHtml(formatDate(post.comment_deadline_at, lang, currentState?.data?.campaign?.timezone))}</p>
      ` : ''}
      <form class="special-offer-activity-claim-form" data-special-offer-activity-claim-form novalidate>
        <div class="special-offer-form-status" data-special-offer-activity-claim-status role="status" aria-live="polite"></div>
        <label class="special-offer-form-field">
          <span>${escapeHtml(t.evidenceUrl)} <span class="special-offer-form-required" aria-hidden="true">*</span></span>
          <input type="url" name="evidence_url" required value="${escapeHtml(draft.evidence_url || '')}" autocomplete="url" />
        </label>
        <label class="special-offer-form-field">
          <span>${escapeHtml(t.evidenceText)} (${escapeHtml(t.optional)})</span>
          <textarea name="evidence_text" rows="4" maxlength="2000">${escapeHtml(draft.evidence_text || '')}</textarea>
        </label>
        <label class="special-offer-form-field">
          <span>${escapeHtml(t.participantReportedAt)} (${escapeHtml(t.optional)})</span>
          <input type="datetime-local" name="participant_reported_at" value="${escapeHtml(draft.participant_reported_at || '')}" />
        </label>
        <div class="special-offer-form-submit">
          <button type="button" class="special-offer-button special-offer-button--secondary" data-special-offer-claim-close>${escapeHtml(t.cancel)}</button>
          <button type="submit" class="special-offer-button" data-special-offer-activity-claim-submit>${escapeHtml(t.submitEvidence)}</button>
        </div>
      </form>
    </div>
  `;
  return modal;
}

function openActivityClaimModal(postId, type, lang) {
  const post = activityState.posts.find((item) => cleanText(item?.id) === cleanText(postId));
  const normalizedType = cleanText(type);
  if (!post || !['share', 'comment'].includes(normalizedType)) return;
  closeActivityClaimModal({ restoreFocus: false });
  const modal = buildActivityClaimModal(post, normalizedType, lang);
  activeClaimModal = {
    node: modal,
    postId: post.id,
    type: normalizedType,
    previousFocus: document.activeElement,
  };
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-special-offer-claim-close]').forEach((node) => {
    node.addEventListener('click', () => closeActivityClaimModal());
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeActivityClaimModal();
    }
    if (event.key === 'Tab') {
      const focusables = Array.from(modal.querySelectorAll('button, input, textarea, select, a[href]'))
        .filter((node) => node instanceof HTMLElement && !node.hasAttribute('disabled'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  const form = modal.querySelector('[data-special-offer-activity-claim-form]');
  if (form instanceof HTMLFormElement) {
    form.addEventListener('input', saveActiveClaimDraft);
    form.addEventListener('submit', (event) => {
      void handleActivityClaimSubmit(event, post, normalizedType, lang);
    });
  }
  const firstInput = modal.querySelector('input[name="evidence_url"]');
  if (firstInput instanceof HTMLElement) firstInput.focus({ preventScroll: true });
}

function setClaimModalStatus(message, tone = 'info') {
  const node = activeClaimModal?.node?.querySelector('[data-special-offer-activity-claim-status]');
  if (!(node instanceof HTMLElement)) return;
  node.textContent = message || '';
  node.dataset.tone = tone;
}

function setClaimSubmitState(submittingState, lang) {
  const button = activeClaimModal?.node?.querySelector('[data-special-offer-activity-claim-submit]');
  if (!(button instanceof HTMLButtonElement)) return;
  const t = getText(lang);
  button.disabled = submittingState;
  button.textContent = submittingState ? t.submittingEvidence : t.submitEvidence;
  button.setAttribute('aria-busy', submittingState ? 'true' : 'false');
}

function readParticipantReportedAt(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function handleActivityClaimSubmit(event, post, type, lang) {
  event.preventDefault();
  if (activitySubmitting) return;
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const t = getText(lang);
  const entry = activityState.entry;
  if (!entry?.id || !canEntryClaimActivity(entry)) {
    setClaimModalStatus(getErrorMessage('entry_not_eligible_for_activity', lang), 'error');
    return;
  }

  saveActiveClaimDraft();
  await refreshSpecialOfferAuthState();
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    openAuthGate(lang);
    return;
  }
  if (!isConfirmedAuthUser(session.user)) {
    openAuthGate(lang, 'email_not_confirmed');
    return;
  }

  const evidenceUrl = cleanText(form.elements.namedItem('evidence_url')?.value);
  const evidenceText = cleanText(form.elements.namedItem('evidence_text')?.value);
  const participantReportedAt = readParticipantReportedAt(form.elements.namedItem('participant_reported_at')?.value);
  if (!isValidActivityEvidenceUrl(evidenceUrl)) {
    setClaimModalStatus(getErrorMessage('invalid_activity_url', lang), 'error');
    form.elements.namedItem('evidence_url')?.focus?.();
    return;
  }
  if (evidenceText.length > 2000) {
    setClaimModalStatus(getErrorMessage('evidence_text_too_long', lang), 'error');
    form.elements.namedItem('evidence_text')?.focus?.();
    return;
  }

  const submissionId = getActivitySubmissionId(entry.id, post.id, type);
  activitySubmitting = true;
  setClaimSubmitState(true, lang);
  setClaimModalStatus('', 'info');
  try {
    const { data, error } = await supabase.rpc('submit_special_offer_activity_claim', {
      p_entry_id: entry.id,
      p_official_post_id: post.id,
      p_activity_type: type,
      p_evidence_url: evidenceUrl,
      p_client_submission_id: submissionId,
      p_evidence_text: evidenceText || null,
      p_participant_reported_at: participantReportedAt,
    });
    if (error) throw error;
    clearActivitySubmissionId(entry.id, post.id, type);
    delete activityClaimDrafts[getActivityDraftKey(post.id, type)];
    const payload = Array.isArray(data) ? data[0] : data;
    setClaimModalStatus(payload?.duplicate ? t.activityDuplicate : t.activitySuccess, 'success');
    await refreshActivityData({ render: true });
    await new Promise((resolve) => setTimeout(resolve, 150));
    closeActivityClaimModal({ restoreFocus: false });
  } catch (error) {
    console.warn('Special Offer activity claim failed:', error);
    setClaimModalStatus(getErrorMessage(mapActivityError(error), lang), 'error');
  } finally {
    activitySubmitting = false;
    setClaimSubmitState(false, lang);
  }
}

function renderPrizes(prizes, prizeTranslations, lang, previewMode) {
  const t = getText(lang);
  refs.prizes.replaceChildren();
  const translationMap = new Map();
  (Array.isArray(prizeTranslations) ? prizeTranslations : []).forEach((row) => {
    if (!translationMap.has(row?.prize_id)) translationMap.set(row?.prize_id, []);
    translationMap.get(row?.prize_id).push(row);
  });

  const visiblePrizes = (Array.isArray(prizes) ? prizes : []).slice().sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
  if (!visiblePrizes.length) {
    refs.prizes.innerHTML = `<p class="special-offer-empty">${escapeHtml(t.noPrize)}</p>`;
    return;
  }

  visiblePrizes.forEach((prize) => {
    const picked = pickTranslation(translationMap.get(prize.id) || [], lang).row || {};
    const name = cleanText(picked.name || (previewMode ? prize.name : ''));
    const description = cleanText(picked.description || (previewMode ? prize.description : ''));
    const restrictions = cleanText(picked.restrictions || (previewMode ? prize.restrictions : ''));
    const notes = cleanText(picked.fulfillment_notes || (previewMode ? prize.fulfillment_notes : ''));
    const card = document.createElement('article');
    card.className = 'special-offer-prize';
    if (lang === 'he') card.dir = 'rtl';
    const h3 = document.createElement('h3');
    h3.textContent = name || t.noPrize;
    card.appendChild(h3);
    [description, restrictions, notes].filter(Boolean).forEach((value) => {
      const p = document.createElement('p');
      p.textContent = value;
      card.appendChild(p);
    });
    refs.prizes.appendChild(card);
  });
}

function renderRules(translation, lang) {
  const t = getText(lang);
  const html = sanitizeHtml(translation?.rules_html);
  refs.rules.innerHTML = html || `<p class="special-offer-empty">${escapeHtml(t.noRules)}</p>`;
}

function renderFaq(translation, lang) {
  const t = getText(lang);
  refs.faq.replaceChildren();
  const items = parseFaq(translation?.faq_json);
  if (!items.length) {
    refs.faq.innerHTML = `<p class="special-offer-empty">${escapeHtml(t.noFaq)}</p>`;
    return;
  }
  items.forEach((item, index) => {
    const details = document.createElement('details');
    if (index === 0) details.open = true;
    if (lang === 'he') details.dir = 'rtl';
    const summary = document.createElement('summary');
    summary.textContent = item.question;
    const answer = document.createElement('p');
    answer.textContent = item.answer;
    details.append(summary, answer);
    refs.faq.appendChild(details);
  });
}

function renderLinks(links, linkTranslations, lang) {
  const t = getText(lang);
  refs.links.replaceChildren();
  const translationMap = new Map();
  (Array.isArray(linkTranslations) ? linkTranslations : []).forEach((row) => {
    if (!translationMap.has(row?.link_id)) translationMap.set(row?.link_id, []);
    translationMap.get(row?.link_id).push(row);
  });

  const visibleLinks = (Array.isArray(links) ? links : [])
    .filter((link) => link && link.is_active !== false)
    .slice()
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));

  visibleLinks.forEach((link) => {
    const picked = pickTranslation(translationMap.get(link.id) || [], lang).row || {};
    const url = cleanText(picked.url || link.url);
    const label = cleanText(picked.label || link.label || link.link_type);
    const description = cleanText(picked.description || link.description);
    const imageUrl = String(link.image_url || '');
    if (!url || !label || !isSafeHref(url)) return;
    const card = document.createElement('article');
    card.className = 'special-offer-link-card';
    card.dataset.primary = link.is_primary ? 'true' : 'false';
    card.dir = lang === 'he' ? 'rtl' : 'ltr';

    if (isSafeImageSrc(imageUrl)) {
      const media = document.createElement('div');
      media.className = 'special-offer-link-card__media';
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = label;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        media.remove();
        card.classList.add('special-offer-link-card--no-image');
      }, { once: true });
      media.appendChild(image);
      card.appendChild(media);
    } else {
      card.classList.add('special-offer-link-card--no-image');
    }

    const body = document.createElement('div');
    body.className = 'special-offer-link-card__body';
    const title = document.createElement('h3');
    title.textContent = label;
    body.appendChild(title);
    if (description) {
      const copy = document.createElement('p');
      copy.textContent = description;
      body.appendChild(copy);
    }
    const anchor = document.createElement('a');
    anchor.className = 'special-offer-link-card__cta';
    anchor.href = url;
    anchor.textContent = t.linkCta;
    anchor.setAttribute('aria-label', label);
    if (/^https?:\/\//i.test(url)) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    body.appendChild(anchor);
    card.appendChild(body);
    refs.links.appendChild(card);
  });

  if (!refs.links.children.length) {
    const empty = document.createElement('p');
    empty.className = 'special-offer-empty';
    empty.textContent = t.noLinks;
    refs.links.appendChild(empty);
  }
}

function normalizeWinnerPayload(payload) {
  const source = Array.isArray(payload) ? payload[0] : payload;
  if (!source || typeof source !== 'object') {
    return {
      winner_published: false,
      public_name: '',
      published_at: null,
      campaign_slug: '',
    };
  }
  return {
    winner_published: source.winner_published === true,
    public_name: cleanText(source.public_name),
    published_at: source.published_at || null,
    campaign_slug: cleanText(source.campaign_slug),
  };
}

async function loadPublicWinner(slug) {
  try {
    const { data, error } = await supabase.rpc('get_public_special_offer_winner', {
      p_slug: slug,
    });
    if (error) return normalizeWinnerPayload(null);
    return normalizeWinnerPayload(data);
  } catch (_error) {
    return normalizeWinnerPayload(null);
  }
}

function renderWinnerSection(data, lang) {
  if (!refs.winnerSection || !refs.winnerTitle || !refs.winnerBody) return;
  const t = getText(lang);
  const campaignState = getCampaignWindowState(data?.campaign);
  const winner = normalizeWinnerPayload(data?.winnerResult);
  refs.winnerSection.dir = lang === 'he' ? 'rtl' : 'ltr';

  if (winner.winner_published && winner.public_name) {
    refs.winnerSection.hidden = false;
    refs.winnerTitle.textContent = t.winnerResultTitle;
    const publishedAt = formatDate(winner.published_at, lang, data?.campaign?.timezone);
    refs.winnerBody.innerHTML = `
      <article class="special-offer-winner-card" data-special-offer-winner-result>
        <h3>${escapeHtml(winner.public_name)}</h3>
        ${publishedAt ? `<p><strong>${escapeHtml(t.winnerPublishedAt)}:</strong> ${escapeHtml(publishedAt)}</p>` : ''}
        <p>${escapeHtml(t.winnerManualSelectionCopy)}</p>
      </article>
    `;
    return;
  }

  if (campaignState === 'ended') {
    refs.winnerSection.hidden = false;
    refs.winnerTitle.textContent = t.winnerResultPendingTitle;
    refs.winnerBody.innerHTML = `
      <div class="special-offer-activity-message" data-special-offer-winner-pending>
        <p>${escapeHtml(t.winnerResultPendingCopy)}</p>
      </div>
    `;
    return;
  }

  refs.winnerSection.hidden = true;
  refs.winnerBody.replaceChildren();
}

function getMetaDescription(translation) {
  return cleanText(translation?.seo_description || translation?.short_description || translation?.full_description).slice(0, 160);
}

function updateSeo(translation, campaign, lang, data) {
  const title = cleanText(translation?.seo_title || translation?.title || campaign?.slug || 'Special Offer');
  document.title = `${title} • CyprusEye`;
  const description = getMetaDescription(translation);
  if (description) setNamedMeta('description', description);

  const canonical = setCanonicalAndAlternates(campaign, lang);
  const ogImage = getOgImage(data);
  setPropertyMeta('og:type', 'website');
  setPropertyMeta('og:title', title);
  setPropertyMeta('og:description', description || title);
  setPropertyMeta('og:url', canonical);
  setPropertyMeta('og:image', ogImage);
  setPropertyMeta('og:locale', lang === 'pl' ? 'pl_PL' : lang === 'he' ? 'he_IL' : 'en_GB');
  setPropertyMeta('og:locale:alternate', lang === 'pl' ? 'en_GB' : 'pl_PL');
  setNamedMeta('twitter:card', 'summary_large_image');
  setNamedMeta('twitter:title', title);
  setNamedMeta('twitter:description', description || title);
  setNamedMeta('twitter:image', ogImage);
}

function renderCampaign(data, requestedLang, previewMode) {
  const picked = pickTranslation(data.translations, requestedLang);
  const lang = normalizeLang(picked.lang);
  const translation = picked.row || {};
  const t = getText(lang);
  currentState = { data, lang, previewMode };
  setPageLanguage(lang);
  updateStaticText(lang);
  updateSeo(translation, data.campaign, lang, data);
  setRobotsNoIndex(previewMode || !isPublicReadableCampaign(data.campaign));

  refs.loading.hidden = true;
  refs.unavailable.hidden = true;
  refs.content.hidden = false;

  setText(refs.modeLabel, previewMode ? t.previewMode : t.mode);
  setText(refs.title, translation.title || data.campaign?.slug || t.mode);
  setText(refs.short, translation.short_description);
  setParagraphs(refs.full, translation.full_description);
  renderDates(data.campaign, lang);
  renderPrizes(data.prizes, data.prizeTranslations, lang, previewMode);
  renderRules(translation, lang);
  renderFaq(translation, lang);
  renderLinks(data.links, data.linkTranslations, lang);
  renderWinnerSection(data, lang);
  renderEntryForm(data, lang);
  renderActivitySection(data, lang);
  void refreshOwnEntryData({ render: true }).then(() => refreshActivityData({ render: true }));
}

async function fetchRows(table, filters = [], order = null) {
  let query = supabase.from(table).select('*');
  filters.forEach(([column, value, mode]) => {
    if (mode === 'in') {
      query = query.in(column, value);
    } else {
      query = query.eq(column, value);
    }
  });
  if (order) query = query.order(order, { ascending: true });
  const { data, error } = await query;
  if (error) {
    console.error(`Special Offer landing select failed for ${table}:`, error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

function normalizePublicLandingPayload(payload) {
  const source = Array.isArray(payload) ? payload[0] : payload;
  if (!source || typeof source !== 'object') return null;
  const campaign = source.campaign && typeof source.campaign === 'object' ? source.campaign : null;
  if (!campaign?.id) return null;
  return {
    campaign,
    translations: Array.isArray(source.translations) ? source.translations : [],
    prizes: Array.isArray(source.prizes) ? source.prizes : [],
    prizeTranslations: Array.isArray(source.prizeTranslations) ? source.prizeTranslations : Array.isArray(source.prize_translations) ? source.prize_translations : [],
    links: Array.isArray(source.links) ? source.links : [],
    linkTranslations: Array.isArray(source.linkTranslations) ? source.linkTranslations : Array.isArray(source.link_translations) ? source.link_translations : [],
    formFields: Array.isArray(source.formFields) ? source.formFields : Array.isArray(source.form_fields) ? source.form_fields : [],
    formFieldTranslations: Array.isArray(source.formFieldTranslations) ? source.formFieldTranslations : Array.isArray(source.form_field_translations) ? source.form_field_translations : [],
    previewAllowed: false,
  };
}

async function loadPublicCampaign(slug) {
  const { data, error } = await supabase.rpc('get_public_special_offer_landing', {
    p_slug: slug,
  });
  if (error) {
    console.error('Special Offer public landing RPC failed:', error);
    return null;
  }
  const payload = normalizePublicLandingPayload(data);
  if (!payload?.campaign) return null;
  if (!isPublicReadableCampaign(payload.campaign)) return null;
  payload.winnerResult = await loadPublicWinner(slug);
  return payload;
}

async function loadCampaign(slug, previewMode) {
  let previewAllowed = false;
  if (previewMode) {
    try {
      const { data } = await supabase.auth.getUser();
      previewAllowed = Boolean(data?.user?.id);
    } catch (_error) {
      previewAllowed = false;
    }
  }

  if (!previewAllowed) {
    return loadPublicCampaign(slug);
  }

  let query = supabase.from('special_offers').select('*').eq('slug', slug).limit(1);
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    if (error) console.error('Special Offer landing campaign select failed:', error);
    return null;
  }

  const offerId = data.id;
  const [translations, prizes, links, formFields] = await Promise.all([
    fetchRows('special_offer_translations', [['offer_id', offerId]], 'lang'),
    fetchRows('special_offer_prizes', [['offer_id', offerId]], 'sort_order'),
    fetchRows('special_offer_links', [['offer_id', offerId]], 'sort_order'),
    data.requires_form === true ? fetchRows('special_offer_form_fields', [['offer_id', offerId], ['active', true]], 'sort_order') : Promise.resolve([]),
  ]);
  const prizeIds = prizes.map((row) => row.id).filter(Boolean);
  const linkIds = links.map((row) => row.id).filter(Boolean);
  const formFieldIds = formFields.map((row) => row.id).filter(Boolean);
  const [prizeTranslations, linkTranslations, formFieldTranslations] = await Promise.all([
    prizeIds.length ? fetchRows('special_offer_prize_translations', [['prize_id', prizeIds, 'in']], 'lang') : Promise.resolve([]),
    linkIds.length ? fetchRows('special_offer_link_translations', [['link_id', linkIds, 'in']], 'lang') : Promise.resolve([]),
    formFieldIds.length ? fetchRows('special_offer_form_field_translations', [['field_id', formFieldIds, 'in']], 'lang') : Promise.resolve([]),
  ]);

  return {
    campaign: data,
    translations,
    prizes,
    prizeTranslations,
    links,
    linkTranslations,
    formFields,
    formFieldTranslations,
    previewAllowed,
  };
}

function bindLanguageButtons() {
  refs.languageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      saveCurrentFormDraft();
      saveActiveClaimDraft();
      const nextLang = normalizeLang(button.getAttribute('data-special-offer-lang'));
      const url = new URL(window.location.href);
      url.searchParams.set('lang', nextLang);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      if (currentState) {
        renderCampaign(currentState.data, nextLang, currentState.previewMode);
        if (activeClaimModal?.postId && activeClaimModal?.type) {
          openActivityClaimModal(activeClaimModal.postId, activeClaimModal.type, nextLang);
        }
      } else {
        setPageLanguage(nextLang);
        updateStaticText(nextLang);
      }
    });
  });
}

function bindAuthEvents() {
  const refreshAndRender = async ({ scroll = false } = {}) => {
    saveCurrentFormDraft();
    saveActiveClaimDraft();
    await refreshSpecialOfferAuthState();
    activeSubmitErrorCode = '';
    formStatus = 'idle';
    await refreshOwnEntryData({ render: true, scroll: scroll || authState.confirmed });
    await applyAuthenticatedEmailToForm();
    await refreshActivityData({ render: true, scroll: scroll || authState.confirmed });
    showFormStatus('', 'info');
    setSubmitButtonState('idle', currentState?.lang || readRequestedLang());
  };
  document.addEventListener('ce-auth:post-login', () => {
    window.__authModalController?.close?.({ restoreFocus: false });
    void refreshAndRender({ scroll: true });
  });
  document.addEventListener('ce-auth:state', () => {
    void refreshAndRender();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refreshAndRender();
  });
  window.addEventListener('focus', () => {
    void refreshAndRender();
  });
}

async function init() {
  bindLanguageButtons();
  bindAuthEvents();
  configureAuthRedirectTarget();
  const lang = readRequestedLang();
  setPageLanguage(lang);
  updateStaticText(lang);
  showLoading();
  const slug = readSlug();
  currentSlug = slug;
  if (!slug) {
    showUnavailable(lang);
    return;
  }

  try {
    await refreshSpecialOfferAuthState();
    const previewMode = isAdminPreview();
    const campaign = await loadCampaign(slug, previewMode);
    if (!campaign) {
      showUnavailable(lang);
      return;
    }
    renderCampaign(campaign, lang, Boolean(campaign.previewAllowed));
  } catch (error) {
    console.error('Special Offer landing failed:', error);
    showUnavailable(lang);
  }
}

init();
