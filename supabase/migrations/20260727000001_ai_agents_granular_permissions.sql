-- Splits ai_governance_manage into ai_governance_create_agent (new agent)
-- vs. ai_governance_edit_agent (edit an existing agent, log metrics, resolve
-- alerts) — matches core's 20260727000001_granular_permissions.sql, which
-- already renamed the capability strings in organization_role_permissions.
drop policy "permitted write ai_agents" on public.ai_agents;
drop policy "permitted update ai_agents" on public.ai_agents;
drop policy "permitted delete ai_agents" on public.ai_agents;
create policy "permitted create ai_agents" on public.ai_agents for insert with check (public.has_permission(organization_id, 'ai_governance_create_agent'));
create policy "permitted edit ai_agents" on public.ai_agents for update using (public.has_permission(organization_id, 'ai_governance_edit_agent')) with check (public.has_permission(organization_id, 'ai_governance_edit_agent'));
create policy "permitted delete ai_agents" on public.ai_agents for delete using (public.has_permission(organization_id, 'ai_governance_edit_agent'));

drop policy "permitted write ai_agent_metrics" on public.ai_agent_metrics;
drop policy "permitted update ai_agent_metrics" on public.ai_agent_metrics;
drop policy "permitted delete ai_agent_metrics" on public.ai_agent_metrics;
create policy "permitted write ai_agent_metrics" on public.ai_agent_metrics for insert with check (public.has_permission(organization_id, 'ai_governance_edit_agent'));
create policy "permitted update ai_agent_metrics" on public.ai_agent_metrics for update using (public.has_permission(organization_id, 'ai_governance_edit_agent')) with check (public.has_permission(organization_id, 'ai_governance_edit_agent'));
create policy "permitted delete ai_agent_metrics" on public.ai_agent_metrics for delete using (public.has_permission(organization_id, 'ai_governance_edit_agent'));

drop policy "permitted write ai_governance_alerts" on public.ai_governance_alerts;
drop policy "permitted update ai_governance_alerts" on public.ai_governance_alerts;
drop policy "permitted delete ai_governance_alerts" on public.ai_governance_alerts;
create policy "permitted write ai_governance_alerts" on public.ai_governance_alerts for insert with check (public.has_permission(organization_id, 'ai_governance_edit_agent'));
create policy "permitted update ai_governance_alerts" on public.ai_governance_alerts for update using (public.has_permission(organization_id, 'ai_governance_edit_agent')) with check (public.has_permission(organization_id, 'ai_governance_edit_agent'));
create policy "permitted delete ai_governance_alerts" on public.ai_governance_alerts for delete using (public.has_permission(organization_id, 'ai_governance_edit_agent'));
