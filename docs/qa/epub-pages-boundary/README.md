# EPUB Pages visible-boundary regression

The browser check launches Microsoft Edge through Playwright, serves the actual application, generates a valid two-chapter EPUB, parses it through the app's EPUB adapter, and stores the parsed record in IndexedDB. The first chapter contains 150 long paragraphs; the second contains one short paragraph. It records screenshots and Range-measured column starts in `measurements.json`.

Run with `npm run test:browser` on Windows with Microsoft Edge installed. Set `EDGE_PATH` if Edge is installed elsewhere.

## Baseline reproduction

At a 390×844 CSS viewport, the baseline article scroll viewport measured 350px wide with 40px horizontal padding, leaving a 310px content area. `getComputedStyle().columnWidth` returned 282px and the gap was 28px, so the old pagination stride was 310px. Browser Range geometry measured a 338px pitch between rendered columns. At `scrollLeft=620px` (the old third-page target), the viewport intersected columns 1 and 2; the screenshot shows fragments from adjacent pages on both sides.

## Fixed measurements

| CSS viewport | Content / column width | Column gap | Program stride | Range-measured pitch | Samples |
| --- | ---: | ---: | ---: | ---: | --- |
| 390×844 | 350px | 28px | 378px | 378px | First, page 79, last (158) |
| 413×699 | 373px | 28px | 401px | 401px | First, page 89, last (177) |
| 834×1112 | 598.5px | 41.7px | 640.2px | 640.1875px | First, page 42, last (84) |
| 1440×900 | 598.5px | 64px | 662.5px | 662.5px | First, page 61, last (121) |

The test also moves from page 3 at 1440×900 to 390×844 and back without reloading. It lands on page 4 at both sizes, retains nearby visible paragraph IDs, and verifies that only one rendered column intersects the viewport each time. The longest measured end-page offset error is below 2px. Browser CSS viewport resizing exercises the same running Edge document; it is not a native Tauri window resize.

## Screenshots

- `baseline-390-page3.png`: original adjacent-page leakage.
- `390x844-page-79.png`, `413x699-page-89.png`, `834x1112-page-42.png`, `1440x900-page-61.png`: fixed mid-page samples.
- `resize-midpage-narrow.png`, `resize-midpage-wide.png`: the live-document shrink and grow sequence.
- `before-reopen-page3.png`, `after-reopen-page3.png`: persisted and restored location.
- Remaining viewport, short-chapter, and settings screenshots cover first/last pages and 48/64/80ch widths.
