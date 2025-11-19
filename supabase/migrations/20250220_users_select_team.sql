-- Allow Liatrio teammates to read user records (to show author on prompts)
create policy if not exists "Users: select team" on public.users
  for select
  using (email ilike '%@liatrio.com');
