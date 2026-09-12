#!/usr/bin/env node
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const localesDir = join(root, 'locales');
const output = join(root, 'locales.js');
const required = ['searchPlaceholder', 'allCountries', 'allCategories', 'loadingChannels', 'noChannels', 'tryFilters', 'genres.Notícias'];

async function readLocales() {
  const files = (await readdir(localesDir)).filter(file => file.endsWith('.json')).sort();
  const entries = [];
  for (const file of files) {
    const locale = file.replace(/\.json$/, '');
    const data = JSON.parse(await readFile(join(localesDir, file), 'utf8'));
    entries.push([locale, data]);
  }
  return Object.fromEntries(entries);
}

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return item && typeof item === 'object' && !Array.isArray(item) ? flatten(item, path) : [path];
  });
}

function validate(locales) {
  const languages = Object.keys(locales);
  if (!languages.length) throw new Error('Nenhum arquivo JSON encontrado em locales/.');
  const baseKeys = new Set(flatten(locales[languages[0]]));
  for (const language of languages) {
    const keys = new Set(flatten(locales[language]));
    for (const key of required) if (!keys.has(key)) throw new Error(`${language}: chave obrigatória ausente: ${key}`);
    for (const key of baseKeys) if (!keys.has(key)) throw new Error(`${language}: chave ausente: ${key}`);
    for (const key of keys) if (!baseKeys.has(key)) throw new Error(`${language}: chave extra: ${key}`);
  }
}

async function build(locales) {
  const source = `/* Gerado por scripts/i18n.mjs — edite apenas locales/*.json. */\nwindow.IPTV_LOCALES = ${JSON.stringify(locales, null, 2)};\n`;
  await writeFile(output, source);
}

const command = process.argv[2] || 'build';
const locales = await readLocales();
if (command === 'list') {
  console.log(Object.keys(locales).join('\n'));
} else if (command === 'validate') {
  validate(locales);
  console.log(`OK: ${Object.keys(locales).length} idiomas, ${flatten(locales[Object.keys(locales)[0]]).length} chaves.`);
} else if (command === 'build') {
  validate(locales);
  await build(locales);
  console.log(`Gerado: ${output}`);
} else {
  console.error('Uso: node scripts/i18n.mjs [list|validate|build]');
  process.exit(1);
}
