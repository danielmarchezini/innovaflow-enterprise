-- InnovaFlow — AI Agent Governance & ROI module (Enterprise-only, gated by
-- organizations.plan at the application layer, same as arquitetura/admin).
-- Inventories AI agents, links them to the value-chain architecture, tracks
-- monthly cost/hours-saved metrics, and raises governance alerts.

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  agent_link text,
  technology text not null,
  monthly_cost numeric(12,2) not null default 0,
  process_id uuid references public.arch_processes(id) on delete set null,
  activity_id uuid references public.process_activities(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'descontinuado')),
  handles_sensitive_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (process_id is not null or activity_id is not null)
);

create index idx_ai_agents_org on public.ai_agents(organization_id);

create table public.ai_agent_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  month date not null,
  tokens_used integer not null default 0,
  cost numeric(12,2) not null default 0,
  hours_saved numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (agent_id, month)
);

create index idx_ai_agent_metrics_agent on public.ai_agent_metrics(agent_id);

create table public.ai_governance_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  alert_type text not null check (alert_type in ('sem_metricas', 'custo_elevado', 'dados_sensiveis', 'sem_revisao')),
  description text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_ai_governance_alerts_org on public.ai_governance_alerts(organization_id, resolved);

-- Ideas can be promoted into an AI-agent project (the module's "pipeline"),
-- tracked back to the originating idea for traceability.
alter table public.ideas add column promoted_agent_id uuid references public.ai_agents(id) on delete set null;

grant select, insert, update, delete on public.ai_agents to authenticated;
grant select, insert, update, delete on public.ai_agent_metrics to authenticated;
grant select, insert, update, delete on public.ai_governance_alerts to authenticated;
grant all on public.ai_agents to service_role;
grant all on public.ai_agent_metrics to service_role;
grant all on public.ai_governance_alerts to service_role;

alter table public.ai_agents enable row level security;
alter table public.ai_agent_metrics enable row level security;
alter table public.ai_governance_alerts enable row level security;

create policy "members select ai_agents" on public.ai_agents for select using (public.is_org_member(organization_id));
create policy "managers write ai_agents" on public.ai_agents for insert with check (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[]));
create policy "managers update ai_agents" on public.ai_agents for update using (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[])) with check (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[]));
create policy "managers delete ai_agents" on public.ai_agents for delete using (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[]));

create policy "members select ai_agent_metrics" on public.ai_agent_metrics for select using (public.is_org_member(organization_id));
create policy "managers write ai_agent_metrics" on public.ai_agent_metrics for insert with check (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[]));
create policy "managers update ai_agent_metrics" on public.ai_agent_metrics for update using (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[])) with check (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[]));
create policy "managers delete ai_agent_metrics" on public.ai_agent_metrics for delete using (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[]));

create policy "members select ai_governance_alerts" on public.ai_governance_alerts for select using (public.is_org_member(organization_id));
create policy "managers write ai_governance_alerts" on public.ai_governance_alerts for insert with check (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[]));
create policy "managers update ai_governance_alerts" on public.ai_governance_alerts for update using (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[])) with check (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[]));
create policy "managers delete ai_governance_alerts" on public.ai_governance_alerts for delete using (public.has_any_role(organization_id, array['admin_global','admin_empresa','gestor']::app_role[]));
