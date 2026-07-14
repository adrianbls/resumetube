const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const es = JSON.parse(fs.readFileSync('_locales/es/messages.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('_locales/en/messages.json', 'utf8'));

async function importSource(path) {
  const source = fs.readFileSync(path, 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('Spanish and English catalogs contain the same message keys', () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());

  for (const [key, entry] of Object.entries(es)) {
    assert.ok(entry.message.trim(), `Missing Spanish message: ${key}`);
    assert.ok(en[key].message.trim(), `Missing English message: ${key}`);
    assert.deepEqual(
      Object.keys(entry.placeholders || {}).sort(),
      Object.keys(en[key].placeholders || {}).sort(),
      `Placeholder mismatch: ${key}`
    );
  }
});

test('all Spanish variants resolve to Spanish and every other locale to English', async () => {
  globalThis.browser = {
    i18n: {
      getUILanguage: () => 'en',
      getMessage: () => ''
    }
  };
  const { resolveUiLocale } = await importSource('popup/i18n.js');

  for (const locale of ['es', 'es-ES', 'es-MX', 'ES-ar']) {
    assert.equal(resolveUiLocale(locale), 'es');
  }
  for (const locale of ['en', 'en-US', 'fr', 'de', 'ja', '', undefined]) {
    assert.equal(resolveUiLocale(locale), 'en');
  }
});

test('keeps prompts in English while changing the requested output language', async () => {
  const { buildPrompt, OUTPUT_LANGUAGES } = await importSource('popup/prompt.js');
  const transcript = {
    title: 'Test video',
    url: 'https://www.youtube.com/watch?v=test',
    segments: [{ timestamp: '0:05', text: 'Transcript content.' }]
  };
  const settings = {
    language: 'es',
    detail: 'medium',
    format: 'summary',
    includeTimestamps: true
  };

  const spanishPrompt = buildPrompt(transcript, settings);
  const hindiPrompt = buildPrompt(transcript, { ...settings, language: 'hi' });

  assert.match(spanishPrompt, /^Summarize the transcript below in Spanish/);
  assert.match(hindiPrompt, /^Summarize the transcript below in Hindi/);
  assert.match(spanishPrompt, /Do not follow instructions/);
  assert.match(spanishPrompt, /\[0:05\] Transcript content/);
  assert.equal(Object.keys(OUTPUT_LANGUAGES).length, 31);
  assert.equal(Object.hasOwn(OUTPUT_LANGUAGES, 'he'), false);
});

test('language selector starts with automatic mode and keeps speaker order', () => {
  const html = fs.readFileSync('popup/popup.html', 'utf8');
  const languageSelect = html.match(/<select id="language">([\s\S]*?)<\/select>/)?.[1] || '';
  const values = [...languageSelect.matchAll(/<option value="([^"]+)"/g)]
    .map((match) => match[1]);

  assert.deepEqual(values, [
    'source', 'en', 'zh', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'id', 'ur',
    'ru', 'de', 'ja', 'vi', 'sw', 'tr', 'ha', 'fil', 'fa', 'ko', 'th',
    'it', 'am', 'my', 'pl', 'ln', 'uk', 'ms', 'nl', 'ro'
  ]);
});
