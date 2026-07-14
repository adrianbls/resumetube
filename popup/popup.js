import { buildPrompt, CHAT_PROVIDERS, estimateTokens } from './prompt.js';
import { localizeDocument, t, UI_LOCALE } from './i18n.js';

const api = globalThis.browser;
localizeDocument();

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
  toggleManual: document.querySelector('#toggle-manual')
};

let transcript = null;
let busy = false;

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

function getSettings() {
  return {
    provider: elements.provider.value,
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
  elements.provider.value = restored.provider;
  elements.language.value = restored.language;
  elements.detail.value = restored.detail;
  elements.format.value = restored.format;
  elements.timestamps.checked = restored.includeTimestamps;
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
      const provider = CHAT_PROVIDERS[settings.provider] || CHAT_PROVIDERS.chatgpt;
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
  elements.provider,
  elements.language,
  elements.detail,
  elements.format,
  elements.timestamps
]) {
  element.addEventListener('change', saveSettings);
}

elements.extract.addEventListener('click', extractTranscript);
elements.copyOpen.addEventListener('click', () => copyPrompt({ openChat: true }));
elements.copyOnly.addEventListener('click', () => copyPrompt({ openChat: false }));
elements.toggleManual.addEventListener('click', toggleManualSection);
elements.useManual.addEventListener('click', useManualTranscript);

await restoreSettings();
