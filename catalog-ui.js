import { SAMPLE_CATALOG } from "./catalog-data.js";

const DISCORD_URL = "https://discord.gg/3KPa29G6Vs";
const grid = document.querySelector("#catalog-grid");
const count = document.querySelector("#gallery-count");
const pagination = document.querySelector("#catalog-pagination");
const searchInput = document.querySelector("#catalog-search");
const categorySelect = document.querySelector("#category-filter");
const sortSelect = document.querySelector("#catalog-sort");
const tagFilters = document.querySelector("#tag-filters");
const activeFilters = document.querySelector("#active-filters");
const genderButtons = [...document.querySelectorAll("[data-gender]")];
const collectionButtons = [...document.querySelectorAll("[data-collection]")];
const genderFilter = document.querySelector(".seg");
const dialog = document.querySelector("#ped-dialog");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

let products = [];
let activeGender = "all";
let activeCollection = "peds";
let activeTag = "";
let currentPage = 1;
const PAGE_SIZE = 12;
let opener = null;
let currentDetail = null;

const make = (tag, className = "", text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

// Which tab a product belongs to: "peds", "clothing" or "free" (Free Ped tab)
function collectionOf(product) {
  const category = String(product.category || "").toLowerCase();
  return category.startsWith("clothing") ? "clothing" : category.startsWith("free") ? "free" : category.startsWith("head") ? "head" : "peds";
}
const isFree = (product) => collectionOf(product) === "free";
// "Free Ped DEATH" → "DEATH" (the FREE badge already says it's free)
function displayName(product) {
  const name = String(product.name || "").trim();
  if (!isFree(product)) return name || "Custom character";
  return name.replace(/^free\s*peds?\b\s*[-:·|]?\s*/i, "").trim() || name || "Free ped";
}
const genderOf = (product) => /female/i.test(product.category || "") ? "Female" : /male/i.test(product.category || "") ? "Male" : /unisex/i.test(product.category || "") ? "Unisex" : "";
// "New" = added in the last 7 days
const NEW_DAYS = 7;
function isNew(product) {
  if (product.isSample || !product.created_at) return false;
  const added = Date.parse(product.created_at);
  return Number.isFinite(added) && Date.now() - added < NEW_DAYS * 24 * 60 * 60 * 1000 && Date.now() >= added - 60000;
}
const COLLECTION_NAMES = { peds: ["ped", "peds"], head: ["head", "heads"], clothing: ["clothing item", "clothing items"], free: ["free ped", "free peds"] };
const isHead = (product) => collectionOf(product) === "head";
// what to call one product in sentences: "ped", "head" or "item"
const nounOf = (product) => isClothing(product) ? "item" : isHead(product) ? "head" : "ped";

function placeholderFor(product) {
  const color = product.accent || "#9868f2";
  const code = String(product.sampleCode || "R67").replace(/[^a-z0-9-]/gi, "");
  const art = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#17121f"/><stop offset="1" stop-color="${color}" stop-opacity=".72"/></linearGradient><radialGradient id="r"><stop stop-color="${color}" stop-opacity=".5"/><stop offset="1" stop-color="#100d16" stop-opacity="0"/></radialGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="610" cy="240" r="350" fill="url(#r)"/><path d="M85 100h630M85 900h630" stroke="#fff" stroke-opacity=".12"/><circle cx="400" cy="365" r="105" fill="#100d16" fill-opacity=".78"/><path d="M180 890c22-210 98-340 220-340s198 130 220 340" fill="#100d16" fill-opacity=".78"/><path d="M310 330c0-74 40-117 91-117s89 43 89 117" fill="none" stroke="${color}" stroke-width="10" stroke-opacity=".85"/><text x="72" y="118" fill="#fff" fill-opacity=".74" font-family="Arial,sans-serif" font-size="24" letter-spacing="8">RAVEN67 · DEMO</text><text x="72" y="952" fill="#fff" font-family="Arial,sans-serif" font-size="70" font-weight="700" letter-spacing="5">SAMPLE ${code}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(art)}`;
}

function normalizeTags(item) {
  let tags = item.tags;
  if (typeof tags === "string") {
    try { tags = JSON.parse(tags); } catch { tags = tags.split(","); }
  }
  if (!Array.isArray(tags)) tags = [];
  const category = item.category || "Custom Peds";
  const sale = Number(item.price);
  const original = Number(item.originalPrice ?? item.original_price);
  if (category && !tags.some((tag) => String(tag).toLowerCase() === category.toLowerCase())) tags.unshift(category);
  if (Number.isFinite(sale) && Number.isFinite(original) && original > sale && !tags.some((tag) => String(tag).toLowerCase() === "sale")) tags.push("Sale");
  if (isNew(item) && !tags.some((tag) => String(tag).toLowerCase() === "new")) tags.unshift("New");
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 8);
}

function normalizeProduct(item, sample = false) {
  const product = {
    ...item,
    productCode: item.productCode || item.product_code || "",
    modelName: item.modelName || item.model_name || "",
    originalPrice: item.originalPrice ?? item.original_price ?? null,
    image: item.image || item.image_url || "",
    isSample: sample || Boolean(item.isSample),
  };
  product.tags = normalizeTags(product);
  if (product.isSample && !product.image) product.image = placeholderFor(product);
  // cover first, then the extra photos (front, back, close-up…)
  let gallery = item.gallery;
  if (typeof gallery === "string") { try { gallery = JSON.parse(gallery); } catch { gallery = []; } }
  const extras = (Array.isArray(gallery) ? gallery : []).map((g) => (typeof g === "string" ? g : g?.url)).filter(Boolean);
  product.images = [product.image, ...extras].filter(Boolean);
  return product;
}

