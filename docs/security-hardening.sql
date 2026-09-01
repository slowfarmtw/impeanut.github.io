-- 花生一生：後台授權與 Storage 安全強化
-- 執行位置：Supabase SQL Editor
-- 前置條件：目前專案只有一個有效 Auth 使用者；此腳本會將該帳號標記為 admin。

begin;

do $$
declare
  active_user_count integer;
  admin_user_id uuid;
begin
  select count(*)
    into active_user_count
  from auth.users
  where deleted_at is null;

  if active_user_count <> 1 then
    raise exception '安全停止：預期恰好 1 個有效 Auth 使用者，實際為 %。請先人工指定管理員。', active_user_count;
  end if;

  select id
    into admin_user_id
  from auth.users
  where deleted_at is null
  limit 1;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'admin')
  where id = admin_user_id;

  insert into public.profiles (id, email, name, role, is_active, created_at, updated_at)
  select
    id,
    email,
    nullif(coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name'), ''),
    'admin',
    true,
    coalesce(created_at, now()),
    now()
  from auth.users
  where id = admin_user_id
  on conflict (id) do update
  set role = 'admin', is_active = true, updated_at = now();
end
$$;

-- user_metadata 可由使用者自行修改，授權只讀取伺服器管理的 app_metadata。
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

-- 移除原先「任何 authenticated 帳號皆可管理」的政策。
drop policy if exists "Authenticated users can read inventory logs" on public.inventory_logs;
drop policy if exists "Authenticated users can insert inventory logs" on public.inventory_logs;
drop policy if exists "Authenticated users can update inventory logs" on public.inventory_logs;
drop policy if exists "Authenticated users can delete inventory logs" on public.inventory_logs;
drop policy if exists "Authenticated users can read order items" on public.order_items;
drop policy if exists "Authenticated users can insert order items" on public.order_items;
drop policy if exists "Authenticated users can update order items" on public.order_items;
drop policy if exists "Authenticated users can delete order items" on public.order_items;
drop policy if exists "Authenticated users can read order logs" on public.order_logs;
drop policy if exists "Authenticated users can insert order logs" on public.order_logs;
drop policy if exists "Authenticated users can update order logs" on public.order_logs;
drop policy if exists "Authenticated users can delete order logs" on public.order_logs;
drop policy if exists "Authenticated users can read orders" on public.orders;
drop policy if exists "Authenticated users can insert orders" on public.orders;
drop policy if exists "Authenticated users can update orders" on public.orders;
drop policy if exists "Authenticated users can delete orders" on public.orders;
drop policy if exists "Authenticated users can read all posts" on public.posts;
drop policy if exists "Authenticated users can insert posts" on public.posts;
drop policy if exists "Authenticated users can update posts" on public.posts;
drop policy if exists "Authenticated users can delete posts" on public.posts;
drop policy if exists "Authenticated users can read all products" on public.products;
drop policy if exists "Authenticated users can insert products" on public.products;
drop policy if exists "Authenticated users can update products" on public.products;
drop policy if exists "Authenticated users can delete products" on public.products;
drop policy if exists "Authenticated users can read system settings" on public.system_settings;
drop policy if exists "Authenticated users can insert system settings" on public.system_settings;
drop policy if exists "Authenticated users can update system settings" on public.system_settings;
drop policy if exists "Authenticated users can delete system settings" on public.system_settings;
drop policy if exists "authenticated manages post categories" on public.post_categories;
drop policy if exists "public reads visible post categories" on public.post_categories;

-- 公開讀取只開放上架商品、已發布文章與可見分類。
drop policy if exists "Public can read active products" on public.products;
create policy "anon reads active products"
on public.products for select to anon
using (status = 'active' and is_visible = true);

drop policy if exists "Public can read published posts" on public.posts;
create policy "anon reads published posts"
on public.posts for select to anon
using (status = 'published');

create policy "anon reads visible post categories"
on public.post_categories for select to anon
using (is_visible = true);

-- 後台政策統一要求 app_metadata.role = admin，並排除 anonymous sign-in。
create policy "admins manage inventory logs"
on public.inventory_logs for all to authenticated
using (
  (select auth.jwt()->'app_metadata'->>'role') = 'admin'
  and coalesce((select auth.jwt()->>'is_anonymous'), 'false') <> 'true'
)
with check (
  (select auth.jwt()->'app_metadata'->>'role') = 'admin'
  and coalesce((select auth.jwt()->>'is_anonymous'), 'false') <> 'true'
);

create policy "admins manage order items"
on public.order_items for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins manage order logs"
on public.order_logs for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins manage orders"
on public.orders for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins manage posts"
on public.posts for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins manage products"
on public.products for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins manage post categories"
on public.post_categories for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admins manage system settings"
on public.system_settings for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Data API 權限與 RLS 分層設定：anon 僅能讀公開內容。
revoke all on table
  public.inventory_logs,
  public.order_items,
  public.order_logs,
  public.orders,
  public.post_categories,
  public.posts,
  public.products,
  public.system_settings
from anon, authenticated;

grant select on table public.post_categories, public.posts, public.products to anon;
grant select, insert, update, delete on table
  public.inventory_logs,
  public.order_items,
  public.order_logs,
  public.orders,
  public.post_categories,
  public.posts,
  public.products,
  public.system_settings
to authenticated;

-- product-images 不再允許匿名上傳，並限制為 5 MB 圖片。
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (coalesce(qual, '') like '%product-images%'
        or coalesce(with_check, '') like '%product-images%')
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;
end
$$;

drop policy if exists "authenticated uploads article images" on storage.objects;
drop policy if exists "authenticated reads article image objects" on storage.objects;
drop policy if exists "authenticated deletes article images" on storage.objects;

create policy "admins insert managed images"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('product-images', 'article-images')
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);

create policy "admins select managed images"
on storage.objects for select to authenticated
using (
  bucket_id in ('product-images', 'article-images')
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);

create policy "admins update managed images"
on storage.objects for update to authenticated
using (
  bucket_id in ('product-images', 'article-images')
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
)
with check (
  bucket_id in ('product-images', 'article-images')
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);

create policy "admins delete managed images"
on storage.objects for delete to authenticated
using (
  bucket_id in ('product-images', 'article-images')
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
where id in ('product-images', 'article-images');

-- 函式預設不再對 PUBLIC 開放；只保留前台實際使用的 RPC。
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.create_public_order(jsonb, jsonb) to anon, authenticated;
grant execute on function public.get_public_analytics_settings() to anon, authenticated;
grant execute on function public.get_public_checkout_settings() to anon, authenticated;
grant execute on function public.get_public_home_settings() to anon, authenticated;
alter function public.update_updated_at_column() set search_path = pg_catalog;

commit;

-- 執行後請登出再登入，讓新的 app_metadata 進入 JWT，再測試後台讀寫與圖片上傳。
