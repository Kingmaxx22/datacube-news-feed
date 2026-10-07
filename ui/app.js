/* ═══════════════════════════════════════════════════════════
   Cyber Slate Intelligence — feed client
   Data source: Data Cube AI News API (free, no auth)
     GET /api/weeks
     GET /api/{tech|investment|tips|videos|trends}/{periodId}
   ═══════════════════════════════════════════════════════════ */

const { invoke } = window.__TAURI__.core;
const { openUrl } = window.__TAURI__.opener;

const API_BASE = "https://api-production-3ee5.up.railway.app";
const LOCALES = [
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
  { code: "zh", label: "ZH" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "pt", label: "PT" },
  { code: "ja", label: "JA" },
  { code: "ko", label: "KO" },
];

const FEEDS = [
  { kind: "tech", label: "Tech News", endpoint: "/api/tech", color: "#00F2FE" },
  { kind: "investment", label: "Investment & M&A", endpoint: "/api/investment", color: "#10B981" },
  { kind: "tips", label: "Dev Tips", endpoint: "/api/tips", color: "#F59E0B" },
  { kind: "videos", label: "Video Summaries", endpoint: "/api/videos", color: "#EC4899" },
  { kind: "trends", label: "Trending Topics", endpoint: "/api/trends", color: "#8B5CF6" },
];

const SECTION_LABELS = {
  primaryMarket: "Primary Market",
  secondaryMarket: "Secondary Market",
  ma: "M&A",
};

const LIVE_INTERVAL_MS = 300000;
const PAGE_SIZE = 12;
const MAX_PAGES = 999;

const state = {
  locale: "en",
  periodType: "day",
  period: null,
  kind: "tech",
  sort: "impact",
  query: "",
  page: 1,
  live: true,
  codeTab: "curl",
  weeks: null,
  feeds: new Map(),
  localeCoverage: new Map(),
  loading: false,
  latencyHistory: [],
  nextRefreshAt: Date.now() + LIVE_INTERVAL_MS,
  timer: null,
  requestedPeriod: null,
};

/* ═══════════════ helpers ═══════════════ */
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const FEED_BY_KIND = Object.fromEntries(FEEDS.map((f) => [f.kind, f]));
const colorOf = (kind) => FEED_BY_KIND[kind]?.color ?? "#00F2FE";

let toastTimer = null;
function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} copied to clipboard`);
    return true;
  } catch {
    // clipboard API can be blocked in webview; fall back to a hidden textarea
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast(`${label} copied to clipboard`);
      return true;
    } catch {
      toast("clipboard unavailable");
      return false;
    }
  }
}

function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  $("export-status").textContent = `wrote ${filename} (${formatBytes(new Blob([content]).size)})`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatCount(n) {
  if (n == null) return "0";
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num >= 10_000_000 ? 0 : 1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10_000 ? 0 : 1)}k`;
  return String(num);
}

function parseTimestamp(value) {
  if (!value) return null;
  const ms = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(ms) ? null : ms;
}

function relativeTime(value) {
  const ms = parseTimestamp(value);
  if (ms == null) return "—";
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const mins = Math.round(abs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function absoluteTime(value) {
  const ms = parseTimestamp(value);
  if (ms == null) return "—";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16) + "Z";
}

function impactRank(impact) {
  return { high: 0, medium: 1, low: 2, unknown: 3 }[impact] ?? 3;
}

function normalizeImpact(raw) {
  const v = String(raw ?? "").toLowerCase();
  if (["critical", "high", "breaking", "urgent"].includes(v)) return "high";
  if (["medium", "med", "moderate", "important"].includes(v)) return "medium";
  if (["low", "minor", "info"].includes(v)) return "low";
  return null;
}

function splitTitleBody(text) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return { title: "Untitled signal", body: "" };
  const m = clean.match(/^(.{24,150}?[.!?])\s+(?=\S)/);
  if (m && !/\s[A-Z]\.$/.test(m[1])) return { title: m[1], body: capitalize(clean.slice(m[1].length).trim()) };
  const words = clean.split(" ");
  if (words.length > 18) {
    const cut = words.slice(0, 16).join(" ");
    return { title: `${cut}.`, body: capitalize(words.slice(16).join(" ")) };
  }
  return { title: clean, body: "" };
}

