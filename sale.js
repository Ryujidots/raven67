/* Store-wide sale — shared by the storefront (catalog-client.js) and admin.html.
   The sale is ONE setting (Supabase table "store_settings", key "sale"):
     { active: true, percent: 20, label: "Weekend Sale", scope: ["peds","head","clothing"], ends_at: "2026-11-09T17:00:00.000Z" | null }
   Real product prices are never changed: the discount is applied when the catalog is shown,
   so ending the sale (or reaching ends_at) puts every price back automatically. */

export const SALE_KEY = "sale";
export const SALE_LOCAL_KEY = "raven67-sale";
export const SALE_SCOPES = { peds: "Peds", head: "Head Only", clothing: "Clothing" };

export function collectionOfCategory(category) {
  const c = String(category || "").toLowerCase();
  if (c.startsWith("clothing")) return "clothing";
  if (c.startsWith("free")) return "free";
  if (c.startsWith("head")) return "head";
  return "peds";
}

/* Returns the sale if it is switched on and not expired, otherwise null. */
export function activeSale(raw, now = Date.now()) {
  if (!raw || raw.active !== true) return null;
  const percent = Math.round(Number(raw.percent));
  if (!Number.isFinite(percent) || percent < 1 || percent > 90) return null;
  const endsAt = raw.ends_at ? Date.parse(raw.ends_at) : null;
  if (endsAt !== null && (!Number.isFinite(endsAt) || endsAt <= now)) return null;
  const scope = (Array.isArray(raw.scope) && raw.scope.length ? raw.scope : Object.keys(SALE_SCOPES)).filter((s) => s in SALE_SCOPES);
  if (!scope.length) return null;
  return { percent, label: String(raw.label || "").trim().slice(0, 40), scope, ends_at: endsAt ? new Date(endsAt).toISOString() : null };
}

/* Sale price, rounded to whole dollars (35 at 20% → 28). */
export function salePrice(price, percent) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return p;
  return Math.max(1, Math.round(p * (100 - percent) / 100));
}

export function inSale(product, sale) {
  if (!sale || product.is_sold) return false;
  const price = Number(product.price);
  return Number.isFinite(price) && price > 0 && sale.scope.includes(collectionOfCategory(product.category));
}

/* The struck-through price is the item's normal price, so every card shows the same −X% as the banner. */
export function applySale(products, sale) {
  if (!sale) return products;
  return products.map((product) => {
    if (!inSale(product, sale)) return product;
    const base = Number(product.price);
    return { ...product, price: salePrice(base, sale.percent), original_price: base, base_price: base, on_sale: true };
  });
}

/* "Weekend Sale" / "Sale" + what it covers, for banners. */
export function saleScopeText(sale) {
  const s = sale.scope;
  if (s.length === 3) return "everything";
  const names = { peds: "all peds", head: "head-only peds", clothing: "all clothing" };
  return s.map((k) => names[k]).join(" & ");
}
