create table if not exists businesses (
  id text primary key,
  name text not null,
  slug text not null unique,
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
