# Reading help fixes — 2026-09-28

## Scope

Workspace: `D:\Codex_product\LumaRead`; branch `codex/learning-reader-20260926`.
Starting commit: `72336b79627b6977b8cf45c6ba8281f407fde6d8`.
Implementation / embedded application build: `40d8a34f38f7197b9668d580b7246b1110de8eb3`.
Pre-edit verified source bundle: `.local-backups/before-reading-help-fixes-20260928.bundle`.
No user API Key, existing library, installed application, external worktree or system configuration is edited.

## Findings and changes

The user reports DeepSeek connection test succeeds but reading explanations fail. No real provider key or failing response was available, so this delivery must not claim an observed live-provider root cause. We identified and corrected independently verifiable risks:

- Previous Chat Completions output budget was only 350 tokens (700 for details), with no DeepSeek thinking override. Current official DeepSeek documentation says thinking is enabled by default; reasoning can exhaust the budget before final content. Official-host requests now use `thinking: { type: 'disabled' }` and 1200/2400 limits, without changing the user's model ID or sending provider-specific options to other hosts.
- Truncated/empty/reasoning-only answers now have actionable errors. Never display reasoning as an answer; never automatically retry a paid request. HTTP 402 and native network/timeout are distinguished. Request deadline is 60 seconds native / 65 seconds frontend, with cancellation retained.
- AI result insertion can leave the result below the panel viewport. Scroll only the panel to the result; retain the sticky close bar and unchanged book position.
- Allow the exact official Tauri IPC CSP origins; keep all remote requests on the bounded native transport.

Sources:
- [DeepSeek thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/)
- [Tauri CSP](https://v2.tauri.app/security/csp/)
- [Microsoft SAPI speak flags](https://learn.microsoft.com/en-us/previous-versions/office/developer/speech-technologies/jj127460(v=msdn.10))

## Selection and pronunciation

- Keep an exact cloned DOM Range, not a paragraph-level highlight. Paint a noninteractive temporary rectangle layer clipped to EPUB Pages / PDF stage / viewport; do not wrap or mutate reading text nodes.
- Context carries the UTF-16 selected-occurrence offset. Repeated words and inline spans are covered; permanent annotations remain separate.
- Offline phonetics retain source attribution and explicit lemma labels. Missing phonetics are reported honestly.
- Windows uses local SAPI, selecting an installed English voice. Rate is -1 / -4, bounded plain text only (`SPF_IS_NOT_XML`), serialized audio, cancellation and a 90-second maximum. No powershell process, network service or system-setting change.
- Other runtimes use Web Speech with asynchronous voice discovery, English voice preference, playback status, start timeout, stop and cleanup.

## Verification

- Typecheck, strict lint and full Vitest passed: 42 files / 216 tests. `npm audit` reported 0 vulnerabilities; `git diff --check` passed.
- Native Rust tests passed: 7 ordinary tests cover bounded request transport and speech input/cancel behavior; the audible test is opt-in, not silently run by the ordinary suite.
- Explicit `windows_english_pronunciation -- --ignored --nocapture` played the test word “reluctantly” at normal and slow rates; the installed speech engine completed both calls successfully. This is an actual SAPI integration test, not a browser mock, but does not establish subjective pronunciation quality.
- `test:reading-help` imports synthetic TXT, EPUB, DOCX and PDF via Library; checks exact marker geometry, context marking, 390/834/1440 panel bounds, DeepSeek-style truncated response behavior after a successful connection test, explicit retry, explanation visibility, Pages, Dark theme and persistence.
- AI browser responses come from a local HTTP contract fixture with a fake key. Live DeepSeek account/model access is **not verified**.
- Existing EPUB page-boundary browser regression runs at 390×844, 413×699, 834×1112 and 1440×900.
- Production `test:reading-help` passed with built assets and no page errors. One earlier resize run clicked coordinates measured before media-query layout settled; the helper now requires three consecutive stable Range measurements before a single physical tap. No automatic retry of the click was added.
- Browser screenshots/results: `.qa-artifacts/reading-help/`. Temporary profiles are redirected to project-local `.local-cache/tmp` by the test scripts.

## Native/device limitations

Computer Use was attempted after reading its skill. Its runtime failed during initialization with `helper_sandbox_lock_failed / SetNamedSecurityInfoW ... 5`. No desktop security settings or sandbox files were modified. Native UI clicking is not claimed as passed. Android device behavior remains unverified; no APK or MSI installation occurs.

Final Windows artifact is rebuilt from this workspace with embedded production resources, not a dependency on a running Vite server. Build products and source bundles remain ignored by Git. Existing book databases are not migrated or cleared by this change.

## Final Windows artifact

- `npm run tauri -- build --debug --no-bundle`: passed (including production frontend and Rust compilation).
- File: `src-tauri/target/debug/lumaread.exe`, 22,728,192 bytes.
- SHA-256: `D9458FA2EE8A572E00A292E5F28E1EC0A87B6E53ED10008D9BDA5F063AAF312F`.
- Isolated startup passed: owned PID 40820, title LumaRead, nonzero window handle, responding process. WebView2 command line confirmed project-local `.qa-artifacts/native-reading-help-fixes-profile/EBWebView` data. Only that test process was stopped.
- This verifies native startup, **not native UI interactions or live DeepSeek responses**. Computer Use still failed after reset and a permission-environment change; no bypass was used.
- Old executable retained at `.local-backups/lumaread-before-help-fixes-20260928.exe` (22,647,296 bytes).
- Final verified source bundle: `.local-backups/reading-help-fixes-final-20260928.bundle`.
