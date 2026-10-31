import { useCtx } from '../state/MachineProvider';

export type Lang = 'en' | 'ar';

export interface AppStrings {
  lang: Lang;

  // Spelling & letter feedback
  looksLike: (letter: string) => string;
  looksLikeHoldStill: string;
  showFirstLetter: string;
  showNextLetter: string;

  // Screen 01 Welcome
  welcomeCaptionDetected: string;
  welcomeOpenHandFully: string;
  welcomeRaiseOpenHand: string;

  // Screen 02 Camera check
  cameraCheckTip: (tip: string) => string;
  checksLightTitle: string;
  checksDistanceTitle: string;
  checksHandTitle: string;
  checksLightMeasuring: string;
  checksLightDark: string;
  checksLightBright: string;
  checksLightGood: string;
  checksDistanceShowHand: string;
  checksDistanceFar: string;
  checksDistanceClose: string;
  checksDistanceGood: string;
  checksHandNoHand: string;
  checksHandGood: string;
  checksHandOutside: string;
  checksAllGoodTip: string;

  // Screen 08 Hand lost
  handLostAnnounce: string;
  handLostBannerTitle: string;
  handLostBannerSub: string;
  handLostPill: string;

  // Screen 09 Word suggestion
  wordSuggestionAnnounce: (match: string, original: string, place: string) => string;

  // Screen 10 Picture card
  pictureCardHold: (word: string) => string;
  pictureCardShow: string;

  // Screen 11 Review sentence
  reviewSentenceAnnounce: (sentence: string) => string;

  // Screen 12 Share
  shareMessageForYou: (sentence: string) => string;
  readingAloud: string;
  readAloudEnglishOnly: string;
  readAloudNoArabicVoice: string;

  // Screen 13 Gesture guide
  gestureGuideOpen: string;

  // Screen 14 Comfort
  comfortAnnounceLive: (seconds: string) => string;
  comfortAnnounceStatic: string;
  noArabicVoiceNotice: string;

  // Model & Vision Notices
  cardNoticeMissing: string;
  cardNoticeError: (msg: string) => string;
  cardNoticeSynthetic: string;
  cardNoticeForeign: (card: string) => string;
  letterNoticeMissing: string;
  letterNoticeError: (msg: string) => string;
  letterNoticeSynthetic: string;

  // Context drift advice
  contextDark: string;
  contextBright: string;
  contextFar: string;
  contextClose: string;

  // Camera problems (the banner picks one by the error situation)
  cameraProblem: Record<
    'denied' | 'nocamera' | 'inuse' | 'unsupported' | 'insecure' | 'unknown',
    string
  >;

  // Commands
  commandSpace: string;
  commandDelete: string;
  commandDone: string;
  commandCancel: string;
  commandYes: string;
  commandNo: string;
}

