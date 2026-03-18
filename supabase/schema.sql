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

-- RLS (Row Level Security)
alter table profiles enable row level security;
alter table clients enable row level security;
alter table tickets enable row level security;
alter table time_entries enable row level security;

-- Policies: logged-in users can read/write everything for now
create policy "Authenticated users can read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "Authenticated users can update own profile" on profiles for update using (auth.uid() = id);

create policy "Authenticated users can read clients" on clients for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage clients" on clients for all using (auth.role() = 'authenticated');

create policy "Authenticated users can read tickets" on tickets for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage tickets" on tickets for all using (auth.role() = 'authenticated');

create policy "Authenticated users can read time entries" on time_entries for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage time entries" on time_entries for all using (auth.role() = 'authenticated');
