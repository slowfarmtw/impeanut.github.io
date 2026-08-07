-- 訂單與銷售管理欄位
-- 用途：統一記錄賣貨便、現場、親友與社群私訊訂單，並追蹤實際入帳。

alter table public.orders
  add column if not exists order_source text not null default 'website',
  add column if not exists order_date timestamptz not null default now(),
  add column if not exists external_order_number text,
  add column if not exists fulfillment_method text not null default 'shipping',
  add column if not exists pickup_store text,
  add column if not exists settlement_status text not null default 'unsettled',
  add column if not exists settled_amount integer,
  add column if not exists settled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_order_source_check'
  ) then
    alter table public.orders
      add constraint orders_order_source_check
      check (order_source in ('website', 'myship', 'onsite', 'friends_family', 'social', 'other', 'manual_legacy'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_fulfillment_method_check'
  ) then
    alter table public.orders
      add constraint orders_fulfillment_method_check
      check (fulfillment_method in ('myship', 'onsite', 'meetup', 'shipping', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_settlement_status_check'
  ) then
    alter table public.orders
      add constraint orders_settlement_status_check
      check (settlement_status in ('unsettled', 'settled', 'not_applicable'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_settled_amount_check'
  ) then
    alter table public.orders
      add constraint orders_settled_amount_check
      check (settled_amount is null or settled_amount >= 0);
  end if;
end
$$;

update public.orders
set order_date = created_at
where order_date is null
   or order_date > created_at + interval '1 minute';

update public.orders
set order_source = 'manual_legacy'
where internal_note like '%【訂單來源】%'
  and order_source = 'website';

update public.orders
set settlement_status = 'settled',
    settled_amount = total_amount,
    settled_at = coalesce(paid_at, updated_at, created_at)
where payment_status = 'paid'
  and settlement_status = 'unsettled';

create index if not exists orders_order_source_idx
  on public.orders (order_source);

create index if not exists orders_order_date_idx
  on public.orders (order_date desc);

create unique index if not exists orders_external_order_number_unique_idx
  on public.orders (external_order_number)
  where external_order_number is not null;
