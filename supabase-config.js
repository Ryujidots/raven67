// Raven67 — Supabase connection.
// 1. Rename this file to  supabase-config.js
// 2. Paste your values from Supabase → Project Settings → API (or "Data API" / "API Keys").
//    Use the PUBLISHABLE key (starts with sb_publishable_) or the "anon public" key.
//    NEVER put the secret / service_role key here — this file is public on your website.

export const SUPABASE_URL = "https://mmvgmcpixbqkypjnpjqc.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aKxVvNatfkDoiHM6hPrckQ_J0CJOQmR";

export const PRODUCTS_TABLE = "products";
export const PRODUCT_IMAGES_BUCKET = "product-images";
export const REVIEWS_TABLE = "reviews";

// Leave this line as it is
export const isSupabaseConfigured =
  Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) && !SUPABASE_URL.includes("YOUR-PROJECT-ID") && !SUPABASE_PUBLISHABLE_KEY.startsWith("PASTE-");
