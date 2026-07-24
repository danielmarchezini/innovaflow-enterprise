// Enterprise-only: AI Agent Governance & ROI inventory + dashboard. Gated by
// organizations.plan === 'enterprise' in src/routes/governanca-ia.tsx.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bot, Lock, Plus, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { PageBody, PageHeader } from "@/components/app-shell";
import { EnterpriseLimitNotice } from "@/components/enterprise-limit-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useHasPermission } from "@/hooks/use-role-permissions";
import { useProcesses, useProcessActivities } from "@/hooks/use-architecture";
import { useOrgMembers } from "@/hooks/use-org-members";
import { fmtBRL } from "@/lib/format";
import {
  useAiAgents,
  useAllAgentMetrics,
  useAlerts,
  useResolveAlert,
  useCreateAgent,
  useUpdateAgent,
  type AgentStatus,
  type AiAgentRow,
} from "./use-ai-agents";

const STARTER_AGENT_LIMIT = 3;

const STATUS_LABEL: Record<AgentStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  descontinuado: "Descontinuado",
};

const STATUS_TONE: Record<AgentStatus, string> = {
  ativo: "text-success border-success/40",
  pausado: "text-warning border-warning/40",
  descontinuado: "text-muted-foreground border-border-subtle",
};

const ALERT_LABEL: Record<string, string> = {
  sem_metricas: "Sem métricas registradas",
  custo_elevado: "Custo elevado",
  dados_sensiveis: "Acesso a dados sensíveis",
  sem_revisao: "Sem revisão",
};

export function GovernancePage() {
  const { currentOrg, isLoading: orgLoading } = useCurrentOrg();

  if (orgLoading) {
    return (
      <PageBody>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </PageBody>
    );
  }

  return <GovernancePanel />;
}

