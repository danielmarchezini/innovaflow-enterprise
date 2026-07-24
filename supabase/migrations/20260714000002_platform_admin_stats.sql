-- InnovaFlow — let platform admins read ideas/projects across every org, so
-- the master admin panel can show basic usage stats per company (idea
-- count, ROI, active projects) without joining the org first.
create policy "platform admins see all ideas"
  on public.ideas for select
  using (public.is_platform_admin());

create policy "platform admins see all projects"
  on public.projects for select
  using (public.is_platform_admin());
