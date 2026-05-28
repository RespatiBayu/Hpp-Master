create table if not exists businesses (
  id text primary key,
  name text not null,
  slug text not null unique,
  allow_admin_create_staff boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_members (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  invitation_email text,
  role text not null check (role in ('super_admin', 'admin', 'staff')),
  status text not null check (status in ('active', 'invited')) default 'invited',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists idx_business_members_user_id on business_members(user_id);
create index if not exists idx_business_members_invitation_email on business_members(invitation_email);
create unique index if not exists idx_business_members_unique_invitation
  on business_members(business_id, invitation_email)
  where invitation_email is not null;

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_expires_at on sessions(expires_at);

create table if not exists items (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Umum',
  type text not null check (type in ('RAW', 'HALF_FINISHED', 'FINISHED')),
  unit text not null,
  min_qty numeric not null default 0,
  selling_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_items_business_id on items(business_id);

create table if not exists purchases (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  date date not null,
  item_id text not null references items(id) on delete restrict,
  qty numeric not null,
  total_cost numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_purchases_business_id on purchases(business_id);
create index if not exists idx_purchases_item_id on purchases(item_id);

create table if not exists productions (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  date date not null,
  finished_item_id text not null references items(id) on delete restrict,
  finished_qty numeric not null,
  overhead_cost numeric not null default 0,
  total_hpp numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_productions_business_id on productions(business_id);
create index if not exists idx_productions_finished_item_id on productions(finished_item_id);

create table if not exists production_materials (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  production_id text not null references productions(id) on delete cascade,
  item_id text not null references items(id) on delete restrict,
  qty numeric not null
);

create index if not exists idx_production_materials_business_id on production_materials(business_id);
create index if not exists idx_production_materials_production_id on production_materials(production_id);

create table if not exists sales (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  date date not null,
  item_id text not null references items(id) on delete restrict,
  qty numeric not null,
  total_revenue numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_business_id on sales(business_id);
create index if not exists idx_sales_item_id on sales(item_id);

create table if not exists expenses (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_business_id on expenses(business_id);

create table if not exists activity_logs (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  user_id text references users(id) on delete set null,
  user_email text not null,
  action text not null,
  details text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_business_id on activity_logs(business_id);
create index if not exists idx_activity_logs_created_at on activity_logs(created_at desc);

create table if not exists business_menu_settings (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  menu_key text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, menu_key)
);

create index if not exists idx_business_menu_settings_business_id on business_menu_settings(business_id);

create table if not exists business_menu_packages (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  name text not null,
  description text,
  menu_visibility_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_menu_packages_business_id on business_menu_packages(business_id);
create unique index if not exists idx_business_menu_packages_single_active
  on business_menu_packages(business_id)
  where is_active = true;

alter table business_members
drop constraint if exists business_members_role_check;

update business_members
set role = 'super_admin'
where role = 'owner';

alter table business_members
add constraint business_members_role_check
check (role in ('super_admin', 'admin', 'staff'));

alter table businesses
add column if not exists allow_admin_create_staff boolean not null default true;

alter table items
add column if not exists category text not null default 'Umum';

update items
set category = 'Umum'
where category is null;

create table if not exists item_categories (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, normalized_name)
);

create index if not exists idx_item_categories_business_id on item_categories(business_id);

insert into item_categories (id, business_id, name, normalized_name)
select
  'cat_' || md5(source.business_id || '|' || source.normalized_name),
  source.business_id,
  source.name,
  source.normalized_name
from (
  select distinct on (items.business_id, lower(trim(items.category)))
    items.business_id,
    trim(items.category) as name,
    lower(trim(items.category)) as normalized_name
  from items
  where trim(coalesce(items.category, '')) <> ''
  order by
    items.business_id,
    lower(trim(items.category)),
    case
      when trim(items.category) ~ '[A-Z]' then 0
      else 1
    end,
    length(trim(items.category)) desc,
    trim(items.category) asc
) as source
on conflict (business_id, normalized_name) do update
set name = excluded.name,
    updated_at = now();

create table if not exists item_photos (
  item_id text primary key references items(id) on delete cascade,
  business_id text not null references businesses(id) on delete cascade,
  mime_type text not null,
  data bytea not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_item_photos_business_id on item_photos(business_id);

create table if not exists business_pos_settings (
  id text primary key,
  business_id text not null unique references businesses(id) on delete cascade,
  paper_width text not null default '58mm',
  header_text text,
  footer_text text,
  show_cashier boolean not null default true,
  show_payment_method boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pos_orders (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  cashier_member_id text references business_members(id) on delete set null,
  cashier_user_id text references users(id) on delete set null,
  order_number text not null,
  share_token text not null unique,
  order_date date not null,
  status text not null default 'completed',
  payment_method text not null,
  subtotal numeric not null default 0,
  total numeric not null default 0,
  paid_amount numeric not null default 0,
  change_amount numeric not null default 0,
  receipt_settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, order_number)
);

create index if not exists idx_pos_orders_business_id on pos_orders(business_id);
create index if not exists idx_pos_orders_order_date on pos_orders(order_date desc);
create index if not exists idx_pos_orders_cashier_member_id on pos_orders(cashier_member_id);

create table if not exists pos_order_lines (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  pos_order_id text not null references pos_orders(id) on delete cascade,
  item_id text not null references items(id) on delete restrict,
  item_name_snapshot text not null,
  item_category_snapshot text not null,
  unit_snapshot text not null,
  qty numeric not null,
  unit_price numeric not null,
  line_total numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_order_lines_business_id on pos_order_lines(business_id);
create index if not exists idx_pos_order_lines_order_id on pos_order_lines(pos_order_id);

alter table sales
add column if not exists source text not null default 'manual';

alter table sales
add column if not exists pos_order_id text references pos_orders(id) on delete set null;

alter table sales
add column if not exists unit_price numeric;

update sales
set unit_price = case
  when qty = 0 then 0
  else total_revenue / qty
end
where unit_price is null;

create index if not exists idx_sales_pos_order_id on sales(pos_order_id);

create table if not exists ai_intake_logs (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  user_id text references users(id) on delete set null,
  telegram_chat_id text,
  source text not null,
  mode text not null,
  model text,
  status text not null default 'draft',
  prompt_excerpt text,
  result_json jsonb,
  confidence numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_intake_logs_business_id on ai_intake_logs(business_id);
create index if not exists idx_ai_intake_logs_created_at on ai_intake_logs(created_at desc);

create table if not exists telegram_chat_links (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  user_id text references users(id) on delete set null,
  member_id text references business_members(id) on delete set null,
  link_code text not null unique,
  chat_id text unique,
  chat_username text,
  link_status text not null default 'pending',
  expires_at timestamptz not null,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_telegram_chat_links_business_id on telegram_chat_links(business_id);

create table if not exists telegram_pending_drafts (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  chat_link_id text not null references telegram_chat_links(id) on delete cascade,
  target_menu text not null,
  draft_json jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_pending_drafts_chat_link_id on telegram_pending_drafts(chat_link_id);
