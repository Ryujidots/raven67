-- FiveM Store US product catalog and image storage setup
-- 1) Create a Supabase Auth user for yourself in Authentication > Users.
-- 2) Replace the UUID below with that user's ID before running this file.
-- 3) Create a PUBLIC Storage bucket named product-images in Storage first.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_code text not null default '',
  model_name text not null default '',
  description text not null default '',
  category text not null default 'Custom Peds',
  price numeric(10,2) not null default 5.00 check (price >= 0),
  original_price numeric(10,2) check (original_price is null or original_price >= 0),
  rating numeric(2,1) not null default 5.0 check (rating >= 0 and rating <= 5),
  image_url text not null,
  image_path text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.products add column if not exists product_code text not null default '';
alter table public.products add column if not exists model_name text not null default '';
alter table public.products add column if not exists is_sold boolean not null default false;
create unique index if not exists products_product_code_unique
  on public.products (product_code) where product_code <> '';
revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

drop policy if exists "Anyone can read live products" on public.products;
create policy "Anyone can read live products"
on public.products for select to anon, authenticated
using (is_active = true or (select auth.uid()) = 'PUT_ADMIN_AUTH_USER_UUID_HERE'::uuid);

drop policy if exists "Store admin can add products" on public.products;
create policy "Store admin can add products"
on public.products for insert to authenticated
with check ((select auth.uid()) = 'PUT_ADMIN_AUTH_USER_UUID_HERE'::uuid);

drop policy if exists "Store admin can edit products" on public.products;
create policy "Store admin can edit products"
on public.products for update to authenticated
using ((select auth.uid()) = 'PUT_ADMIN_AUTH_USER_UUID_HERE'::uuid)
with check ((select auth.uid()) = 'PUT_ADMIN_AUTH_USER_UUID_HERE'::uuid);

drop policy if exists "Store admin can delete products" on public.products;
create policy "Store admin can delete products"
on public.products for delete to authenticated
using ((select auth.uid()) = 'PUT_ADMIN_AUTH_USER_UUID_HERE'::uuid);


-- The public bucket serves storefront images. These policies keep upload,
-- listing, replacement, and removal restricted to your Auth user.
drop policy if exists "Store admin can view product image objects" on storage.objects;
create policy "Store admin can view product image objects"
on storage.objects for select to authenticated
using (bucket_id = 'product-images' and (select auth.uid()) = 'PUT_ADMIN_AUTH_USER_UUID_HERE'::uuid);

drop policy if exists "Store admin can upload product images" on storage.objects;
create policy "Store admin can upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and (select auth.uid()) = 'PUT_ADMIN_AUTH_USER_UUID_HERE'::uuid);

drop policy if exists "Store admin can delete product images" on storage.objects;
create policy "Store admin can delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (select auth.uid()) = 'PUT_ADMIN_AUTH_USER_UUID_HERE'::uuid);


