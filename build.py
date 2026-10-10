#!/usr/bin/env python3
"""Build the generated pages of vozonda.com from the files in this repo.

Run it from anywhere, Python 3.10+, standard library only:

    python3 build.py

What it does, in order:

1. Shell pages: compare/, blind-test/ and support/ get the head, navigation and footer of index.html
   wrapped around their body.html, with their own title, description and canonical URL.
2. Comparison table: built from competitors.json and written between the
   <!-- compare:start --> and <!-- compare:end --> markers in index.html and compare/index.html.
3. Social cards: on every page og:url, og:title and og:description follow the page's own canonical URL,
   <title> and meta description, so a shared subpage shows its own card instead of the home page's.
4. Cache busting: every page links site.css and site.js with ?v=<content hash>, so browsers fetch
   a changed file instead of a cached one.

Deterministic: running it twice on the same files changes nothing. CI runs it on every pull request
and fails when a generated page is out of date, so run it before you commit.

Not built here: samples.json, changelog/ and roadmap/. They come from the maintainers' Vozonda
instance and the app's GitHub issues and releases, and are rebuilt daily by the maintainers' tooling,
which then calls this script. Their pages use the same head, navigation and footer.
"""
import hashlib
import html
import json
import re
from pathlib import Path

WEB = Path(__file__).resolve().parent
SITE = "https://vozonda.com/"

# Pages built from <dir>/body.html: directory, <title>, meta description.
SHELL_PAGES = [
    ("compare", "Compare · Vozonda",
     "Vozonda next to NotebookLM, ElevenLabs GenFM, Jellypod, Wondercraft, Audioread, Open Notebook and "
     "Podcastfy: features and a public blind test."),
    ("blind-test", "Blind test · Vozonda",
     "Read three scripts and hear three clips from the same source, blind: Vozonda vs NotebookLM vs "
     "Open Notebook, results published live."),
    ("support", "Support · Vozonda",
     "Ways to support Vozonda: boost it over Lightning, contribute code and ideas, or spread the word. "
     "All optional, no account needed."),
]


# 1. shell pages ---------------------------------------------------------------------------------

def _block(page: str, start: str, end: str) -> str:
    """The part of page from the start tag up to and including the end tag."""
    i = page.index(start)
    return page[i:page.index(end, i) + len(end)]


def shell_page(directory: str, title: str, desc: str) -> None:
    shell = (WEB / "index.html").read_text()
    head = shell[:shell.index("<body>")]
    head = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", head)
    head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', head)
    head = head.replace(f'<link rel="canonical" href="{SITE}">', f'<link rel="canonical" href="{SITE}{directory}/">')
    # the schema.org block describes the app and belongs to the home page only
    head = re.sub(r'<script type="application/ld\+json">.*?</script>\n?', "", head, flags=re.S)
    # in-page anchors of the home page (#listen, #compare, ...) must point back to it from a subpage
    nav = _block(shell, '<header class="nav">', "</header>").replace('href="#', 'href="/#')
    foot = _block(shell, '<footer class="foot">', "</footer>").replace('href="#', 'href="/#')
    body = (WEB / directory / "body.html").read_text()
    (WEB / directory / "index.html").write_text(
        f'{head}<body>\n<a class="skip" href="#main">Skip to content</a>\n{nav}\n{body}\n{foot}\n</body>\n</html>\n')


# 2. comparison table ----------------------------------------------------------------------------
# competitors.json: "tools" are the columns (Vozonda first, marked "us"), "params" the rows in display
# order. A param starting with "§" opens a group. Each tool has "cells" keyed by param:
# {"text": ..., "mark": "y" | "n" | "", "url": optional link for that one value}.

def _oss(tool: dict) -> bool:
    """Open-source tools get data-oss, which the "Open source only" filter in site.js keys on."""
    cell = tool["cells"].get("Open-source app") or tool["cells"].get("Open source") or {}
    return cell.get("mark") == "y"


def _attrs(tool: dict) -> str:
    return (' data-us="1"' if tool.get("us") else "") + (" data-oss" if _oss(tool) else "")


def _cell(tool: dict, param: str) -> str:
    c = tool["cells"].get(param, {})
    cls = {"y": ' class="y"', "n": ' class="n"'}.get(c.get("mark", ""), "")
    text = html.escape(c.get("text", ""))
    if c.get("url"):  # a value that is not on the tool's source page, e.g. a planned feature's roadmap entry
        text = f'<a href="{html.escape(c["url"])}">{text}</a>'
    return f"<td{cls}{_attrs(tool)}>{text}</td>"


