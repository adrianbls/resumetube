import { buildPrompt, CHAT_PROVIDERS, estimateTokens } from './prompt.js';

const api = globalThis.browser;
const DEFAULT_SETTINGS = {
  provider: 'chatgpt',
  language: 'es',
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
    throw new Error('La pestaña activa no es una página de YouTube.');
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
  elements.transcriptStats.textContent =
    `${words.toLocaleString('es-ES')} palabras · ~${tokens.toLocaleString('es-ES')} tokens en el prompt`;
  elements.transcriptInfo.hidden = false;
  elements.copyOnly.disabled = false;

  if (tokens > 30_000) {
    setStatus(
      'La transcripción es muy larga; el chat elegido podría rechazarla o recortarla.',
      'warning'
    );
  }
}

async function extractTranscript() {
  setBusy(true);
  setStatus('Buscando la transcripción en YouTube…', 'loading');

  try {
    const tab = await getActiveYouTubeTab();
    const response = await requestTranscript(tab);
    if (!response?.ok) {
      throw new Error(response?.error || 'No se pudo obtener la transcripción.');
    }

    transcript = response.data;
    refreshTranscriptInfo();
    setStatus('Transcripción obtenida correctamente.', 'success');
    return transcript;
  } catch (error) {
    transcript = null;
    refreshTranscriptInfo();
    elements.manualSection.hidden = false;
    elements.toggleManual.textContent = 'Ocultar pegado manual';
    setStatus(
      `${error instanceof Error ? error.message : String(error)} Puedes pegarla manualmente.`,
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
    setStatus('Pega algún texto antes de continuar.', 'error');
    return;
  }

  transcript = {
    title: 'Transcripción introducida manualmente',
    url: '',
    segments: [{ timestamp: '', text }]
  };
  refreshTranscriptInfo();
  setStatus('Transcripción manual preparada.', 'success');
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
    if (!copied) throw new Error('Firefox no permitió copiar el texto.');
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
      setStatus(`Prompt copiado. Pégalo en ${provider.label} con Ctrl+V.`, 'success');
    } else {
      setStatus('Prompt copiado al portapapeles.', 'success');
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
    ? 'Pegar transcripción manualmente'
    : 'Ocultar pegado manual';
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
