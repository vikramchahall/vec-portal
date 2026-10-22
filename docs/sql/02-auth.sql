-- =====================================================================
-- Vikram Engineering Co. — PHASE 2 (part 1): authentication and roles
-- Supabase project: swpkutpeimuoomculpbz
--
-- Run this AFTER 01-website.sql. Paste the whole file into the Supabase
-- SQL Editor and run it once. Safe to re-run.
--
-- What this gives you:
--   * a `profiles` table holding each staff member's name and role
--   * a trigger that creates that row automatically on sign-up
--   * helper functions is_admin() / can_access_site() for later modules
--   * RLS so a user can read their own profile and only an admin can
--     change roles
--
-- There is NO public sign-up. Accounts are created by the administrator
-- in the Supabase dashboard (Authentication → Users → Add user).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Role enum
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'hr');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. profiles — one row per auth user
--
-- site_ids null  = access to every site (typical for admin)
-- site_ids array = restricted to those sites (typical for HR)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text not null default '',
  role       user_role not null default 'hr',
  site_ids   uuid[],
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles (role);

-- ---------------------------------------------------------------------
-- 3. Auto-create a profile whenever an auth user is created
--
-- SECURITY DEFINER so the trigger can write to profiles regardless of
-- who caused the insert. search_path is pinned: without it, a definer
-- function can be hijacked by a caller-controlled search_path.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'hr')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. Helpers used by this file and by every later module
--
-- is_admin() is STABLE and SECURITY DEFINER so policies can call it
-- without the caller needing read access to profiles — otherwise the
-- policy would recurse into itself.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.can_access_site(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active
      and (role = 'admin' or site_ids is null or target = any(site_ids))
  );
$$;

-- ---------------------------------------------------------------------
-- 5. RLS on profiles
-- ---------------------------------------------------------------------
alter table profiles enable row level security;

drop policy if exists "read own profile" on profiles;
create policy "read own profile"
  on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "update own name" on profiles;
create policy "update own name"
  on profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "admin manages profiles" on profiles;
create policy "admin manages profiles"
  on profiles for insert to authenticated
  with check (public.is_admin());

-- Note: a non-admin can UPDATE their own row, which means they could set
-- their own role. Lock that down with a trigger rather than a policy,
-- because RLS cannot compare old vs new values.
--
-- The trigger deliberately stands aside when auth.uid() is null — the
-- SQL Editor and service-role tasks already bypass RLS, and gating them
-- would make the first admin impossible to create.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No JWT on this connection: the SQL Editor, a migration, or a
  -- service-role task. Those already bypass RLS, so there is nothing to
  -- protect here. Without this check the first admin can never be
  -- created, because is_admin() is false when no admin exists yet.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Compare before complaining, so a plain name edit still goes through.
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

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role
  before update on profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------
-- 6. Let signed-in staff manage the public-site tables from 01-website
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.enquiries') is not null then
    drop policy if exists "staff update enquiries" on enquiries;
    create policy "staff update enquiries"
      on enquiries for update to authenticated
      using (true) with check (true);
  end if;

  if to_regclass('public.job_applications') is not null then
    drop policy if exists "staff update applications" on job_applications;
    create policy "staff update applications"
      on job_applications for update to authenticated
      using (true) with check (true);
  end if;
end $$;

-- =====================================================================
-- AFTER RUNNING THIS
--
-- 1. Authentication → Users → Add user
--       Email:    harjeet@vikramengineering.co.in   (any address you own)
--       Password: set one, and tick "Auto Confirm User"
--
-- 2. The trigger creates the profile as 'hr'. Promote it to admin:
--
--       update profiles
--       set full_name = 'Harjeet Singh', role = 'admin'
--       where id = (select id from auth.users where email = 'THAT_EMAIL');
--
-- 3. Verify:
--
--       select p.full_name, p.role, u.email
--       from profiles p join auth.users u on u.id = p.id;
-- =====================================================================
