(() => {
  if (globalThis.__resumeTubeContentScriptLoaded) return;
  globalThis.__resumeTubeContentScriptLoaded = true;

  const TRANSCRIPT_PANEL_SELECTORS = [
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
    'ytd-transcript-renderer',
    'ytd-transcript-search-panel-renderer'
  ];

  const SEGMENT_SELECTORS = [
    'ytd-transcript-segment-renderer',
    'yt-transcript-segment-view-model',
    '[class*="transcript-segment"]'
  ];

  const TRANSCRIPT_LABEL = /(?:mostrar|ver|show|open|afficher|voir|anzeigen|transkript|trascri(?:zione|zione)|transcri(?:pt|pç[aã]o)|transcripción|transcription)/i;

  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  function getVideoTitle() {
    const title =
      document.querySelector('ytd-watch-metadata h1 yt-formatted-string')?.textContent?.trim() ||
      document.querySelector('h1.title yt-formatted-string')?.textContent?.trim() ||
      document.title.replace(/\s*-\s*YouTube\s*$/, '').trim();

    return title || 'Vídeo de YouTube';
  }

  function normalizeText(value) {
    return value?.replace(/\s+/g, ' ').trim() || '';
  }

  function readSegments() {
    const nodes = [...document.querySelectorAll(SEGMENT_SELECTORS.join(','))];
    const segments = [];
    const seen = new Set();

    for (const node of nodes) {
      const timestamp = normalizeText(
        node.querySelector(
          '.segment-timestamp, [class*="timestamp"], yt-formatted-string.segment-timestamp'
        )?.textContent
      );
      let text = normalizeText(
        node.querySelector(
          '.segment-text, [class*="segment-text"], yt-formatted-string.segment-text'
        )?.textContent
      );

      if (!text) {
        const rawText = normalizeText(node.textContent);
        text = timestamp && rawText.startsWith(timestamp)
          ? normalizeText(rawText.slice(timestamp.length))
          : rawText;
      }

      if (!text) continue;
      const key = `${timestamp}\u0000${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push({ timestamp, text });
    }

    return segments;
  }

  function findTranscriptButton() {
    const directSelectors = [
      'ytd-video-description-transcript-section-renderer button',
      'ytd-video-description-transcript-section-renderer yt-button-shape button',
      'button[aria-label*="transcri" i]',
      'button[aria-label*="transkript" i]'
    ];

    for (const selector of directSelectors) {
      const button = document.querySelector(selector);
      if (button && button.getClientRects().length) return button;
    }

    return [...document.querySelectorAll('button, tp-yt-paper-button')].find((element) => {
      if (!element.getClientRects().length) return false;
      const label = `${element.getAttribute('aria-label') || ''} ${element.textContent || ''}`;
      return TRANSCRIPT_LABEL.test(label);
    });
  }

  async function revealTranscript() {
    const existingPanel = TRANSCRIPT_PANEL_SELECTORS.some((selector) =>
      document.querySelector(selector)
    );
    if (existingPanel && readSegments().length) return;

    let button = findTranscriptButton();

    if (!button) {
      const expandButton = document.querySelector(
        'ytd-watch-metadata #description-inline-expander #expand, #description #expand'
      );
      if (expandButton && expandButton.getClientRects().length) {
        expandButton.click();
        await sleep(350);
        button = findTranscriptButton();
      }
    }

    if (!button) {
      throw new Error(
        'No se encontró el botón de transcripción. Es posible que el vídeo no tenga subtítulos.'
      );
    }

    button.click();

    for (let attempt = 0; attempt < 24; attempt += 1) {
      await sleep(250);
      if (readSegments().length) return;
    }

    throw new Error(
      'YouTube abrió la transcripción, pero no fue posible leer sus segmentos.'
    );
  }

  async function extractTranscript() {
    if (!location.pathname.startsWith('/watch')) {
      throw new Error('Abre primero la página de un vídeo de YouTube.');
    }

    let segments = readSegments();
    if (!segments.length) {
      await revealTranscript();
      segments = readSegments();
    }

    if (!segments.length) {
      throw new Error('La transcripción está vacía o no se encuentra disponible.');
    }

    return {
      title: getVideoTitle(),
      url: location.href,
      segments
    };
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'RESUMETUBE_EXTRACT_TRANSCRIPT') return undefined;

    return extractTranscript()
      .then((data) => ({ ok: true, data }))
      .catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }));
  });
})();
