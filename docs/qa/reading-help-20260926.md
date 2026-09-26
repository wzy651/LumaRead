# Reading help verification — 2026-09-26

## Scope and source

- Workspace: `D:\Codex_product\LumaRead`
- Branch: `codex/learning-reader-20260926`
- Starting point: `80a254f3a0d05dbfc3b71c9e91c872ab45dbf03f` (latest existing EPUB boundary fix)
- Implementation checkpoint: `1f1d82abd16ab4411e2eb2b652f04c9ae5102921`
- No other worktree, installed app, system setting or user library was modified.
- Windows native smoke used a project-local `WEBVIEW2_USER_DATA_FOLDER`; process command lines confirmed that WebView data was under `.qa-artifacts/native-reading-help-profile/EBWebView`.

## Completed checks

| Check | Result |
| --- | --- |
| `npm ci` | Passed at start; no new npm dependencies |
| Typecheck | Passed |
| Vitest | 41 files / 204 tests passed |
| Strict ESLint | Passed, zero warnings |
| Vite production build | Passed; existing large DOCX chunk warning remains |
| `cargo check` | Passed |
| `cargo test --lib` | 5 passed, including actual loopback HTTP transport |
| `npm audit` | 0 vulnerabilities |
| `git diff --check` | Passed |
| Tauri Windows build | `tauri build --debug --no-bundle` passed |
| Native startup | `lumaread.exe` launched; LumaRead window handle and responding process confirmed |

Native interactive clicks were **not verified**: the installed computer-use runtime failed to initialize with a sandbox helper error, including after reset. A responsive process is not evidence that every UI feature works natively. Android device/build verification was not performed in this turn.

## Browser evidence

`tests/browser/reading-help.mjs` exercised actual rendered DOM in Edge, once with the Vite development server and again with built production assets. It imports real synthetic TXT, EPUB, DOCX and text PDF files through the Library import flow.

- TXT word hit-testing, real bundled Chinese definitions, word forms and source sentence.
- Explicit model-service configuration, context request and Simplify English.
- No AI requests for ordinary dictionary taps; no credential in localStorage.
- Explicit add-to-learning/undo; querying alone remains unknown.
- Selected-sentence keyboard action, Escape closes the help without exiting Reader.
- 390×844 touch emulation, 834×1112, 1440×900 panel bounds and no horizontal overflow.
- EPUB Aa → Pages, lookup before and after a page turn.
- DOCX import and lookup.
- PDF original official TextLayer hit-testing.
- Built-in sample keyboard lookup uses the real dictionary, not mock explanations.
- Query history survives reload; session API key does not.
- Dark theme lookup and persistence.
- No uncaught page errors in the tested flow.

All model responses in these end-to-end tests came from an explicitly identified **local HTTP contract fixture**, not a real AI provider. Live explanation quality, real account/model permissions and provider-specific behavior require the user's later API Key.

Local screenshots and results: `.qa-artifacts/reading-help/`. Screenshots include `desktop-context.png`, `lookup-390.png`, `lookup-834.png`, `lookup-1440.png`, `lookup-dark.png`. Earlier failure evidence is retained, not presented as the final result.

The existing `npm run test:browser` EPUB boundary regression also passed. Its measurements include 390×844, 413×699, 834×1112 and 1440×900, middle/end pages, short chapters, resize, restore, font/width and Scroll/Pages switching. New evidence is written under `.qa-artifacts/epub-pages-boundary/` rather than overwriting previously committed QA screenshots.

## New regression coverage

- Actual bundled dictionary and aliases; no external dictionary fetch.
- Word boundaries and PDF context reconstruction across individual word spans.
- Real fake-indexeddb query/status storage and concurrent writes.
- StrictMode once-only recording; no automatic review enrollment or AI call.
- Stale-answer protection, explicit retry, cancellation on unmount/settings changes.
- API key memory-only behavior, URL rules and Ollama credential isolation.
- Tauri bridge request/cancel/error contracts (mock bridge, separate from native UI).
- Rust transport sends real HTTP POST to loopback fixtures, preserves Unicode, does not follow redirects, strips error response details and caps response size.

## Size and artifacts

- Main JS: 311.49 kB (gzip 97.39 kB).
- Reader JS: 119.19 kB (gzip 33.34 kB).
- Shared reading-help code: 10.95 kB (gzip 5.15 kB), separate from the Home entry.
- Offline dictionary data: about 9.7 MB, 557 lazily read shards; not bundled into the Home JS.
- Windows test executable: `src-tauri/target/debug/lumaread.exe`, embedded production frontend, no Vite server needed. This is a debug test build, not a newly installed MSI.
- No build artifacts, caches, screenshots, local test profiles, credentials or backups are tracked in Git.

## Backups and remaining boundaries

Verified complete-history Git bundles live inside `.local-backups/`: the pre-development snapshot and the implementation checkpoint. A final verified snapshot follows this report.
These are **source-code backups**, not backups of the user's existing IndexedDB library.

Still outside this delivery: OCR, Android real-device behavior, real-provider response quality, persistent OS-protected credential storage, live FSRS/review integration, AI content filtering and proficiency profiling.