function compareCatalogCodes(a, b) {
  const parse = (value) => {
    const code = String(value || "").trim().toUpperCase();
    const ped = code.match(/^#(\d+)$/);
    const clothing = code.match(/^C-(\d+)$/);
    const free = code.match(/^F-(\d+)$/);
    const head = code.match(/^H-(\d+)$/);
    return ped ? { group: 0, number: Number(ped[1]) } : head ? { group: 1, number: Number(head[1]) } : clothing ? { group: 2, number: Number(clothing[1]) } : free ? { group: 3, number: Number(free[1]) } : null;
  };
  const left = parse(a.productCode);
  const right = parse(b.productCode);
  if (left && right) return left.group - right.group || left.number - right.number;
  if (left) return -1;
  if (right) return 1;
  return Number(a.sort_order || 0) - Number(b.sort_order || 0);
}

function currentProducts() {
  const query = searchInput.value.trim().toLowerCase();
  return products.filter((product) => {
    const category = String(product.category || "Other");
    const gender = category.toLowerCase().includes("female") ? "female" : category.toLowerCase().includes("male") ? "male" : "other";
    const searchable = [product.name, product.productCode, product.modelName, category, product.description, ...product.tags].join(" ").toLowerCase();
    return collectionOf(product) === activeCollection
      && (activeGender === "all" || gender === activeGender)
      && (categorySelect.value === "all" || category === categorySelect.value)
      && (!activeTag || product.tags.some((tag) => tag.toLowerCase() === activeTag.toLowerCase()))
      && (!query || searchable.includes(query));
  });
}

function fillCategories() {
  const selected = categorySelect.value;
  const categories = [...new Set(products.filter((product) => collectionOf(product) === activeCollection).map((product) => product.category || "Other"))].sort((a, b) => a.localeCompare(b));
  categorySelect.replaceChildren(make("option", "", "All categories"));
  categorySelect.options[0].value = "all";
  for (const category of categories) {
    const option = make("option", "", category);
    option.value = category;
    categorySelect.append(option);
  }
  categorySelect.value = categories.includes(selected) ? selected : "all";
}

function renderTagFilters() {
  tagFilters.replaceChildren();
  const frequencies = new Map();
  products.filter((product) => collectionOf(product) === activeCollection).forEach((product) => product.tags.forEach((tag) => frequencies.set(tag, (frequencies.get(tag) || 0) + 1)));
  const popular = [...frequencies].filter(([tag]) => tag.toLowerCase() !== "sample").sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
  if (!popular.length) return;
  tagFilters.append(make("span", "tag-label", "POPULAR TAGS"));
  for (const [tag] of popular) {
    const button = make("button", `tag-filter${activeTag === tag ? " is-active" : ""}`, tag);
    button.type = "button";
    button.setAttribute("aria-pressed", String(activeTag === tag));
    button.addEventListener("click", () => { activeTag = activeTag === tag ? "" : tag; currentPage = 1; render(); });
    tagFilters.append(button);
  }
}

function renderActiveFilters() {
  activeFilters.replaceChildren();
  const chips = [];
  if (activeGender !== "all") chips.push(activeGender === "male" ? "Male" : "Female");
  if (categorySelect.value !== "all") chips.push(categorySelect.value);
  if (sortSelect.value !== "code") chips.push(sortSelect.value === "newest" ? "Newest uploads" : "Oldest uploads");
  if (activeTag) chips.push(`#${activeTag}`);
  if (searchInput.value.trim()) chips.push(`“${searchInput.value.trim()}”`);
  if (!chips.length) return;
  chips.forEach((label) => activeFilters.append(make("span", "active-chip", label)));
  const clear = make("button", "clear-filters", "Clear filters");
  clear.type = "button";
  clear.addEventListener("click", () => {
    activeGender = "all"; activeTag = ""; currentPage = 1; searchInput.value = ""; categorySelect.value = "all"; sortSelect.value = "code";
    genderButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.gender === "all")));
    render(); searchInput.focus();
  });
  activeFilters.append(clear);
}

