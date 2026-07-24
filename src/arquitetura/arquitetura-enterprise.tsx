// Enterprise-only: the restyled Cadeia de Valor view (category -> chain cards
// -> process cards, plus typed search), modeled after a reference visual the
// user shared. Gated behind org.plan === 'enterprise' in src/routes/arquitetura.tsx.
// See AGENTS.md's Free/Enterprise split — src/components/architecture-free-view.tsx
// is the plain equivalent every tier gets.
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  UserX,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useValueChains,
  useProcessesWithDocCounts,
  useCreateProcess,
  useUpdateProcess,
  useCreateValueChain,
  useUpdateValueChain,
  type ProcessRow,
  type ValueChainRow,
  type ValueChainCategory,
} from "@/hooks/use-architecture";
import { useIdeas } from "@/hooks/use-ideas";
import { useOrgMembers } from "@/hooks/use-org-members";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useCurrentUser } from "@/hooks/use-current-user";
import { computeHealth, type ProcessHealth } from "@/lib/architecture";
import { EnterpriseLimitNotice } from "@/components/enterprise-limit-notice";

type SearchScope = "processo" | "responsavel" | "ambos";

const STARTER_PROCESS_LIMIT = 3;

const HEALTH_DOT: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

const CATEGORY_ORDER: { key: ValueChainCategory; label: string }[] = [
  { key: "gestao", label: "Gestão" },
  { key: "primario", label: "Primário" },
  { key: "suporte", label: "Suporte" },
];

