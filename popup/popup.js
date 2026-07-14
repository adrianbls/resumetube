import { buildPrompt, CHAT_PROVIDERS, estimateTokens } from './prompt.js';
import { localizeDocument, t, UI_LOCALE } from './i18n.js';

const api = globalThis.browser ?? globalThis.chrome;
localizeDocument();

const ADD_PROVIDER_VALUE = '__add_custom__';

const DEFAULT_SETTINGS = {
  provider: 'chatgpt',
  language: UI_LOCALE,
  detail: 'medium',
  format: 'summary',
  includeTimestamps: true
};

const elements = {
  provider: document.querySelector('#provider'),
  language: document.querySelector('#language'),
  detail: document.querySelector('#detail'),
  format: document.querySelector('#format'),
  timestamps: document.querySelector('#timestamps'),
  status: document.querySelector('#status'),
  transcriptInfo: document.querySelector('#transcript-info'),
  videoTitle: document.querySelector('#video-title'),
  transcriptStats: document.querySelector('#transcript-stats'),
  manualSection: document.querySelector('#manual-section'),
  manualTranscript: document.querySelector('#manual-transcript'),
  useManual: document.querySelector('#use-manual'),
  extract: document.querySelector('#extract'),
  copyOpen: document.querySelector('#copy-open'),
  copyOnly: document.querySelector('#copy-only'),
  toggleManual: document.querySelector('#toggle-manual'),
  removeProvider: document.querySelector('#remove-provider'),
  customProvider: document.querySelector('#custom-provider'),
  customName: document.querySelector('#custom-name'),
  customUrl: document.querySelector('#custom-url'),
  saveCustom: document.querySelector('#save-custom'),
  cancelCustom: document.querySelector('#cancel-custom')
};

let transcript = null;
let busy = false;
let customProviders = [];
let lastRealProvider = DEFAULT_SETTINGS.provider;

function setStatus(message, kind = '') {
  elements.status.textContent = message;
  if (kind) elements.status.dataset.kind = kind;
  else delete elements.status.dataset.kind;
}

function setBusy(value) {
  busy = value;
  elements.extract.disabled = value;
  elements.copyOpen.disabled = value;
  elements.useManual.disabled = value;
}

function currentProvider() {
  const value = elements.provider.value;
  return value && value !== ADD_PROVIDER_VALUE ? value : lastRealProvider;
}

function getSettings() {
  return {
    provider: currentProvider(),
    language: elements.language.value,
    detail: elements.detail.value,
    format: elements.format.value,
    includeTimestamps: elements.timestamps.checked
  };
}

async function saveSettings() {
  await api.storage.local.set({ settings: getSettings() });
  refreshTranscriptInfo();
}

async function restoreSettings() {
  const { settings = {} } = await api.storage.local.get('settings');
  const restored = { ...DEFAULT_SETTINGS, ...settings };
  renderProviderOptions(restored.provider);
  lastRealProvider = elements.provider.value;
  elements.language.value = restored.language;
  elements.detail.value = restored.detail;
  elements.format.value = restored.format;
  elements.timestamps.checked = restored.includeTimestamps;
}

function getAllProviders() {
  const providers = { ...CHAT_PROVIDERS };
  for (const { id, label, url } of customProviders) {
    providers[id] = { label, url };
  }
  return providers;
}

function isCustomProvider(id) {
  return customProviders.some((provider) => provider.id === id);
}

function updateRemoveButton() {
  elements.removeProvider.hidden = !isCustomProvider(elements.provider.value);
}

function renderProviderOptions(selected = elements.provider.value) {
  elements.provider.textContent = '';

  for (const [id, { label }] of Object.entries(CHAT_PROVIDERS)) {
    elements.provider.append(new Option(label, id));
  }

  if (customProviders.length) {
    const group = document.createElement('optgroup');
    group.label = t('providerCustomGroup');
    for (const { id, label } of customProviders) {
      group.append(new Option(label, id));
    }
    elements.provider.append(group);
  }

  elements.provider.append(new Option(t('providerAddCustom'), ADD_PROVIDER_VALUE));

  const canSelect = [...elements.provider.options].some(
    (option) => option.value === selected
  );
  elements.provider.value = canSelect ? selected : DEFAULT_SETTINGS.provider;
  updateRemoveButton();
}

async function loadCustomProviders() {
  const { customProviders: stored = [] } =
    await api.storage.local.get('customProviders');
  customProviders = Array.isArray(stored) ? stored : [];
}

function normalizeProviderUrl(rawValue) {
  const candidates = /^https?:\/\//i.test(rawValue) ? [rawValue] : [`https://${rawValue}`];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch {
      // Ignore invalid candidates and fall through to returning null.
    }
  }
  return null;
}

function newProviderId() {
  const random = globalThis.crypto?.randomUUID?.();
  return `custom-${random || `${Date.now()}-${customProviders.length}`}`;
}

function openCustomProviderForm() {
  elements.customName.value = '';
  elements.customUrl.value = '';
  elements.customProvider.hidden = false;
  elements.removeProvider.hidden = true;
  elements.customName.focus();
}

function closeCustomProviderForm() {
  elements.customProvider.hidden = true;
  elements.provider.value = lastRealProvider;
  updateRemoveButton();
}

