(() => {
  if (globalThis.__resumeTubeContentScriptLoaded) return;
  globalThis.__resumeTubeContentScriptLoaded = true;

  const api = globalThis.browser ?? globalThis.chrome;

  const TRANSCRIPT_PANEL_SELECTORS = [
    'ytd-engagement-panel-section-list-renderer[target-id="PAmodern_transcript_view"]',
    'ytd-engagement-panel-section-list-renderer[target-id*="PAmodern_transcript"]',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-timeline-view-consolidated"]',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
    'ytd-transcript-renderer',
    'ytd-transcript-search-panel-renderer'
  ];

  const SEGMENT_SELECTORS = [
    'transcript-segment-view-model',
    'ytd-transcript-segment-renderer',
    'yt-transcript-segment-view-model',
    '[class*="transcript-segment"]'
  ];

  const TIMESTAMP_SELECTORS = [
    '.ytwTranscriptSegmentViewModelTimestamp',
    '.segment-timestamp',
    '#timestamp',
    '[class*="Timestamp"]',
    '[class*="timestamp"]',
    'yt-formatted-string.segment-timestamp'
  ];

  const TEXT_SELECTORS = [
    'span.ytAttributedStringHost[role="text"]',
    '.yt-core-attributed-string[role="text"]',
    '.segment-text',
    '#segment-text',
    '[class*="segment-text"]',
    'yt-formatted-string.segment-text'
  ];

  const TRANSCRIPT_LABELS = [
    /show\s+(?:the\s+)?transcript/i,
    /open\s+(?:the\s+)?transcript/i,
    /mostrar\s+(?:la\s+)?transcripci[oó]n/i,
    /ver\s+(?:la\s+)?transcripci[oó]n/i,
    /afficher\s+(?:la\s+)?transcription/i,
    /voir\s+(?:la\s+)?transcription/i,
    /transkript\s+anzeigen/i,
    /trascrizione/i,
    /mostrar\s+(?:a\s+)?transcri[cç][aã]o/i
  ];

  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  function t(key) {
    return api.i18n.getMessage(key) || key;
  }

  function getVideoTitle() {
    const title =
      document.querySelector('ytd-watch-metadata h1 yt-formatted-string')?.textContent?.trim() ||
      document.querySelector('h1.title yt-formatted-string')?.textContent?.trim() ||
      document.title.replace(/\s*-\s*YouTube\s*$/, '').trim();

    return title || t('defaultVideoTitle');
  }

  function normalizeText(value) {
    return value?.replace(/\s+/g, ' ').trim() || '';
  }

  function normalizeTimestamp(value) {
    const timestamp = normalizeText(value);
    return timestamp.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] || timestamp;
  }

  function getElementLabel(element) {
    return normalizeText(
      `${element?.getAttribute?.('aria-label') || ''} ` +
      `${element?.getAttribute?.('title') || ''} ` +
      `${element?.innerText || ''} ${element?.textContent || ''}`
    );
  }

  function matchesTranscriptLabel(value) {
    return TRANSCRIPT_LABELS.some((pattern) => pattern.test(value));
  }

  function isVisible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  async function clickElement(element) {
    const clickable =
      element?.matches?.('button, [role="button"], tp-yt-paper-button')
        ? element
        : element?.querySelector?.('button, [role="button"], tp-yt-paper-button') || element;

    if (!clickable) return false;
    clickable.scrollIntoView({ block: 'center', behavior: 'instant' });
    await sleep(100);
    clickable.click();
    return true;
  }

  function readSegments(root = document) {
    const nodes = [...root.querySelectorAll(SEGMENT_SELECTORS.join(','))];
    const segments = [];
    const seen = new Set();

    for (const node of nodes) {
      const timestamp = normalizeTimestamp(
        node.querySelector(TIMESTAMP_SELECTORS.join(','))?.textContent
      );
      let text = normalizeText(
        node.querySelector(TEXT_SELECTORS.join(','))?.textContent
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

  async function waitForSegments() {
    let latest = [];
    let previousCount = -1;
    let stableRounds = 0;

    for (let attempt = 0; attempt < 32; attempt += 1) {
      latest = readSegments();

      if (latest.length && latest.length === previousCount) {
        stableRounds += 1;
        if (stableRounds >= 4) return latest;
      } else {
        stableRounds = 0;
      }

      previousCount = latest.length;
      await sleep(250);
    }

    return latest;
  }

  function findTranscriptButton() {
    const structuralSelectors = [
      'ytd-video-description-transcript-section-renderer button',
      'ytd-video-description-transcript-section-renderer yt-button-shape button'
    ];

    for (const selector of structuralSelectors) {
      const button = document.querySelector(selector);
      if (isVisible(button)) return button;
    }

    const localizedSelectors = [
      'ytd-watch-metadata button[aria-label*="transcript" i]',
      'ytd-watch-metadata [role="button"][aria-label*="transcript" i]',
      'button[aria-label*="transcri" i]',
      'button[aria-label*="transkript" i]'
    ];

    for (const selector of localizedSelectors) {
      const button = document.querySelector(selector);
      if (isVisible(button) && matchesTranscriptLabel(getElementLabel(button))) return button;
    }

    const candidates = document.querySelectorAll(
      'ytd-watch-metadata button, ' +
      'ytd-watch-metadata [role="button"], ' +
      'ytd-watch-metadata tp-yt-paper-button, ' +
      'ytd-watch-metadata yt-button-shape, ' +
      'ytd-watch-metadata yt-button-view-model'
    );

    return [...candidates].find((element) =>
      isVisible(element) && matchesTranscriptLabel(getElementLabel(element))
    );
  }

  function findExpandButton() {
    const selectors = [
      'ytd-watch-metadata ytd-text-inline-expander tp-yt-paper-button#expand',
      'ytd-watch-metadata ytd-text-inline-expander #expand',
      'ytd-watch-metadata #description-inline-expander #expand',
      '#description ytd-text-inline-expander #expand',
      '#description #expand'
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (isVisible(button)) return button;
    }

    return null;
  }

  async function revealTranscript() {
    const existingPanel = TRANSCRIPT_PANEL_SELECTORS.some((selector) =>
      document.querySelector(selector)
    );
    if (existingPanel && readSegments().length) return;

    let button = findTranscriptButton();

    if (!button) {
      let expandButton = findExpandButton();

      if (!expandButton) {
        document.querySelector('ytd-watch-metadata #description')?.scrollIntoView({
          block: 'center',
          behavior: 'instant'
        });
        await sleep(350);
        expandButton = findExpandButton();
      }

      if (expandButton) {
        await clickElement(expandButton);
        await sleep(500);
        button = findTranscriptButton();
      }
    }

    if (!button) {
      throw new Error(t('transcriptButtonNotFound'));
    }

    await clickElement(button);

    if ((await waitForSegments()).length) return;

    throw new Error(t('transcriptSegmentsUnreadable'));
  }

  async function extractTranscript() {
    if (!location.pathname.startsWith('/watch')) {
      throw new Error(t('openVideoFirst'));
    }

    let segments = readSegments();
    if (!segments.length) {
      await revealTranscript();
    }

    segments = await waitForSegments();

    if (!segments.length) {
      throw new Error(t('transcriptEmpty'));
    }

    return {
      title: getVideoTitle(),
      url: location.href,
      segments
    };
  }

  if (globalThis.__RESUMETUBE_TEST__) {
    Object.assign(globalThis.__RESUMETUBE_TEST__, {
      normalizeTimestamp,
      readSegments,
      matchesTranscriptLabel
    });
  }

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'RESUMETUBE_EXTRACT_TRANSCRIPT') return false;

    // Chrome ignora la Promise devuelta; hay que usar sendResponse + return true.
    // Firefox también admite este patrón, así que sirve para ambos navegadores.
    extractTranscript()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  });
})();
