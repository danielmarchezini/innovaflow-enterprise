// Enterprise-only: AI Agent Governance & ROI module. Isolated under
// src/enterprise/ per AGENTS.md's Free/Enterprise split — gated by
// organizations.plan === 'enterprise', same mechanism as arquitetura/admin.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase-client";
import { useCurrentOrg } from "@/hooks/use-current-org";

export type AgentStatus = "ativo" | "pausado" | "descontinuado";
export type AlertType = "sem_metricas" | "custo_elevado" | "dados_sensiveis" | "sem_revisao";

export type AiAgentRow = {
  id: string;
  name: string;
  agent_link: string | null;
  technology: string;
  monthly_cost: number;
  process_id: string | null;
  activity_id: string | null;
  owner_id: string;
  status: AgentStatus;
  handles_sensitive_data: boolean;
  created_at: string;
};

export type AiAgentMetricRow = {
  id: string;
  agent_id: string;
  month: string;
  tokens_used: number;
  cost: number;
  hours_saved: number;
};

export type AiGovernanceAlertRow = {
  id: string;
  agent_id: string;
  alert_type: AlertType;
  description: string;
  resolved: boolean;
  created_at: string;
};

export function useAiAgents() {
  const { currentOrg } = useCurrentOrg();
  return useQuery({
    queryKey: ["ai_agents", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, agent_link, technology, monthly_cost, process_id, activity_id, owner_id, status, handles_sensitive_data, created_at")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AiAgentRow[];
    },
  });
}

export function useAiAgent(id: string) {
  return useQuery({
    queryKey: ["ai_agents", "detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_agents").select("*").eq("id", id).single();
      if (error) throw error;
      return data as AiAgentRow;
    },
  });
}

export type AiAgentInput = {
  name: string;
  agent_link?: string;
  technology: string;
  monthly_cost: number;
  process_id?: string;
  activity_id?: string;
  owner_id: string;
  status: AgentStatus;
  handles_sensitive_data: boolean;
};

export function useCreateAgent() {
  const { currentOrg } = useCurrentOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AiAgentInput) => {
      const { data, error } = await supabase
        .from("ai_agents")
        .insert({
          organization_id: currentOrg!.id,
          name: input.name,
          agent_link: input.agent_link || null,
          technology: input.technology,
          monthly_cost: input.monthly_cost,
          process_id: input.process_id || null,
          activity_id: input.activity_id || null,
          owner_id: input.owner_id,
          status: input.status,
          handles_sensitive_data: input.handles_sensitive_data,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (input.handles_sensitive_data) {
        await supabase.from("ai_governance_alerts").insert({
          organization_id: currentOrg!.id,
          agent_id: data.id,
          alert_type: "dados_sensiveis",
          description: `${input.name} tem acesso a dados sensíveis — confirme os controles de segurança e compliance.`,
        });
      }

      return data as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_agents"] });
      queryClient.invalidateQueries({ queryKey: ["ai_governance_alerts"] });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AiAgentInput & { id: string }) => {
      const { error } = await supabase
        .from("ai_agents")
        .update({
          name: input.name,
          agent_link: input.agent_link || null,
          technology: input.technology,
          monthly_cost: input.monthly_cost,
          process_id: input.process_id || null,
          activity_id: input.activity_id || null,
          owner_id: input.owner_id,
          status: input.status,
          handles_sensitive_data: input.handles_sensitive_data,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai_agents"] }),
  });
}

export function useAgentMetrics(agentId: string | null) {
  return useQuery({
    queryKey: ["ai_agent_metrics", agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agent_metrics")
        .select("id, agent_id, month, tokens_used, cost, hours_saved")
        .eq("agent_id", agentId!)
        .order("month", { ascending: false });
      if (error) throw error;
      return data as AiAgentMetricRow[];
    },
  });
}

// One metrics module per org — used for the inventory-wide cost x savings
// dashboard without an N+1 query per agent card.
export function useAllAgentMetrics() {
  const { currentOrg } = useCurrentOrg();
  return useQuery({
    queryKey: ["ai_agent_metrics", "all", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data: agents, error: agentsError } = await supabase
        .from("ai_agents")
        .select("id")
        .eq("organization_id", currentOrg!.id);
      if (agentsError) throw agentsError;
      if (!agents.length) return [] as AiAgentMetricRow[];

      const { data, error } = await supabase
        .from("ai_agent_metrics")
        .select("id, agent_id, month, tokens_used, cost, hours_saved")
        .in("agent_id", agents.map((a) => a.id));
      if (error) throw error;
      return data as AiAgentMetricRow[];
    },
  });
}

export function useLogAgentMetric() {
  const { currentOrg } = useCurrentOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { agent_id: string; month: string; tokens_used: number; cost: number; hours_saved: number }) => {
      const { error } = await supabase
        .from("ai_agent_metrics")
        .upsert(
          { organization_id: currentOrg!.id, ...input },
          { onConflict: "agent_id,month" },
        );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ai_agent_metrics", variables.agent_id] });
      queryClient.invalidateQueries({ queryKey: ["ai_agent_metrics", "all"] });
    },
  });
}

export function useAlerts() {
  const { currentOrg } = useCurrentOrg();
  return useQuery({
    queryKey: ["ai_governance_alerts", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_governance_alerts")
        .select("id, agent_id, alert_type, description, resolved, created_at")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AiGovernanceAlertRow[];
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_governance_alerts").update({ resolved: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai_governance_alerts"] }),
  });
}

// Pipeline: promotes a collaborator's idea into a planned AI-agent project,
// pre-filling the agent from the idea and linking back to it for traceability.
export function usePromoteIdeaToAgent() {
  const { currentOrg } = useCurrentOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { idea_id: string; title: string; process_id: string | null; owner_id: string }) => {
      if (!input.process_id) throw new Error("A ideia precisa estar vinculada a um processo para virar um agente.");
      const { data: agent, error: agentError } = await supabase
        .from("ai_agents")
        .insert({
          organization_id: currentOrg!.id,
          name: input.title,
          technology: "A definir",
          monthly_cost: 0,
          process_id: input.process_id,
          owner_id: input.owner_id,
          status: "pausado",
        })
        .select("id")
        .single();
      if (agentError) throw agentError;

      const { error: ideaError } = await supabase
        .from("ideas")
        .update({ promoted_agent_id: agent.id })
        .eq("id", input.idea_id);
      if (ideaError) throw ideaError;

      return agent as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_agents"] });
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
    },
  });
}
