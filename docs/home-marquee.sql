-- 在 Supabase SQL Editor 執行一次：加入首頁跑馬燈設定與安全的公開唯讀 RPC。
alter table public.system_settings
  add column if not exists marquee_enabled boolean not null default false,
  add column if not exists marquee_text text,
  add column if not exists marquee_url text,
  add column if not exists marquee_new_tab boolean not null default false;

create or replace function public.get_public_home_settings()
returns table (
  marquee_enabled boolean,
  marquee_text text,
  marquee_url text,
  marquee_new_tab boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(s.marquee_enabled, false),
    s.marquee_text,
    s.marquee_url,
    coalesce(s.marquee_new_tab, false)
  from public.system_settings s
  order by s.created_at asc
  limit 1;
$$;

revoke all on function public.get_public_home_settings() from public;
grant execute on function public.get_public_home_settings() to anon, authenticated;
