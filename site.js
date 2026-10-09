// vozonda.com: hero player with live transcript, samples, blind A/B test, cloud interest.
// No cookies, no third parties; localStorage only remembers your own votes.
"use strict";

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("vz." + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("vz." + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v);
  }
  for (const k of kids) if (k) n.append(k);
  return n;
}

async function getJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---- hero player ---------------------------------------------------------------------------
async function heroPlayer() {
  const card = document.getElementById("hero-player");
  if (!card) return;
  const audio = document.getElementById("hero-audio");
  const wave = document.getElementById("hero-wave");
  const line = document.getElementById("hero-line");
  const time = document.getElementById("hero-time");
  const names = { A: card.dataset.a, B: card.dataset.b };

  let peaks = [];
  try { peaks = await getJSON("/img/sample-dst.peaks.json"); } catch { peaks = Array.from({ length: 96 }, (_, i) => 0.35 + 0.3 * Math.abs(Math.sin(i / 3))); }
  const bars = peaks.map((p) => { const b = el("i"); b.style.height = Math.max(8, Math.round(p * 100)) + "%"; wave.append(b); return b; });

  let cues = [];
  const loadCues = async () => {
    if (cues.length) return;
    try {
      const txt = await (await fetch(card.dataset.vtt)).text();
      for (const block of txt.split(/\n\n+/)) {
        const m = block.match(/(\d+):(\d+):(\d+\.\d+)\s+-->[^\n]*\n<v (\w)>([\s\S]*)/);
        if (m) cues.push({ t: +m[1] * 3600 + +m[2] * 60 + +m[3], who: m[4], text: m[5].trim() });
      }
    } catch { /* transcript is optional */ }
  };
  let shown = -1;
  const show = (t) => {
    let i = -1;
    for (let k = 0; k < cues.length && cues[k].t <= t + 0.05; k++) i = k;
    if (i === shown || i < 0) return;
    shown = i;
    line.replaceChildren(el("b", { text: names[cues[i].who] || cues[i].who }), cues[i].text);
  };
  const paint = () => {
    const d = audio.duration || 0;
    const f = d ? audio.currentTime / d : 0;
    const on = Math.round(f * bars.length);
    bars.forEach((b, i) => b.classList.toggle("on", i < on));
    time.textContent = d ? `${fmt(audio.currentTime)} / ${fmt(d)}` : time.textContent;
    show(audio.currentTime);
  };
  const toggle = async () => {
    await loadCues();
    if (audio.paused) { await audio.play().catch(() => {}); } else { audio.pause(); }
  };
  audio.addEventListener("play", () => card.classList.add("playing"));
  audio.addEventListener("pause", () => card.classList.remove("playing"));
  audio.addEventListener("timeupdate", paint);
  document.getElementById("hero-play").addEventListener("click", toggle);
  document.getElementById("hero-play-cta")?.addEventListener("click", () => {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    if (audio.paused) toggle();
  });
  wave.addEventListener("click", async (e) => {
    await loadCues();
    const r = wave.getBoundingClientRect();
    const seek = () => { audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; paint(); };
    if (!audio.duration) { audio.addEventListener("loadedmetadata", seek, { once: true }); audio.load(); } else seek();
  });
}

// ---- samples -------------------------------------------------------------------------------
function sourceLine(sources) {
  const p = el("p", { class: "meta" });
  p.append("Sources: ");
  sources.forEach((s, i) => {
    if (i) p.append(" · ");
    p.append(el("a", { href: s.url, rel: "noopener", text: s.title }));
    if (s.license) p.append(" (" + s.license + ")");
  });
  return p;
}

// "How it was made": the real settings of each sample, from the job record (samples.py).
function madeWith(m) {
  if (!m) return null;
  const rows = [
    ["Script", m.script_model], ["Voices", `${m.tts} (${m.voices})`], ["Hardware", m.hardware],
    ["Length", `${m.minutes} min, ${m.words.toLocaleString("en")} words (target ${m.target})`],
    ["Render time", `${m.render_min} min of machine time`], ["Review", m.review], ["Note", m.note],
  ].filter((r) => r[1]);
  const dl = el("dl", { class: "made" });
  for (const [k, v] of rows) dl.append(el("dt", { text: k }), el("dd", { text: v }));
  return el("details", { class: "made-with" }, el("summary", { text: "How it was made" }), dl);
}

