# vozonda.com

The website of [Vozonda](https://github.com/Vozonda/vozonda): one static page, no build step, no
cookies, no third-party requests.

- `index.html`, `site.css`, `site.js`: the page (Calm Grid design, light and dark).
- `samples.json`: the sample episodes; `compare.json`: the blind test pairs (clip ids only).
- Audio files and blind-test results are served from the server and are not in this repo.

Changes: open a pull request. Keep it static, under 100 KB before audio, and free of trackers.

## Links

Same convention as sovgrid.org, keyed on the link target (`href`):

- **Internal** (relative paths or `vozonda.com`): brand green, same tab.
- **External**: body colour, underlined, with a trailing ↗; opens in a new tab with `rel="noopener noreferrer"`,
  plus `nofollow` unless it points to our own places (sovgrid.org, github.com/Vozonda).
- **In-page anchors** (`#...`): body colour.
- Navigation, footer, buttons and chips keep their own look and open in the same tab.

Links stay underlined in text (colour alone is not enough, WCAG 1.4.1). The styling is in `site.css` (section
"links"), the new-tab behaviour in `site.js` (`externalLinks()`), so new pages get it without extra markup.

## Comparison sources

Every tool column in the comparison links the public page its values were read from (`source` in
`competitors.json`). A claim that is not on that page gets its own `url` on the cell, or `Unknown`.
