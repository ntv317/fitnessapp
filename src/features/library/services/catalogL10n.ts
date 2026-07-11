import i18n from 'i18next';

export interface CatalogL10nEntry {
  name: string;
  instructions?: string[];
}

type CatalogL10n = Record<string, CatalogL10nEntry | undefined>;

// Lazy requires so only the active locale's file (~800KB once translated)
// is parsed; English needs no file — the bundled catalog is the fallback.
const loaders: Record<string, () => CatalogL10n> = {
  vi: () => require('../data/i18n/exercises.vi.json'),
  th: () => require('../data/i18n/exercises.th.json'),
  ru: () => require('../data/i18n/exercises.ru.json'),
  'zh-Hans': () => require('../data/i18n/exercises.zh-Hans.json'),
  'zh-Hant': () => require('../data/i18n/exercises.zh-Hant.json'),
};

const cache = new Map<string, CatalogL10n>();

export function catalogL10n(): CatalogL10n | null {
  const lang = i18n.language;
  const loader = loaders[lang];
  if (!loader) return null;
  let data = cache.get(lang);
  if (!data) {
    data = loader();
    cache.set(lang, data);
  }
  return data;
}
