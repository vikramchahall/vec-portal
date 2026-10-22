-- =====================================================================
-- FIX: role reverts to 'hr' after you update it
--
-- Cause
-- -----
-- The guard trigger in 02-auth.sql reverted `role` unless is_admin() was
-- true. is_admin() reads auth.uid(), which is NULL in the SQL Editor
-- (there is no JWT on that connection). So every update from the
-- dashboard was silently rolled back — including the one that was
-- supposed to create the very first admin.
--
-- Fix
-- ---
-- The guard exists to stop a signed-in HR user promoting themselves. It
-- has no business policing the SQL Editor or a service-role task, both
-- of which already bypass RLS entirely. So it now only applies when
-- there IS an authenticated end-user (auth.uid() is not null).
--
-- It also now RAISES instead of silently reverting. A guard that quietly
-- undoes your work is how this went unnoticed in the first place.
--
-- Paste this whole file into the SQL Editor and run it. Safe to re-run.
-- =====================================================================

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No JWT on this connection: SQL Editor, a migration, or a service-role
  -- task. Those already bypass RLS, so there is nothing to protect here.
  if auth.uid() is null then
    return new;
  end if;

  -- An admin may change anything.
  if public.is_admin() then
    return new;
  end if;

  -- Anyone else: the privileged columns must not change. Compare before
  -- complaining, so a plain name edit still goes through.
  if new.role is distinct from old.role
     or new.site_ids is distinct from old.site_ids
     or new.is_active is distinct from old.is_active then
    raise exception
      'Only an administrator can change role, site access or active status.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Now create your first admin. Replace the email, then run.
-- ---------------------------------------------------------------------
-- update profiles
-- set full_name = 'Harjeet Singh', role = 'admin'
-- where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');

-- ---------------------------------------------------------------------
-- Verify it stuck. Expect role = admin.
-- ---------------------------------------------------------------------
-- select u.email, p.full_name, p.role, p.is_active
-- from profiles p
-- join auth.users u on u.id = p.id;
