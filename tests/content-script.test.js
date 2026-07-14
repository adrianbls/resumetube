const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function createReader(nodes) {
  const context = {
    __RESUMETUBE_TEST__: {},
    browser: {
      runtime: {
        onMessage: { addListener() {} }
      }
    },
    document: {
      querySelectorAll() { return nodes; }
    }
  };
  context.globalThis = context;

  const source = fs.readFileSync('content/content-script.js', 'utf8');
  vm.runInNewContext(source, context);
  return context.__RESUMETUBE_TEST__;
}

function createSegment({ timestamp, text, modern }) {
  return {
    textContent: `${timestamp} ${text}`,
    querySelector(selector) {
      if (modern && selector.includes('ytwTranscriptSegmentViewModelTimestamp')) {
        return { textContent: `Ir a ${timestamp}` };
      }
      if (modern && selector.includes('ytAttributedStringHost')) {
        return { textContent: text };
      }
      if (!modern && selector.includes('.segment-timestamp')) {
        return { textContent: timestamp };
      }
      if (!modern && selector.includes('.segment-text')) {
        return { textContent: text };
      }
      return null;
    }
  };
}

test('reads legacy YouTube transcript segments', () => {
  const reader = createReader([
    createSegment({ timestamp: '0:05', text: 'Primera frase.', modern: false }),
    createSegment({ timestamp: '1:20', text: 'Segunda frase.', modern: false })
  ]);

  assert.deepEqual(
    structuredClone(reader.readSegments()),
    [
      { timestamp: '0:05', text: 'Primera frase.' },
      { timestamp: '1:20', text: 'Segunda frase.' }
    ]
  );
});

test('reads PAmodern transcript view segments', () => {
  const reader = createReader([
    createSegment({ timestamp: '0:12', text: 'Modern transcript text.', modern: true }),
    createSegment({ timestamp: '12:34', text: 'Another modern segment.', modern: true })
  ]);

  assert.deepEqual(
    structuredClone(reader.readSegments()),
    [
      { timestamp: '0:12', text: 'Modern transcript text.' },
      { timestamp: '12:34', text: 'Another modern segment.' }
    ]
  );
});

test('deduplicates repeated DOM segments', () => {
  const segment = createSegment({
    timestamp: '2:03',
    text: 'Repeated segment.',
    modern: true
  });
  const reader = createReader([segment, segment]);

  assert.equal(reader.readSegments().length, 1);
});

test('recognizes transcript actions without confusing the description expander', () => {
  const reader = createReader([]);

  assert.equal(reader.matchesTranscriptLabel('Show transcript'), true);
  assert.equal(reader.matchesTranscriptLabel('Mostrar la transcripción'), true);
  assert.equal(reader.matchesTranscriptLabel('Transkript anzeigen'), true);
  assert.equal(reader.matchesTranscriptLabel('Ver más'), false);
  assert.equal(reader.matchesTranscriptLabel('Show more'), false);
});