function buildCard(product) {
  const noun = nounOf(product);
  const card = make("article", "card");
  const photo = make("div", "photo");
  const open = make("button", "card-image-button");
  open.type = "button";
  open.dataset.openId = product.id;
  open.setAttribute("aria-label", `View details for ${product.name || `this ${noun}`}`);
  const image = make("img");
  image.src = product.image;
  image.alt = product.isSample ? "Decorative sample artwork" : `${product.name || `FiveM ${noun}`} preview`;
  image.loading = "lazy";
  image.onerror = () => { image.src = placeholderFor({ ...product, sampleCode: "R67" }); };
  open.append(image, make("span", "ask", `View ${noun} details`));
  photo.append(open);

  const sale = Number(product.price);
  const original = Number(product.originalPrice);
  const free = isFree(product);
  const hasPrice = !free && product.price !== null && product.price !== undefined && Number.isFinite(sale);
  const onSale = hasPrice && Number.isFinite(original) && original > sale;
  // top-left badge: only one, in this order of importance
  if (product.isSample) photo.append(make("span", "sale sample-badge", "DEMO SAMPLE"));
  else if (product.is_sold) photo.append(make("span", "sale sold-badge", "SOLD"));
  else if (isFree(product)) photo.append(make("span", "sale free-badge", "FREE"));
  else if (onSale) photo.append(make("span", "sale", `SALE · ${Math.round((1 - sale / original) * 100)}% OFF`));
  if (product.images.length > 1) {
    const many = make("span", "photo-count");
    many.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg>';
    many.append(document.createTextNode(String(product.images.length)));
    many.setAttribute("aria-label", `${product.images.length} photos`);
    photo.append(many);
  }
  if (isNew(product) && !product.is_sold) {
    const badge = make("span", "new-badge", "NEW");
    badge.setAttribute("aria-label", "Added this week");
    photo.append(badge);
  }

  const details = make("div", "details");
  details.append(make("span", "type", product.category || "Custom Peds"));
  const title = make("button", "product-name", displayName(product));
  title.type = "button"; title.dataset.openId = product.id;
  title.setAttribute("aria-label", `View details for ${product.name || `this ${noun}`}`);
  details.append(title);
  if (product.productCode) details.append(make("span", "product-code", product.productCode));
  const rating = Number(product.rating);
  if (Number.isFinite(rating) && rating > 0) {
    const value = Math.max(1, Math.min(5, rating));
    const ratingEl = make("span", "star-rating", `${"★".repeat(Math.round(value))}${"☆".repeat(5 - Math.round(value))}`);
    ratingEl.setAttribute("role", "img");
    ratingEl.setAttribute("aria-label", `Rated ${value} out of 5 stars`);
    details.append(ratingEl);
  }
  if (product.modelName) {
    const model = make("p", "model-name");
    model.append(make("span", "model-label", "MODEL"), document.createTextNode(product.modelName));
    details.append(model);
  }
  if (product.description) details.append(make("p", "product-description", product.description));
  const tags = make("div", "card-tags");
  product.tags.slice(0, 3).forEach((tag) => {
    const button = make("button", "tag-chip", tag);
    button.type = "button";
    button.addEventListener("click", () => { activeTag = tag; currentPage = 1; render(); });
    tags.append(button);
  });
  if (tags.childElementCount) details.append(tags);

  const meta = make("div", "meta");
  meta.classList.toggle("on-sale", onSale);
  if (free) {
    meta.append(make("span", "price free-price", "FREE"));
  } else if (hasPrice) {
    const price = make("span", "price", money.format(sale));
    if (onSale) price.append(make("del", "", money.format(original)));
    meta.append(price);
  } else {
    meta.append(make("span", "price-note", product.isSample ? "Example listing" : "Ask for price"));
  }
  const action = product.is_sold
    ? make("span", "card-cta sold-cta", "SOLD OUT")
    : product.isSample ? make("a", "card-cta secondary-cta", "Add your own in Admin")
    : free ? make("a", "card-cta download-cta", "Get it free")
    : make("button", "card-cta", "View details");
  if (action.tagName === "A" && free) {
    action.href = DISCORD_URL; action.target = "_blank"; action.rel = "noopener noreferrer";
    action.setAttribute("aria-label", `Get ${product.name || "this free ped"} free on our Discord (opens in a new tab)`);
  } else if (action.tagName === "A") action.href = "./admin.html";
  if (action.tagName === "BUTTON") {
    action.type = "button";
    action.dataset.openId = product.id;
    action.setAttribute("aria-label", `View details for ${product.name || `this ${noun}`}`);
  }
  meta.append(action);
  card.append(photo, details, meta);
  return card;
}

/* Free Peds teaser: shown above the Peds & Clothing catalogs with the newest free peds */
const teaser = document.querySelector("#free-teaser");
function renderFreeTeaser() {
  if (!teaser) return;
  const free = products.filter((product) => isFree(product) && !product.is_sold && !product.isSample)
    .sort((a, b) => (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0));
  teaser.hidden = !free.length || activeCollection === "free";
  if (teaser.hidden) return;
  const list = teaser.querySelector(".ft-list");
  list.replaceChildren(...free.slice(0, 2).map((product) => {
    const item = make("button", "ft-item");
    item.type = "button";
    item.dataset.openId = product.id;
    item.setAttribute("aria-label", `View free ped ${product.name || ""}`);
    const image = make("img"); image.src = product.image; image.alt = ""; image.loading = "lazy";
    image.onerror = () => { image.src = placeholderFor({ ...product, sampleCode: "R67" }); };
    const text = make("span", "ft-item-text");
    const gender = genderOf(product);
    text.append(make("strong", "", displayName(product)), make("small", "", gender ? `${gender} ped` : "Ped"));
    item.append(image, text, make("span", "ft-free", "FREE"));
    return item;
  }));
  const more = teaser.querySelector("[data-ft-count]");
  if (more) more.textContent = free.length > 2 ? `+${free.length - 2} more on Discord` : "";
}
teaser?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-open-id]");
  if (item) openDetails(products.find((product) => String(product.id) === item.dataset.openId), item);
});

