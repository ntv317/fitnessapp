import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import vi from './locales/vi.json';
import th from './locales/th.json';
import ru from './locales/ru.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';

export type AppLanguage = 'en' | 'vi' | 'th' | 'ru' | 'zh-Hans' | 'zh-Hant';

const STORAGE_KEY = '@fitness/language';

export const SUPPORTED_LANGUAGES: { code: AppLanguage; nativeName: string }[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'vi', nativeName: 'Tiếng Việt' },
  { code: 'th', nativeName: 'ไทย' },
  { code: 'ru', nativeName: 'Русский' },
  { code: 'zh-Hans', nativeName: '简体中文' },
  { code: 'zh-Hant', nativeName: '繁體中文' },
];

function isSupported(code: string | null | undefined): code is AppLanguage {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

// Chinese needs its script disambiguated (languageCode is just "zh" for both
// styles); Taiwan/Hong Kong/Macau default to Traditional, everything else
// bundling a "Hant" script tag also gets Traditional, all other zh -> Simplified.
function detectLanguage(): AppLanguage {
  for (const locale of getLocales()) {
    if (isSupported(locale.languageCode)) return locale.languageCode;
    if (locale.languageCode === 'zh') {
      if (locale.languageScriptCode === 'Hant') return 'zh-Hant';
      if (locale.languageScriptCode === 'Hans') return 'zh-Hans';
      if (locale.regionCode === 'TW' || locale.regionCode === 'HK' || locale.regionCode === 'MO') return 'zh-Hant';
      return 'zh-Hans';
    }
  }
  return 'en';
}

export async function initI18n(): Promise<void> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  const lng = isSupported(stored) ? stored : detectLanguage();
  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
      th: { translation: th },
      ru: { translation: ru },
      'zh-Hans': { translation: zhHans },
      'zh-Hant': { translation: zhHant },
    },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export function setAppLanguage(lang: AppLanguage): void {
  i18n.changeLanguage(lang);
  AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
}

export function currentLanguage(): AppLanguage {
  return isSupported(i18n.language) ? i18n.language : 'en';
}
