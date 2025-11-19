-- Allow authenticated users to insert their own user record for FK satisfaction
create policy "Users: insert self" on public.users
  for insert
  with check (id = auth.uid());
