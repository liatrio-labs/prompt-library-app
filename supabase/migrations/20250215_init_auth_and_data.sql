-- Supabase migration for Prompt Library
-- Creates core tables, defaults sharing to public, enforces @liatrio.com, and sets RLS policies.

-- Extensions
create extension if not exists "uuid-ossp";

-- Tables
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.prompts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  tags text[] default '{}',
  category text not null,
  is_public boolean default true, -- default to SHARED
  trashed boolean default false,
  trashed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.prompt_history (
  id uuid primary key default uuid_generate_v4(),
  prompt_id uuid references public.prompts(id) on delete cascade,
  content text not null,
  saved_at timestamptz default now(),
  version_name text
);

create table if not exists public.global_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  key text not null,
  value text not null,
  is_public boolean default true, -- default to SHARED
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, key)
);

-- Updated-at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

create trigger set_updated_at_prompts
before update on public.prompts
for each row execute function public.set_updated_at();

create trigger set_updated_at_users
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_updated_at_global_templates
before update on public.global_templates
for each row execute function public.set_updated_at();

-- Seed users table when an auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Enforce @liatrio.com at account creation
create or replace function public.validate_email_domain()
returns trigger language plpgsql as $$
declare v_email text;
begin
  v_email := lower(new.email);
  if v_email not like '%@liatrio.com' then
    raise exception 'Only @liatrio.com emails are allowed';
  end if;
  return new;
end$$;

drop trigger if exists before_user_created on auth.users;
create trigger before_user_created
before insert on auth.users
for each row execute function public.validate_email_domain();

-- Enable RLS
alter table public.users enable row level security;
alter table public.prompts enable row level security;
alter table public.prompt_history enable row level security;
alter table public.global_templates enable row level security;

-- Policies
create policy "Users: select self" on public.users
  for select using (id = auth.uid());
create policy "Users: update self" on public.users
  for update using (id = auth.uid());

create policy "Prompts: select public or mine" on public.prompts
  for select using (is_public or user_id = auth.uid());
create policy "Prompts: insert mine" on public.prompts
  for insert with check (user_id = auth.uid());
create policy "Prompts: update mine" on public.prompts
  for update using (user_id = auth.uid());
create policy "Prompts: delete mine" on public.prompts
  for delete using (user_id = auth.uid());

create policy "History: select if parent visible" on public.prompt_history
  for select using (exists (
    select 1 from public.prompts p
    where p.id = prompt_history.prompt_id
      and (p.is_public or p.user_id = auth.uid())
  ));
create policy "History: insert if parent mine" on public.prompt_history
  for insert with check (exists (
    select 1 from public.prompts p
    where p.id = prompt_history.prompt_id
      and p.user_id = auth.uid()
  ));
create policy "History: update if parent mine" on public.prompt_history
  for update using (exists (
    select 1 from public.prompts p
    where p.id = prompt_history.prompt_id
      and p.user_id = auth.uid()
  ));
create policy "History: delete if parent mine" on public.prompt_history
  for delete using (exists (
    select 1 from public.prompts p
    where p.id = prompt_history.prompt_id
      and p.user_id = auth.uid()
  ));

create policy "Templates: select public or mine" on public.global_templates
  for select using (is_public or user_id = auth.uid());
create policy "Templates: insert mine" on public.global_templates
  for insert with check (user_id = auth.uid());
create policy "Templates: update mine" on public.global_templates
  for update using (user_id = auth.uid());
create policy "Templates: delete mine" on public.global_templates
  for delete using (user_id = auth.uid());