async function saveCustomProvider() {
  const label = elements.customName.value.trim();
  if (!label) {
    setStatus(t('customProviderNameRequired'), 'error');
    elements.customName.focus();
    return;
  }

  const url = normalizeProviderUrl(elements.customUrl.value.trim());
  if (!url) {
    setStatus(t('customProviderUrlInvalid'), 'error');
    elements.customUrl.focus();
    return;
  }

  const provider = { id: newProviderId(), label, url };
  customProviders.push(provider);
  await api.storage.local.set({ customProviders });

  renderProviderOptions(provider.id);
  lastRealProvider = provider.id;
  elements.customProvider.hidden = true;
  await saveSettings();
  setStatus(t('customProviderSaved', label), 'success');
}

async function removeCustomProvider() {
  const id = elements.provider.value;
  if (!isCustomProvider(id)) return;

  customProviders = customProviders.filter((provider) => provider.id !== id);
  await api.storage.local.set({ customProviders });

  renderProviderOptions(DEFAULT_SETTINGS.provider);
  lastRealProvider = elements.provider.value;
  await saveSettings();
  setStatus(t('customProviderRemoved'), 'success');
}

function onProviderChange() {
  if (elements.provider.value === ADD_PROVIDER_VALUE) {
    openCustomProviderForm();
    return;
  }
  lastRealProvider = elements.provider.value;
  updateRemoveButton();
  saveSettings();
}

async function getActiveYouTubeTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://www.youtube.com/')) {
    throw new Error(t('activeTabNotYoutube'));
  }
  return tab;
}

async function requestTranscript(tab) {
  try {
    return await api.tabs.sendMessage(tab.id, {
      type: 'RESUMETUBE_EXTRACT_TRANSCRIPT'
    });
  } catch {
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content-script.js']
    });
    return api.tabs.sendMessage(tab.id, {
      type: 'RESUMETUBE_EXTRACT_TRANSCRIPT'
    });
  }
}

function refreshTranscriptInfo() {
  if (!transcript) {
    elements.transcriptInfo.hidden = true;
    elements.copyOnly.disabled = true;
    return;
  }

  const prompt = buildPrompt(transcript, getSettings());
  const words = transcript.segments.reduce((total, segment) => {
    return total + segment.text.split(/\s+/).filter(Boolean).length;
  }, 0);
  const tokens = estimateTokens(prompt);

  elements.videoTitle.textContent = transcript.title;
  elements.transcriptStats.textContent = t('transcriptStats', [
    words.toLocaleString(UI_LOCALE),
    tokens.toLocaleString(UI_LOCALE)
  ]);
  elements.transcriptInfo.hidden = false;
  elements.copyOnly.disabled = false;

  if (tokens > 30_000) {
    setStatus(
      t('longTranscriptWarning'),
      'warning'
    );
  }
}

async function extractTranscript() {
  setBusy(true);
  setStatus(t('searchingTranscript'), 'loading');

  try {
    const tab = await getActiveYouTubeTab();
    const response = await requestTranscript(tab);
    if (!response?.ok) {
      throw new Error(response?.error || t('unableToGetTranscript'));
    }

    transcript = response.data;
    refreshTranscriptInfo();
    setStatus(t('transcriptReady'), 'success');
    return transcript;
  } catch (error) {
    transcript = null;
    refreshTranscriptInfo();
    elements.manualSection.hidden = false;
    elements.toggleManual.textContent = t('hideManual');
    setStatus(
      `${error instanceof Error ? error.message : String(error)} ${t('manualFallbackSuffix')}`,
      'error'
    );
    return null;
  } finally {
    setBusy(false);
  }
}

function useManualTranscript() {
  const text = elements.manualTranscript.value.trim();
  if (!text) {
    setStatus(t('manualTextRequired'), 'error');
    return;
  }

  transcript = {
    title: t('manualTranscriptTitle'),
    url: '',
    segments: [{ timestamp: '', text }]
  };
  refreshTranscriptInfo();
  setStatus(t('manualTranscriptReady'), 'success');
}

async function writeToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error(t('clipboardDenied'));
  }
}

async function copyPrompt({ openChat }) {
  if (busy) return;
  if (!transcript) {
    const extracted = await extractTranscript();
    if (!extracted) return;
  }

  setBusy(true);
  try {
    const settings = getSettings();
    const prompt = buildPrompt(transcript, settings);
    await writeToClipboard(prompt);

    if (openChat) {
      const provider = getAllProviders()[settings.provider] || CHAT_PROVIDERS.chatgpt;
      await api.tabs.create({ url: provider.url });
      setStatus(t('promptCopiedOpen', provider.label), 'success');
    } else {
      setStatus(t('promptCopied'), 'success');
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    setBusy(false);
  }
}

function toggleManualSection() {
  elements.manualSection.hidden = !elements.manualSection.hidden;
  elements.toggleManual.textContent = elements.manualSection.hidden
    ? t('pasteManually')
    : t('hideManual');
  if (!elements.manualSection.hidden) elements.manualTranscript.focus();
}

for (const element of [
  elements.language,
  elements.detail,
  elements.format,
  elements.timestamps
]) {
  element.addEventListener('change', saveSettings);
}

elements.provider.addEventListener('change', onProviderChange);
elements.removeProvider.addEventListener('click', removeCustomProvider);
elements.saveCustom.addEventListener('click', saveCustomProvider);
elements.cancelCustom.addEventListener('click', closeCustomProviderForm);
elements.extract.addEventListener('click', extractTranscript);
elements.copyOpen.addEventListener('click', () => copyPrompt({ openChat: true }));
elements.copyOnly.addEventListener('click', () => copyPrompt({ openChat: false }));
elements.toggleManual.addEventListener('click', toggleManualSection);
elements.useManual.addEventListener('click', useManualTranscript);

await loadCustomProviders();
await restoreSettings();
