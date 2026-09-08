-- Production data model for Air & Sea SEO Command Center.
-- Run this in a new Supabase project before switching the UI from localStorage.

create extension if not exists "uuid-ossp";

create table if not exists public.sites (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  domain text not null unique,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'editor' check (role in ('admin','editor','client')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(), site_id uuid not null references public.sites(id) on delete cascade,
  title text not null, group_name text not null default 'General', description text, url text,
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  status text not null default 'To do' check (status in ('Backlog','To do','In progress','Waiting','Review','Done','Cancelled')),
  owner_id uuid references public.profiles(id), due_date date, estimated_hours numeric(8,2), actual_hours numeric(8,2),
  result text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default uuid_generate_v4(), site_id uuid not null references public.sites(id) on delete cascade,
  title text not null, slug text, url text, primary_keyword text, secondary_keywords text[], search_intent text,
  funnel text, topic_cluster text, pillar_url text, status text not null default 'Idea',
  content_score integer not null default 0 check (content_score between 0 and 100), onpage_score integer not null default 0 check (onpage_score between 0 and 100),
  publish_date date, updated_at timestamptz not null default now()
);

create table if not exists public.audit_items (
  id uuid primary key default uuid_generate_v4(), site_id uuid not null references public.sites(id) on delete cascade,
  url text not null, issue_type text not null, description text, severity text not null default 'Medium' check (severity in ('Low','Medium','High','Critical')),
  resolution text, status text not null default 'Open' check (status in ('Open','In progress','Done','Ignored')),
  due_date date, task_id uuid references public.tasks(id), discovered_at timestamptz not null default now(), resolved_at timestamptz
);

create table if not exists public.index_checks (
  id uuid primary key default uuid_generate_v4(), site_id uuid not null references public.sites(id) on delete cascade,
  url text not null, url_type text not null default 'Article', status text not null default 'Unknown',
  submitted_at timestamptz, checked_at timestamptz, next_check_at timestamptz, reason text, action text
);

create table if not exists public.backlinks (
  id uuid primary key default uuid_generate_v4(), site_id uuid not null references public.sites(id) on delete cascade,
  source_domain text not null, source_url text, target_url text, anchor_text text, link_type text,
  status text not null default 'Pending check', authority_score integer, contacted_at timestamptz, placed_at timestamptz, last_checked_at timestamptz
);

create table if not exists public.entities (
  id uuid primary key default uuid_generate_v4(), site_id uuid not null references public.sites(id) on delete cascade,
  name text not null, platform text not null, entity_type text, url text, description text, nap_name text, nap_address text, nap_phone text,
  status text not null default 'Draft', index_status text not null default 'Unknown', verified_at timestamptz
);

create table if not exists public.worklogs (
  id uuid primary key default uuid_generate_v4(), site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid references public.profiles(id), task_id uuid references public.tasks(id), work_date date not null default current_date,
  description text not null, started_at timestamptz, ended_at timestamptz, hours numeric(8,2), result text, blockers text, next_step text
);

create table if not exists public.search_console_daily (
  id uuid primary key default uuid_generate_v4(), site_id uuid not null references public.sites(id) on delete cascade,
  metric_date date not null, page text, query text, device text, clicks integer default 0, impressions integer default 0,
  ctr numeric(8,5) default 0, position numeric(8,2) default 0, unique(site_id, metric_date, page, query, device)
);

create table if not exists public.activity_log (
  id uuid primary key default uuid_generate_v4(), site_id uuid references public.sites(id) on delete cascade,
  user_id uuid references public.profiles(id), entity_type text not null, entity_id uuid, action text not null, payload jsonb, created_at timestamptz not null default now()
);

alter table public.sites enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.content_items enable row level security;
alter table public.audit_items enable row level security;
alter table public.index_checks enable row level security;
alter table public.backlinks enable row level security;
alter table public.entities enable row level security;
alter table public.worklogs enable row level security;
alter table public.search_console_daily enable row level security;
alter table public.activity_log enable row level security;

-- Authenticated users can work with the SEO workspace. Refine to site-level membership when multi-client mode is enabled.
create policy "authenticated workspace access" on public.sites for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.profiles for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.tasks for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.content_items for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.audit_items for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.index_checks for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.backlinks for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.entities for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.worklogs for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.search_console_daily for all to authenticated using (true) with check (true);
create policy "authenticated workspace access" on public.activity_log for all to authenticated using (true) with check (true);
