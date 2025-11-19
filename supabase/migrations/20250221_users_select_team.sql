-- Allow Liatrio teammates to read user records (for author display)
create policy "Users: select team" on public.users
  for select
  using (email ilike '%@liatrio.com');