function capitalize(text) {
  if (!text) return text;
  // split mid-sentence leaves fragments starting lowercase; restore sentence case
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function uniqTags(...groups) {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    for (const value of [].concat(group)) {
      const tag = String(value ?? "").trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

function parseMoney(text) {
  if (!text) return null;
  const s = String(text).replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const num = parseFloat(s);
  if (!Number.isFinite(num)) return null;
  if (/trillion|\bT\b/i.test(text)) return num * 1000;
  if (/billion|\bB\b/i.test(text)) return num;
  if (/million|\bM\b/i.test(text)) return num / 1000;
  return num / 1000; // treat millions-or-less as millions
}

function investmentImpact(amount) {
  const billions = parseMoney(amount);
  if (billions == null) return "low";
  if (billions >= 1) return "high";
  if (billions >= 0.1) return "medium";
  return "low";
}

function viewImpact(viewCount) {
  const n = Number(viewCount);
  if (!Number.isFinite(n)) return "low";
  if (n >= 1_000_000) return "high";
  if (n >= 100_000) return "medium";
  return "low";
}

function trendImpact(item) {
  const streak = Number(item.streak) || 0;
  if (streak >= 3) return "high";
  if (item.momentum === "rising" || streak === 2) return "medium";
  return "low";
}

/* ═══════════════ API layer ═══════════════ */
async function callFetchWeeks(force = false) {
  const t0 = performance.now();
  const env = await invoke("fetch_weeks", { force });
  env.roundTrip = Math.round(performance.now() - t0);
  return env;
}

async function callFetchFeed(kind, period, force = false) {
  const t0 = performance.now();
  const env = await invoke("fetch_feed", { kind, period, force });
  env.roundTrip = Math.round(performance.now() - t0);
  return env;
}

function errorInfo(err) {
  if (err && typeof err === "object") {
    return { status: err.status ?? 0, url: err.url ?? "", message: err.message ?? JSON.stringify(err) };
  }
  return { status: 0, url: "", message: String(err) };
}

/* ═══════════════ deep link state (#kind=…&locale=…) ═══════════════ */
function readHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const kind = params.get("kind");
  if (kind === "all" || FEED_BY_KIND[kind]) state.kind = kind;
  const locale = params.get("locale");
  if (locale && LOCALES.some((l) => l.code === locale)) state.locale = locale;
  const type = params.get("type");
  if (type === "day" || type === "week") state.periodType = type;
  const sort = params.get("sort");
  if (sort === "impact" || sort === "recent") state.sort = sort;
  return params.get("period");
}

function syncHash() {
  const params = new URLSearchParams();
  params.set("kind", state.kind);
  params.set("locale", state.locale);
  params.set("type", state.periodType);
  if (state.period) params.set("period", state.period);
  params.set("sort", state.sort);
  history.replaceState(null, "", `#${params.toString()}`);
}

/* ═══════════════ normalizers ═══════════════ */
function localeList(body) {
  if (!body || typeof body !== "object") return [];
  return Object.keys(body).filter((k) => LOCALES.some((l) => l.code === k));
}

function sectionEntries(body) {
  return Object.entries(body ?? {}).filter(([key, value]) => value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTech(raw) {
  const { title, body } = splitTitleBody(raw.content);
  const impact = normalizeImpact(raw.impact) ?? "unknown";
  return {
    uid: `tech-${raw.id}`,
    feed: "tech",
    title,
    body,
    source: raw.source || raw.author?.name || "Unknown",
    sourceUrl: raw.sourceUrl || "",
    category: raw.category || "Tech",
    tags: uniqTags(raw.tags),
    time: raw.timestamp,
    impact,
    impactDerived: !normalizeImpact(raw.impact),
    metrics: raw.metrics ?? {},
    path: `/tech/${String(raw.category || "general").toLowerCase().replace(/\s+/g, "-")}`,
    extra: {
      iconType: raw.iconType || "",
      isVideo: Boolean(raw.isVideo),
      videoUrl: raw.videoId ? `https://www.youtube.com/watch?v=${raw.videoId}` : "",
      videoViews: raw.videoViewCount ?? null,
      thumbnail: raw.videoThumbnailUrl || "",
    },
  };
}

function normalizeInvestment(raw, section) {
  const { title, body } = splitTitleBody(raw.content);
  const amount = raw.amount || raw.dealValue || null;
  const impact = investmentImpact(amount);
  const subject = raw.company || [raw.acquirer, raw.target].filter(Boolean).join(" → ") || "Transaction";
  return {
    uid: `investment-${raw.id}-${section}`,
    feed: "investment",
    title: amount ? `${subject} — ${amount}` : subject,
    body: body || title,
    source: raw.author?.name || "Dealwire",
    sourceUrl: raw.sourceUrl || "",
    category: raw.roundCategory || raw.dealType || raw.industry || SECTION_LABELS[section] || "Markets",
    tags: uniqTags(raw.round, raw.roundCategory, raw.dealType, raw.industry),
    time: raw.timestamp,
    impact,
    impactDerived: true,
    metrics: raw.metrics ?? {},
    path: `/${SECTION_LABELS[section] || section}/${slug(subject)}`,
    extra: {
      section: SECTION_LABELS[section] || section,
      sectionKey: section,
      company: raw.company || raw.target || raw.acquirer || "",
      acquirer: raw.acquirer || "",
      target: raw.target || "",
      amount,
      valuation: raw.valuation || null,
      round: raw.round || raw.dealType || "",
      investors: Array.isArray(raw.investors) ? raw.investors : [],
      industry: raw.industry || "",
    },
  };
}

function normalizeTip(raw) {
  const difficulty = String(raw.difficulty || "").toLowerCase();
  const impact = difficulty.includes("advanced") ? "high" : difficulty.includes("intermediate") ? "medium" : "low";
  return {
    uid: `tips-${raw.id}`,
    feed: "tips",
    title: raw.tip || raw.content || "Tip",
    body: raw.content || "",
    source: raw.platform || raw.author?.name || "Community",
    sourceUrl: raw.sourceUrl || "",
    category: raw.category || "Tips",
    tags: uniqTags(raw.difficulty, raw.category),
    time: raw.timestamp,
    impact,
    impactDerived: true,
    metrics: raw.metrics ?? {},
    path: `/tips/${slug(raw.category || "general")}`,
    extra: {
      platform: raw.platform || raw.author?.name || "",
      difficulty: raw.difficulty || "",
      likes: raw.metrics?.likes ?? 0,
      comments: raw.metrics?.comments ?? 0,
    },
  };
}

function normalizeVideo(raw) {
  return {
    uid: `videos-${raw.id}`,
    feed: "videos",
    title: raw.title || "Untitled video",
    body: raw.summary || "",
    source: raw.channelName || "YouTube",
    sourceUrl: `https://www.youtube.com/watch?v=${raw.videoId}`,
    category: raw.category || "Videos",
    tags: uniqTags(raw.tags),
    time: raw.publishedAt,
    impact: viewImpact(raw.viewCount),
    impactDerived: true,
    metrics: { likes: raw.likeCount ?? 0, views: raw.viewCount ?? 0 },
    path: `/videos/${slug(raw.category || "general")}`,
    extra: {
      thumbnail: raw.thumbnailUrl || "",
      duration: raw.durationFormatted || formatDuration(raw.durationSeconds),
      viewCount: raw.viewCount ?? 0,
      likeCount: raw.likeCount ?? 0,
      videoId: raw.videoId || "",
    },
  };
}

function normalizeTrend(raw) {
  return {
    uid: `trends-${slug(raw.title)}-${raw.streak ?? 0}`,
    feed: "trends",
    title: raw.title || "",
    body: "",
    source: "Trend Radar",
    sourceUrl: "",
    category: raw.category || "Trends",
    tags: [],
    time: null,
    impact: trendImpact(raw),
    impactDerived: true,
    metrics: {},
    path: `/trends/${slug(raw.category || "ai")}`,
    extra: {
      momentum: raw.momentum || "new",
      streak: Number(raw.streak) || 0,
      posts: raw.posts ?? null,
    },
  };
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function formatDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function normalizeFeed(kind, body, locale) {
  const out = [];
  const pick = (arr) => (Array.isArray(arr) ? arr : []);
  if (kind === "tech") {
    pick(body?.[locale]).forEach((raw) => out.push(normalizeTech(raw)));
  } else if (kind === "tips") {
    pick(body?.[locale]).forEach((raw) => out.push(normalizeTip(raw)));
  } else if (kind === "videos") {
    pick(body?.[locale]).forEach((raw) => out.push(normalizeVideo(raw)));
  } else if (kind === "investment") {
    for (const [section, byLocale] of sectionEntries(body)) {
      pick(byLocale?.[locale]).forEach((raw) => out.push(normalizeInvestment(raw, section)));
    }
  } else if (kind === "trends") {
    pick(body?.trends?.[locale]).forEach((raw) => out.push(normalizeTrend(raw)));
  }
  return out;
}

function coverageFor(kind, body) {
  const codes = new Set();
  if (kind === "tech" || kind === "tips" || kind === "videos") {
    localeList(body).forEach((c) => codes.add(c));
  } else {
    for (const [, byLocale] of sectionEntries(body)) {
      localeList(byLocale).forEach((c) => codes.add(c));
    }
  }
  return codes;
}

/* ═══════════════ data loading ═══════════════ */
async function loadWeeks(force = false) {
  try {
    const env = await callFetchWeeks(force);
    state.weeks = env.body?.weeks ?? [];
    return env;
  } catch (err) {
    const info = errorInfo(err);
    state.weeks = [];
    throw Object.assign(new Error(info.message), info);
  }
}

function resolvePeriod() {
  const weeks = state.weeks ?? [];
  const knownIds = new Set(weeks.flatMap((w) => [w.id, ...(w.days ?? []).map((d) => d.id)]));

  // deep-linked period wins, as long as the archive still lists it
  if (state.requestedPeriod && knownIds.has(state.requestedPeriod)) {
    state.period = state.requestedPeriod;
    state.periodType = weeks.some((w) => w.id === state.requestedPeriod) ? "week" : "day";
    return state.period;
  }
  state.requestedPeriod = null;

  const currentWeek = weeks.find((w) => w.current) ?? weeks[0];
  if (!currentWeek) {
    // fallback when /api/weeks is unreachable
    state.periodType = "day";
    state.period = new Date().toISOString().slice(0, 10);
    return state.period;
  }
  const days = currentWeek.days ?? [];
  const latestDay = days.find((d) => d.current) ?? days[days.length - 1];
  if (state.periodType === "week") {
    state.period = currentWeek.id;
  } else {
    state.period = state.period && dayBelongsToWeek(state.period, currentWeek) ? state.period : latestDay?.id ?? currentWeek.id;
  }
  return state.period;
}

function dayBelongsToWeek(dayId, week) {
  return (week.days ?? []).some((d) => d.id === dayId);
}

async function loadFeeds(force = false) {
  if (!state.period) resolvePeriod();
  const kinds = state.kind === "all" ? FEEDS.map((f) => f.kind) : [state.kind];
  state.loading = true;
  renderStatus();

  const results = await Promise.allSettled(
    kinds.map(async (kind) => {
      const env = await callFetchFeed(kind, state.period, force);
      state.feeds.set(kind, { env, items: null, error: null });
      state.localeCoverage.set(kind, coverageFor(kind, env.body));
      return env;
    })
  );

  results.forEach((result, index) => {
    const kind = kinds[index];
    if (result.status === "rejected") {
      const info = errorInfo(result.reason);
      state.feeds.set(kind, { env: null, items: null, error: info });
      state.localeCoverage.set(kind, new Set());
    }
  });

  if (force) {
    state.latencyHistory.push(
      Math.round([...results].reduce((acc, r) => acc + (r.status === "fulfilled" ? r.value.latency_ms : 0), 0) /
        Math.max(1, results.filter((r) => r.status === "fulfilled").length))
    );
    if (state.latencyHistory.length > 24) state.latencyHistory.shift();
  }

  state.loading = false;
  state.page = 1;
  reprojectFeeds();
  renderAll();
}

function reprojectFeeds() {
  for (const [kind, entry] of state.feeds) {
    if (!entry.env) {
      entry.items = null;
      continue;
    }
    entry.items = normalizeFeed(kind, entry.env.body, state.locale);
  }
}

function currentItems() {
  const kinds = state.kind === "all" ? FEEDS.map((f) => f.kind) : [state.kind];
  let items = [];
  for (const kind of kinds) {
    const entry = state.feeds.get(kind);
    if (entry?.items) items = items.concat(entry.items);
  }
  if (state.query.trim()) {
    const q = state.query.trim().toLowerCase();
    items = items.filter((item) =>
      [item.title, item.body, item.source, item.category, (item.tags || []).join(" "), item.path]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  const sorted = items.slice();
  if (state.sort === "recent") {
    sorted.sort((a, b) => (parseTimestamp(b.time) ?? 0) - (parseTimestamp(a.time) ?? 0) || impactRank(a.impact) - impactRank(b.impact));
  } else {
    sorted.sort((a, b) => impactRank(a.impact) - impactRank(b.impact) || (parseTimestamp(b.time) ?? 0) - (parseTimestamp(a.time) ?? 0));
  }
  return sorted;
}

function activeEnvelope() {
  const kinds = state.kind === "all" ? FEEDS.map((f) => f.kind) : [state.kind];
  const envs = kinds.map((k) => state.feeds.get(k)?.env).filter(Boolean);
  if (envs.length === 1) return envs[0];
  if (envs.length === 0) return null;
  const merged = {};
  for (const env of envs) {
    for (const [key, value] of Object.entries(env.body)) {
      if (value && typeof value === "object") merged[key] = value;
    }
  }
  return {
    url: envs.map((e) => e.url).join("  ·  "),
    body: merged,
    latency_ms: Math.round(envs.reduce((a, e) => a + e.latency_ms, 0) / envs.length),
    bytes: envs.reduce((a, e) => a + e.bytes, 0),
    cache_age_ms: Math.min(...envs.map((e) => e.cache_age_ms)),
    cached: envs.every((e) => e.cached),
    status: 200,
  };
}

/* ═══════════════ renderers ═══════════════ */
function renderAll() {
  renderPeriodLabels();
  renderLangSwitch();
  renderKindChips();
  renderHero();
  renderStream();
  renderDock();
  renderArchive();
  renderStatus();
  syncHash();
}

function renderPeriodLabels() {
  const week = (state.weeks ?? []).find((w) => w.id === state.period);
  const days = (state.weeks ?? []).flatMap((w) => w.days ?? []);
  const day = days.find((d) => d.id === state.period);
  $("label-period-day").textContent = `Daily: ${day?.id ?? state.period ?? "—"}`;
  $("label-period-week").textContent = `Week: ${week?.id ?? (state.periodType === "week" ? state.period : "—")}`;
  $("btn-period-day").classList.toggle("active", state.periodType === "day");
  $("btn-period-week").classList.toggle("active", state.periodType === "week");
  $("period-id").textContent = state.period ?? "—";
}

function renderLangSwitch() {
  const host = $("lang-switch");
  host.replaceChildren();
  const kinds = state.kind === "all" ? FEEDS.map((f) => f.kind) : [state.kind];
  for (const locale of LOCALES) {
    const covered = kinds.every((kind) => (state.localeCoverage.get(kind)?.size ?? 0) === 0 || state.localeCoverage.get(kind)?.has(locale.code));
    const btn = el("button", `lang-btn${locale.code === state.locale ? " active" : ""}`, locale.label);
    if (!covered) btn.classList.add("missing");
    btn.title = covered ? `Locale ${locale.code.toUpperCase()}` : `No ${locale.code.toUpperCase()} translation in this payload`;
    btn.addEventListener("click", () => {
      if (state.locale === locale.code) return;
      state.locale = locale.code;
      reprojectFeeds();
      state.page = 1;
      renderAll();
    });
    host.appendChild(btn);
  }
}

function renderKindChips() {
  const host = $("kind-chips");
  host.replaceChildren();

  const allPill = el("button", `cat-pill${state.kind === "all" ? " active" : ""}`);
  const allDot = el("span", "dot");
  allDot.style.background = "#e0fdff";
  allPill.appendChild(allDot);
  const allCount = [...state.feeds.values()].reduce((acc, e) => acc + (e.items?.length ?? 0), 0);
  allPill.append(document.createTextNode("All Feeds"));
  allPill.append(el("span", "count", `(${allCount})`));
  allPill.addEventListener("click", () => selectKind("all"));
  host.appendChild(allPill);

  for (const feed of FEEDS) {
    const entry = state.feeds.get(feed.kind);
    const pill = el("button", `cat-pill${state.kind === feed.kind ? " active" : ""}`);
    if (entry?.error) pill.classList.add("is-error");
    const dot = el("span", "dot");
    dot.style.background = feed.color;
    pill.appendChild(dot);
    pill.append(document.createTextNode(feed.label));
    const count = entry?.error ? "!" : `(${entry?.items?.length ?? 0})`;
    pill.appendChild(el("span", "count", count));
    pill.title = entry?.error ? `${feed.endpoint} → ${entry.error.message}` : `${feed.endpoint}/{periodId}`;
    pill.addEventListener("click", () => selectKind(feed.kind));
    host.appendChild(pill);
  }
}

function selectKind(kind) {
  if (state.kind === kind) return;
  state.kind = kind;
  state.page = 1;
  renderKindChips();
  renderLangSwitch();
  renderHero();
  renderStream();
  renderDock();
  renderStatus();
  if (!state.feeds.has(kind)) loadFeeds(false);
}

function impactBadge(impact, derived) {
  const badge = el("span", `badge badge--impact-${impact}`);
  badge.appendChild(el("span", "dot"));
  badge.append(document.createTextNode(impact.toUpperCase()));
  if (derived) badge.title = "Impact derived client-side — this endpoint does not ship an impact field";
  return badge;
}

function renderHero() {
  const host = $("hero-body");
  const items = currentItems();
  const top = items[0];

  if (!top) {
    const loading = state.loading;
    host.replaceChildren();
    const wrap = el("div", loading ? "hero-grid" : "");
    const left = el("div", "hero-body");
    if (loading) {
      for (const [w, h] of [["w-40", ""], ["w-90 h-lg", ""], ["w-70", ""]]) {
        const s = el("div", `skeleton-line ${w} ${h}`.trim());
        left.appendChild(s);
      }
    } else {
      const empty = el("div", "empty-state");
      empty.appendChild(el("span", "material-symbols-outlined", "signal_cellular_off"));
      empty.appendChild(
        el("h3", null, state.periodType === "week" ? "No weekly digest published for this period" : "No signals available")
      );
      const p = el("p");
      if (state.periodType === "week") {
        p.innerHTML = `<code>${esc(state.period)}</code> returned an empty payload from every feed. Weekly digests are advertised by the API but not populated yet — daily snapshots are.`;
      } else {
        p.innerHTML = `The API returned an empty payload for <code>${esc(state.period)}</code>. Upstream publishes new data every evening at 23:00 CET — pick another day from the archive below.`;
      }
      empty.appendChild(p);
      if (state.periodType === "week") {
        const toDaily = el("button", "btn btn--primary", "Switch to the latest published day");
        toDaily.addEventListener("click", () => $("btn-period-day").click());
        empty.appendChild(toDaily);
      }
      left.appendChild(empty);
    }
    wrap.appendChild(left);
    host.replaceChildren(wrap);
    return;
  }

  const left = el("div", "hero-body");

  // meta row
  const meta = el("div", "hero-meta");
  meta.appendChild(top.feed === "trends" ? momentumBadge(top) : impactBadge(top.impact, top.impactDerived));
  const sourceBadge = el("span", "badge badge--source", top.source);
  meta.appendChild(sourceBadge);
  if (top.time) {
    const time = el("span", "mono dim", `${absoluteTime(top.time)} (${relativeTime(top.time)})`);
    time.style.fontSize = "10px";
    meta.appendChild(time);
  } else {
    const undated = el("span", "mono dim", "no timestamp in payload");
    undated.style.fontSize = "10px";
    meta.appendChild(undated);
  }
  meta.appendChild(el("span", "badge badge--tag-cyan", `#${top.category}`));
  for (const tag of (top.tags || []).slice(0, 2)) meta.appendChild(el("span", "badge badge--tag-violet", `#${tag}`));
  left.appendChild(meta);

  // headline + deck
  const headline = el("div");
  headline.style.display = "flex";
  headline.style.flexDirection = "column";
  headline.style.gap = "var(--space-xs)";
  headline.appendChild(el("h2", "hero-title", top.title));
  if (top.body) headline.appendChild(el("p", "hero-deck", top.body));
  left.appendChild(headline);

  // takeaways: derive concrete facts from the top signal
  const takeaways = el("div", "takeaways");
  const facts = heroFacts(top);
  for (const fact of facts) {
    const box = el("div", "takeaway");
    box.appendChild(el("span", "takeaway-label", fact.label));
    box.appendChild(el("span", "takeaway-value", fact.value));
    takeaways.appendChild(box);
  }
  left.appendChild(takeaways);

  // actions
  const actions = el("div", "hero-actions");
  const jsonBtn = el("button", "btn btn--primary");
  jsonBtn.appendChild(el("span", "material-symbols-outlined xs", "data_object"));
  jsonBtn.append(document.createTextNode("View Raw JSON"));
  jsonBtn.addEventListener("click", toggleJsonDrawer);
  actions.appendChild(jsonBtn);

  if (top.sourceUrl) {
    const link = el("button", "btn btn--ghost");
    link.appendChild(el("span", "material-symbols-outlined xs", "open_in_new"));
    link.append(document.createTextNode("Source Publication"));
    link.addEventListener("click", () => openExternal(top.sourceUrl));
    actions.appendChild(link);
  }
  const copyItem = el("button", "btn btn--ghost");
  copyItem.appendChild(el("span", "material-symbols-outlined xs", "content_copy"));
  copyItem.append(document.createTextNode("Copy Signal JSON"));
  copyItem.addEventListener("click", () => copyText(JSON.stringify(top, null, 2), "Signal"));
  actions.appendChild(copyItem);
  left.appendChild(actions);

  const right = el("div", "hero-aside");
  if (top.extra?.thumbnail) {
    const visual = el("div", "hero-visual");
    const img = el("img");
    img.src = top.extra.thumbnail;
    img.alt = top.title;
    img.loading = "lazy";
    visual.appendChild(img);
    const caption = el("div", "hero-visual-caption");
    caption.appendChild(el("span", "cyan", `SIGNAL // ${top.feed.toUpperCase()}`));
    caption.appendChild(el("span", "sky", top.extra.duration ? `RT ${top.extra.duration}` : `#${top.category}`));
    visual.appendChild(caption);
    right.appendChild(visual);
  }

  // latency metric with real sparkline
  const env = activeEnvelope();
  const metric = el("div", "hero-metric");
  const metricLeft = el("div");
  metricLeft.style.display = "flex";
  metricLeft.style.flexDirection = "column";
  metricLeft.appendChild(el("span", "hero-metric-label", "API Latency"));
  metricLeft.appendChild(el("span", "hero-metric-value cyan", env ? `${env.latency_ms} ms` : "—"));
  metric.appendChild(metricLeft);
  if (state.latencyHistory.length > 1) metric.appendChild(sparkline());
  right.appendChild(metric);

  const payload = el("div", "hero-metric");
  const payloadLeft = el("div");
  payloadLeft.style.display = "flex";
  payloadLeft.style.flexDirection = "column";
  payloadLeft.appendChild(el("span", "hero-metric-label", "Payload Size"));
  payloadLeft.appendChild(el("span", "hero-metric-value green", env ? formatBytes(env.bytes) : "—"));
  payload.appendChild(payloadLeft);
  payload.appendChild(el("span", "mono dim", `${env?.cached ? "cached" : "fresh"}`));
  right.appendChild(payload);

  const coverage = el("div", "hero-metric");
  const coverageLeft = el("div");
  coverageLeft.style.display = "flex";
  coverageLeft.style.flexDirection = "column";
  coverageLeft.appendChild(el("span", "hero-metric-label", "Locales Ready"));
  coverageLeft.appendChild(el("span", "hero-metric-value violet", `${localeCoverageCount()}/8`));
  coverage.appendChild(coverageLeft);
  coverage.appendChild(el("span", "mono dim", state.locale.toUpperCase()));
  right.appendChild(coverage);

  const grid = el("div", "hero-grid");
  grid.appendChild(left);
  grid.appendChild(right);
  host.replaceChildren(grid);
}

function localeCoverageCount() {
  const kinds = state.kind === "all" ? FEEDS.map((f) => f.kind) : [state.kind];
  return LOCALES.filter((l) => kinds.every((k) => state.localeCoverage.get(k)?.has(l.code))).length;
}

function heroFacts(item) {
  const facts = [];
  if (item.feed === "investment") {
    if (item.extra.amount) facts.push({ label: "Deal Size", value: item.extra.amount });
    if (item.extra.round) facts.push({ label: "Round / Type", value: item.extra.round });
    if (item.extra.valuation) facts.push({ label: "Valuation", value: item.extra.valuation });
    if (item.extra.investors?.length) facts.push({ label: "Lead Syndicate", value: item.extra.investors.slice(0, 4).join(", ") });
    if (item.extra.acquirer || item.extra.target) {
      facts.push({ label: "Parties", value: [item.extra.acquirer, item.extra.target].filter(Boolean).join(" → ") });
    }
  } else if (item.feed === "videos") {
    facts.push({ label: "Runtime", value: item.extra.duration });
    facts.push({ label: "Channel", value: item.source });
    facts.push({ label: "Views", value: formatCount(item.extra.viewCount) });
    facts.push({ label: "Likes", value: formatCount(item.extra.likeCount) });
  } else if (item.feed === "trends") {
    facts.push({ label: "Momentum", value: item.extra.momentum });
    facts.push({ label: "Day Streak", value: `${item.extra.streak}` });
    facts.push({ label: "Category", value: item.category });
  } else if (item.feed === "tips") {
    facts.push({ label: "Platform", value: item.extra.platform });
    facts.push({ label: "Difficulty", value: item.extra.difficulty });
    facts.push({ label: "Upvotes", value: formatCount(item.extra.likes) });
  } else {
    facts.push({ label: "Source", value: item.source });
    facts.push({ label: "Category", value: item.category });
    if (item.extra.videoViews) facts.push({ label: "Video Views", value: formatCount(item.extra.videoViews) });
    facts.push({ label: "Impact", value: item.impactDerived ? `${item.impact} (derived)` : item.impact });
  }
  if (facts.length === 0) facts.push({ label: "Signal", value: item.feed });
  return facts.slice(0, 3);
}

function sparkline() {
  const data = state.latencyHistory.slice(-24);
  const w = 120;
  const h = 34;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = Math.max(1, max - min);
  const points = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "sparkline");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("preserveAspectRatio", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${points.join(" L ")}`);
  svg.appendChild(path);
  const last = points[points.length - 1]?.split(",");
  if (last) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", last[0]);
    circle.setAttribute("cy", last[1]);
    circle.setAttribute("r", "3");
    svg.appendChild(circle);
  }
  return svg;
}

function renderStream() {
  const grid = $("feed-grid");
  grid.replaceChildren();
  const items = currentItems();
  const errors = (state.kind === "all" ? FEEDS.map((f) => f.kind) : [state.kind])
    .map((k) => state.feeds.get(k))
    .filter((e) => e?.error);

  $("stream-count").textContent = `${items.length} signal${items.length === 1 ? "" : "s"} · ${state.period ?? "—"} · [${state.locale.toUpperCase()}]`;

  if (state.loading && !items.length) {
    for (let i = 0; i < 6; i += 1) {
      const card = el("div", "skeleton-card");
      card.appendChild(el("div", "skeleton-line w-40"));
      card.appendChild(el("div", "skeleton-line w-90 h-lg"));
      card.appendChild(el("div", "skeleton-line w-70"));
      grid.appendChild(card);
    }
    return;
  }

  if (!items.length) {
    const empty = el("div", "empty-state");
    empty.appendChild(el("span", "material-symbols-outlined", "signal_cellular_off"));
    empty.appendChild(el("h3", null, state.periodType === "week" ? "No weekly digest published for this period" : "No signals match this query"));
    const p = el("p");
    if (errors.length) {
      const info = errors[0].error;
      p.innerHTML = `Upstream request failed — <code>${esc(info.status || "network")}</code> ${esc(info.message)}`;
    } else if (state.periodType === "week") {
      p.innerHTML = `<code>${esc(state.period)}</code> came back empty from every feed. Weekly digests are advertised by the API but not populated yet — daily snapshots are, so switch to a day to keep reading.`;
    } else if (state.query) {
      p.textContent = `Nothing in the current payload matches “${state.query}”. The API returns a fixed daily snapshot — try a broader term or another period.`;
    } else {
      p.innerHTML = `The API returned no records for <code>${esc(state.period)}</code> on this feed.`;
    }
    empty.appendChild(p);

    if (errors.length) {
      const retry = el("button", "btn btn--primary", "Retry request");
      retry.addEventListener("click", () => refresh(true));
      empty.appendChild(retry);
    } else if (state.periodType === "week") {
      const toDaily = el("button", "btn btn--primary", "Switch to the latest published day");
      toDaily.addEventListener("click", () => $("btn-period-day").click());
      empty.appendChild(toDaily);
    } else {
      const archive = el("button", "btn btn--primary", "Open period archive");
      archive.addEventListener("click", () => {
        $("archive-flyout").hidden = false;
        $("archive-flyout").scrollIntoView({ block: "nearest" });
      });
      empty.appendChild(archive);
    }
    grid.appendChild(empty);
    return;
  }

  const totalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(items.length / PAGE_SIZE)));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const slice = items.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  slice.forEach((item) => grid.appendChild(renderCard(item)));

  $("pager-label").textContent = `Page ${state.page} of ${totalPages} • ${items.length} records synced for ${state.period}`;
  $("btn-prev").disabled = state.page <= 1;
  $("btn-next").disabled = state.page >= totalPages;
}

function renderCard(item) {
  const card = el("article", "card");
  card.style.setProperty("--kind-color", colorOf(item.feed));

  // head: source + relative time + impact
  const head = el("div", "card-head");
  const src = el("div", "card-source");
  src.appendChild(el("span", "name", item.source));
  src.appendChild(el("span", null, "•"));
  src.appendChild(el("span", null, item.time ? relativeTime(item.time) : item.extra?.momentum ?? "live"));
  head.appendChild(src);
  head.appendChild(item.feed === "trends" ? momentumBadge(item) : impactBadge(item.impact, item.impactDerived));
  card.appendChild(head);

  // media for videos
  if (item.feed === "videos" && item.extra.thumbnail) {
    const media = el("div", "card-media");
    const img = el("img", "card-thumbnail");
    img.src = item.extra.thumbnail;
    img.alt = item.title;
    img.loading = "lazy";
    media.appendChild(img);
    media.appendChild(el("span", "badge badge--duration", `▶ ${item.extra.duration}`));
    media.appendChild(el("span", "badge badge--views", `${formatCount(item.extra.viewCount)} views`));
    card.appendChild(media);
  }

  card.appendChild(el("h3", "card-title", item.title));
  if (item.body) card.appendChild(el("p", "card-body", item.body));

  // feed specific detail blocks
  if (item.feed === "investment") card.appendChild(investmentStats(item));
  if (item.feed === "trends") card.appendChild(trendStats(item));
  if (item.feed === "tips") card.appendChild(tipStats(item));
  if (item.feed === "videos") card.appendChild(videoStats(item));

  if (item.tags?.length) {
    const tags = el("div", "card-tags");
    for (const tag of item.tags.slice(0, 4)) tags.appendChild(el("span", "badge badge--tag", tag));
    card.appendChild(tags);
  }

  // foot: path + action
  const foot = el("div", "card-foot");
  foot.appendChild(el("span", "card-path", item.path));
  if (item.sourceUrl) {
    const link = el("button", "card-link");
    link.append(document.createTextNode(item.feed === "videos" ? "WATCH" : "READ"));
    link.appendChild(el("span", "material-symbols-outlined xs", "arrow_forward"));
    link.addEventListener("click", () => openExternal(item.sourceUrl));
    foot.appendChild(link);
  } else {
    foot.appendChild(el("span", "card-link dim", "NO LINK"));
  }
  card.appendChild(foot);
  return card;
}

function momentumBadge(item) {
  const badge = el("span", "badge badge--momentum");
  const icon = el("span", "material-symbols-outlined xs", item.extra.momentum === "rising" ? "trending_up" : "bolt");
  badge.appendChild(icon);
  badge.append(document.createTextNode(`${item.extra.momentum.toUpperCase()} · ${item.extra.streak}d`));
  return badge;
}

function investmentStats(item) {
  const box = el("div", "card-stats");
  const rows = [];
  if (item.extra.amount) rows.push(["Deal Size", item.extra.amount]);
  if (item.extra.round) rows.push(["Round", item.extra.round]);
  if (item.extra.valuation) rows.push(["Valuation", item.extra.valuation]);
  if (item.extra.investors?.length) rows.push(["Investors", item.extra.investors.slice(0, 5).join(", ")]);
  rows.push(["Book", item.extra.section]);
  for (const [k, v] of rows) {
    const row = el("div", "stat-row");
    row.appendChild(el("span", "k", k));
    row.appendChild(el("span", "v", String(v)));
    box.appendChild(row);
  }
  return box;
}

function tipStats(item) {
  const box = el("div", "card-stats");
  const rows = [
    ["Platform", item.extra.platform],
    ["Difficulty", item.extra.difficulty],
    ["Upvotes", formatCount(item.extra.likes)],
    ["Comments", formatCount(item.extra.comments)],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");
  for (const [k, v] of rows) {
    const row = el("div", "stat-row");
    row.appendChild(el("span", "k", k));
    row.appendChild(el("span", "v", String(v)));
    box.appendChild(row);
  }
  return box;
}

function trendStats(item) {
  const box = el("div", "card-stats");
  const row = el("div", "stat-row");
  row.appendChild(el("span", "k", "Sustained days"));
  row.appendChild(el("span", "v", `${item.extra.streak}`));
  box.appendChild(row);
  const meter = el("div", "meter");
  const fill = el("i");
  fill.style.width = `${Math.min(100, 12 + item.extra.streak * 22)}%`;
  meter.appendChild(fill);
  box.appendChild(meter);
  return box;
}

function videoStats(item) {
  const box = el("div", "card-stats");
  const row = el("div", "stat-row");
  row.appendChild(el("span", "k", "Engagement"));
  row.appendChild(el("span", "v", `${formatCount(item.extra.viewCount)} views · ${formatCount(item.extra.likeCount)} likes`));
  box.appendChild(row);
  const bar = el("div", "meter");
  const fill = el("i");
  const top = Math.max(Number(item.extra.viewCount) || 0, 1);
  fill.style.width = "100%";
  fill.style.opacity = "0.9";
  bar.appendChild(fill);
  box.appendChild(bar);
  void top;
  return box;
}

function renderDock() {
  const env = activeEnvelope();
  const kinds = state.kind === "all" ? FEEDS.map((f) => f.kind) : [state.kind];
  const errored = kinds.map((k) => state.feeds.get(k)).find((e) => e?.error);

  const status = $("sandbox-status");
  if (state.loading) {
    status.textContent = "HTTP —";
    status.className = "status-badge busy";
  } else if (errored) {
    status.textContent = `HTTP ${errored.error.status || "ERR"}`;
    status.className = "status-badge err";
  } else if (env) {
    status.textContent = `HTTP ${env.status} OK`;
    status.className = "status-badge ok";
  } else {
    status.textContent = "HTTP —";
    status.className = "status-badge";
  }

  $("metric-latency").textContent = env ? `${env.latency_ms} ms` : "—";
  $("metric-bytes").textContent = env ? formatBytes(env.bytes) : "—";
  $("metric-cache").textContent = env ? (env.cached ? `${Math.round(env.cache_age_ms / 1000)}s ago` : "fresh") : "—";
  $("metric-status").textContent = env ? env.status : "—";

  renderCodeBlock(env);
  renderSources();
  renderEditorial();

  if (env) {
    const sources = new Set();
    for (const kind of kinds) (state.feeds.get(kind)?.items ?? []).forEach((i) => sources.add(i.source));
    $("sources-chip").textContent = `${sources.size || "35+"} SOURCES LIVE`;
    $("sources-chip").className = "chip chip--ok mono";
  }
}

function codeSamples(env) {
  const kinds = state.kind === "all" ? FEEDS.map((f) => f.kind) : [state.kind];
  const target = kinds.length === 1 ? `${API_BASE}${FEED_BY_KIND[kinds[0]].endpoint}/${state.period}` : `${API_BASE}/api/{tech|investment|tips|videos|trends}/${state.period}`;
  const url = `${API_BASE}${FEED_BY_KIND[kinds[0]].endpoint}/${state.period}`;
  return {
    curl: `curl -s "${url}" | jq '.${state.locale}[0]'`,
    python: `import json, urllib.request\n\nwith urllib.request.urlopen("${url}") as r:\n    data = json.load(r)\n\nfor item in data["${state.locale}"]:\n    print(item["content"])`,
    node: `const res = await fetch("${url}");\nconst data = await res.json();\n\nfor (const item of data.${state.locale}) {\n  console.log(item.content);\n}`,
    target,
  };
}

function renderCodeBlock(env) {
  const samples = codeSamples(env);
  $("code-block").textContent = samples[state.codeTab] ?? samples.curl;
}

function renderSources() {
  const host = $("source-list");
  host.replaceChildren();
  const items = currentItems();
  const counts = new Map();
  for (const item of items) {
    const key = item.source || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);

  $("source-count").textContent = `${counts.size} distinct · ${items.length} records`;

  if (!sorted.length) {
    const empty = el("p", "panel-copy mono", "No source metadata in the current payload.");
    host.appendChild(empty);
    return;
  }
  for (const [name, count] of sorted) {
    const row = el("div", "source-row");
    const left = el("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "8px";
    left.style.minWidth = "0";
    const dot = el("span", "dot");
    dot.style.background = "var(--impact-low)";
    left.appendChild(dot);
    left.appendChild(el("span", "name", name));
    row.appendChild(left);
    row.appendChild(el("span", "count", `${count}`));
    host.appendChild(row);
  }
}

function renderEditorial() {
  const panel = $("editorial-panel");
  const host = $("editorial-list");
  host.replaceChildren();
  const entry = state.feeds.get("trends");
  const raw = entry?.env?.body;
  const notes = Array.isArray(raw?.teamMembers?.[state.locale]) ? raw.teamMembers[state.locale] : [];
  if (!notes.length) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  $("editorial-locale").textContent = state.locale.toUpperCase();
  for (const note of notes) {
    const item = el("div", "editorial-item");
    item.appendChild(el("div", "topic", note.topic || "Analysis"));
    item.appendChild(el("p", null, note.text || ""));
    host.appendChild(item);
  }
}

function renderStatus() {
  const pill = $("endpoint-pill");
  const dot = pill.querySelector(".pulse-dot");
  const kinds = state.kind === "all" ? "…" : FEED_BY_KIND[state.kind]?.endpoint ?? "";
  $("endpoint-label").textContent = state.loading ? `FETCHING: GET ${kinds}/{periodId}` : `ENDPOINT: GET ${kinds}/{periodId}`;

  dot.classList.toggle("is-busy", state.loading);
  const errored = [...state.feeds.values()].some((e) => e?.error);
  dot.classList.toggle("is-error", !state.loading && errored);

  const erroredFeed = [...state.feeds.entries()].find(([, e]) => e?.error);
  const chip = $("telemetry-chip");
  if (state.loading) {
    $("telemetry-text").textContent = "requesting…";
    chip.className = "chip chip--ghost chip--loading";
  } else if (erroredFeed) {
    $("telemetry-text").textContent = `HTTP ${erroredFeed[1].error.status || "NET"} · ${erroredFeed[0]}`;
    chip.className = "chip chip--ghost chip--err";
  } else {
    $("telemetry-text").textContent = `${state.period ?? "—"} · ${state.locale.toUpperCase()} · ${currentItems().length} records`;
    chip.className = "chip chip--ghost";
  }
}

function renderArchive() {
  const host = $("archive-body");
  host.replaceChildren();
  const weeks = state.weeks ?? [];
  if (!weeks.length) {
    host.appendChild(el("p", "panel-copy mono", "Period archive unavailable — /api/weeks could not be read."));
    return;
  }
  for (const week of weeks.slice(0, 16)) {
    const box = el("div", "archive-week");
    const head = el("div", "archive-week-head");
    head.appendChild(el("span", "mono", week.id));
    head.appendChild(el("span", "range", week.dateRange ?? ""));
    box.appendChild(head);

    const days = el("div", "archive-days");
    for (const day of week.days ?? []) {
      const btn = el("button", `archive-day${day.id === state.period ? " active" : ""}`, day.label);
      btn.title = day.id;
      btn.addEventListener("click", async () => {
        state.periodType = "day";
        state.period = day.id;
        state.requestedPeriod = null;
        state.page = 1;
        $("archive-flyout").hidden = true;
        state.feeds.clear();
        state.localeCoverage.clear();
        renderPeriodLabels();
        await loadFeeds(false);
      });
      days.appendChild(btn);
    }
    box.appendChild(days);

    const weekBtn = el("button", `archive-week-btn${week.id === state.period ? " active" : ""}`, `▸ load whole week (${(week.days ?? []).length} days)`);
    weekBtn.addEventListener("click", async () => {
      state.periodType = "week";
      state.period = week.id;
      state.requestedPeriod = null;
      state.page = 1;
      $("archive-flyout").hidden = true;
      state.feeds.clear();
      state.localeCoverage.clear();
      renderPeriodLabels();
      await loadFeeds(false);
    });
    box.appendChild(weekBtn);
    host.appendChild(box);
  }
}

function renderLiveCountdown() {
  const node = $("live-countdown");
  if (!state.live) {
    node.textContent = "· paused";
    return;
  }
  const remaining = Math.max(0, state.nextRefreshAt - Date.now());
  const secs = Math.round(remaining / 1000);
  node.textContent = `· ${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

function toggleJsonDrawer() {
  const drawer = $("json-drawer");
  const env = activeEnvelope();
  if (drawer.hidden) {
    if (!env) {
      toast("no payload loaded yet");
      return;
    }
    $("drawer-url").textContent = env.url;
    $("json-body").textContent = JSON.stringify(env.body, null, 2);
    drawer.hidden = false;
    drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } else {
    drawer.hidden = true;
  }
}

async function openExternal(url) {
  if (!url) return;
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

async function refresh(force = false) {
  if (state.loading) return;
  state.nextRefreshAt = Date.now() + LIVE_INTERVAL_MS;
  try {
    if (force) await invoke("invalidate_cache");
    resolvePeriod();
    await loadFeeds(force);
    if (force) await loadWeeks(true);
    toast(force ? "refetched from upstream" : "cache revalidated");
  } catch (err) {
    const info = errorInfo(err);
    toast(`request failed: ${info.message}`);
    state.loading = false;
    renderAll();
  }
}

function setupLiveStream() {
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (!state.live || state.loading) {
      renderLiveCountdown();
      return;
    }
    if (Date.now() >= state.nextRefreshAt) {
      state.nextRefreshAt = Date.now() + LIVE_INTERVAL_MS;
      loadFeeds(true).catch(() => {});
    }
    renderLiveCountdown();
  }, 1000);
  renderLiveCountdown();
}

/* ═══════════════ exports ═══════════════ */
function visibleItems() {
  return currentItems();
}

function exportJson() {
  const items = visibleItems();
  download(`datacube-news-${state.period}-${state.locale}.json`, "application/json", JSON.stringify({ period: state.period, locale: state.locale, feed: state.kind, count: items.length, items }, null, 2));
}

function exportCsv() {
  const items = visibleItems();
  const headers = ["feed", "impact", "impact_derived", "source", "category", "title", "timestamp", "url"];
  const esc_ = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = items.map((i) => [i.feed, i.impact, i.impactDerived, i.source, i.category, i.title, i.time, i.sourceUrl].map(esc_).join(","));
  download(`datacube-news-${state.period}-${state.locale}.csv`, "text/csv", [headers.join(","), ...rows].join("\n"));
}

function exportMarkdown() {
  const items = visibleItems();
  const lines = [
    `# Data Cube AI News — ${state.period} (${state.locale.toUpperCase()})`,
    "",
    `> ${items.length} records from ${API_BASE}/api · feed: ${state.kind}`,
    "",
  ];
  for (const item of items) {
    lines.push(`## ${item.title}`);
    lines.push(`\`${item.feed}\` · ${item.source} · \`${item.impact}\` · ${item.time ?? "no timestamp"}`);
    if (item.body) lines.push("", item.body);
    if (item.sourceUrl) lines.push("", `[Source](${item.sourceUrl})`);
    lines.push("");
  }
  download(`datacube-news-${state.period}-${state.locale}.md`, "text/markdown", lines.join("\n"));
}

/* ═══════════════ wiring ═══════════════ */
function wire() {
  $("btn-period-day").addEventListener("click", async () => {
    if (state.periodType === "day") return;
    state.periodType = "day";
    state.page = 1;
    resolvePeriod();
    state.feeds.clear();
    state.localeCoverage.clear();
    renderPeriodLabels();
    await loadFeeds(false);
  });

  $("btn-period-week").addEventListener("click", async () => {
    if (state.periodType === "week") return;
    state.periodType = "week";
    state.page = 1;
    resolvePeriod();
    state.feeds.clear();
    state.localeCoverage.clear();
    renderPeriodLabels();
    await loadFeeds(false);
  });

  $("btn-archive").addEventListener("click", () => {
    const flyout = $("archive-flyout");
    flyout.hidden = !flyout.hidden;
  });
  $("btn-close-archive").addEventListener("click", () => ($("archive-flyout").hidden = true));

  document.querySelectorAll(".sort-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.sort = btn.dataset.sort;
      state.page = 1;
      document.querySelectorAll(".sort-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderStream();
    })
  );

  let searchTimer = null;
  $("search-input").addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = event.target.value;
      state.page = 1;
      renderStream();
      renderHero();
      renderSources();
    }, 140);
  });

  $("btn-refresh").addEventListener("click", () => refresh(true));

  $("btn-live").addEventListener("click", () => {
    state.live = !state.live;
    $("btn-live").classList.toggle("active", state.live);
    $("live-label").textContent = `Live Stream: ${state.live ? "ON" : "OFF"}`;
    state.nextRefreshAt = Date.now() + LIVE_INTERVAL_MS;
    renderLiveCountdown();
  });

  $("btn-prev").addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      renderStream();
    }
  });
  $("btn-next").addEventListener("click", () => {
    state.page += 1;
    renderStream();
  });

  $("btn-copy-code").addEventListener("click", () => copyText($("code-block").textContent, "Snippet"));
  $("btn-copy-json").addEventListener("click", () => {
    const env = activeEnvelope();
    if (env) copyText(JSON.stringify(env.body, null, 2), "Payload");
  });
  $("btn-close-json").addEventListener("click", () => ($("json-drawer").hidden = true));

  $("code-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest(".code-tab");
    if (!tab) return;
    state.codeTab = tab.dataset.tab;
    document.querySelectorAll(".code-tab").forEach((t) => t.classList.toggle("active", t === tab));
    renderCodeBlock(activeEnvelope());
  });

  $("btn-export-json").addEventListener("click", exportJson);
  $("btn-export-csv").addEventListener("click", exportCsv);
  $("btn-export-md").addEventListener("click", exportMarkdown);
  $("btn-copy-feed").addEventListener("click", () => {
    const kinds = state.kind === "all" ? FEEDS.map((f) => f.kind) : [state.kind];
    copyText(`${API_BASE}${FEED_BY_KIND[kinds[0]].endpoint}/${state.period}`, "Endpoint URL");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      $("archive-flyout").hidden = true;
      $("json-drawer").hidden = true;
    }
    if (event.key === "/" && document.activeElement !== $("search-input")) {
      event.preventDefault();
      $("search-input").focus();
    }
    if (event.key === "r" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      refresh(true);
    }
  });

  document.addEventListener("click", (event) => {
    const flyout = $("archive-flyout");
    if (!flyout.hidden && !flyout.contains(event.target) && event.target !== $("btn-archive")) {
      flyout.hidden = true;
    }
  });
}

