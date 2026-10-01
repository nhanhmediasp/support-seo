-- Public, read-only SEO report links.
-- Run after schema.sql and multi-project.sql.

create table if not exists public.public_report_shares (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  share_token text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_report_shares enable row level security;

drop policy if exists "public can view shared reports" on public.public_report_shares;
drop policy if exists "members can view shared reports" on public.public_report_shares;
create policy "members can view shared reports" on public.public_report_shares
  for select to authenticated using (public.can_access_site(site_id));

drop policy if exists "editors can publish shared reports" on public.public_report_shares;
create policy "editors can publish shared reports" on public.public_report_shares
  for insert to authenticated with check (public.can_edit_site(site_id));

drop policy if exists "editors can update shared reports" on public.public_report_shares;
create policy "editors can update shared reports" on public.public_report_shares
  for update to authenticated using (public.can_edit_site(site_id)) with check (public.can_edit_site(site_id));

drop policy if exists "editors can delete shared reports" on public.public_report_shares;
create policy "editors can delete shared reports" on public.public_report_shares
  for delete to authenticated using (public.can_edit_site(site_id));

grant select, insert, update, delete on table public.public_report_shares to authenticated;

-- Anonymous visitors cannot list reports. They can only request the exact,
-- unguessable token contained in a shared URL.
revoke all on table public.public_report_shares from anon;
create or replace function public.get_public_seo_report(p_share_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select payload
  from public.public_report_shares
  where share_token = p_share_token
  limit 1;
$$;
revoke all on function public.get_public_seo_report(text) from public;
grant execute on function public.get_public_seo_report(text) to anon, authenticated;