async function renderSamples() {
  const box = document.getElementById("samples");
  if (!box) return;
  try {
    const data = await getJSON(box.dataset.src);
    box.replaceChildren();
    for (const s of data.samples) {
      const audio = el("audio", { controls: "", preload: "none", src: s.audio });
      if (s.transcript) audio.append(el("track", { kind: "captions", src: s.transcript, srclang: s.lang || "en", label: "Transcript" }));
      box.append(el("article", { class: "sample" },
        el("h3", { text: s.title }),
        el("p", { class: "meta", text: s.settings }),
        el("p", { text: s.blurb }),
        audio,
        madeWith(s.made),
        sourceLine(s.sources)));
    }
  } catch {
    box.replaceChildren(el("p", { class: "muted", text: "Samples are on their way." }));
  }
}

// ---- blind test ----------------------------------------------------------------------------
function shuffle(pair) {
  const saved = store.get("order." + pair.id);
  const n = pair.clips.length;
  if (saved && saved.length === n) {  // an order saved for a two-way pairing is not reused for three
    const o = saved.map((id) => pair.clips.find((c) => c.id === id)).filter(Boolean);
    if (o.length === n) return o;
  }
  const order = [...pair.clips];
  for (let i = order.length - 1; i > 0; i--) {  // Fisher-Yates
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  store.set("order." + pair.id, order.map((c) => c.id));
  return order;
}

function showResult(card, pair, results, myPick, order = []) {
  card.querySelector(".result")?.remove();
  const box = el("div", { class: "result", "aria-live": "polite" });
  const r = results && results.pairs && results.pairs[pair.id];
  const sys = (r && r.systems) || {};
  if (myPick === "none") box.append(el("p", { text: "You picked no difference." }));
  else if (sys[myPick]) box.append(el("p", { text: "You picked " + sys[myPick] + "." }));
  else box.append(el("p", { text: "Thanks, your vote is in." }));
  // after the vote, reveal who wrote or voiced each letter, on the labels and in one line
  if (order.length && order.every((c) => sys[c.id])) {
    const letters = card.querySelectorAll(".excerpt > b, .clip > b");
    order.forEach((c, i) => { if (letters[i]) letters[i].textContent = `${"ABC"[i]} · ${sys[c.id]}`; });
    box.append(el("p", { class: "reveal", text: order.map((c, i) => `${"ABC"[i]}: ${sys[c.id]}`).join(" · ") }));
  } else {
    box.append(el("p", { class: "meta", text: "Which was which appears here within five minutes." }));
  }
  if (r && r.total) {
    for (const [label, n] of Object.entries(r.counts || {})) {
      const pct = Math.round((100 * n) / r.total);
      box.append(el("div", { text: `${label}: ${n} (${pct} %)` }));
      const bar = el("div", { class: "bar" }); const fill = el("span"); fill.style.width = pct + "%"; bar.append(fill);
      box.append(bar);
    }
    box.append(el("p", { class: "meta", text: `${r.total} votes so far · updated every five minutes` }));
  } else {
    box.append(el("p", { class: "meta", text: "Results appear within five minutes." }));
  }
  card.append(box);
}

async function renderPairs(boxId = "pairs", mode = "audio") {
  const box = document.getElementById(boxId);
  if (!box) return;
  let data, results = null;
  try { data = await getJSON(box.dataset.src); } catch { return; }
  const loadResults = async () => { try { results = await getJSON("/data/results.json"); } catch { /* not yet */ } };
  box.replaceChildren();
  for (const pair of data.pairs) {
    if (mode === "text") pair.clips = pair.texts;
    const order = shuffle(pair);
    const card = el("article", { class: "pair" }, el("h3", { text: pair.title }), sourceLine([pair.source]));
    if (mode === "text") {
      const grid = el("div", { class: "text-pair" });
      grid.classList.toggle("three", order.length === 3);
      order.forEach((c, i) => grid.append(el("blockquote", { class: "excerpt" }, el("b", { text: "ABC"[i] }), el("p", { text: c.text }))));
      card.append(grid);
    } else {
      order.forEach((c, i) => {
        const label = "ABC"[i];
        card.append(el("div", { class: "clip" }, el("b", { text: label }),
          el("audio", { controls: "", preload: "none", src: c.src, "aria-label": "Clip " + label })));
      });
    }
    const choice = el("div", { class: "choice", role: "group", "aria-label": "Your pick" });
    const voted = store.get("vote." + pair.id);
    const best = order.length > 2 ? "best" : "better";
    const options = order.map((c, i) => [mode === "text" ? `${"ABC"[i]} explains it ${best}` : `I prefer ${"ABC"[i]}`, c.id]);
    for (const [label, pick] of [...options, ["No difference", "none"]]) {
      const b = el("button", { type: "button", class: "btn", text: label });
      if (voted) { b.disabled = true; if (voted === pick) b.setAttribute("aria-pressed", "true"); }
      b.addEventListener("click", async () => {
        if (store.get("vote." + pair.id)) return;
        store.set("vote." + pair.id, pick);
        choice.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        b.setAttribute("aria-pressed", "true");
        try { await fetch(`/api/vote?pair=${encodeURIComponent(pair.id)}&pick=${encodeURIComponent(pick)}`, { cache: "no-store" }); } catch { /* offline */ }
        await loadResults();
        showResult(card, pair, results, pick, order);
      });
      choice.append(b);
    }
    card.append(choice);
    box.append(card);
    if (voted) { if (!results) await loadResults(); showResult(card, pair, results, voted, order); }
  }
}

// ---- cloud interest ------------------------------------------------------------------------
async function interest() {
  const b = document.getElementById("interest");
  const out = document.getElementById("interest-count");
  if (!b) return;
  const kind = b.dataset.kind;
  const done = () => { b.disabled = true; b.setAttribute("aria-pressed", "true"); b.textContent = "Noted, thank you"; };
  if (store.get("interest." + kind)) done();
  b.addEventListener("click", async () => {
    if (store.get("interest." + kind)) return;
    store.set("interest." + kind, true);
    done();
    try { await fetch(`/api/interest?kind=${encodeURIComponent(kind)}`, { cache: "no-store" }); } catch { /* offline */ }
  });
  try {
    const r = await getJSON("/data/results.json");
    const n = (r.interest || {})[kind];
    if (n) out.textContent = `${n} ${n === 1 ? "person wants" : "people want"} it so far. We build it when enough people ask.`;
  } catch { /* not yet */ }
}

// ---- support page: copy buttons and Lightning amounts ------------------------------------
function copyButtons() {
  for (const b of document.querySelectorAll("[data-copy]")) {
    b.addEventListener("click", async () => {
      const text = (document.getElementById(b.dataset.copy)?.textContent || "").trim();
      const prev = b.textContent;
      try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; }
      catch { b.textContent = "Select and copy"; }
      setTimeout(() => { b.textContent = prev; }, 1800);
    });
  }
}