function fatal(message, detail) {
  const wrap = el("div", "fatal");
  const card = el("div", "fatal-card");
  card.appendChild(el("h2", null, "Intelligence feed unavailable"));
  card.appendChild(el("p", "panel-copy", message));
  if (detail) {
    const pre = el("pre", null, typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
    card.appendChild(pre);
  }
  const retry = el("button", "btn btn--primary", "Retry");
  retry.addEventListener("click", () => location.reload());
  card.appendChild(retry);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
}

async function boot() {
  if (!window.__TAURI__) {
    fatal(
      "This interface runs inside the Tauri shell. The HTTP proxy commands (fetch_weeks / fetch_feed) are only available in the desktop webview.",
      "Run `npm run dev` (Tauri dev) or install the built application."
    );
    return;
  }

  wire();
  state.requestedPeriod = readHash();
  document.querySelectorAll(".sort-btn").forEach((b) => b.classList.toggle("active", b.dataset.sort === state.sort));

  renderPeriodLabels();
  renderLangSwitch();
  renderKindChips();
  setupLiveStream();

  try {
    await loadWeeks(false);
  } catch (err) {
    const info = errorInfo(err);
    toast(`period archive offline: ${info.message}`);
  }
  resolvePeriod();
  renderPeriodLabels();

  try {
    await loadFeeds(false);
  } catch (err) {
    const info = errorInfo(err);
    fatal("Could not reach the Data Cube AI News API from this machine.", info);
  }

  window.addEventListener("hashchange", async () => {
    const previous = { kind: state.kind, locale: state.locale, period: state.period, sort: state.sort };
    state.requestedPeriod = readHash();
    resolvePeriod();
    const periodChanged = previous.period !== state.period;
    const kindChanged = previous.kind !== state.kind;
    document.querySelectorAll(".sort-btn").forEach((b) => b.classList.toggle("active", b.dataset.sort === state.sort));
    if (periodChanged) {
      state.feeds.clear();
      state.localeCoverage.clear();
    }
    state.page = 1;
    if (periodChanged || kindChanged) await loadFeeds(false);
    else renderAll();
  });
}

boot();