function render() {
  fillCategories();
  renderFreeTeaser();
  const visible = currentProducts();
  if (sortSelect.value !== "code") {
    const direction = sortSelect.value === "newest" ? -1 : 1;
    visible.sort((a, b) => {
      const aDate = Date.parse(a.created_at || "");
      const bDate = Date.parse(b.created_at || "");
      if (Number.isFinite(aDate) && Number.isFinite(bDate) && aDate !== bDate) return (aDate - bDate) * direction;
      return (Number(a.sort_order || 0) - Number(b.sort_order || 0)) * direction;
    });
  }
  grid.replaceChildren();
  const [itemType, itemTypes] = COLLECTION_NAMES[activeCollection];
  count.textContent = `${visible.length} ${visible.length === 1 ? itemType : itemTypes}`;
  const pageCount = Math.ceil(visible.length / PAGE_SIZE);
  currentPage = Math.min(Math.max(currentPage, 1), Math.max(pageCount, 1));
  if (!visible.length) {
    const empty = make("div", "empty");
    const collectionProducts = products.filter((product) => collectionOf(product) === activeCollection);
    empty.append(make("strong", "", collectionProducts.length ? `No ${itemTypes} match those filters` : activeCollection === "free" ? "No free peds yet" : `No ${activeCollection === "clothing" ? "clothing" : activeCollection === "head" ? "head-only items" : "peds"} in this catalog yet`));
    empty.append(make("span", "", collectionProducts.length ? "Try a different search or clear your filters." : activeCollection === "free" ? "New free peds will show up here — check back soon or join our Discord." : "Add an item from the Admin page to start this collection."));
    if (collectionProducts.length) {
      const clear = make("button", "btn ghost", "Clear filters");
      clear.type = "button";
      clear.addEventListener("click", () => { activeGender = "all"; activeTag = ""; currentPage = 1; searchInput.value = ""; categorySelect.value = "all"; sortSelect.value = "code"; genderButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.gender === "all"))); render(); });
      empty.append(clear);
    }
    grid.append(empty);
  } else visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).forEach((product, index) => {
    const card = buildCard(product);
    card.style.setProperty("--card-index", index);
    grid.append(card);
  });
  renderPagination(visible.length, itemType, itemTypes);
  renderTagFilters();
  renderActiveFilters();
}

function renderPagination(total, itemType, itemTypes) {
  pagination.replaceChildren();
  const pageCount = Math.ceil(total / PAGE_SIZE);
  pagination.classList.toggle("hide", pageCount <= 1);
  if (pageCount <= 1) return;
  const first = (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(currentPage * PAGE_SIZE, total);
  pagination.append(make("span", "pagination-summary", `Showing ${first}–${last} of ${total} ${total === 1 ? itemType : itemTypes}`));
  const controls = make("div", "pagination-controls");
  const addButton = (label, page, options = {}) => {
    if (options.ellipsis) { controls.append(make("span", "pagination-ellipsis", "…")); return; }
    const button = make("button", `page-button${page === currentPage ? " is-current" : ""}`, label);
    button.type = "button";
    button.disabled = Boolean(options.disabled);
    if (page === currentPage) button.setAttribute("aria-current", "page");
    button.setAttribute("aria-label", options.label || `Page ${page}`);
    button.addEventListener("click", () => { currentPage = page; render(); document.querySelector("#catalog-grid").scrollIntoView({ behavior: "smooth", block: "start" }); });
    controls.append(button);
  };
  addButton("Previous", currentPage - 1, { disabled: currentPage === 1, label: "Previous page" });
  const pages = new Set([1, pageCount]);
  for (let page = Math.max(2, currentPage - 1); page <= Math.min(pageCount - 1, currentPage + 1); page++) pages.add(page);
  let previous = 0;
  [...pages].sort((a, b) => a - b).forEach((page) => {
    if (previous && page - previous > 1) controls.append(make("span", "pagination-ellipsis", "…"));
    addButton(String(page), page);
    previous = page;
  });
  addButton("Next", currentPage + 1, { disabled: currentPage === pageCount, label: "Next page" });
  pagination.append(controls);
}

function safeOptionalLink(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

const ICONS = {
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  shirt: '<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
};

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONS[name];
  return svg;
}

const isClothing = (product) => String(product.category || "").toLowerCase().startsWith("clothing");

function tagIcon(tag, product) {
  const value = tag.toLowerCase();
  if (value === "sale") return "percent";
  if (value === "new") return "spark";
  if (isClothing(product) && value === String(product.category).toLowerCase()) return "shirt";
  if (["male", "female", "unisex", "baby"].includes(value) || value.endsWith("peds")) return "users";
  return "tag";
}

function setCollection(name) {
  // free peds have no tab on the site (they're claimed on Discord), so fall back to Peds
  activeCollection = collectionButtons.some((button) => button.dataset.collection === name) ? name : "peds";
  collectionButtons.forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.collection === activeCollection)));
  const tabs = collectionButtons[0]?.parentElement;
  if (tabs) tabs.dataset.active = activeCollection;
  genderFilter?.classList.toggle("hide", activeCollection === "clothing");
  window.dispatchEvent(new CustomEvent("raven67:collection", { detail: activeCollection }));
}

// Used by the top menu (PEDS / FREE PED) to open a collection
window.raven67SetCollection = (name) => {
  if (name === activeCollection) return;
  setCollection(name);
  activeGender = "all"; activeTag = ""; currentPage = 1; searchInput.value = ""; categorySelect.value = "all";
  genderButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.gender === "all")));
  render();
};

function showCatalog({ category = "all", collection } = {}) {
  dialog.close();
  if (collection) setCollection(collection);
  activeGender = "all"; activeTag = ""; currentPage = 1; searchInput.value = ""; sortSelect.value = "code";
  genderButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.gender === "all")));
  fillCategories();
  categorySelect.value = [...categorySelect.options].some((option) => option.value === category) ? category : "all";
  render();
  // The catalog is now its own navigation tab, so activate it before scrolling/focusing.
  if (typeof window.raven67ShowTab === "function") window.raven67ShowTab("peds");
  requestAnimationFrame(() => grid.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function renderRelated(product) {
  const wrap = document.querySelector("#dialog-related-wrap");
  const pool = products.filter((item) => item.id !== product.id && collectionOf(item) === collectionOf(product) && !item.is_sold);
  const related = [...pool.filter((item) => item.category === product.category), ...pool.filter((item) => item.category !== product.category)].slice(0, 4);
  document.querySelector("#dialog-related").replaceChildren(...related.map((item) => {
    const button = make("button", "pd-related-item");
    button.type = "button";
    button.setAttribute("aria-label", `View ${item.name || "this item"}`);
    const image = make("img");
    image.src = item.image; image.alt = ""; image.loading = "lazy";
    image.onerror = () => { image.src = placeholderFor({ ...item, sampleCode: "R67" }); };
    button.append(image, make("span", "", displayName(item)));
    button.addEventListener("click", () => openDetails(item, opener));
    return button;
  }));
  wrap.classList.toggle("hide", !related.length);
}

/* ---------- Popup info panel tabs ---------- */
function setPanelTab(name) {
  const panel = document.querySelector("#dialog-panel");
  if (!panel) return;
  panel.dataset.active = name;
  panel.querySelectorAll("[data-pd-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.pdTab === name)));
}
document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-pd-tab]");
  if (tab) setPanelTab(tab.dataset.pdTab);
});

