<p align="center">
  <a href="https://vozonda.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="img/vozonda-lockup-dark.svg">
      <img src="img/vozonda-lockup.svg" alt="Vozonda" width="280">
    </picture>
  </a>
</p>

# vozonda.com

The website of [Vozonda](https://github.com/Vozonda/vozonda), the self-hosted, open-source podcast generator.
It shows what Vozonda does, lets you hear it, and measures it in public against NotebookLM and six other tools.

**[Website](https://vozonda.com)** · **[App repo](https://github.com/Vozonda/vozonda)** ·
**[Compare](https://vozonda.com/compare/)** · **[Blind test](https://vozonda.com/test/)** ·
**[Roadmap](https://vozonda.com/roadmap/)**

## What the site is for

Every page serves one goal, and every claim on it comes from a file in this repo or a public source.

| Goal | Page | Built from |
|---|---|---|
| Show what Vozonda does and let you hear it | [`/`](https://vozonda.com) | `index.html`, `samples.json`, `script.json` |
| Compare it with the alternatives | [`/compare/`](https://vozonda.com/compare/) | `competitors.json` (8 tools, 29 rows, each with a source) |
| Measure it, blind, with every vote public | [`/test/`](https://vozonda.com/test/) | `compare.json` (clip ids), the published votes |
| Show where it is going and what shipped | [`/roadmap/`](https://vozonda.com/roadmap/), [`/changelog/`](https://vozonda.com/changelog/) | GitHub issues and releases of the app |
| Let people support it without an account | [`/support/`](https://vozonda.com/support/) | Lightning and Nostr |

## How we compare and measure

A comparison written by one of the compared projects is only worth something if you can check it. So:

- **Every value has a source.** Each tool column links the public page its values were read from (`source` in
  `competitors.json`). A claim that is not on that page gets its own `url` on the cell; what we cannot verify
  says `Unknown` instead of a guess.
- **The table is dated** (`as_of`, currently October 2026) and rechecked when a tool changes.
- **Our own gaps stay visible.** Rows where Vozonda is weaker (fewer languages than NotebookLM, no Word files
  or slides) are in the table, not left out.
- **Engine and app are kept apart.** Voices in Vozonda are plugins, so the comparison says which engine a
  sample uses and treats voice quality as a property of the engine, not of Vozonda.
- **The blind test is a preference test**, a multi-choice form of the pairwise tests used to evaluate speech
  synthesis: the script and the voices are judged separately, the clips are cut from the same point in each
  episode and loudness-normalised (−16 LUFS, EBU R 128), every side runs its default settings, nothing is
  regenerated or picked, and every vote is published. The full method is on the [test page](https://vozonda.com/test/).

## Found a wrong claim?

If a tool is described wrongly, including Vozonda, please
[open a comparison correction](https://github.com/Vozonda/website/issues/new?template=comparison-correction.yml)
with the tool, the row, the correct value and a public source. Corrections from the vendors themselves are
welcome. Bugs in the app go to [Vozonda/vozonda](https://github.com/Vozonda/vozonda/issues).

## Standards we hold the site to

- **Privacy by design:** no cookies, no analytics, no trackers, no request to a third party. Fonts, scripts and
  the QR code library are served from this site.
- **Security headers:** a strict Content Security Policy (`default-src 'none'`, no inline scripts or styles,
  `frame-ancestors 'none'`), HSTS, `Permissions-Policy`, `nosniff`, and a
  [`security.txt`](https://vozonda.com/.well-known/security.txt) (RFC 9116).
- **Accessibility, aiming at WCAG 2.2 AA:** semantic HTML, a skip link, visible focus, links underlined in text
  (WCAG 1.4.1), light and dark themes from the system setting, and less motion with `prefers-reduced-motion`.
- **Lightweight:** static files, no framework. HTML, CSS and JavaScript of the home page stay under 100 KB
  together; audio loads only when you press play.
- **Progressive enhancement:** all text works without JavaScript; the parts that need it (the blind test,
  the Lightning amount) say so.
- **Findable and verifiable:** schema.org metadata, Open Graph image, sitemap, and a Nostr identity
  ([NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md)) under `.well-known/`.

## How the site is built

The pages are plain HTML. `index.html` is the hand-written home page and the shell (head, navigation, footer)
for the others; `compare/`, `test/`, `support/`, `roadmap/` and `changelog/` are generated from their
`body.html`, the JSON files and the app's releases by the maintainers' build script, which also stamps the
release data into every page. A pull request therefore changes `body.html`, a JSON file,
`site.css` or `site.js`; the maintainers rebuild the generated pages. After a merge to `main` the site is
live within about five minutes.

```
index.html  site.css  site.js      the home page and the shared style and behaviour
*/body.html                        content of the other pages
competitors.json                   the comparison (tools, rows, sources)
compare.json  samples.json  script.json  roadmap.json   test pairs, samples, script excerpt, roadmap
img/  fonts/  vendor/              images, self-hosted fonts (OFL), the QR code library
.well-known/                       security.txt, nostr.json
```

Audio files and the blind-test results are served from the server and are not in this repo.

### Conventions

**Links** follow the same rules as sovgrid.org, keyed on the link target:

- **Internal** (relative paths or `vozonda.com`): brand green, same tab.
- **External**: body colour, underlined, with a trailing ↗; opens in a new tab with `rel="noopener noreferrer"`,
  plus `nofollow` unless it points to our own places (sovgrid.org, github.com/Vozonda).
- **In-page anchors** (`#...`): body colour.
- Navigation, footer, buttons and chips keep their own look and open in the same tab.

The styling is in `site.css` (section "links"), the new-tab behaviour in `site.js` (`externalLinks()`), so new
pages get it without extra markup.

**Writing:** plain English, short sentences, no marketing superlatives, no claim without a source.

## Get involved

Vozonda is young, and the most useful help is small:

- **Listen and vote.** Take the [blind test](https://vozonda.com/test/); a few minutes, no account.
- **Try it.** `docker compose up -d` with the [quickstart](https://github.com/Vozonda/vozonda/blob/main/docs/quickstart.md),
  and tell us where you got stuck.
- **Keep us honest.** Point out a wrong value in the comparison.
- **Follow along.** Watch the [releases](https://github.com/Vozonda/vozonda/releases), or follow Vozonda on
  [Nostr](https://vozonda.com/support/).
- **Support it.** Send sats over Lightning, no account needed: [support](https://vozonda.com/support/).

## License

Code and content: [MIT](LICENSE). Fonts: SIL Open Font License (`fonts/OFL-*.txt`).
