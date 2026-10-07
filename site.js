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
        sourceLine(s.sources)));
    }
  } catch {
    box.replaceChildren(el("p", { class: "muted", text: "Samples are on their way." }));
  }
}

// ---- blind test ----------------------------------------------------------------------------
function shuffle(pair) {
  const saved = store.get("order." + pair.id);
  if (saved && saved.length === 2) {
    const o = saved.map((id) => pair.clips.find((c) => c.id === id)).filter(Boolean);
    if (o.length === 2) return o;
  }
  const order = Math.random() < 0.5 ? [pair.clips[0], pair.clips[1]] : [pair.clips[1], pair.clips[0]];
  store.set("order." + pair.id, order.map((c) => c.id));
  return order;
}

function showResult(card, pair, results, myPick) {
  card.querySelector(".result")?.remove();
  const box = el("div", { class: "result", "aria-live": "polite" });
  const r = results && results.pairs && results.pairs[pair.id];
  const sys = (r && r.systems) || {};
  if (myPick === "none") box.append(el("p", { text: "You heard no difference." }));
  else if (sys[myPick]) box.append(el("p", { text: "You picked " + sys[myPick] + "." }));
  else box.append(el("p", { text: "Thanks, your vote is in." }));
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

async function renderPairs() {
  const box = document.getElementById("pairs");
  if (!box) return;
  let data, results = null;
  try { data = await getJSON(box.dataset.src); } catch { return; }
  const loadResults = async () => { try { results = await getJSON("/data/results.json"); } catch { /* not yet */ } };
  box.replaceChildren();
  for (const pair of data.pairs) {
    const order = shuffle(pair);
    const card = el("article", { class: "pair" }, el("h3", { text: pair.title }), sourceLine([pair.source]));
    order.forEach((c, i) => {
      const label = i ? "B" : "A";
      card.append(el("div", { class: "clip" }, el("b", { text: label }),
        el("audio", { controls: "", preload: "none", src: c.src, "aria-label": "Clip " + label })));
    });
    const choice = el("div", { class: "choice", role: "group", "aria-label": "Your pick" });
    const voted = store.get("vote." + pair.id);
    for (const [label, pick] of [["I prefer A", order[0].id], ["I prefer B", order[1].id], ["No difference", "none"]]) {
      const b = el("button", { type: "button", class: "btn", text: label });
      if (voted) { b.disabled = true; if (voted === pick) b.setAttribute("aria-pressed", "true"); }
      b.addEventListener("click", async () => {
        if (store.get("vote." + pair.id)) return;
        store.set("vote." + pair.id, pick);
        choice.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        b.setAttribute("aria-pressed", "true");
        try { await fetch(`/api/vote?pair=${encodeURIComponent(pair.id)}&pick=${encodeURIComponent(pick)}`, { cache: "no-store" }); } catch { /* offline */ }
        await loadResults();
        showResult(card, pair, results, pick);
      });
      choice.append(b);
    }
    card.append(choice);
    box.append(card);
    if (voted) { if (!results) await loadResults(); showResult(card, pair, results, voted); }
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

heroPlayer();
renderSamples();
renderPairs();
interest();