/* ---------- "What's included" per product type ---------- */
const FEATURE_ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  face: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
  shirt: '<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z"/>',
  hair: '<path d="M4 20c0-9 3-16 8-16s8 7 8 16"/><path d="M8 20c0-6 1.5-10 4-10s4 4 4 10"/>',
};
const PED_FEATURES = {
  peds: [["check", "FiveM Ready"], ["layers", "All LODs Fixed & Optimized"], ["face", "Facial Animations & Lip Sync"], ["shirt", "Full Clothing Included"], ["hair", "Hair Variations"]],
  head: [["check", "FiveM Ready"], ["layers", "All LODs Fixed & Optimized"], ["face", "Facial Animations & Lip Sync"], ["hair", "Hair Variations"]],
};

/* ---------- Popup photo gallery: big photo + thumbnails, arrows, ← → keys, swipe ---------- */
const galleryState = { product: null, index: 0 };
function showPhoto(index) {
  const product = galleryState.product;
  if (!product) return;
  const images = product.images.length ? product.images : [product.image];
  const count = images.length;
  galleryState.index = (index + count) % count;
  const media = document.querySelector("#dialog-media");
  let image = media.querySelector(".pd-image");
  if (!image) { image = make("img", "pd-image"); media.prepend(image); }
  image.classList.remove("pd-image"); void image.offsetWidth; image.classList.add("pd-image"); // replay fade
  image.src = images[galleryState.index];
  image.alt = product.isSample ? "Sample catalog artwork" : `${displayName(product)} — photo ${galleryState.index + 1} of ${count}`;
  image.onerror = () => { image.onerror = null; image.src = placeholderFor({ ...product, sampleCode: "R67" }); };
  const counter = media.querySelector(".pd-counter");
  if (counter) counter.textContent = `${galleryState.index + 1} / ${count}`;
  document.querySelectorAll("#dialog-thumbs .pd-thumb").forEach((thumb, i) => {
    const active = i === galleryState.index;
    thumb.classList.toggle("is-active", active);
    thumb.setAttribute("aria-current", active ? "true" : "false");
    if (active) thumb.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}
function renderGallery(product) {
  galleryState.product = product;
  const images = product.images.length ? product.images : [product.image];
  const many = images.length > 1;
  const media = document.querySelector("#dialog-media");
  media.replaceChildren();
  media.classList.toggle("has-many", many);
  if (many) {
    const prev = make("button", "pd-nav pd-prev"); prev.type = "button"; prev.setAttribute("aria-label", "Previous photo"); prev.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
    const next = make("button", "pd-nav pd-next"); next.type = "button"; next.setAttribute("aria-label", "Next photo"); next.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
    prev.addEventListener("click", () => showPhoto(galleryState.index - 1));
    next.addEventListener("click", () => showPhoto(galleryState.index + 1));
    media.append(prev, next, make("span", "pd-counter"));
  }
  const thumbs = document.querySelector("#dialog-thumbs");
  if (thumbs) {
    thumbs.hidden = !many;
    thumbs.replaceChildren(...(many ? images.map((src, i) => {
      const thumb = make("button", "pd-thumb"); thumb.type = "button";
      thumb.setAttribute("aria-label", `Show photo ${i + 1} of ${images.length}`);
      const img = make("img"); img.src = src; img.alt = ""; img.loading = "lazy";
      thumb.append(img);
      thumb.addEventListener("click", () => showPhoto(i));
      return thumb;
    }) : []));
  }
  showPhoto(0);
}
// ← → keys while the popup is open
document.addEventListener("keydown", (event) => {
  if (!dialog.open || !galleryState.product || galleryState.product.images.length < 2) return;
  if (event.target.closest?.("input, textarea, select")) return;
  if (event.key === "ArrowLeft") { event.preventDefault(); showPhoto(galleryState.index - 1); }
  if (event.key === "ArrowRight") { event.preventDefault(); showPhoto(galleryState.index + 1); }
});
// swipe on phones
(() => {
  const media = document.querySelector("#dialog-media");
  let startX = 0, startY = 0, tracking = false;
  media.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) return; tracking = true; startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  media.addEventListener("touchend", (e) => {
    if (!tracking) return; tracking = false;
    const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3 && galleryState.product?.images.length > 1) showPhoto(galleryState.index + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();

function openDetails(product, trigger) {
  if (!product) return;
  opener = trigger;
  currentDetail = product;
  const clothing = isClothing(product);
  const free = isFree(product);
  const collection = collectionOf(product);
  const category = product.category || "Custom Peds";

  const crumbs = document.querySelector("#dialog-crumbs");
  const crumbCollection = free ? "peds" : collection; // there's no Free tab to go back to
  crumbs.replaceChildren();
  for (const [label, target] of (free ? [["Peds", { collection: "peds" }]] : [[clothing ? "Clothing" : isHead(product) ? "Head Only" : "Peds", { collection: crumbCollection }], [category, { category, collection: crumbCollection }]])) {
    const link = make("button", "pd-crumb", label);
    link.type = "button";
    link.addEventListener("click", () => showCatalog(target));
    crumbs.append(link, icon("chevron"));
  }
  const current = make("span", "pd-crumb is-current", displayName(product));
  current.setAttribute("aria-current", "page");
  crumbs.append(current);

  renderGallery(product);

  const categoryEl = document.querySelector("#dialog-category");
  categoryEl.textContent = free ? `${genderOf(product) || "Community"} ped` : category;
  if (isNew(product)) categoryEl.append(make("span", "pd-new", "NEW"));
  document.querySelector("#dialog-title").textContent = displayName(product);
  const model = document.querySelector("#dialog-model");
  model.textContent = product.modelName ? `Model name · ${product.modelName}` : "";
  model.classList.toggle("hide", !product.modelName);
  document.querySelector("#dialog-code").textContent = product.productCode || "Not assigned";
  // free peds are claimed in the Discord free-ped channel, so no code to copy
  document.querySelector("#copy-code").classList.toggle("hide", !product.productCode || free);
  document.querySelector("#dialog-code").closest(".code-row")?.classList.toggle("hide", free);
  document.querySelector("#copy-code-status").textContent = "";
  document.querySelector("#copy-code").classList.remove("is-copied");

  const dialogPrice = document.querySelector("#dialog-price");
  dialogPrice.replaceChildren();
  const salePrice = Number(product.price);
  const originalPrice = Number(product.originalPrice);
  if (free) {
    dialogPrice.append(make("strong", "free-price", "FREE"));
  } else if (product.price !== null && product.price !== undefined && Number.isFinite(salePrice)) {
    dialogPrice.append(make("strong", "", money.format(salePrice)));
    if (Number.isFinite(originalPrice) && originalPrice > salePrice) {
      dialogPrice.append(make("del", "", money.format(originalPrice)), make("span", "pd-save", `Save ${Math.round((1 - salePrice / originalPrice) * 100)}%`));
    }
  } else dialogPrice.append(make("span", "price-note", product.isSample ? "Demo item · no price set" : "Ask for price"));

  const description = document.querySelector("#dialog-description");
  description.textContent = product.description || "";
  description.classList.toggle("hide", !product.description);
  const shownTags = free
    ? [...product.tags.filter((tag) => tag !== product.category && !/^free/i.test(tag)), genderOf(product)].filter(Boolean)
    : product.tags;
  document.querySelector("#dialog-tags").replaceChildren(...shownTags.map((tag) => {
    const badge = make("span", "dialog-tag");
    badge.append(icon(tagIcon(tag, product)), document.createTextNode(tag));
    return badge;
  }));
  const installWrap = document.querySelector("#dialog-install-wrap");
  const installText = product.installation || product.installation_notes || "";
  installWrap.classList.toggle("hide", !installText);
  document.querySelector("#dialog-install").textContent = installText;
  const download = document.querySelector("#dialog-download");
  const downloadUrl = safeOptionalLink(product.download_url || product.downloadUrl);
  download.classList.toggle("hide", !downloadUrl || product.isSample || free); // free peds are claimed on Discord
  download.href = downloadUrl || "#";

  const rating = document.querySelector("#dialog-rating");
  const ratingValue = Number(product.rating);
  if (Number.isFinite(ratingValue) && ratingValue > 0) {
    const value = Math.max(1, Math.min(5, ratingValue));
    const stars = make("span", "pd-stars", `${"★".repeat(Math.round(value))}${"☆".repeat(5 - Math.round(value))}`);
    stars.setAttribute("aria-hidden", "true");
    rating.replaceChildren(stars, make("span", "", `${value.toFixed(1)} rating`));
  } else rating.replaceChildren(make("span", "", "Official Raven67 store"));

  const discord = document.querySelector("#dialog-discord");
  const discordLabel = document.querySelector("#dialog-discord-label");
  const soldNote = document.querySelector("#dialog-sold-note");
  soldNote.textContent = `This ${nounOf(product)} has been sold and is no longer available.`;
  soldNote.classList.toggle("hide", !product.is_sold);
  discord.classList.toggle("hide", Boolean(product.is_sold));
  if (product.is_sold) {
    discord.href = "#"; discord.target = "_self";
  } else if (product.isSample) {
    discord.href = "./admin.html"; discord.target = "_self"; discordLabel.textContent = "Replace demo items in Admin";
  } else {
    discord.href = DISCORD_URL; discord.target = "_blank"; discordLabel.textContent = free ? "Claim on Discord" : "Order on Discord";
  }
  discord.classList.remove("is-download");
  // free peds are grabbed from the free-peds channel, so the copied order message is for paid items only
  const orderable = !product.is_sold && !product.isSample && !free;
  discord.dataset.orderReady = orderable ? "1" : "";
  document.querySelector("#dialog-order-hint")?.classList.toggle("hide", !orderable);
  const speed = document.querySelector("[data-trust-speed]");
  if (speed) speed.querySelector("span").textContent = free ? "Members-only channel" : "Files within 24h";

  // short "how to" so the next step is obvious (and the panel isn't empty)
  const name = displayName(product);
  // "What's included" checklist — edit PED_FEATURES below to change the wording
  const features = PED_FEATURES[collectionOf(product)] || [];
  document.querySelector("#dialog-features").classList.toggle("hide", !features.length || product.isSample);
  document.querySelector("#dialog-features-list").replaceChildren(...features.map(([iconName, text]) => {
    const li = make("li");
    const ic = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ic.setAttribute("viewBox", "0 0 24 24"); ic.setAttribute("aria-hidden", "true"); ic.innerHTML = FEATURE_ICONS[iconName];
    li.append(ic, make("span", "", text));
    return li;
  }));

  const steps = free
    ? [["Join our Discord", "Takes just a few seconds."], ["Open the free peds channel", "All community peds are posted there."], [`Download ${name}`, "Add it to your server and enjoy."]]
    : product.isSample ? []
    : [["Click “Order on Discord”", "Your order message (with the code) is copied for you."], ["Open a ticket and paste it", "Press Ctrl+V (or hold → Paste on phone) and send."], ["Get your files", "Delivered in your ticket within 24 hours."]];
  document.querySelector("#dialog-steps").classList.toggle("hide", !steps.length);
  document.querySelector("#dialog-steps-title").textContent = free ? "How to claim" : "How to order";
  // one compact panel: tabs only when both parts exist
  const hasFeatures = features.length > 0 && !product.isSample;
  const panel = document.querySelector("#dialog-panel");
  panel.classList.toggle("hide", !hasFeatures && !steps.length);
  panel.classList.toggle("has-tabs", hasFeatures && steps.length > 0);
  document.querySelector("#dialog-steps-tab").textContent = free ? "How to claim" : "How to order";
  setPanelTab(hasFeatures ? "features" : "steps");
  document.querySelector("#dialog-steps-list").replaceChildren(...steps.map(([title, text]) => {
    const li = make("li");
    li.append(make("strong", "", title), make("span", "", text));
    return li;
  }));

  renderRelated(product);
  genderFilter?.classList.toggle("hide", activeCollection === "clothing");
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  document.querySelector("#dialog-close").focus();
}

/* ---------- One-click order message: copied when "Order on Discord" is clicked ---------- */
function orderMessage(product) {
  const name = displayName(product);
  const code = product.productCode && !name.toUpperCase().includes(product.productCode.toUpperCase()) ? ` (${product.productCode})` : "";
  if (isFree(product)) return `Hi! I'd like to claim the free ped ${name}${code}.`;
  const price = Number(product.price);
  const priceText = product.price !== null && product.price !== undefined && product.price !== "" && Number.isFinite(price) ? ` — ${money.format(price)}` : "";
  return `Hi! I'd like to order ${name}${code}${priceText}. Is it still available?`;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try { // older browsers / blocked clipboard API
    const area = document.createElement("textarea");
    area.value = text; area.setAttribute("readonly", ""); area.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    dialog.append(area); area.select(); const ok = document.execCommand("copy"); area.remove(); return ok;
  } catch { return false; }
}
function showToast(html, ok = true) {
  let toast = dialog.querySelector(".order-toast");
  if (!toast) { toast = make("div", "order-toast"); toast.setAttribute("role", "status"); dialog.append(toast); }
  toast.classList.toggle("is-error", !ok);
  toast.innerHTML = html;
  toast.classList.remove("is-on"); void toast.offsetWidth; toast.classList.add("is-on");
  clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove("is-on"), 5200);
}
document.querySelector("#dialog-discord").addEventListener("click", (event) => {
  const link = event.currentTarget;
  if (!currentDetail || link.dataset.orderReady !== "1") return;
  const message = orderMessage(currentDetail);
  // copy first, then let the link open Discord in a new tab (no preventDefault → popup blockers stay happy)
  copyText(message).then((ok) => {
    if (ok) showToast(`<strong>Order message copied</strong><span>Open a ticket and paste it (Ctrl+V)</span>`);
    else showToast(`<strong>Couldn't copy automatically</strong><span>Send this in your ticket: “${message.replace(/[<>&]/g, "")}”</span>`, false);
  });
});

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-id]");
  if (button) openDetails(products.find((product) => String(product.id) === button.dataset.openId), button);
});

for (const imageArea of [grid, document.querySelector("#dialog-media")]) {
  imageArea.addEventListener("contextmenu", (event) => {
    if (event.target.closest("img")) event.preventDefault();
  });
  imageArea.addEventListener("dragstart", (event) => {
    if (event.target.closest("img")) event.preventDefault();
  });
}
document.querySelector("#dialog-close").addEventListener("click", () => dialog.close());
document.querySelector("#dialog-similar").addEventListener("click", () => showCatalog(currentDetail && isFree(currentDetail) ? { collection: "peds" } : { category: currentDetail?.category, collection: currentDetail && collectionOf(currentDetail) }));
document.querySelector("#dialog-all").addEventListener("click", () => showCatalog({ collection: currentDetail && !isFree(currentDetail) ? collectionOf(currentDetail) : "peds" }));
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener("close", () => { if (opener?.isConnected) opener.focus(); });

document.querySelector("#copy-code").addEventListener("click", async () => {
  const code = document.querySelector("#dialog-code").textContent;
  const status = document.querySelector("#copy-code-status");
  const chip = document.querySelector("#copy-code");
  try {
    await navigator.clipboard.writeText(code);
    status.textContent = "Copied!";
    chip.classList.add("is-copied");
    clearTimeout(chip._t);
    chip._t = setTimeout(() => { chip.classList.remove("is-copied"); status.textContent = ""; }, 1600);
  } catch {
    status.textContent = "Select the code to copy";
  }
});
searchInput.addEventListener("input", () => { currentPage = 1; render(); });
categorySelect.addEventListener("change", () => { currentPage = 1; render(); });
sortSelect.addEventListener("change", () => { currentPage = 1; render(); });
genderButtons.forEach((button) => button.addEventListener("click", () => {
  currentPage = 1;
  activeGender = button.dataset.gender;
  genderButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  render();
}));

collectionButtons.forEach((button) => button.addEventListener("click", () => {
  currentPage = 1;
  setCollection(button.dataset.collection);
  activeGender = "all";
  activeTag = "";
  categorySelect.value = "all";
  genderButtons.forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.gender === "all")));
  render();
}));

