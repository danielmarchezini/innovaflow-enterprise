-- Rewires ai_agents/ai_agent_metrics/ai_governance_alerts write policies to
-- use has_permission() (defined in core's
-- 20260724000001_configurable_permissions.sql) instead of a fixed manager
-- role array, so an admin's "Papéis & Permissões" override actually takes
-- effect for the ai_governance_manage capability. Split out from the core
-- migration because these tables only exist where the Enterprise schema is
-- installed.
drop policy "managers write ai_agents" on public.ai_agents;
drop policy "managers update ai_agents" on public.ai_agents;
drop policy "managers delete ai_agents" on public.ai_agents;
create policy "permitted write ai_agents" on public.ai_agents for insert with check (public.has_permission(organization_id, 'ai_governance_manage'));
create policy "permitted update ai_agents" on public.ai_agents for update using (public.has_permission(organization_id, 'ai_governance_manage')) with check (public.has_permission(organization_id, 'ai_governance_manage'));
create policy "permitted delete ai_agents" on public.ai_agents for delete using (public.has_permission(organization_id, 'ai_governance_manage'));

drop policy "managers write ai_agent_metrics" on public.ai_agent_metrics;
drop policy "managers update ai_agent_metrics" on public.ai_agent_metrics;
drop policy "managers delete ai_agent_metrics" on public.ai_agent_metrics;
create policy "permitted write ai_agent_metrics" on public.ai_agent_metrics for insert with check (public.has_permission(organization_id, 'ai_governance_manage'));
create policy "permitted update ai_agent_metrics" on public.ai_agent_metrics for update using (public.has_permission(organization_id, 'ai_governance_manage')) with check (public.has_permission(organization_id, 'ai_governance_manage'));
create policy "permitted delete ai_agent_metrics" on public.ai_agent_metrics for delete using (public.has_permission(organization_id, 'ai_governance_manage'));

drop policy "managers write ai_governance_alerts" on public.ai_governance_alerts;
drop policy "managers update ai_governance_alerts" on public.ai_governance_alerts;
drop policy "managers delete ai_governance_alerts" on public.ai_governance_alerts;
create policy "permitted write ai_governance_alerts" on public.ai_governance_alerts for insert with check (public.has_permission(organization_id, 'ai_governance_manage'));
create policy "permitted update ai_governance_alerts" on public.ai_governance_alerts for update using (public.has_permission(organization_id, 'ai_governance_manage')) with check (public.has_permission(organization_id, 'ai_governance_manage'));
create policy "permitted delete ai_governance_alerts" on public.ai_governance_alerts for delete using (public.has_permission(organization_id, 'ai_governance_manage'));