// Same pattern as sovgrid.org's zap: the invoice comes from the Lightning address via LNURL-pay,
// proxied by vozonda.com (/api/ln/callback, amount only), so the browser never talks to the provider.
// The QR library is loaded only when someone picks an amount.
function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return new Promise((ok, fail) => {
    const s = el("script", { src: "/vendor/qrcode.js" });
    s.onload = () => ok(window.qrcode);
    s.onerror = fail;
    document.head.append(s);
  });
}

function lightningAmounts() {
  const box = document.getElementById("ln-amounts");
  const out = document.getElementById("ln-invoice");
  const form = document.getElementById("ln-custom");
  if (!box || !out) return;
  const say = (t) => out.replaceChildren(el("p", { class: "fine" }, t));
  const pick = async (sats) => {
    if (!Number.isInteger(sats) || sats < 1 || sats > 25000000) { out.hidden = false; say("Enter a whole number of sats, 1 or more."); return; }
    box.querySelectorAll("[data-sats]").forEach((x) => x.setAttribute("aria-pressed", String(Number(x.dataset.sats) === sats)));
    out.hidden = false;
    say("Building the invoice…");
    let pr = null;
    try {
      const r = await fetch(`/api/ln/callback?amount=${sats * 1000}`, { cache: "no-store" });
      if (r.ok) pr = (await r.json()).pr || null;
    } catch { /* offline */ }
    if (!pr) { say("No invoice right now. Send any amount to the address below instead."); return; }
    const qrBox = el("div", { class: "ln-qr" });
    try {
      const qr = (await loadQr())(0, "M");
      qr.addData(`lightning:${pr}`.toUpperCase(), "Alphanumeric");
      qr.make();
      qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: `Lightning invoice for ${sats} sats` });
    } catch { /* copy and wallet link still work */ }
    const copy = el("button", { type: "button", class: "btn ghost" }, "Copy invoice");
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(pr); copy.textContent = "Copied"; } catch { copy.textContent = "Copy failed"; }
    });
    const actions = el("div", { class: "cta" }, el("a", { class: "btn primary", href: `lightning:${pr}` }, "Open in wallet"), copy);
    if (window.webln) {
      const wl = el("button", { type: "button", class: "btn ghost" }, "Pay with Alby / WebLN");
      wl.addEventListener("click", async () => {
        try { await window.webln.enable(); await window.webln.sendPayment(pr); say("Thank you. Boost sent."); }
        catch { wl.textContent = "Payment not sent"; }
      });
      actions.append(wl);
    }
    out.replaceChildren(el("p", { class: "fine" }, `${sats.toLocaleString("en")} sats: scan, open in your wallet, or copy.`), qrBox, actions);
  };
  box.addEventListener("click", (e) => { const b = e.target.closest("[data-sats]"); if (b) pick(Number(b.dataset.sats)); });
  form?.addEventListener("submit", (e) => { e.preventDefault(); pick(parseInt(form.elements.sats.value, 10)); });
}

