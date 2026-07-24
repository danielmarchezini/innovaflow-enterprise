// Enterprise-only: AI agent detail — monthly cost/hours-saved metrics log,
// history, and related governance alerts. Gated by organizations.plan via the
// parent GovernancePage guard (this page is only reachable from there).
import { useState } from "react";
import { Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";

import { PageBody, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useHasPermission } from "@/hooks/use-role-permissions";
import { useProcesses } from "@/hooks/use-architecture";
import { useOrgMembers } from "@/hooks/use-org-members";
import { fmtBRL, fmtDate } from "@/lib/format";
import {
  useAiAgent,
  useAgentMetrics,
  useLogAgentMetric,
  useAlerts,
  useResolveAlert,
} from "./use-ai-agents";
import { AgentDialogContent } from "./governance-page";

export function AgentDetailPage({ agentId }: { agentId: string }) {
  const { data: agent, isLoading } = useAiAgent(agentId);
  const { data: processes = [] } = useProcesses();
  const { data: members = [] } = useOrgMembers();
  const { data: metrics = [] } = useAgentMetrics(agentId);
  const { data: alerts = [] } = useAlerts();
  const { currentOrg } = useCurrentOrg();
  const isManager = useHasPermission("ai_governance_edit_agent");
  const resolveAlert = useResolveAlert();
  const logMetric = useLogAgentMetric();
  const [editOpen, setEditOpen] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [tokens, setTokens] = useState(0);
  const [cost, setCost] = useState(0);
  const [hoursSaved, setHoursSaved] = useState(0);

  if (isLoading) {
    return (
      <PageBody>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </PageBody>
    );
  }
  if (!agent) throw notFound();

  const process = processes.find((p) => p.id === agent.process_id);
  const owner = members.find((m) => m.user_id === agent.owner_id);
  const agentAlerts = alerts.filter((a) => a.agent_id === agent.id && !a.resolved);

  const totalHoursSaved = metrics.reduce((s, m) => s + m.hours_saved, 0);
  const totalCost = metrics.reduce((s, m) => s + m.cost, 0);
  const totalSavingsValue = totalHoursSaved * (currentOrg?.hour_cost ?? 0);

  const logMonth = async () => {
    try {
      await logMetric.mutateAsync({
        agent_id: agent.id,
        month: `${month}-01`,
        tokens_used: tokens,
        cost,
        hours_saved: hoursSaved,
      });
      toast.success("Métricas do mês registradas.");
      setTokens(0);
      setCost(0);
      setHoursSaved(0);
    } catch (err) {
      toast.error("Não foi possível registrar as métricas.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

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
        title={agent.name}
        description={`${agent.technology} · Custo mensal ${fmtBRL(agent.monthly_cost)}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/governanca-ia"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Voltar</Link>
            </Button>
            {isManager && (
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                </DialogTrigger>
                {editOpen && <AgentDialogContent agent={agent} onDone={() => setEditOpen(false)} />}
              </Dialog>
            )}
          </>
        }
      />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {agentAlerts.length > 0 && (
              <div className="space-y-2">
                {agentAlerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                    <span className="text-warning">{a.description}</span>
                    {isManager && (
                      <Button size="sm" variant="ghost" onClick={() => resolve(a.id)} disabled={resolveAlert.isPending}>
                        Resolver
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isManager && (
              <Card className="border-border/70">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Registrar métricas do mês</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mês</Label>
                    <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tokens usados</Label>
                    <Input type="number" value={tokens} onChange={(e) => setTokens(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Custo (R$)</Label>
                    <Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Horas economizadas</Label>
                    <Input type="number" value={hoursSaved} onChange={(e) => setHoursSaved(Number(e.target.value))} />
                  </div>
                  <Button size="sm" className="col-span-4" onClick={logMonth} disabled={logMetric.isPending}>
                    {logMetric.isPending ? "Salvando…" : "Registrar mês"}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/70">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico mensal</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {metrics.map((m) => (
                  <div key={m.id} className="grid grid-cols-4 gap-2 rounded-md border border-border-subtle bg-surface/40 px-3 py-2 text-xs">
                    <span className="font-medium">{fmtDate(m.month)}</span>
                    <span>{m.tokens_used.toLocaleString("pt-BR")} tokens</span>
                    <span>{fmtBRL(m.cost)}</span>
                    <span>{m.hours_saved}h economizadas</span>
                  </div>
                ))}
                {metrics.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma métrica registrada ainda.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Custo x Retorno</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Row label="Custo acumulado (métricas)">{fmtBRL(totalCost)}</Row>
                <Row label="Horas economizadas">{totalHoursSaved.toFixed(0)}h</Row>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <div className="text-xs text-muted-foreground">Economia gerada</div>
                  <div className="mt-1 text-xl font-semibold text-primary">{fmtBRL(totalSavingsValue)}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhes</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                <Row label="Processo">{process?.name ?? "—"}</Row>
                <Row label="Responsável">{owner?.name ?? "—"}</Row>
                <Row label="Dados sensíveis">
                  <Badge variant="outline" className={agent.handles_sensitive_data ? "text-destructive border-destructive/40" : ""}>
                    {agent.handles_sensitive_data ? "Sim" : "Não"}
                  </Badge>
                </Row>
                {agent.agent_link && (
                  <a
                    href={agent.agent_link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    Acessar agente <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