function worstTone(tones: ProcessHealth["tone"][]): ProcessHealth["tone"] {
  if (tones.includes("danger")) return "danger";
  if (tones.includes("warning")) return "warning";
  return "success";
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/25 text-inherit">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function ArquiteturaEnterpriseView() {
  const { data: valueChains = [] } = useValueChains();
  const { data: processes = [] } = useProcessesWithDocCounts();
  const { data: ideas = [] } = useIdeas();
  const { data: members = [] } = useOrgMembers();
  const { currentOrg } = useCurrentOrg();
  const { role } = useCurrentUser();
  const isManager = role === "admin_empresa" || role === "gestor" || role === "admin_global";
  const isEnterprise = currentOrg?.plan === "enterprise";
  const atProcessLimit = !isEnterprise && processes.length >= STARTER_PROCESS_LIMIT;
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("processo");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProcess, setEditProcess] = useState<ProcessRow | null>(null);
  const [editChain, setEditChain] = useState<ValueChainRow | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);

  const enriched = useMemo(
    () =>
      processes.map((p) => ({
        process: p,
        health: computeHealth({
          lastReview: p.last_review ?? new Date().toISOString().slice(0, 10),
          documentsCount: p.process_documents[0]?.count ?? 0,
          bottlenecks: p.bottlenecks,
          improvementsCount: ideas.filter((i) => i.process_id === p.id).length,
        }),
        owner: members.find((u) => u.user_id === p.owner_id),
      })),
    [processes, ideas, members],
  );

  const q = query.trim().toLowerCase();
  const filtered = enriched.filter(({ process, owner }) => {
    if (!q) return true;
    const matchProcess = process.name.toLowerCase().includes(q);
    const matchOwner = (owner?.name ?? "").toLowerCase().includes(q);
    if (scope === "processo") return matchProcess;
    if (scope === "responsavel") return matchOwner;
    return matchProcess || matchOwner;
  });

  const searchGroups = valueChains
    .map((chain) => ({ chain, items: filtered.filter((e) => e.process.chain_id === chain.id) }))
    .filter((g) => g.items.length > 0);

  const chainStats = valueChains.map((chain) => {
    const items = enriched.filter((e) => e.process.chain_id === chain.id);
    return { chain, count: items.length, tone: worstTone(items.map((i) => i.health.tone)) };
  });

  const categoryGroups = CATEGORY_ORDER.map((cat) => ({
    ...cat,
    chains: chainStats.filter((c) => c.chain.category === cat.key),
  })).filter((g) => g.chains.length > 0);

  const selectedChain = valueChains.find((c) => c.id === selectedChainId) ?? null;
  const chainProcesses = selectedChainId ? enriched.filter((e) => e.process.chain_id === selectedChainId) : [];

  const noOwnerCount = enriched.filter((e) => !e.owner).length;
  const overdueCount = enriched.filter((e) => e.health.obsolete).length;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle px-6 py-3">
        <div className="relative max-w-[420px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por processo ou responsável..."
            className="h-8 w-full rounded-md border border-border-subtle bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {(["processo", "responsavel", "ambos"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-md border px-3 py-1 text-[11px] capitalize transition-colors ${
                scope === s
                  ? "border-foreground bg-foreground text-background"
                  : "border-border-subtle bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "responsavel" ? "Responsável" : s}
            </button>
          ))}
        </div>
        {isManager && (
          <Dialog open={createOpen && !atProcessLimit} onOpenChange={(v) => !atProcessLimit && setCreateOpen(v)}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => atProcessLimit && toast.error(`Limite do plano Starter atingido (${STARTER_PROCESS_LIMIT} processos) — faça upgrade para Enterprise para cadastrar mais.`)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo processo
              </Button>
            </DialogTrigger>
            {createOpen && !atProcessLimit && (
              <ProcessDialogContent
                valueChains={valueChains}
                defaultChainId={selectedChainId ?? undefined}
                onDone={() => setCreateOpen(false)}
              />
            )}
          </Dialog>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!isEnterprise && (
          <div className="mb-5">
            <EnterpriseLimitNotice current={processes.length} limit={STARTER_PROCESS_LIMIT} label="processos" />
          </div>
        )}
        {(noOwnerCount > 0 || overdueCount > 0) && (
          <div className="mb-5 flex flex-wrap gap-2">
            {noOwnerCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] text-warning">
                <UserX className="h-3 w-3" /> {noOwnerCount} processo{noOwnerCount > 1 ? "s" : ""} sem responsável
              </span>
            )}
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] text-destructive">
                <AlertTriangle className="h-3 w-3" /> {overdueCount} processo{overdueCount > 1 ? "s" : ""} com revisão vencida (+365 dias)
              </span>
            )}
          </div>
        )}

        {q ? (
          <>
            <div className="mb-4 text-sm font-semibold tracking-tight">Resultados da busca</div>
            {searchGroups.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum processo encontrado para essa busca.</p>
            )}
            <div className="space-y-7">
              {searchGroups.map(({ chain, items }) => (
                <section key={chain.id}>
                  <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {chain.name}
                    <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((entry) => (
                      <ProcessCard key={entry.process.id} entry={entry} q={q} scope={scope} onEdit={setEditProcess} showEdit={isManager} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : selectedChain ? (
          <>
            <button
              onClick={() => setSelectedChainId(null)}
              className="mb-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Cadeia de Valor
            </button>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">{selectedChain.name}</span>
              {isManager && (
                <button
                  onClick={() => setEditChain(selectedChain)}
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Editar cadeia de valor"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {chainProcesses.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum processo nesta cadeia ainda.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {chainProcesses.map((entry) => (
                <ProcessCard key={entry.process.id} entry={entry} q="" scope={scope} onEdit={setEditProcess} showEdit={isManager} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 text-sm font-semibold tracking-tight">Cadeia de Valor</div>
            {categoryGroups.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma cadeia de valor cadastrada ainda.</p>
            )}
            <div className="space-y-7">
              {categoryGroups.map(({ key, label, chains }) => (
                <section key={key}>
                  <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                    <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {chains.length}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {chains.map(({ chain, count, tone }) => (
                      <div
                        key={chain.id}
                        className="group flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface/60 px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-surface"
                      >
                        <button onClick={() => setSelectedChainId(chain.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[tone]}`} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold leading-tight">{chain.name}</div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {count} processo{count !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </button>
                        {isManager && (
                          <button
                            onClick={() => setEditChain(chain)}
                            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                            aria-label="Editar cadeia de valor"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!editProcess} onOpenChange={(open) => !open && setEditProcess(null)}>
        {editProcess && (
          <ProcessDialogContent
            valueChains={valueChains}
            process={editProcess}
            onDone={() => setEditProcess(null)}
          />
        )}
      </Dialog>

      <Dialog open={!!editChain} onOpenChange={(open) => !open && setEditChain(null)}>
        {editChain && <ValueChainDialogContent chain={editChain} onDone={() => setEditChain(null)} />}
      </Dialog>
    </div>
  );
}

function ValueChainDialogContent({ chain, onDone }: { chain: ValueChainRow; onDone: () => void }) {
  const updateValueChain = useUpdateValueChain();
  const [name, setName] = useState(chain.name);
  const [category, setCategory] = useState<ValueChainCategory>(chain.category);
  const [description, setDescription] = useState(chain.description ?? "");

  const save = async () => {
    if (!name.trim()) {
      toast.error("Dê um nome à cadeia de valor.");
      return;
    }
    try {
      await updateValueChain.mutateAsync({ id: chain.id, name: name.trim(), category, description: description || undefined });
      toast.success("Cadeia de valor atualizada.");
      onDone();
    } catch (err) {
      toast.error("Não foi possível salvar.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Editar cadeia de valor</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo de processo</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ValueChainCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORY_ORDER.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
        </div>
        <Button className="w-full" onClick={save} disabled={updateValueChain.isPending}>
          {updateValueChain.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </DialogContent>
  );
}

function ProcessCard({
  entry,
  q,
  scope,
  onEdit,
  showEdit,
}: {
  entry: { process: ProcessRow; health: ProcessHealth; owner?: { name: string } };
  q: string;
  scope: SearchScope;
  onEdit: (process: ProcessRow) => void;
  showEdit: boolean;
}) {
  const { process, health, owner } = entry;
  return (
    <div className="group relative flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface/60 px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-surface">
      <Link
        to="/arquitetura/$processId"
        params={{ processId: process.id }}
        className="flex min-w-0 flex-1 items-center gap-2.5"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[health.tone]}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight">
            {highlight(process.name, scope !== "responsavel" ? q : "")}
          </div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <UsersIcon className="h-2.5 w-2.5 shrink-0" />
            {highlight(owner?.name ?? "Sem owner", scope !== "processo" ? q : "")}
          </div>
        </div>
      </Link>
      {showEdit && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onEdit(process);
          }}
          className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          aria-label="Editar processo"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

function ProcessDialogContent({
  valueChains,
  process,
  defaultChainId,
  onDone,
}: {
  valueChains: ValueChainRow[];
  process?: ProcessRow;
  defaultChainId?: string;
  onDone: () => void;
}) {
  const { data: members = [] } = useOrgMembers();
  const [name, setName] = useState(process?.name ?? "");
  const [chainId, setChainId] = useState(process?.chain_id ?? defaultChainId ?? valueChains[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(process?.owner_id ?? "");
  const [description, setDescription] = useState(process?.description ?? "");
  const [lastReview, setLastReview] = useState(process?.last_review ?? new Date().toISOString().slice(0, 10));
  const createProcess = useCreateProcess();
  const updateProcess = useUpdateProcess();
  const createValueChain = useCreateValueChain();
  const isEdit = !!process;
  const pending = createProcess.isPending || updateProcess.isPending;

  const [newChainOpen, setNewChainOpen] = useState(false);
  const [newChainName, setNewChainName] = useState("");
  const [newChainCategory, setNewChainCategory] = useState<ValueChainCategory>("suporte");

  const createChain = async () => {
    if (!newChainName.trim()) return;
    try {
      const chain = await createValueChain.mutateAsync({ name: newChainName, category: newChainCategory });
      setChainId(chain.id);
      setNewChainName("");
      setNewChainOpen(false);
      toast.success("Cadeia de valor criada.");
    } catch (err) {
      toast.error("Não foi possível criar a cadeia de valor.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const submit = async () => {
    if (!name.trim() || !chainId || !ownerId) {
      toast.error("Preencha nome, cadeia de valor e responsável.");
      return;
    }
    try {
      const input = { name, chain_id: chainId, owner_id: ownerId, description: description || undefined, last_review: lastReview };
      if (isEdit) {
        await updateProcess.mutateAsync({ ...input, id: process!.id });
        toast.success("Processo atualizado.");
      } else {
        await createProcess.mutateAsync(input);
        toast.success("Processo criado.");
      }
      onDone();
    } catch (err) {
      toast.error("Não foi possível salvar o processo.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? `Editar ${process!.name}` : "Novo processo"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Nome do processo</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Cadeia de valor</Label>
            <Select
              value={chainId}
              onValueChange={(v) => (v === "__new__" ? setNewChainOpen(true) : setChainId(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {valueChains.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                <SelectItem value="__new__" className="text-primary">+ Nova cadeia de valor</SelectItem>
              </SelectContent>
            </Select>
            {newChainOpen && (
              <div className="space-y-1.5 pt-1">
                <Input
                  autoFocus
                  placeholder="Nome da nova cadeia"
                  value={newChainName}
                  onChange={(e) => setNewChainName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createChain()}
                />
                <div className="flex gap-1.5">
                  <Select value={newChainCategory} onValueChange={(v) => setNewChainCategory(v as ValueChainCategory)}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_ORDER.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={createChain} disabled={createValueChain.isPending}>
                    Criar
                  </Button>
                </div>
              </div>
            )}
          </div>
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
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="space-y-1.5">
          <Label>Última revisão</Label>
          <Input type="date" value={lastReview} onChange={(e) => setLastReview(e.target.value)} />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar processo"}
        </Button>
      </div>
    </DialogContent>
  );
}
