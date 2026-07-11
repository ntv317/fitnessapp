#!/usr/bin/env node
// Assembles translated catalog parts (scratchpad catalog-parts/<lang>-NN.json)
// into src/features/library/data/i18n/exercises.<lang>.json.
//
// Language-gated: an entry is only emitted if BOTH its name and every
// instruction actually contain target-script characters. Half-translated
// entries (e.g. Vietnamese instructions with an English name) and untranslated
// English copies are dropped so they fall back to English at display time —
// the app never shows a card mislabeled as "translated".
//
// Usage: node scripts/merge-catalog-i18n.mjs <parts-dir>
import fs from 'fs';
import path from 'path';

const partsDir = process.argv[2];
if (!partsDir) {
  console.error('usage: node scripts/merge-catalog-i18n.mjs <parts-dir>');
  process.exit(1);
}

const outDir = new URL('../src/features/library/data/i18n/', import.meta.url).pathname;

const SCRIPT = {
  ru: /[Ѐ-ӿ]/,
  th: /[฀-๿]/,
  // Vietnamese uses Latin; require at least one Vietnamese-specific diacritic
  // OR đ. Pure-ASCII names slip through only if they legitimately have no
  // diacritics — rare for exercise names, and harmless (English == the value).
  vi: /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/i,
  'zh-Hans': /[一-鿿]/,
  'zh-Hant': /[一-鿿]/,
};

for (const lang of ['vi', 'th', 'ru', 'zh-Hans', 'zh-Hant']) {
  const re = SCRIPT[lang];
  const parts = fs
    .readdirSync(partsDir)
    .filter((f) => f.startsWith(lang + '-') && f.endsWith('.json'))
    .sort();
  if (parts.length === 0) continue;
  const merged = {};
  let dropped = 0;
  for (const f of parts) {
    const obj = JSON.parse(fs.readFileSync(path.join(partsDir, f), 'utf8'));
    for (const [id, entry] of Object.entries(obj)) {
      const nameOK = re.test(entry.name);
      // Empty instruction lines exist in the source catalog and are legitimately
      // empty in every language; they must pass the gate rather than sink the entry.
      const instOK = (entry.instructions ?? []).every((s) => s === '' || re.test(s));
      if (nameOK && instOK) merged[id] = entry;
      else dropped++;
    }
  }
  const outFile = path.join(outDir, `exercises.${lang}.json`);
  fs.writeFileSync(outFile, JSON.stringify(merged, null, 1) + '\n');
  console.log(`${lang}: ${parts.length} parts → ${Object.keys(merged).length} accepted, ${dropped} dropped (not in-language)`);
}
