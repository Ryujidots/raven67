-- =====================================================================
-- Raven67 — full Supabase setup (products, reviews, image storage)
-- Supabase Dashboard → SQL Editor → New query → paste ALL of this → Run.
-- Safe to run more than once: it only adds what is missing.
-- =====================================================================

-- ---------- 1. PRODUCTS (peds, clothing, free peds) ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid()
);
alter table public.products add column if not exists name           text;
alter table public.products add column if not exists product_code   text;
alter table public.products add column if not exists model_name     text;
alter table public.products add column if not exists description    text;
alter table public.products add column if not exists category       text default 'Custom Peds';
alter table public.products add column if not exists price          numeric(10,2) default 0;
alter table public.products add column if not exists original_price numeric(10,2);
alter table public.products add column if not exists rating         numeric(2,1) default 5;
alter table public.products add column if not exists image_url      text;
alter table public.products add column if not exists image_path     text;
alter table public.products add column if not exists download_url   text;   -- not used any more, harmless
alter table public.products add column if not exists is_active      boolean not null default true;
alter table public.products add column if not exists is_sold        boolean not null default false;
alter table public.products add column if not exists sort_order     integer not null default 0;
alter table public.products add column if not exists created_at     timestamptz not null default now();

alter table public.products enable row level security;

drop policy if exists "Public can read live products" on public.products;
create policy "Public can read live products"
  on public.products for select to anon, authenticated using (is_active = true);

drop policy if exists "Admins can read all products" on public.products;
create policy "Admins can read all products"
  on public.products for select to authenticated using (true);

drop policy if exists "Admins can add products" on public.products;
create policy "Admins can add products"
  on public.products for insert to authenticated with check (true);

drop policy if exists "Admins can edit products" on public.products;
create policy "Admins can edit products"
  on public.products for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products for delete to authenticated using (true);

-- ---------- 2. REVIEWS ----------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  display_name  text        not null check (char_length(display_name) between 1 and 60),  -- already masked, e.g. "a**ng"
  message       text        not null check (char_length(message) between 1 and 600),
  rating        numeric(2,1) not null default 5 check (rating between 1 and 5),
  product_label text        check (product_label is null or char_length(product_label) <= 60),
  is_active     boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.reviews enable row level security;

drop policy if exists "Public can read visible reviews" on public.reviews;
create policy "Public can read visible reviews"
  on public.reviews for select to anon, authenticated using (is_active = true);

drop policy if exists "Admins can read all reviews" on public.reviews;
create policy "Admins can read all reviews"
  on public.reviews for select to authenticated using (true);

drop policy if exists "Admins can add reviews" on public.reviews;
create policy "Admins can add reviews"
  on public.reviews for insert to authenticated with check (true);

drop policy if exists "Admins can edit reviews" on public.reviews;
create policy "Admins can edit reviews"
  on public.reviews for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete reviews" on public.reviews;
create policy "Admins can delete reviews"
  on public.reviews for delete to authenticated using (true);

-- ---------- 3. IMAGE STORAGE (bucket "product-images") ----------
-- If your supabase-config.js uses a different bucket name, change 'product-images' everywhere below.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "Admins can replace product images" on storage.objects;
create policy "Admins can replace product images"
  on storage.objects for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects for delete to authenticated using (bucket_id = 'product-images');

-- IMPORTANT: "authenticated" = ANY signed-in user. Turn public sign-ups OFF
-- (Authentication → Sign In / Providers → "Allow new users to sign up")
-- so only the admin account you create yourself can sign in.
