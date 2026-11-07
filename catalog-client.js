import { isSupabaseConfigured, PRODUCTS_TABLE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";
import { getLocalProducts } from "./catalog-storage.js";
import { activeSale, applySale, SALE_KEY, SALE_LOCAL_KEY } from "./sale.js?v=56";

// refresh = true when the visitor pressed the catalog's refresh button (keeps their page/filters)
function dispatchProducts(products, refresh = false) {
  const list = products || [];
  list.isRefresh = refresh;
  window.dispatchEvent(new CustomEvent("catalog-products-loaded", { detail: list }));
}

let localUrls = [];
async function loadLocalCatalog() {
  const records = await getLocalProducts();
  localUrls.forEach((url) => URL.revokeObjectURL(url));
  localUrls = [];
  const make = (blob) => { const url = URL.createObjectURL(blob); localUrls.push(url); return url; };
  return records
    .filter((product) => product.is_active !== false && product.image_blob)
    .map((product) => ({
      ...product,
      image_url: make(product.image_blob),
      gallery: (product.gallery_blobs || []).filter(Boolean).map((blob) => ({ url: make(blob) })),
    }));
}

let supabase = null;
async function loadRemoteCatalog() {
  if (!supabase) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.116.0");
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  const COLUMNS = "id,name,product_code,model_name,description,price,original_price,rating,image_url,image_path,category,is_active,is_sold,sort_order,created_at";
  const query = (columns) => supabase
    .from(PRODUCTS_TABLE)
    .select(columns)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  // Optional columns (gallery = extra photos, download_url = old free-ped links).
  // If one hasn't been added in Supabase yet, load the catalog without it so nothing breaks.
  let { data, error } = await query(`${COLUMNS},gallery,download_url`);
  if (error && /gallery|download_url/i.test(error.message || "")) ({ data, error } = await query(`${COLUMNS},gallery`));
  if (error && /gallery/i.test(error.message || "")) ({ data, error } = await query(COLUMNS));
  if (error) throw new Error(error.message);
  return data || [];
}

/* Store-wide sale setting (see sale.js). A missing table just means "no sale". */
async function loadSaleSetting() {
  try {
    if (!isSupabaseConfigured) return JSON.parse(localStorage.getItem(SALE_LOCAL_KEY) || "null");
    const { data, error } = await supabase.from("store_settings").select("value").eq("key", SALE_KEY).maybeSingle();
    if (error) { if (!/store_settings/i.test(error.message || "")) console.warn("Could not load the sale setting.", error.message); return null; }
    return data?.value || null;
  } catch { return null; }
}

let saleTimer = 0;
function announceSale(sale) {
  window.raven67Sale = sale;
  document.documentElement.classList.toggle("has-sale", !!sale);
  window.dispatchEvent(new CustomEvent("raven67:sale", { detail: sale }));
  // when the sale ends while the page is open, put the normal prices back
  clearTimeout(saleTimer);
  const left = sale?.ends_at ? Date.parse(sale.ends_at) - Date.now() : 0;
  if (left > 0 && left < 2 ** 31 - 1) saleTimer = setTimeout(() => loadCatalog({ refresh: true }), left + 1000);
}

/* Loads the catalog. Returns true when it worked.
   On a refresh that fails, the products already on screen are kept. */
async function loadCatalog({ refresh = false } = {}) {
  try {
    const products = isSupabaseConfigured ? await loadRemoteCatalog() : await loadLocalCatalog();
    const sale = activeSale(await loadSaleSetting());
    announceSale(sale);
    dispatchProducts(applySale(products, sale), refresh);
    return true;
  } catch (error) {
    console.warn("Could not load products.", error);
    if (!refresh) dispatchProducts([]);
    return false;
  }
}

// Used by the catalog's refresh button
window.raven67ReloadCatalog = () => loadCatalog({ refresh: true });

loadCatalog();

// Local-only mode: update when the admin page (in another tab) saves a product
if (!isSupabaseConfigured) {
  window.addEventListener("storage", (event) => {
    if (event.key === "raven67-catalog-revision" || event.key === SALE_LOCAL_KEY) loadCatalog({ refresh: true });
  });
}