// ---- launch countdown: until the repo goes public, GitHub links would 404 -----------------
// Shows a bar with the time left and keeps clicks on GitHub links on the page. At the launch time
// both disappear on their own, no redeploy needed.
const LAUNCH = Date.parse("2026-10-08T13:00:00Z"); // 15:00 CEST
function launchCountdown() {
  if (Date.now() >= LAUNCH) return;
  const left = el("span", { class: "lc-left" });
  const opt = { hour: "2-digit", minute: "2-digit" };
  const local = new Date(LAUNCH).toLocaleTimeString([], opt);
  const berlin = new Date(LAUNCH).toLocaleTimeString([], { ...opt, timeZone: "Europe/Berlin" });
  const when = "today 15:00 CEST" + (local === berlin ? "" : ` (${local} your time)`);
  const bar = el("div", { class: "launch-bar", role: "status" },
    el("span", { text: "Open source on GitHub in " }), left,
    el("span", { class: "lc-note", text: ` · ${when}` }));
  document.body.prepend(bar);
  const fmt = (ms) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };
  const onClick = (e) => {
    const a = e.target.closest('a[href^="https://github.com/Vozonda/"]');
    if (!a || Date.now() >= LAUNCH) return;
    e.preventDefault();
    bar.classList.remove("lc-flash"); void bar.offsetWidth; bar.classList.add("lc-flash");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  document.addEventListener("click", onClick);
  const tick = () => {
    const ms = LAUNCH - Date.now();
    if (ms <= 0) { bar.remove(); document.removeEventListener("click", onClick); clearInterval(timer); return; }
    left.textContent = fmt(ms);
  };
  const timer = setInterval(tick, 1000);
  tick();
}