// Lets other parts of the page (e.g. the hero "Latest drop" card) open a product popup
window.raven67OpenProduct = (id, trigger = null) => {
  const product = products.find((item) => String(item.id) === String(id));
  if (product) openDetails(product, trigger);
};

window.addEventListener("catalog-products-loaded", (event) => {
  const uploaded = (event.detail || []).filter((item) => item.image_url || item.image).map((item) => normalizeProduct(item));
  products = (uploaded.length ? uploaded : SAMPLE_CATALOG.map((item) => normalizeProduct(item, true))).sort(compareCatalogCodes);
  if (!event.detail?.isRefresh) currentPage = 1; // a refresh keeps the visitor's page (render() clamps it)
  fillCategories();
  render();
});

function renderSkeleton() {
  grid.replaceChildren();
  for (let index = 0; index < 4; index += 1) {
    const card = make("div", "card skeleton");
    card.append(make("div", "photo"), make("div", "skeleton-lines"));
    grid.append(card);
  }
}

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const revealTargets = [...document.querySelectorAll(".scroll-reveal")];
if (!motionPreference.matches && "IntersectionObserver" in window) {
  document.documentElement.classList.add("motion-ready");
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });
  revealTargets.forEach((target) => revealObserver.observe(target));
} else revealTargets.forEach((target) => target.classList.add("is-visible"));

