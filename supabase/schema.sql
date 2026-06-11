-- ============================================================
-- IT HELP DESK - Supabase Database Schema
-- ============================================================

-- ---------- Users ----------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  emp_id text unique not null,
  password text not null,
  name text not null,
  role text not null,
  dept text,
  email text,
  phone text,
  active boolean not null default true,
  internet boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Departments ----------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

-- ---------- Tickets ----------
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  "desc" text,
  problem_type text,
  priority text,
  status text not null default 'جديدة',
  requester_id uuid references public.users(id),
  requester_name text,
  requester_dept text,
  assigned_id uuid references public.users(id),
  assigned_name text,
  notes text,
  attachments jsonb default '[]'::jsonb,
  history jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  solved_at timestamptz
);

-- ---------- Notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  ticket_id uuid references public.tickets(id),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Devices ----------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id),
  device_type text,
  status text,
  notes text,
  checked_in_by uuid references public.users(id),
  sent_to_tech uuid references public.users(id),
  history jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Internet Users ----------
create table public.internet_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dept text,
  username text,
  password text,
  notes text,
  updated_at timestamptz not null default now()
);

-- ---------- Guidelines ----------
create table public.guidelines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  created_at timestamptz not null default now()
);

-- ---------- Manual Entries ----------
create table public.manual_entries (
  id uuid primary key default gen_random_uuid(),
  device_type text,
  title text not null,
  content text,
  created_at timestamptz not null default now()
);

-- ---------- Knowledge Base (for AI) ----------
create table public.knowledge (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  content text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index idx_tickets_status on public.tickets(status);
create index idx_tickets_requester on public.tickets(requester_id);
create index idx_tickets_assigned on public.tickets(assigned_id);
create index idx_notifications_user on public.notifications(user_id, read);

-- ============================================================
-- Seed data (matches old setupInitialData)
-- ============================================================
insert into public.departments (name) values
  ('تكنلوجيا المعلومات'),
  ('الموارد البشرية'),
  ('المحاسبة'),
  ('الإدارة');

insert into public.users (emp_id, password, name, role, dept, active)
values ('1001', '1001', 'مدير النظام', 'admin', 'تكنلوجيا المعلومات', true);