def _tool_name(tool: dict) -> str:
    # the column header links the vendor page the column's values were read from ("source")
    name = html.escape(tool["name"])
    return f'<a href="{html.escape(tool["source"])}">{name}</a>' if tool.get("source") else name


def _row(cmp: dict, param: str) -> str:
    if param.startswith("§"):
        # group header: the label sits in the first cell so it stays in view (sticky left)
        # while the table scrolls sideways
        return (f'<tr class="vs-group"><th scope="rowgroup">{html.escape(param[1:])}</th>'
                f'<td colspan="{len(cmp["tools"])}"></td></tr>')
    cls = ' class="compact"' if param in cmp.get("compact", []) else ""
    cells = "".join(_cell(t, param) for t in cmp["tools"])
    return f'<tr{cls}><th scope="row">{html.escape(param)}</th>{cells}</tr>'


def comparison_table() -> None:
    cmp = json.loads((WEB / "competitors.json").read_text())
    cols = "".join(
        f'<th scope="col"{" class=" + chr(34) + "us" + chr(34) if t.get("us") else ""}{" data-oss" if _oss(t) else ""}>'
        f'{_tool_name(t)}</th>' for t in cmp["tools"])
    rows = "".join(_row(cmp, p) for p in cmp["params"])
    table = (f'<!-- compare:start (generated from competitors.json by build.py) -->\n'
             f'<div class="seg-filter" role="group" aria-label="Show tools">'
             f'<button type="button" class="btn ghost" data-filter="all" aria-pressed="true">All tools</button>'
             f'<button type="button" class="btn ghost" data-filter="oss" aria-pressed="false">Open source only</button></div>\n'
             f'<div class="table-wrap">'
             f'<table class="vs vs-cols"><thead><tr><th scope="col"><span class="sr">Feature</span></th>{cols}</tr></thead>'
             f'<tbody>{rows}</tbody></table></div>\n<!-- compare:end -->')
    for page in (WEB / "index.html", WEB / "compare" / "index.html"):
        s = page.read_text()
        s = re.sub(r"<!-- compare:start.*?<!-- compare:end -->", lambda m: table, s, flags=re.S)
        s = re.sub(r"<span data-asof>[^<]*</span>", f"<span data-asof>{cmp['as_of']}</span>", s)
        page.write_text(s)


# 3. social cards --------------------------------------------------------------------------------
# The head of every page starts as a copy of the home page's, Open Graph tags included. Without this step
# a shared /blind-test/ link would show the home page's title, and og:url would tell Facebook, LinkedIn
# and Mastodon that it is the home page. The image (og.png) stays the same on every page. The home page
# keeps its hand-written card, which deliberately differs from its meta description.

def _meta(page: str, pattern: str) -> str:
    m = re.search(pattern, page)
    return m.group(1) if m else ""


def social_cards() -> None:
    for page in sorted(WEB.glob("*/index.html")):
        s = page.read_text()
        values = {
            "og:url": _meta(s, r'<link rel="canonical" href="([^"]*)">'),
            "og:title": _meta(s, r"<title>(.*?)</title>"),
            "og:description": _meta(s, r'<meta name="description" content="([^"]*)">'),
        }
        for prop, value in values.items():
            if value:  # values come from the page's own (already escaped) HTML, so they go in as they are
                s = re.sub(rf'<meta property="{prop}" content="[^"]*">',
                           lambda m: f'<meta property="{prop}" content="{value}">', s)
        page.write_text(s)


# 4. cache busting -------------------------------------------------------------------------------

def stamp_assets() -> dict:
    stamp = {name: hashlib.sha256((WEB / name).read_bytes()).hexdigest()[:10] for name in ("site.css", "site.js")}
    for page in [WEB / "index.html", *sorted(WEB.glob("*/index.html"))]:
        s = page.read_text()
        for name, h in stamp.items():
            s = re.sub(rf'(href|src)="/{re.escape(name)}(\?v=[0-9a-f]+)?"', rf'\1="/{name}?v={h}"', s)
        page.write_text(s)
    return stamp


def main() -> None:
    for directory, title, desc in SHELL_PAGES:
        if (WEB / directory / "body.html").exists():
            shell_page(directory, title, desc)
    comparison_table()
    social_cards()
    print("stamped", stamp_assets())


if __name__ == "__main__":
    main()
