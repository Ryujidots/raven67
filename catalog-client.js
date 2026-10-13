import { isSupabaseConfigured, PRODUCTS_TABLE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";
import { getLocalProducts } from "./catalog-storage.js";

function dispatchProducts(products) {
  window.dispatchEvent(new CustomEvent("catalog-products-loaded", { detail: products }));
}

async function loadLocalCatalog() {
  const records = await getLocalProducts();
  const activeProducts = records
    .filter((product) => product.is_active !== false && product.image_blob)
    .map((product) => ({
      ...product,
      image_url: URL.createObjectURL(product.image_blob),
    }));
  dispatchProducts(activeProducts);
}

if (isSupabaseConfigured) {
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.116.0");
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const COLUMNS = "id,name,product_code,model_name,description,price,original_price,rating,image_url,image_path,category,is_active,is_sold,sort_order,created_at";
    const query = (columns) => supabase
      .from(PRODUCTS_TABLE)
      .select(columns)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    // download_url is used by the Free Ped tab. If that column hasn't been added yet
    // (free-peds-setup.sql), load the catalog without it so nothing breaks.
    let { data, error } = await query(`${COLUMNS},download_url`);
    if (error && /download_url/i.test(error.message || "")) ({ data, error } = await query(COLUMNS));

    if (!error) dispatchProducts(data || []);
    else {
      console.warn("Could not load Supabase products.", error.message);
      dispatchProducts([]);
    }
  } catch (error) {
    console.warn("Could not connect to Supabase.", error);
    dispatchProducts([]);
  }
} else {
  loadLocalCatalog().catch((error) => {
    console.warn("Could not load local products.", error);
    dispatchProducts([]);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "raven67-catalog-revision") {
      loadLocalCatalog().catch((error) => {
        console.warn("Could not refresh local products.", error);
        dispatchProducts([]);
      });
    }
  });
}