// ---- changelog live numbers --------------------------------------------------------------
async function liveKpis() {
  const els = document.querySelectorAll("[data-live]");
  if (!els.length) return;
  let r;
  try { r = await getJSON("/data/results.json"); } catch { return; }
  const pairs = Object.values(r.pairs || {});
  const voz = pairs.reduce((a, p) => a + ((p.counts || {}).Vozonda || 0), 0);
  // every opponent counts (NotebookLM, Open Notebook, ...): votes for anyone but Vozonda or "no difference"
  const nlm = pairs.reduce((a, p) => a + Object.entries(p.counts || {})
    .filter(([k]) => k !== "Vozonda" && k !== "no difference").reduce((s, [, v]) => s + v, 0), 0);
  const total = pairs.reduce((a, p) => a + (p.total || 0), 0);
  for (const e of els) {
    const sub = e.parentElement.querySelector(".kpi-sub");
    if (e.dataset.live === "prefer") {
      if (voz + nlm >= 20) {
        e.textContent = Math.round((100 * voz) / (voz + nlm)) + " %";
        sub.textContent = `of ${voz + nlm} votes with a preference, blind tests vs NotebookLM and Open Notebook`;
      } else {
        sub.textContent = `collecting votes (${total} so far)`;
      }
    } else if (e.dataset.live === "waitlist") {
      e.textContent = ((r.interest || {}).hosted || 0).toLocaleString("en");
    } else if (e.dataset.live === "stars" && r.github && typeof r.github.stars === "number") {
      e.textContent = r.github.stars.toLocaleString("en");
      sub.textContent = "on GitHub";
    }
  }
}

// ---- compare page: results of all pairings ------------------------------------------------
async function renderResults(tbodyId = "results-body", src = "/compare.json") {
  const tb = document.getElementById(tbodyId);
  if (!tb) return;
  let pairs, r;
  try { [pairs, r] = await Promise.all([getJSON(src), getJSON("/data/results.json")]); } catch { return; }
  const SYSTEMS = ["Vozonda", "NotebookLM", "Open Notebook"];
  tb.replaceChildren();
  for (const p of pairs.pairs) {
    const res = (r.pairs || {})[p.id] || { counts: {}, total: 0 };
    const c = res.counts || {};
    const pref = SYSTEMS.reduce((a, n) => a + (c[n] || 0), 0);
    const pct = (n) => (pref >= 20 ? Math.round((100 * n) / pref) + " %" : `${n}`);
    tb.append(el("tr", {}, el("th", { scope: "row", text: p.title.split(":")[0].replace(/ (script|sound sample)$/, "") }),
      ...SYSTEMS.map((n) => el("td", { text: pct(c[n] || 0) })),
      el("td", { text: String(c["no difference"] || 0) }), el("td", { text: String(res.total || 0) })));
  }
}

// ---- compare table filter -----------------------------------------------------------------
function tableFilter() {
  const bar = document.querySelector(".seg-filter");
  const table = document.querySelector(".vs-cols");
  if (!bar || !table) return;
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    table.classList.toggle("oss-only", b.dataset.filter === "oss");
    bar.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  });
}

// ---- where am I: current page and section in the main nav, back to top -------------------
// The nav link of this page gets aria-current="page"; on a page whose nav links point at its own
// sections, the link of the section in view gets aria-current="location" while scrolling.
function navOrientation() {
  const nav = document.querySelector('header nav[aria-label="Main"]');
  const spy = [];
  if (nav) {
    for (const a of nav.querySelectorAll("a")) {
      const u = new URL(a.href, location.href);
      if (u.pathname !== location.pathname) continue;
      if (!u.hash) { a.setAttribute("aria-current", "page"); continue; }
      const target = document.getElementById(decodeURIComponent(u.hash.slice(1)));
      if (target) spy.push([a, target]);
    }
  }
  const top = el("button", { type: "button", class: "to-top", "aria-label": "Back to top", hidden: "" });
  top.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  top.addEventListener("click", () => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    document.querySelector(".brand")?.focus({ preventScroll: true });
  });
  document.body.append(top);
  let active = null, queued = false;
  const update = () => {
    queued = false;
    top.hidden = window.scrollY < window.innerHeight;
    if (!spy.length) return;
    const line = window.innerHeight * 0.3;
    const hit = spy.find(([, t]) => { const r = t.getBoundingClientRect(); return r.top <= line && r.bottom > line; });
    const a = hit ? hit[0] : null;
    if (a === active) return;
    active?.removeAttribute("aria-current");
    active = a;
    if (!a) return;
    a.setAttribute("aria-current", "location");
    if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - nav.offsetLeft - 16;
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  update();
}

heroPlayer();
tableFilter();
liveKpis();
renderResults();
renderResults("results-script", "/script.json");
renderSamples();
renderPairs();
renderPairs("text-pairs", "text");
interest();
copyButtons();
lightningAmounts();
launchCountdown();
navOrientation();
