-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text not null default 'engineer' check (role in ('owner', 'admin', 'engineer')),
  created_at timestamptz default now()
);

-- Clients (companies you support)
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  contact_name text,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Tickets
create table tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  client_id uuid references clients(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Time entries
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  minutes integer not null,
  notes text,
  created_at timestamptz default now()
);

-- Company settings (logo, branding, defaults for invoices/quotes)
create table company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  company_email text,
  company_phone text,
  company_address text,
  company_city text,
  company_state text,
  company_zip text,
  logo_url text,
  tax_rate numeric(5,2) default 0,
  invoice_prefix text default 'INV',
  quote_prefix text default 'QT',
  payment_terms text default 'Net 30',
  default_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Counters for auto-numbering quotes and invoices
create table document_counters (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('quote', 'invoice')),
  last_number integer not null default 0
);
insert into document_counters (type, last_number) values ('quote', 0), ('invoice', 0);

-- Function to get next document number
create or replace function next_document_number(doc_type text)
returns integer as $$
declare
  next_num integer;
begin
  update document_counters
  set last_number = last_number + 1
  where type = doc_type
  returning last_number into next_num;
  return next_num;
end;
$$ language plpgsql security definer;

-- Quotes
create table quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null,
  client_id uuid references clients(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  title text,
  notes text,
  valid_until date,
  subtotal numeric(10,2) default 0,
  tax_rate numeric(5,2) default 0,
  tax_amount numeric(10,2) default 0,
  total numeric(10,2) default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Invoices
create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  client_id uuid references clients(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  title text,
  notes text,
  due_date date,
  subtotal numeric(10,2) default 0,
  tax_rate numeric(5,2) default 0,
  tax_amount numeric(10,2) default 0,
  total numeric(10,2) default 0,
  paid_at timestamptz,
  payment_link text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Line items (shared between quotes and invoices)
create table line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  item_name text,
  description text not null,
  quantity numeric(10,2) default 1,
  unit_price numeric(10,2) default 0,
  total numeric(10,2) generated always as (quantity * unit_price) stored,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Auto-create profile when a user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- RLS
alter table profiles enable row level security;
alter table clients enable row level security;
alter table tickets enable row level security;
alter table time_entries enable row level security;
alter table company_settings enable row level security;
alter table quotes enable row level security;
alter table invoices enable row level security;
alter table line_items enable row level security;
alter table document_counters enable row level security;

-- Profiles
create policy "Authenticated users can read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "Authenticated users can update own profile" on profiles for update using (auth.uid() = id);

-- Clients
create policy "Authenticated users can read clients" on clients for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage clients" on clients for all using (auth.role() = 'authenticated');

-- Tickets
create policy "Authenticated users can read tickets" on tickets for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage tickets" on tickets for all using (auth.role() = 'authenticated');

-- Time entries
create policy "Authenticated users can read time entries" on time_entries for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage time entries" on time_entries for all using (auth.role() = 'authenticated');

-- Company settings
create policy "Authenticated users can read company settings" on company_settings for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage company settings" on company_settings for all using (auth.role() = 'authenticated');

-- Quotes
create policy "Authenticated users can read quotes" on quotes for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage quotes" on quotes for all using (auth.role() = 'authenticated');

-- Invoices
create policy "Authenticated users can read invoices" on invoices for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage invoices" on invoices for all using (auth.role() = 'authenticated');

-- Line items
create policy "Authenticated users can read line items" on line_items for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage line items" on line_items for all using (auth.role() = 'authenticated');

-- Document counters
create policy "Authenticated users can read counters" on document_counters for select using (auth.role() = 'authenticated');
create policy "Authenticated users can update counters" on document_counters for update using (auth.role() = 'authenticated');

-- Company expenses (internal operating costs)
create table expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vendor text,
  category text not null default 'Other',
  amount numeric(10,2) not null,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual', 'one_time')),
  notes text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  start_date date,
  created_at timestamptz default now()
);

alter table expenses enable row level security;
create policy "Authenticated users can manage expenses" on expenses for all using (auth.role() = 'authenticated');
