# Bundled dictionary data

LumaRead bundles a filtered offline English–Chinese dictionary from [ECDICT](https://github.com/skywind3000/ECDICT), distributed under the MIT license.

- Upstream revision: `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`
- Input: `ecdict.csv`
- Input SHA-256: `1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`
- Retained: BNC/FRQ ranks 1–40000, examination-tagged words, Collins entries, selected common-prefix phrases up to four words, and applicable inflection aliases.
- Output: 89,655 entries and aliases across 557 shards. This is a subset, not the complete ECDICT database.
- License and original copyright notice are reproduced in `public/dictionary/LICENSE.txt` and copied into production builds.
- Transformation script: `scripts/build-dictionary.mjs`. Place the pinned upstream CSV and LICENSE in `.local-cache/dictionary/` and run `node scripts/build-dictionary.mjs` to reproduce. It performs no network download.

The source data may contain imperfect, dated, specialist, or inconsistent definitions. LumaRead labels these as general dictionary meanings rather than context-specific conclusions.

## Spaced repetition

LumaRead uses [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) version 5.4.2 (MIT) for local review scheduling. Its original license is reproduced in `public/licenses/ts-fsrs.txt` and copied into production builds; no remote scheduling service or optimizer is used.
