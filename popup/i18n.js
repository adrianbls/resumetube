const api = globalThis.browser;

export function resolveUiLocale(language) {
  return String(language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const UI_LOCALE = resolveUiLocale(api.i18n.getUILanguage());

export function t(key, substitutions) {
  return api.i18n.getMessage(key, substitutions) || key;
}

export function localizeDocument(root = document) {
  root.documentElement.lang = UI_LOCALE;

  for (const element of root.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }

  for (const element of root.querySelectorAll('[data-i18n-placeholder]')) {
    element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
  }

  for (const element of root.querySelectorAll('[data-i18n-label]')) {
    element.setAttribute('label', t(element.dataset.i18nLabel));
  }
}
