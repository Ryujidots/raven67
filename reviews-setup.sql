-- =====================================================================
-- Raven67 — customer reviews table
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- =====================================================================

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  display_name  text        not null check (char_length(display_name) between 1 and 60),  -- already masked, e.g. "a**ng"
  message       text        not null check (char_length(message) between 1 and 600),
  rating        numeric(2,1) not null default 5 check (rating between 1 and 5),
  product_label text        check (product_label is null or char_length(product_label) <= 60),
  is_active     boolean     not null default true,   -- false = hidden from the website
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.reviews enable row level security;

-- Anyone visiting the website can read reviews that are switched on.
drop policy if exists "Public can read visible reviews" on public.reviews;
create policy "Public can read visible reviews"
  on public.reviews for select
  to anon, authenticated
  using (is_active = true);

-- Signed-in admins can see hidden reviews and add / edit / delete them.
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

-- IMPORTANT: "authenticated" means ANY signed-in Supabase user.
-- Keep public sign-ups OFF (Authentication → Sign In / Providers → "Allow new users to sign up")
-- so that only your own admin account can sign in. If your products table uses a stricter
-- rule (for example checking your admin email), use that same rule here instead of "true".
