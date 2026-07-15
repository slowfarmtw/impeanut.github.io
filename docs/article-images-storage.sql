-- 花生一生文章內文圖片 Storage 設定
-- 在 Supabase Dashboard → SQL Editor 執行一次。
-- 建立公開讀取的 article-images bucket；只有已登入後台的 authenticated 使用者可以上傳與管理。

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'article-images',
  'article-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated uploads article images" on storage.objects;
create policy "authenticated uploads article images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'article-images');

-- Storage upload 會回傳物件資料；允許後台登入者讀取此 bucket 的物件資訊。
drop policy if exists "authenticated reads article image objects" on storage.objects;
create policy "authenticated reads article image objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'article-images');

drop policy if exists "authenticated deletes article images" on storage.objects;
create policy "authenticated deletes article images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'article-images');
