# Local credentials, reading records and gentle review

Workspace: `D:\Codex_product\LumaRead`. Base: `daf0f71`.
All source, caches, fixtures, test browser profiles and backups remain inside this project.
No real API key, existing user library, other worktree, installed application or system setting was accessed or modified.

## Implementation

- Windows credentials: DPAPI current-user protection, bounded ciphertext file, atomic replace, endpoint binding, no secret-return IPC. Saving is an explicit action; clearing removes only the app's credential file. Browser and Android are session-only, without a plaintext fallback. This is protection at rest, not protection from a compromised logged-in Windows account.
- Local `lumaread-learning` v1 → v2 migration preserves lookup/term stores and indexes; adds sessions, reviewCards and reviewLogs. The documents database is unchanged.
- Reader-scoped foreground clock covers built-in, TXT/EPUB/DOCX and PDF views, not each section/page separately. Idle after 2 minutes; hidden/unfocused/large sleep gaps excluded. Ten-second checkpoints and best-effort exit flush. Timing can be disabled on Stats.
- Real `/statistics`, `/review` and session summary replace mock learning outputs. Home remains content-first.
- Explicit enrollment only. Repeated lookup suggestions never create cards. Existing learning terms initialize FSRS lazily. Five cards per round, safe cap eight; no debt display. Rating writes card and log in one transaction, with idempotent attempt IDs and stale revision checks.
- FSRS is confined to the lazy review chunk. Source sentence, general dictionary meaning, IPA and existing offline system speech support recall. Recognition rating is not treated as writing/speaking mastery.

## Automated verification

- TypeScript, strict ESLint, full Vitest suite, production build, npm audit and diff checks.
- Migration from a real fake-indexeddb v1 database, duplicate/concurrent feedback, FSRS due dates, explicit enrollment/removal, transaction abort, selected occurrence cloze and source isolation.
- Pure clock plus mounted StrictMode tracker tests cover idle, blur, resume, exit save, preference changes and timer cleanup.
- Credential IPC tests cover restart without exposing plaintext, endpoint isolation, clear, unsupported platforms. Native Windows DPAPI test encrypts/reopens/replaces/corrupts a fixture in `.qa-artifacts/credentials-test` and removes only that fixture.
- `node tests/browser/learning-review.mjs`: production Edge browser, actual TXT import and DOM clicks, two lookups without enrollment, statistics, explicit enrollment, original-sentence review, FSRS persistence after reload, skip semantics, timer preference and zero remote requests. 390×844, 834×1112 and 1440×900 screenshots in `.qa-artifacts/learning-review`.
- Existing four-format `test:reading-help` production regression remains applicable, including model HTTP fixture, selection and response handling. No real paid provider was called.

Browser rendering tests and native Rust tests are separate evidence. They do not establish Tauri native click or Android device acceptance. A real API key must be saved once in the new Windows build by the user, then restart to check persistence with the user's service.

## Manual check

1. Open the newly rebuilt executable, not an older installed MSI. Check Settings build hash.
2. Fill API settings, leave “在此 Windows 账户安全记住密钥” checked, Save, close and reopen. Leave the password field blank if it says securely saved, then request one context explanation. Clear key should disable it until reconfigured.
3. Read normally, look up an expression and leave Reader. Stats shows real usage, with sub-minute sessions labelled honestly. Minimize/blur and idle should not keep accumulating.
4. Click “加入学习” on a lookup, open Quick Review, reveal source answer, rate once. Reopening does not repeat a future-due card. Skip produces no rating. Stats allows removing/pausing learning.

## References

- [Microsoft CryptProtectData / DPAPI](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata)
- [Official ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)

Backup before work: `.local-backups/before-review-stats-20260928.bundle`. Old executable and final Git bundle are kept beside it; these are source/build backups, not exports of the user's book database.
