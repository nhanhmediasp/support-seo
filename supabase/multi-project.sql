-- Run after schema.sql for multi-account and multi-website mode.
alter table public.sites add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create table if not exists public.site_members (
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);

create table if not exists public.site_workspaces (
  site_id uuid primary key references public.sites(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_members enable row level security;
alter table public.site_workspaces enable row level security;

create or replace function public.can_access_site(target_site_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.sites s where s.id = target_site_id and s.owner_id = auth.uid()
  ) or exists (
    select 1 from public.site_members m where m.site_id = target_site_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_site_owner(target_site_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.sites s where s.id = target_site_id and s.owner_id = auth.uid());
$$;

create or replace function public.can_edit_site(target_site_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_site_owner(target_site_id) or exists (
    select 1 from public.site_members m
    where m.site_id = target_site_id and m.user_id = auth.uid() and m.role in ('owner','admin','editor')
  );
$$;

revoke all on function public.can_access_site(uuid) from public;
revoke all on function public.is_site_owner(uuid) from public;
revoke all on function public.can_edit_site(uuid) from public;
grant execute on function public.can_access_site(uuid) to authenticated;
grant execute on function public.is_site_owner(uuid) to authenticated;
grant execute on function public.can_edit_site(uuid) to authenticated;

-- Remove the ownerless demo row created by older versions. It otherwise blocks
-- the real owner from creating the same domain because sites.domain is unique.
delete from public.sites s
where s.owner_id is null
  and s.domain = 'https://airandseaglobal.vn'
  and not exists (select 1 from public.site_members m where m.site_id = s.id);

-- Remove starter and previous policies so this file can be run again safely.
do $$ declare table_name text; begin
  foreach table_name in array array['sites','profiles','tasks','content_items','audit_items','index_checks','backlinks','entities','worklogs','search_console_daily','activity_log'] loop
    execute format('drop policy if exists "authenticated workspace access" on public.%I', table_name);
  end loop;
end $$;

drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', '') from auth.users
on conflict (id) do nothing;

drop policy if exists "members can read their projects" on public.sites;
drop policy if exists "users can create their projects" on public.sites;
drop policy if exists "owners can update their projects" on public.sites;
drop policy if exists "owners can delete their projects" on public.sites;
create policy "members can read their projects" on public.sites for select to authenticated using (public.can_access_site(id));
create policy "users can create their projects" on public.sites for insert to authenticated with check (owner_id = auth.uid());
create policy "owners can update their projects" on public.sites for update to authenticated using (public.is_site_owner(id)) with check (owner_id = auth.uid());
create policy "owners can delete their projects" on public.sites for delete to authenticated using (public.is_site_owner(id));

drop policy if exists "members can read membership" on public.site_members;
drop policy if exists "owners can manage membership" on public.site_members;
create policy "members can read membership" on public.site_members for select to authenticated using (user_id = auth.uid() or public.is_site_owner(site_id));
create policy "owners can manage membership" on public.site_members for all to authenticated using (public.is_site_owner(site_id)) with check (public.is_site_owner(site_id));

drop policy if exists "members can read project workspace" on public.site_workspaces;
drop policy if exists "members can write project workspace" on public.site_workspaces;
create policy "members can read project workspace" on public.site_workspaces for select to authenticated using (public.can_access_site(site_id));
create policy "members can write project workspace" on public.site_workspaces for all to authenticated using (public.can_edit_site(site_id)) with check (public.can_edit_site(site_id));

drop policy if exists "members can access tasks" on public.tasks;
drop policy if exists "members can access content" on public.content_items;
drop policy if exists "members can access audits" on public.audit_items;
drop policy if exists "members can access index checks" on public.index_checks;
drop policy if exists "members can access backlinks" on public.backlinks;
drop policy if exists "members can access entities" on public.entities;
drop policy if exists "members can access worklogs" on public.worklogs;
drop policy if exists "members can access search console" on public.search_console_daily;
drop policy if exists "members can access activity log" on public.activity_log;

do $$ declare table_name text; begin
  foreach table_name in array array['tasks','content_items','audit_items','index_checks','backlinks','entities','worklogs','search_console_daily','activity_log'] loop
    execute format('drop policy if exists "members can read rows" on public.%I', table_name);
    execute format('drop policy if exists "editors can write rows" on public.%I', table_name);
    execute format('create policy "members can read rows" on public.%I for select to authenticated using (public.can_access_site(site_id))', table_name);
    execute format('create policy "editors can write rows" on public.%I for all to authenticated using (public.can_edit_site(site_id)) with check (public.can_edit_site(site_id))', table_name);
  end loop;
end $$;

-- RLS policies filter rows, while grants allow the authenticated API role to
-- access the tables in the first place. Some new projects use restrictive
-- default privileges, so keep these grants explicit and repeatable.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.sites,
  public.profiles,
  public.site_members,
  public.site_workspaces,
  public.tasks,
  public.content_items,
  public.audit_items,
  public.index_checks,
  public.backlinks,
  public.entities,
  public.worklogs,
  public.search_console_daily,
  public.activity_log
to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Enable live updates so local and Vercel sessions receive each other's changes.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_workspaces'
  ) then
    alter publication supabase_realtime add table public.site_workspaces;
  end if;
end $$;
