
-- قاعدة بيانات متجر متعدد البائعين
-- نفذ هذا الملف داخل Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  owner_name text,
  phone text not null,
  city text,
  token text not null,
  status text not null default 'active' check (status in ('active','blocked')),
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  currency text not null default 'MRU',
  image_url text,
  category text,
  status text not null default 'active' check (status in ('active','hidden','deleted')),
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  seller_id uuid not null references sellers(id) on delete restrict,
  buyer_name text not null,
  buyer_phone text not null,
  quantity int not null default 1,
  total_amount numeric(12,2) not null default 0,
  commission_rate numeric(5,4) not null default 0.0200,
  commission_amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_seller_id on products(seller_id);
create index if not exists idx_products_status on products(status);
create index if not exists idx_orders_seller_id on orders(seller_id);
create index if not exists idx_orders_status on orders(status);

-- ملاحظة أمنية:
-- لا تضع SUPABASE_SERVICE_ROLE_KEY داخل ملفات الواجهة.
-- ضعه فقط في Netlify Environment Variables.
