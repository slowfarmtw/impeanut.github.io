-- 花生一生後台：正式顧客資料、訂單關聯與安全回填
-- 執行前提：orders 與 order_items 已存在，Auth 使用 app_metadata.role = admin。

begin;

create schema if not exists private;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null default '未命名顧客',
  primary_phone text,
  primary_email text,
  internal_note text,
  tags text[] not null default '{}'::text[],
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (btrim(name) <> '')
);

create table if not exists public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  identity_type text not null,
  identity_value text not null,
  created_at timestamptz not null default now(),
  constraint customer_identities_type_check check (identity_type in ('phone', 'email')),
  constraint customer_identities_value_not_blank check (btrim(identity_value) <> ''),
  constraint customer_identities_unique unique (identity_type, identity_value)
);

alter table public.orders
  add column if not exists customer_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_customer_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists orders_customer_id_idx
  on public.orders (customer_id, order_date desc);

create index if not exists customer_identities_customer_id_idx
  on public.customer_identities (customer_id);

alter table public.customers enable row level security;
alter table public.customer_identities enable row level security;

revoke all on table public.customers from public, anon, authenticated;
revoke all on table public.customer_identities from public, anon, authenticated;

grant select, update on table public.customers to authenticated;
grant select on table public.customer_identities to authenticated;
grant select, insert, update, delete on table public.customers to service_role;
grant select, insert, update, delete on table public.customer_identities to service_role;

drop policy if exists "Admins can read customers" on public.customers;
drop policy if exists "Admins can update customers" on public.customers;
drop policy if exists "Admins can read customer identities" on public.customer_identities;

create policy "Admins can read customers"
on public.customers
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
);

create policy "Admins can update customers"
on public.customers
for update
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
)
with check (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
);

create policy "Admins can read customer identities"
on public.customer_identities
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
);

create or replace function private.set_customer_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_customer_updated_at() from public, anon, authenticated;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function private.set_customer_updated_at();

create or replace function private.attach_order_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(
    coalesce(
      nullif(btrim(new.customer_phone), ''),
      nullif(btrim(new.shipping_phone), ''),
      ''
    ),
    '[^0-9]',
    '',
    'g'
  );
  v_email text := lower(coalesce(nullif(btrim(new.customer_email), ''), ''));
  v_name text := coalesce(
    nullif(btrim(new.customer_name), ''),
    nullif(btrim(new.shipping_name), ''),
    '未命名顧客'
  );
  v_phone_customer_id uuid;
  v_email_customer_id uuid;
  v_customer_id uuid;
begin
  if v_phone = '' and v_email = '' then
    new.customer_id := null;
    return new;
  end if;

  if v_phone <> '' then
    select customer_id
      into v_phone_customer_id
    from public.customer_identities
    where identity_type = 'phone'
      and identity_value = v_phone;
  end if;

  if v_email <> '' then
    select customer_id
      into v_email_customer_id
    from public.customer_identities
    where identity_type = 'email'
      and identity_value = v_email;
  end if;

  if v_phone_customer_id is not null
     and v_email_customer_id is not null
     and v_phone_customer_id <> v_email_customer_id then
    update public.customers
    set needs_review = true
    where id in (v_phone_customer_id, v_email_customer_id);

    -- Email 通常比配送電話穩定；衝突時先保留 Email 所屬顧客並交由後台人工確認。
    new.customer_id := v_email_customer_id;
    return new;
  end if;

  v_customer_id := coalesce(v_email_customer_id, v_phone_customer_id);

  if v_customer_id is null then
    insert into public.customers (
      id,
      name,
      primary_phone,
      primary_email,
      created_at,
      updated_at
    )
    values (
      extensions.gen_random_uuid(),
      v_name,
      coalesce(
        nullif(btrim(new.customer_phone), ''),
        nullif(btrim(new.shipping_phone), '')
      ),
      nullif(btrim(new.customer_email), ''),
      coalesce(new.order_date, new.created_at, now()),
      now()
    )
    returning id into v_customer_id;
  else
    update public.customers
    set
      name = v_name,
      primary_phone = coalesce(
        nullif(btrim(new.customer_phone), ''),
        nullif(btrim(new.shipping_phone), ''),
        primary_phone
      ),
      primary_email = coalesce(nullif(btrim(new.customer_email), ''), primary_email)
    where id = v_customer_id;
  end if;

  if v_phone <> '' then
    insert into public.customer_identities (
      id,
      customer_id,
      identity_type,
      identity_value
    )
    values (
      extensions.gen_random_uuid(),
      v_customer_id,
      'phone',
      v_phone
    )
    on conflict (identity_type, identity_value) do nothing;
  end if;

  if v_email <> '' then
    insert into public.customer_identities (
      id,
      customer_id,
      identity_type,
      identity_value
    )
    values (
      extensions.gen_random_uuid(),
      v_customer_id,
      'email',
      v_email
    )
    on conflict (identity_type, identity_value) do nothing;
  end if;

  new.customer_id := v_customer_id;
  return new;
end;
$$;

revoke all on function private.attach_order_customer() from public, anon, authenticated;

drop trigger if exists orders_attach_customer on public.orders;
create trigger orders_attach_customer
before insert or update of customer_name, customer_phone, customer_email, shipping_name, shipping_phone
on public.orders
for each row execute function private.attach_order_customer();

-- 依銷售日期逐筆回填，讓同一 Email 曾使用的不同電話保留為同一顧客的身分別名。
do $$
declare
  v_order_id uuid;
begin
  for v_order_id in
    select id
    from public.orders
    where customer_phone is not null
       or customer_email is not null
       or shipping_phone is not null
    order by coalesce(order_date, created_at), created_at, id
  loop
    update public.orders
    set customer_name = customer_name
    where id = v_order_id;
  end loop;
end;
$$;

commit;
