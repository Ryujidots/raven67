// Raven67 — customer reviews ticker (Reviews tab).
// Loads visible reviews from Supabase (table "reviews") or, in local-only mode,
// from this browser's storage, then renders two scrolling rows that pause on hover/hold.
import * as config from "./supabase-config.js";

const TABLE = config.REVIEWS_TABLE || "reviews";
const LOCAL_KEY = "raven67-local-reviews";
const SPEED = 45;        // pixels per second
const MIN_TICKER = 4;    // fewer reviews than this → cards stay still, no repeats
const TWO_ROWS = 10;     // this many reviews or more → a second row

const rows = [...document.querySelectorAll("[data-review-row]")];
const empty = document.querySelector("#reviews-empty");
const summary = document.querySelector("#reviews-summary");

/* ---------- Name privacy: "agung" → "a**ng" ---------- */
export function maskName(name) {
  return String(name || "").trim().split(/\s+/).filter(Boolean).map((word) => {
    if (word.includes("*")) return word; // already masked
    const c = [...word];
    if (c.length <= 2) return c[0] + "*";
    if (c.length === 3) return c[0] + "*" + c[2];
    return c[0] + "*".repeat(c.length - 3) + c.slice(-2).join("");
  }).join(" ") || "A*****r";
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function stars(rating) {
  const value = Math.max(0, Math.min(5, Number(rating) || 5));
  const wrap = el("span", "review-stars");
  wrap.style.setProperty("--pct", `${(value / 5) * 100}%`);
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", `${value} out of 5 stars`);
  return wrap;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function buildCard(review) {
  const name = maskName(review.display_name);
  const card = el("article", "review-card");

  const top = el("div", "review-top");
  top.append(el("span", "review-avatar", name.charAt(0).toUpperCase()));
  const who = el("div");
  who.append(el("strong", "review-name", name), el("span", "review-meta", review.product_label || "Raven67 customer"));
  top.append(who);

  card.append(el("span", "review-quote-ic", "“"), top, el("p", "review-text", review.message || ""));

  const foot = el("div", "review-foot");
  foot.append(stars(review.rating), el("span", "review-date", formatDate(review.created_at)));
  card.append(foot);
  return card;
}

/* Fill a row. Few reviews: show each once, standing still.
   Enough reviews: repeat until wide enough, then duplicate once so the loop is seamless. */
function fillRow(row, list) {
  const track = row.querySelector(".marquee-track");
  track.replaceChildren();
  if (!list.length) { row.hidden = true; return; }
  row.hidden = false;

  const still = list.length < MIN_TICKER;
  row.classList.toggle("is-static", still);
  if (still) { track.append(...list.map(buildCard)); return; }

  let set = [...list];
  while (set.length < 8) set = set.concat(list);
  const half = set.map(buildCard);
  const copy = set.map((review) => { const card = buildCard(review); card.setAttribute("aria-hidden", "true"); return card; });
  track.append(...half, ...copy);

  requestAnimationFrame(() => setSpeed(track));
}

/* Constant reading speed no matter how many reviews there are.
   Re-measured when the tab becomes visible (hidden rows have no width). */
function setSpeed(track) {
  if (track.parentElement.classList.contains("is-static")) return;
  const distance = track.scrollWidth / 2;
  if (distance > 0) track.style.setProperty("--marquee-duration", `${Math.max(20, distance / SPEED)}s`);
}
window.addEventListener("raven67:tabchange", (event) => {
  if (event.detail?.tab === "reviews") requestAnimationFrame(() => rows.forEach((row) => setSpeed(row.querySelector(".marquee-track"))));
});
window.addEventListener("resize", () => rows.forEach((row) => setSpeed(row.querySelector(".marquee-track"))));

function render(list) {
  const reviews = list.filter((review) => review && review.message);
  empty.hidden = reviews.length > 0;

  if (reviews.length >= TWO_ROWS) {
    fillRow(rows[0], reviews.filter((_, i) => i % 2 === 0));
    fillRow(rows[1], reviews.filter((_, i) => i % 2 === 1));
  } else {
    fillRow(rows[0], reviews);
    fillRow(rows[1], []);
  }

  if (reviews.length) {
    const average = reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / reviews.length;
    summary.querySelector("#rs-score").textContent = average.toFixed(1);
    summary.querySelector("#rs-stars").replaceChildren(stars(average));
    summary.querySelector("#rs-count").textContent = `from ${reviews.length} review${reviews.length === 1 ? "" : "s"}`;
  }
  summary.hidden = !reviews.length;

  // Share the live rating with the trust badges (Home strip + product popup)
  const avg = reviews.length ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / reviews.length : 0;
  window.raven67Rating = { average: avg, count: reviews.length };
  window.dispatchEvent(new CustomEvent("raven67:rating", { detail: window.raven67Rating }));

  // Share the review list with the hero review bubble (names are already masked)
  window.raven67Reviews = reviews.map((r) => ({
    name: maskName(r.display_name), message: r.message, rating: Number(r.rating) || 5, product: r.product_label || "",
  }));
  window.dispatchEvent(new CustomEvent("raven67:reviews", { detail: window.raven67Reviews }));
}

/* Pause while someone holds a row (touch screens); hover pausing is done in CSS. */
rows.forEach((row) => {
  const hold = () => row.classList.add("is-held");
  const release = () => row.classList.remove("is-held");
  row.addEventListener("pointerdown", hold);
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => row.addEventListener(type, release));
});

/* ---------- Data ---------- */
function loadLocal() {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return all.filter((r) => r.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(b.created_at).localeCompare(String(a.created_at)));
  } catch { return []; }
}

async function loadRemote() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.116.0");
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,display_name,message,rating,product_label,created_at,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) { console.warn("Could not load reviews.", error.message); return []; }
  return data || [];
}

async function load() {
  try { render(config.isSupabaseConfigured ? await loadRemote() : loadLocal()); }
  catch (error) { console.warn("Could not load reviews.", error); render([]); }
}

load();
if (!config.isSupabaseConfigured) {
  window.addEventListener("storage", (event) => { if (event.key === LOCAL_KEY) render(loadLocal()); });
}
