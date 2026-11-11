-- SplitMind AI: Ensure groups SELECT RLS allows owners directly on inserted tuples
-- Prevents PostgreSQL INSERT ... RETURNING * from failing RLS when security-definer helpers query public.groups.

drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups
for select to authenticated
using (
  owner_id = auth.uid()
  or public.is_group_member(id)
);
