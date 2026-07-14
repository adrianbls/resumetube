# ResumeTube

Firefox extension that grabs the visible transcript of a YouTube video, builds a
safe prompt to summarize it, and opens the AI chat chosen by the user. It uses no
backend, API keys, or proprietary services.

## Included features

- Transcript extraction from the YouTube interface.
- Compatibility with the classic panel and with `PAmodern_transcript_view`.
- Interface automatically in Spanish for any `es-*` locale and in English for
  every other language.
- Summary language selection among about 30 languages, or "the same language as
  the transcript".
- Manual pasting when the video offers no transcript or the interface changes.
- Targets: ChatGPT, Claude, Google AI Studio, and Gemini.
- Brief, medium, or detailed summaries.
- General summary, study notes, and chapters formats.
- Optional timestamp preservation.
- Prompt hardened against injection: the transcript content is treated only as
  material to summarize and any instructions inside it are ignored.
- Approximate prompt size estimate.
- Preferences stored only in the extension's local storage.

The extension copies the prompt and opens the chat. The user keeps control and
must paste and send it manually.

## Try it in Firefox

1. Open `about:debugging` in Firefox.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on**.
4. Select the `manifest.json` file in this directory.
5. Open a YouTube video that has subtitles.
6. Click the ResumeTube icon and then **Copy and open chat**.
7. Paste the prompt into the chat with `Ctrl+V` and send it.

Temporary add-ons disappear when Firefox closes. For development, you can also
use Mozilla `web-ext`:

```bash
npx web-ext run
```

Requires Firefox 142 or later (`strict_min_version` in `manifest.json`).

## Tests

The tests use Node's built-in runner, with no external dependencies:

```bash
node --test
```

They check that the Spanish and English message catalogs share the same keys and
placeholders, and validate the content script logic.

## Structure

```text
manifest.json
├── _locales/                  # Spanish (es) and English (en) translations
├── content/content-script.js  # Locates and reads the transcript
├── popup/popup.html           # Extension interface
├── popup/popup.js             # Main flow and clipboard
├── popup/prompt.js            # Prompt templates, languages, and chat targets
├── popup/i18n.js              # Popup interface localization
├── icons/icon.svg
└── tests/                     # Tests run with node --test
```

## Privacy

ResumeTube does not send information to any proprietary servers. The transcript
is only copied to the clipboard. When the user pastes and sends it in a chat, it
becomes subject to the terms and privacy policy of the chosen provider.

The manifest explicitly declares that the extension neither collects nor
transmits data, in line with the consent system built into Firefox 142 and later.

## Known limitations

- Extraction depends on the YouTube interface and may require adjustments if
  YouTube changes its internal components.
- Some videos have no subtitles or do not allow showing the transcript.
- Chats may impose different size limits. For long texts, the extension shows a
  warning starting at around 30,000 estimated tokens.
- The token estimate is approximate and depends on the chosen model.
</content>
