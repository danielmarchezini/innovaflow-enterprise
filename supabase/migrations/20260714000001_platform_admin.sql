-- InnovaFlow — Platform (master) admin support.
-- is_platform_admin() itself is defined in core (see
-- supabase/migrations/20260714000000_is_platform_admin.sql) since core RLS
-- policies use it too — this migration only adds the Enterprise-only
-- management policies (viewing/editing every org, memberships, roles).
-- Platform admins can see and manage every organization, not just ones they
-- belong to.

-- Organizations: platform admins can see and manage every org, in addition
-- to the existing member-scoped policies.
create policy "platform admins see all organizations"
  on public.organizations for select
  using (public.is_platform_admin());

create policy "platform admins create organizations"
  on public.organizations for insert
  with check (public.is_platform_admin());

create policy "platform admins update any organization"
  on public.organizations for update
  using (public.is_platform_admin());

-- organization_members: platform admins can see/manage membership anywhere,
-- needed to provision the first user of a newly created org.
create policy "platform admins see all memberships"
  on public.organization_members for select
  using (public.is_platform_admin());

create policy "platform admins manage all memberships"
  on public.organization_members for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- user_roles: platform admins can assign roles in any org (not just ones
-- where they already hold admin_global/admin_empresa).
create policy "platform admins see all roles"
  on public.user_roles for select
  using (public.is_platform_admin());

create policy "platform admins manage all roles"
  on public.user_roles for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- user_profile: platform admins can see every profile (needed to show
-- member lists across orgs they don't belong to).
create policy "platform admins see all profiles"
  on public.user_profile for select
  using (public.is_platform_admin());