export const STRINGS: Record<Lang, AppStrings> = {
  en: {
    lang: 'en',
    looksLike: (letter: string) => `Looks like "${letter}". Hold still…`,
    looksLikeHoldStill: 'Hold still…',
    showFirstLetter: 'Show your first letter',
    showNextLetter: 'Show your next letter',

    welcomeCaptionDetected: 'Hand detected. Keep holding…',
    welcomeOpenHandFully: 'Open your hand fully',
    welcomeRaiseOpenHand: 'Raise your open hand',

    cameraCheckTip: (tip: string) => `Spoken tip: ${tip}`,
    checksLightTitle: 'Light',
    checksDistanceTitle: 'Distance',
    checksHandTitle: 'Hand visible',
    checksLightMeasuring: 'Measuring the light…',
    checksLightDark: 'Too dark. Turn on a light.',
    checksLightBright: 'Too bright. Avoid a window behind you.',
    checksLightGood: 'Good light on your hands',
    checksDistanceShowHand: 'Show one hand to the camera',
    checksDistanceFar: 'A bit far. Move a little closer.',
    checksDistanceClose: 'A bit close. Move back a little.',
    checksDistanceGood: 'Distance is good',
    checksHandNoHand: 'No hand yet. Raise one hand.',
    checksHandGood: 'Your whole hand is in view',
    checksHandOutside: 'Part of your hand is outside the picture',
    checksAllGoodTip: 'Everything looks good. Hold still.',

    handLostAnnounce:
      "We lost your hand. Bring it back into the frame. Your message is safe. I can't see your hand.",
    handLostBannerTitle: 'We lost your hand',
    handLostBannerSub: 'Bring it back into the frame. Your message is safe.',
    handLostPill: 'Put your hand here',

    wordSuggestionAnnounce: (match: string, original: string, place: string) =>
      `Did you mean ${match}? ${original} is not in the ${place} word list.`,

    pictureCardHold: (word: string) => `Hold the card still to add "${word}"`,
    pictureCardShow: 'Show a picture card',

    reviewSentenceAnnounce: (sentence: string) =>
      `Suggested sentence: ${sentence}. Thumbs up to use it, thumbs down to try another.`,

    shareMessageForYou: (sentence: string) => `Message for you: ${sentence}`,
    readingAloud: 'Reading aloud…',
    readAloudEnglishOnly:
      'Read-aloud is English only. An Arabic sentence is shown on the screen but is not read properly.',
    readAloudNoArabicVoice: 'No Arabic voice installed on this device.',

    gestureGuideOpen: 'Gesture guide open. Thumbs up closes it.',

    comfortAnnounceLive: (seconds: string) =>
      `Comfort settings. Hold time is now ${seconds} seconds and adapts to you.`,
    comfortAnnounceStatic: 'Comfort settings. Point and hold to choose, thumbs up to continue.',
    noArabicVoiceNotice:
      'No Arabic speech voice found on this device. Feedback switched to Sounds only. See docs/KNOWN_ISSUES.md to add one.',

    cardNoticeMissing:
      'No card detector has been trained yet. Point at a card in the list on the right to add it.',
    cardNoticeError: (msg: string) => `The card detector could not be used: ${msg}`,
    cardNoticeSynthetic:
      'This card detector was trained on generated test data. It is not for a real study.',
    cardNoticeForeign: (card: string) =>
      `The ${card} card is not part of this place. Choose another place or another card.`,
    letterNoticeMissing:
      'No letter model has been trained yet, so letters cannot be read. Picture cards still work.',
    letterNoticeError: (msg: string) => `The letter model could not be used: ${msg}`,
    letterNoticeSynthetic:
      'This letter model was trained on generated test data. It is not for a real study.',

    contextDark: 'It is getting dark. Turn on a light so the camera can see your hand.',
    contextBright: 'Too much light behind you. Face the light, away from the window.',
    contextFar: 'Your hand is far from the camera. Move a little closer.',
    contextClose: 'Your hand is very close. Move back a little.',

    cameraProblem: {
      denied:
        'Camera access is blocked. Allow the camera for this page in the browser, then reload.',
      nocamera: 'No camera found. Connect a camera and reload.',
      inuse: 'The camera is in use by another app. Close it and reload.',
      unsupported:
        'The camera is not available in this browser or on this page. Open the app at localhost or https, or use a normal browser window.',
      insecure:
        'This browser cannot use the camera here. Open the app at localhost or https in a current browser.',
      unknown:
        'The camera could not start for an unknown reason. Reload the page, or try another browser window.',
    },

    commandSpace: 'Space',
    commandDelete: 'Delete',
    commandDone: 'Done',
    commandCancel: 'Cancel',
    commandYes: 'Yes',
    commandNo: 'No',
  },
  ar: {
    lang: 'ar',
    looksLike: (letter: string) => `يبدو مثل "${letter}". اثبت…`,
    looksLikeHoldStill: 'اثبت…',
    showFirstLetter: 'اعرض حرفك الأول',
    showNextLetter: 'اعرض حرفك التالي',

    welcomeCaptionDetected: 'تم اكتشاف اليد. استمر في الثبات…',
    welcomeOpenHandFully: 'افتح يدك بالكامل',
    welcomeRaiseOpenHand: 'ارفع يدك المفتوحة',

    cameraCheckTip: (tip: string) => `تلميح صوتي: ${tip}`,
    checksLightTitle: 'الإضاءة',
    checksDistanceTitle: 'المسافة',
    checksHandTitle: 'وضوح اليد',
    checksLightMeasuring: 'جاري قياس الإضاءة…',
    checksLightDark: 'المكان مظلم جداً. أشعل ضوءاً.',
    checksLightBright: 'الإضاءة شديدة جداً. تجنب وجود نافذة خلفك.',
    checksLightGood: 'إضاءة جيدة على يديك',
    checksDistanceShowHand: 'اعرض يداً واحدة أمام الكاميرا',
    checksDistanceFar: 'بعيد قليلاً. اقترب أكثر.',
    checksDistanceClose: 'قريب جداً. ابتعد قليلاً.',
    checksDistanceGood: 'المسافة جيدة',
    checksHandNoHand: 'لا توجد يد بعد. ارفع إحدى يديك.',
    checksHandGood: 'يدك بالكامل في نطاق الرؤية',
    checksHandOutside: 'جزء من يدك خارج الصورة',
    checksAllGoodTip: 'كل شيء يبدو جيداً. اثبت في مكانك.',

    handLostAnnounce: 'فقدنا يدك. أعدها داخل الإطار. رسالتك في أمان. لا أستطيع رؤية يدك.',
    handLostBannerTitle: 'فقدنا يدك',
    handLostBannerSub: 'أعدها داخل الإطار. رسالتك في أمان.',
    handLostPill: 'ضع يدك هنا',

    wordSuggestionAnnounce: (match: string, original: string, place: string) =>
      `هل قصدت ${match}؟ كلمة ${original} ليست في قائمة كلمات ${place}.`,

    pictureCardHold: (word: string) => `اثبت بالبطاقة لإضافة "${word}"`,
    pictureCardShow: 'اعرض بطاقة مصورة',

    reviewSentenceAnnounce: (sentence: string) =>
      `الجملة المقترحة: ${sentence}. إبهام لأعلى للاستخدام، إبهام لأسفل لتجربة أخرى.`,

    shareMessageForYou: (sentence: string) => `رسالة لك: ${sentence}`,
    readingAloud: 'جاري القراءة بصوت عالٍ…',
    readAloudEnglishOnly: 'القراءة الصوتية بالإنجليزية فقط. الجملة العربية معروضة على الشاشة فقط.',
    readAloudNoArabicVoice: 'لا يوجد صوت عربي مثبت على هذا الجهاز.',

    gestureGuideOpen: 'دليل الإشارات مفتوح. إبهام لأعلى للإغلاق.',

    comfortAnnounceLive: (seconds: string) =>
      `إعدادات الراحة. وقت الثبات الآن ${seconds} ثانية ويتكيف معك.`,
    comfortAnnounceStatic: 'إعدادات الراحة. أشر واثبت للاختيار، إبهام لأعلى للمتابعة.',
    noArabicVoiceNotice:
      'لم يتم العثور على صوت عربي على هذا الجهاز. تم التحويل إلى الأصوات فقط. راجع docs/KNOWN_ISSUES.md لإضافة صوت.',

    cardNoticeMissing:
      'لم يتم تدريب مكتشف البطاقات بعد. أشر إلى بطاقة في القائمة على اليمين لإضافتها.',
    cardNoticeError: (msg: string) => `تعذر استخدام مكتشف البطاقات: ${msg}`,
    cardNoticeSynthetic:
      'تم تدريب مكتشف البطاقات هذا على بيانات اختبار تجريبية. ليس لدراسة حقيقية.',
    cardNoticeForeign: (card: string) =>
      `بطاقة ${card} ليست جزءاً من هذا المكان. اختر مكاناً آخر أو بطاقة أخرى.`,
    letterNoticeMissing:
      'لم يتم تدريب نموذج حروف بعد، لذا لا يمكن قراءة الحروف. البطاقات المصورة ما زالت تعمل.',
    letterNoticeError: (msg: string) => `تعذر استخدام نموذج الحروف: ${msg}`,
    letterNoticeSynthetic:
      'تم تدريب نموذج الحروف هذا على بيانات اختبار تجريبية. ليس لدراسة حقيقية.',

    contextDark: 'المكان أصبح مظلماً. أشعل ضوءاً لتتمكن الكاميرا من رؤية يدك.',
    contextBright: 'إضاءة شديدة خلفك. واجه الضوء وابتعد عن النافذة.',
    contextFar: 'يدك بعيدة عن الكاميرا. اقترب قليلاً.',
    contextClose: 'يدك قريبة جداً. ابتعد قليلاً.',

    cameraProblem: {
      denied: 'الوصول إلى الكاميرا محظور. اسمح بالكاميرا لهذه الصفحة في المتصفح ثم أعد التحميل.',
      nocamera: 'لم يتم العثور على كاميرا. وصّل كاميرا ثم أعد التحميل.',
      inuse: 'الكاميرا مستخدمة في تطبيق آخر. أغلقه ثم أعد التحميل.',
      unsupported:
        'الكاميرا غير متاحة في هذا المتصفح أو هذه الصفحة. افتح التطبيق على localhost أو https، أو استخدم نافذة متصفح عادية.',
      insecure:
        'هذا المتصفح لا يستطيع استخدام الكاميرا هنا. افتح التطبيق على localhost أو https في متصفح حديث.',
      unknown: 'تعذّر تشغيل الكاميرا لسبب غير معروف. أعد تحميل الصفحة أو جرّب نافذة متصفح أخرى.',
    },

    commandSpace: 'مسافة',
    commandDelete: 'حذف',
    commandDone: 'تم',
    commandCancel: 'إلغاء',
    commandYes: 'نعم',
    commandNo: 'لا',
  },
};

export function getStrings(lang: Lang = 'en'): AppStrings {
  return STRINGS[lang] ?? STRINGS.en;
}

export function useStrings(): AppStrings {
  const { alphabet } = useCtx();
  const lang: Lang = alphabet === 'arabic' ? 'ar' : 'en';
  return STRINGS[lang];
}

export function useLang(): Lang {
  const { alphabet } = useCtx();
  return alphabet === 'arabic' ? 'ar' : 'en';
}
