// Raven67 — rotating review bubble in the home hero (under "Ready to Play").
// Shows one real buyer review at a time like a chat message:
// "typing…" dots → message pops in → holds → pops out → next buyer.
// Hover pauses it, click opens the Reviews tab. Hidden when there are no reviews.
(() => {
  const col = document.querySelector(".r67-hero .col.right");
  if (!col) return;

  const HOLD = 6000;    // how long each review stays (ms)
  const TYPING = 1100;  // "typing…" before the message appears (ms)
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const box = document.createElement("a");
  box.className = "hero-review";
  box.href = "#reviews";
  box.dataset.tabLink = "reviews";
  box.hidden = true;
  box.setAttribute("aria-live", "polite");
  box.innerHTML = `
    <span class="hr-avatar" aria-hidden="true"></span>
    <span class="hr-bubble">
      <span class="hr-typing" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="hr-msg">
        <span class="hr-head"><strong class="hr-name"></strong><span class="hr-stars" aria-hidden="true"></span></span>
        <span class="hr-text"></span>
        <span class="hr-meta"></span>
      </span>
      <span class="hr-progress" aria-hidden="true"></span>
    </span>`;
  col.appendChild(box);

  const $ = (sel) => box.querySelector(sel);
  let reviews = [], index = 0, timer = 0, paused = false, remaining = HOLD, shownAt = 0;

  const clip = (text, max = 120) => (text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text);

  function fill(r) {
    $(".hr-avatar").textContent = (r.name || "?").charAt(0).toUpperCase();
    $(".hr-name").textContent = r.name || "Raven67 buyer";
    $(".hr-stars").style.setProperty("--pct", `${(Math.max(0, Math.min(5, r.rating)) / 5) * 100}%`);
    $(".hr-text").textContent = `“${clip(r.message)}”`;
    $(".hr-meta").textContent = r.product ? `Bought ${r.product}` : "Raven67 buyer";
    box.setAttribute("aria-label", `Review from ${r.name}: ${r.rating} out of 5 stars. ${r.message}. Open all reviews`);
  }

  function show(i) {
    const r = reviews[i];
    if (!r) return;
    box.classList.remove("is-out");
    box.classList.add("is-typing");
    // restart the pop-in animation
    box.classList.remove("is-in"); void box.offsetWidth; box.classList.add("is-in");
    fill(r);
    setTimeout(() => {
      box.classList.remove("is-typing");
      if (reviews.length > 1) schedule(HOLD);
    }, reduceMotion ? 0 : TYPING);
  }

  function schedule(ms) {
    clearTimeout(timer);
    remaining = ms; shownAt = performance.now();
    box.style.setProperty("--hold", `${ms}ms`);
    box.classList.remove("is-timing"); void box.offsetWidth; box.classList.add("is-timing");
    timer = setTimeout(next, ms);
  }

  function next() {
    if (paused || document.hidden) { timer = setTimeout(next, 800); return; }
    box.classList.add("is-out");
    setTimeout(() => { index = (index + 1) % reviews.length; show(index); }, reduceMotion ? 0 : 450);
  }

  // pause while hovered or focused
  const pause = () => {
    if (paused) return;
    paused = true; box.classList.add("is-paused");
    if (timer && box.classList.contains("is-timing")) { clearTimeout(timer); remaining -= performance.now() - shownAt; }
  };
  const resume = () => {
    if (!paused) return;
    paused = false; box.classList.remove("is-paused");
    if (reviews.length > 1 && !box.classList.contains("is-typing")) { shownAt = performance.now(); timer = setTimeout(next, Math.max(400, remaining)); }
  };
  box.addEventListener("mouseenter", pause);
  box.addEventListener("mouseleave", resume);
  box.addEventListener("focus", pause);
  box.addEventListener("blur", resume);

  function start(list) {
    reviews = (list || []).filter((r) => r && r.message);
    clearTimeout(timer);
    box.hidden = !reviews.length;
    box.classList.toggle("is-single", reviews.length === 1);
    if (!reviews.length) return;
    index = 0;
    setTimeout(() => show(0), 1400); // after the hero entrance animation
  }

  // Prefer the list shared by reviews-client.js; if it never arrives (old/cached file),
  // load the reviews ourselves so the bubble always works.
  let started = false;
  const go = (list) => { if (!started) { started = true; start(list); } };
  window.addEventListener("raven67:reviews", (e) => { started = false; go(e.detail); });
  if (window.raven67Reviews) go(window.raven67Reviews);
  setTimeout(async () => { if (!started) go(await loadReviews()); }, 2500);
})();

async function loadReviews() {
  const mask = (name) => String(name || "").trim().split(/\s+/).filter(Boolean).map((w) => {
    if (w.includes("*")) return w;
    const c = [...w];
    if (c.length <= 2) return c[0] + "*";
    if (c.length === 3) return c[0] + "*" + c[2];
    return c[0] + "*".repeat(c.length - 3) + c.slice(-2).join("");
  }).join(" ");
  const shape = (rows) => (rows || [])
    .filter((r) => r && r.message && r.is_active !== false)
    .map((r) => ({ name: mask(r.display_name), message: r.message, rating: Number(r.rating) || 5, product: r.product_label || "" }));
  try {
    const config = await import("./supabase-config.js");
    if (!config.isSupabaseConfigured) return shape(JSON.parse(localStorage.getItem("raven67-local-reviews") || "[]"));
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.116.0");
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await supabase.from(config.REVIEWS_TABLE || "reviews")
      .select("display_name,message,rating,product_label,is_active,sort_order,created_at")
      .eq("is_active", true).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (error) { console.warn("Hero reviews:", error.message); return []; }
    return shape(data);
  } catch (error) {
    console.warn("Hero reviews: could not load reviews.", error);
    return [];
  }
}