function GovernancePanel() {
  const { data: agents = [] } = useAiAgents();
  const { data: metrics = [] } = useAllAgentMetrics();
  const { data: alerts = [] } = useAlerts();
  const { currentOrg } = useCurrentOrg();
  const isManager = useHasPermission("ai_governance_manage");
  const isEnterprise = currentOrg?.plan === "enterprise";
  const atAgentLimit = !isEnterprise && agents.length >= STARTER_AGENT_LIMIT;
  const resolveAlert = useResolveAlert();
  const [createOpen, setCreateOpen] = useState(false);

  const pendingAlerts = alerts.filter((a) => !a.resolved);

  const totals = useMemo(() => {
    const monthlyCost = agents.reduce((s, a) => s + a.monthly_cost, 0);
    const hoursSaved = metrics.reduce((s, m) => s + m.hours_saved, 0);
    const metricsCost = metrics.reduce((s, m) => s + m.cost, 0);
    const savingsValue = hoursSaved * (currentOrg?.hour_cost ?? 0);
    return { monthlyCost, hoursSaved, metricsCost, savingsValue, roi: savingsValue - metricsCost };
  }, [agents, metrics, currentOrg]);

  const resolve = async (id: string) => {
    try {
      await resolveAlert.mutateAsync(id);
      toast.success("Alerta resolvido.");
    } catch (err) {
      toast.error("Não foi possível resolver o alerta.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Governança de IA"
        description="Inventário, custo e retorno dos agentes de IA da empresa."
        actions={
          isManager && (
            <Dialog open={createOpen && !atAgentLimit} onOpenChange={(v) => !atAgentLimit && setCreateOpen(v)}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => atAgentLimit && toast.error(`Limite do plano Starter atingido (${STARTER_AGENT_LIMIT} agentes) — faça upgrade para Enterprise para cadastrar mais.`)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo agente
                </Button>
              </DialogTrigger>
              {createOpen && !atAgentLimit && <AgentDialogContent onDone={() => setCreateOpen(false)} />}
            </Dialog>
          )
        }
      />
      <PageBody>
        {!isEnterprise && (
          <div className="mb-5">
            <EnterpriseLimitNotice current={agents.length} limit={STARTER_AGENT_LIMIT} label="agentes" />
          </div>
        )}
        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <StatCard label="Custo mensal total" value={fmtBRL(totals.monthlyCost)} icon={Wallet} />
          <StatCard label="Horas economizadas" value={`${totals.hoursSaved.toFixed(0)}h`} icon={TrendingUp} />
          <StatCard label="Economia gerada" value={fmtBRL(totals.savingsValue)} icon={TrendingUp} />
          <StatCard
            label="ROI acumulado"
            value={fmtBRL(totals.roi)}
            icon={TrendingUp}
            tone={totals.roi >= 0 ? "text-success" : "text-destructive"}
          />
        </div>

        {pendingAlerts.length > 0 && (
          <div className="mb-5 space-y-2">
            {pendingAlerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">{ALERT_LABEL[a.alert_type] ?? a.alert_type}:</span>
                  <span className="text-foreground/80">{a.description}</span>
                </div>
                {isManager && (
                  <Button size="sm" variant="ghost" onClick={() => resolve(a.id)} disabled={resolveAlert.isPending}>
                    Resolver
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
          {agents.length === 0 && (
            <Card className="border-dashed border-border/70 md:col-span-2 xl:col-span-3">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum agente de IA cadastrado ainda.
              </CardContent>
            </Card>
          )}
        </div>
      </PageBody>
    </>
  );
}

function AgentCard({ agent }: { agent: AiAgentRow }) {
  const { data: processes = [] } = useProcesses();
  const { data: members = [] } = useOrgMembers();
  const process = processes.find((p) => p.id === agent.process_id);
  const owner = members.find((m) => m.user_id === agent.owner_id);

  return (
    <Link to="/governanca-ia/$agentId" params={{ agentId: agent.id }}>
      <Card className="h-full border-border/70 transition-colors hover:border-primary/40">
        <CardHeader className="pb-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5">
              {agent.handles_sensitive_data && (
                <Badge variant="outline" className="gap-1 text-[10px] text-destructive border-destructive/40">
                  <Lock className="h-2.5 w-2.5" /> Sensível
                </Badge>
              )}
              <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[agent.status]}`}>
                {STATUS_LABEL[agent.status]}
              </Badge>
            </div>
          </div>
          <CardTitle className="text-sm">{agent.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Tecnologia</span><span className="font-medium text-foreground">{agent.technology}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Custo mensal</span><span className="font-medium text-foreground">{fmtBRL(agent.monthly_cost)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Processo</span><span className="truncate font-medium text-foreground">{process?.name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Dono</span><span className="font-medium text-foreground">{owner?.name ?? "—"}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
          <div className={`text-xl font-semibold ${tone ?? ""}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentDialogContent({
  agent,
  onDone,
}: {
  agent?: AiAgentRow;
  onDone: () => void;
}) {
  const { data: processes = [] } = useProcesses();
  const { data: members = [] } = useOrgMembers();
  const [name, setName] = useState(agent?.name ?? "");
  const [agentLink, setAgentLink] = useState(agent?.agent_link ?? "");
  const [technology, setTechnology] = useState(agent?.technology ?? "");
  const [monthlyCost, setMonthlyCost] = useState(agent?.monthly_cost ?? 0);
  const [processId, setProcessId] = useState(agent?.process_id ?? "");
  const [activityId, setActivityId] = useState(agent?.activity_id ?? "none");
  const [ownerId, setOwnerId] = useState(agent?.owner_id ?? "");
  const [status, setStatus] = useState<AgentStatus>(agent?.status ?? "ativo");
  const [sensitive, setSensitive] = useState(agent?.handles_sensitive_data ?? false);
  const { data: activities = [] } = useProcessActivities(processId || null);

  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const isEdit = !!agent;
  const pending = createAgent.isPending || updateAgent.isPending;

  const submit = async () => {
    if (!name.trim() || !technology.trim() || !ownerId) {
      toast.error("Preencha nome, tecnologia e responsável.");
      return;
    }
    const input = {
      name,
      agent_link: agentLink || undefined,
      technology,
      monthly_cost: monthlyCost,
      process_id: processId || undefined,
      activity_id: activityId === "none" ? undefined : activityId,
      owner_id: ownerId,
      status,
      handles_sensitive_data: sensitive,
    };
    try {
      if (isEdit) {
        await updateAgent.mutateAsync({ ...input, id: agent!.id });
        toast.success("Agente atualizado.");
      } else {
        await createAgent.mutateAsync(input);
        toast.success("Agente de IA cadastrado.");
      }
      onDone();
    } catch (err) {
      toast.error("Não foi possível salvar o agente.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? `Editar ${agent!.name}` : "Novo agente de IA"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Nome do agente</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Copiloto de Triagem" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Tecnologia</Label>
            <Input value={technology} onChange={(e) => setTechnology(e.target.value)} placeholder="OpenAI, Anthropic, Custom…" />
          </div>
          <div className="space-y-1.5">
            <Label>Custo mensal (R$)</Label>
            <Input type="number" value={monthlyCost} onChange={(e) => setMonthlyCost(Number(e.target.value))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Link do agente</Label>
          <Input value={agentLink} onChange={(e) => setAgentLink(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Processo vinculado (opcional)</Label>
            <Select
              value={processId || "none"}
              onValueChange={(v) => { setProcessId(v === "none" ? "" : v); setActivityId("none"); }}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum — agente autônomo</SelectItem>
                {processes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Atividade (opcional)</Label>
            <Select value={activityId} onValueChange={setActivityId} disabled={!processId}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Processo inteiro</SelectItem>
                {activities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AgentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="descontinuado">Descontinuado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={sensitive} onCheckedChange={(v) => setSensitive(!!v)} />
          Este agente tem acesso a dados sensíveis da empresa
        </label>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar agente"}
        </Button>
      </div>
    </DialogContent>
  );
}
