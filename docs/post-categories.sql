-- 在 Supabase SQL Editor 執行一次。建立最多兩層的文章分類與 RLS。
create table if not exists public.post_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  parent_id uuid references public.post_categories(id) on delete restrict,
  description text default '', seo_title text default '', seo_description text default '',
  sort_order integer not null default 0, is_visible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
alter table public.posts add column if not exists category_id uuid references public.post_categories(id) on delete set null;
create index if not exists posts_category_id_idx on public.posts(category_id);
alter table public.post_categories enable row level security;
drop policy if exists "public reads visible post categories" on public.post_categories;
create policy "public reads visible post categories" on public.post_categories for select using (is_visible = true or auth.role() = 'authenticated');
drop policy if exists "authenticated manages post categories" on public.post_categories;
create policy "authenticated manages post categories" on public.post_categories for all to authenticated using (true) with check (true);
insert into public.post_categories (name, slug, sort_order) values
('花生研究室','research',10),('最新消息','news',20),('品牌故事','brand-story',30),('檢驗報告','reports',40),('常見問題','faq',50),('SEO 文章','seo',60)
on conflict (slug) do nothing;
update public.posts p set category_id = c.id from public.post_categories c where p.category_id is null and p.category = c.name;