const siteHeader = document.querySelector(".site-header");
const syncHeaderDepth = () => siteHeader.classList.toggle("is-scrolled", window.scrollY > 12);
syncHeaderDepth();
window.addEventListener("scroll", syncHeaderDepth, { passive: true });

/* ---------- Toolbar polish: sliding gender pill, rotating search hints, "stuck" state ---------- */
(() => {
  const tools = document.querySelector(".catalog-tools");
  const seg = document.querySelector(".seg");
  const glider = seg?.querySelector(".seg-glider");
  // purple pill slides to whichever gender button is pressed
  function moveGlider() {
    const on = seg?.querySelector("[aria-pressed=true]");
    if (!glider || !on || !on.offsetWidth) return;
    glider.style.width = `${on.offsetWidth}px`;
    glider.style.transform = `translateX(${on.offsetLeft - 4}px)`;
    seg.classList.add("has-glider");
  }
  if (seg) {
    new MutationObserver(moveGlider).observe(seg, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    window.addEventListener("resize", moveGlider);
    window.addEventListener("raven67:tabchange", () => requestAnimationFrame(moveGlider));
    if (document.fonts) document.fonts.ready.then(moveGlider);
    requestAnimationFrame(moveGlider);
  }

  // rotating hints inside the search box (only while it's empty and not focused)
  const box = document.querySelector(".search-box");
  const hint = box?.querySelector(".search-hint span");
  if (box && hint) {
    const hints = ["Search name, model, or tag…", "Try “female”…", "Search a code like #0012…", "Try “custom” or “baby”…", "Find a head with H-0001…"];
    let i = 0;
    searchInput.placeholder = "";
    hint.textContent = hints[0];
    const sync = () => box.classList.toggle("has-text", Boolean(searchInput.value) || document.activeElement === searchInput);
    ["input", "focus", "blur"].forEach((type) => searchInput.addEventListener(type, sync));
    sync();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInterval(() => {
        if (box.classList.contains("has-text") || document.hidden) return;
        hint.classList.add("is-out");
        setTimeout(() => { i = (i + 1) % hints.length; hint.textContent = hints[i]; hint.classList.remove("is-out"); hint.classList.add("is-in"); setTimeout(() => hint.classList.remove("is-in"), 450); }, 300);
      }, 3200);
    }
  }

  // a touch more solid while it sticks under the header
  if (tools && "IntersectionObserver" in window) {
    const sentinel = document.createElement("div");
    sentinel.className = "tools-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    tools.before(sentinel);
    new IntersectionObserver(([entry]) => tools.classList.toggle("is-stuck", !entry.isIntersecting && entry.boundingClientRect.top < 120), { rootMargin: "-90px 0px 0px 0px" }).observe(sentinel);
  }
})();

/* ---------- Refresh button: reload the latest products without reloading the page ---------- */
(() => {
  const button = document.querySelector("#catalog-refresh");
  if (!button) return;
  const label = button.querySelector(".rf-text");
  button.addEventListener("click", async () => {
    if (button.classList.contains("is-loading") || typeof window.raven67ReloadCatalog !== "function") return;
    button.classList.remove("is-done", "is-error");
    button.classList.add("is-loading"); button.disabled = true; label.textContent = "Loading…";
    const started = performance.now();
    const ok = await window.raven67ReloadCatalog();
    await new Promise((r) => setTimeout(r, Math.max(0, 650 - (performance.now() - started)))); // let the spin be seen
    button.classList.remove("is-loading"); button.disabled = false;
    button.classList.add(ok ? "is-done" : "is-error");
    label.textContent = ok ? "Updated" : "Try again";
    clearTimeout(button._t);
    button._t = setTimeout(() => { button.classList.remove("is-done", "is-error"); label.textContent = "Refresh"; }, ok ? 1800 : 3000);
  });
})();

renderSkeleton();
if (location.hash === "#free") setCollection("free"); // opened from a #free link
