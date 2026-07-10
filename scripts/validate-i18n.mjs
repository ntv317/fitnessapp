#!/usr/bin/env node
// Validates locale data:
// 1. UI locale files (vi/th/ru) have key parity with en.json (plural suffixes normalized).
// 2. Catalog translation files cover bundled catalog ids with matching instruction counts.
// Exits non-zero on failure. Coverage below 100% is reported but only fails with --strict.
import fs from 'fs';

const strict = process.argv.includes('--strict');
const root = new URL('..', import.meta.url).pathname;
let failed = false;

const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? flat(v, p + k + '.') : [p + k]));
const base = (k) => k.replace(/_(one|few|many|other)$/, '');

const en = JSON.parse(fs.readFileSync(root + 'src/core/i18n/locales/en.json', 'utf8'));
const enKeys = new Set(flat(en).map(base));
for (const lang of ['vi', 'th', 'ru']) {
  const j = JSON.parse(fs.readFileSync(`${root}src/core/i18n/locales/${lang}.json`, 'utf8'));
  const keys = new Set(flat(j).map(base));
  const missing = [...enKeys].filter((k) => !keys.has(k));
  const empty = flat(j).filter((k) => k.split('.').reduce((o, p) => o?.[p], j) === '');
  if (missing.length || empty.length) {
    failed = true;
    console.error(`UI ${lang}: ${missing.length} missing (${missing.slice(0, 8).join(', ')}) ${empty.length} empty`);
  } else {
    console.log(`UI ${lang}: OK (${keys.size} keys)`);
  }
}

const SCRIPT = {
  ru: /[Ѐ-ӿ]/,
  th: /[฀-๿]/,
  vi: /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/i,
};

const catalog = JSON.parse(fs.readFileSync(root + 'src/features/library/data/exercises.json', 'utf8'));
for (const lang of ['vi', 'th', 'ru']) {
  const re = SCRIPT[lang];
  const file = `${root}src/features/library/data/i18n/exercises.${lang}.json`;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  let covered = 0;
  const problems = [];
  for (const e of catalog) {
    const tr = j[e.id];
    if (!tr) continue;
    covered++;
    if (!tr.name) problems.push(`${e.id}: empty name`);
    else if (!re.test(tr.name)) problems.push(`${e.id}: name not ${lang}`);
    if (tr.instructions && tr.instructions.length !== e.instructions.length)
      problems.push(`${e.id}: instructions ${tr.instructions.length} != ${e.instructions.length}`);
  }
  const extra = Object.keys(j).filter((id) => !catalog.some((e) => e.id === id));
  if (problems.length || extra.length) {
    failed = true;
    console.error(`catalog ${lang}: ${problems.length} problems, ${extra.length} unknown ids`, problems.slice(0, 5));
  }
  const pct = ((covered / catalog.length) * 100).toFixed(1);
  console.log(`catalog ${lang}: ${covered}/${catalog.length} covered (${pct}%)`);
  if (strict && covered < catalog.length) failed = true;
}

process.exit(failed ? 1 : 0);
