// Enterprise-only: master/platform admin panel (manage every organization,
// create companies and users across the platform). See AGENTS.md's
// Free/Enterprise split — this whole folder is meant to stay isolated.
import { useState } from "react";
import { Building2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageBody, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtBRL } from "@/lib/format";
import {
  useIsPlatformAdmin,
  usePlatformOrganizations,
  usePlatformOrgMembers,
  usePlatformOrgStats,
  useCreateOrganization,
  useUpdateOrganization,
  useCreateOrgUser,
  useRemoveOrgUser,
  type PlatformOrgRow,
  type PlatformOrgMember,
} from "./use-platform-admin";

const ROLE_LABEL: Record<string, string> = {
  admin_global: "Admin Global",
  admin_empresa: "Admin da Empresa",
  gestor: "Gestor",
  colaborador: "Colaborador",
};

export function AdminPage() {
  const { data: isPlatformAdmin, isLoading: checkingAccess } = useIsPlatformAdmin();

  if (checkingAccess) {
    return (
      <PageBody>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </PageBody>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <>
        <PageHeader title="Admin Global" description="Gestão de empresas conectadas ao InnovaFlow." />
        <PageBody>
          <Card className="border-dashed border-border/70">
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm font-medium">Acesso restrito</div>
              <p className="max-w-sm text-xs text-muted-foreground">
                Esta área é exclusiva para administradores da plataforma InnovaFlow.
              </p>
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  return <PlatformAdminPanel />;
}

function PlatformAdminPanel() {
  const { data: organizations = [] } = usePlatformOrganizations();
  const [manageOrg, setManageOrg] = useState<PlatformOrgRow | null>(null);
  const [editOrg, setEditOrg] = useState<PlatformOrgRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Admin Global"
        description="Gestão de empresas conectadas ao InnovaFlow."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> Nova empresa</Button>
            </DialogTrigger>
            <CreateOrgDialogContent onDone={() => setCreateOpen(false)} />
          </Dialog>
        }
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((o) => (
            <OrgCard key={o.id} org={o} onManage={() => setManageOrg(o)} onEdit={() => setEditOrg(o)} />
          ))}
          {organizations.length === 0 && (
            <Card className="border-dashed border-border/70 md:col-span-2 xl:col-span-3">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma empresa cadastrada ainda.
              </CardContent>
            </Card>
          )}
        </div>
      </PageBody>

      <Dialog open={!!manageOrg} onOpenChange={(open) => !open && setManageOrg(null)}>
        {manageOrg && <ManageOrgDialogContent org={manageOrg} />}
      </Dialog>

      <Dialog open={!!editOrg} onOpenChange={(open) => !open && setEditOrg(null)}>
        {editOrg && <EditOrgDialogContent org={editOrg} onDone={() => setEditOrg(null)} />}
      </Dialog>
    </>
  );
}

function OrgCard({ org, onManage, onEdit }: { org: PlatformOrgRow; onManage: () => void; onEdit: () => void }) {
  const { data: stats } = usePlatformOrgStats(org.id);

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="uppercase text-[10px]">{org.plan}</Badge>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={onEdit} aria-label="Editar empresa">
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardTitle className="text-sm">{org.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Seats</span><span className="font-medium text-foreground">{org.seats}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Custo hora médio</span><span className="font-medium text-foreground">{fmtBRL(org.hour_cost)}</span>
        </div>
        {stats && (
          <>
            <div className="flex items-center justify-between">
              <span>Ideias catalogadas</span><span className="font-medium text-foreground">{stats.ideasCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>ROI potencial</span><span className="font-medium text-foreground">{fmtBRL(stats.roiSum)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Projetos ativos</span><span className="font-medium text-foreground">{stats.activeProjects}</span>
            </div>
          </>
        )}
        <div className="pt-2">
          <Button size="sm" variant="outline" className="w-full" onClick={onManage}>
            Gerenciar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditOrgDialogContent({ org, onDone }: { org: PlatformOrgRow; onDone: () => void }) {
  const [name, setName] = useState(org.name);
  const [plan, setPlan] = useState(org.plan);
  const [seats, setSeats] = useState(org.seats);
  const [hourCost, setHourCost] = useState(org.hour_cost);
  const updateOrg = useUpdateOrganization();

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    try {
      await updateOrg.mutateAsync({ id: org.id, name, plan, seats, hour_cost: hourCost });
      toast.success("Empresa atualizada.");
      onDone();
    } catch (err) {
      toast.error("Não foi possível atualizar a empresa.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Editar {org.name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Nome da empresa</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Plano</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as typeof plan)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Seats</Label>
            <Input type="number" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Custo hora (R$)</Label>
            <Input type="number" value={hourCost} onChange={(e) => setHourCost(Number(e.target.value))} />
          </div>
        </div>
        <Button className="w-full" onClick={submit} disabled={updateOrg.isPending}>
          {updateOrg.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </DialogContent>
  );
}

function CreateOrgDialogContent({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<"starter" | "growth" | "enterprise">("starter");
  const [seats, setSeats] = useState(5);
  const [hourCost, setHourCost] = useState(75);
  const createOrg = useCreateOrganization();

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    try {
      await createOrg.mutateAsync({ name, plan, seats, hour_cost: hourCost });
      toast.success("Empresa criada com sucesso.");
      setName("");
      onDone();
    } catch (err) {
      toast.error("Não foi possível criar a empresa.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nova empresa</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Nome da empresa</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Energisa" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Plano</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as typeof plan)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Seats</Label>
            <Input type="number" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Custo hora (R$)</Label>
            <Input type="number" value={hourCost} onChange={(e) => setHourCost(Number(e.target.value))} />
          </div>
        </div>
        <Button className="w-full" onClick={submit} disabled={createOrg.isPending}>
          {createOrg.isPending ? "Criando…" : "Criar empresa"}
        </Button>
      </div>
    </DialogContent>
  );
}

function ManageOrgDialogContent({ org }: { org: PlatformOrgRow }) {
  const { data: members = [] } = usePlatformOrgMembers(org.id);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin_global" | "admin_empresa" | "gestor" | "colaborador">("colaborador");
  const [sector, setSector] = useState("");
  const createUser = useCreateOrgUser();
  const removeUser = useRemoveOrgUser();
  const [removeTarget, setRemoveTarget] = useState<PlatformOrgMember | null>(null);

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeUser.mutateAsync({ organization_id: org.id, user_id: removeTarget.user_id });
      toast.success("Usuário removido da empresa.");
    } catch (err) {
      toast.error("Não foi possível remover o usuário.", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRemoveTarget(null);
    }
  };

  const submit = async () => {
    if (!email.trim() || !name.trim() || password.length < 6) {
      toast.error("Preencha nome, e-mail e uma senha com ao menos 6 caracteres.");
      return;
    }
    try {
      await createUser.mutateAsync({ organization_id: org.id, email, password, name, role, sector: sector || undefined });
      toast.success("Usuário criado com sucesso.");
      setEmail(""); setName(""); setPassword(""); setSector("");
    } catch (err) {
      toast.error("Não foi possível criar o usuário.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{org.name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Usuários ({members.length})
          </div>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between rounded-md border border-border-subtle bg-surface/40 px-3 py-2 text-xs">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoveTarget(m)}
                    aria-label="Remover usuário"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum usuário nesta empresa ainda.</p>
            )}
          </div>
        </div>

        <div className="border-t border-border-subtle pt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Adicionar usuário
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha provisória</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="admin_empresa">Admin da Empresa</SelectItem>
                  <SelectItem value="admin_global">Admin Global (plataforma)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="mt-3 w-full" onClick={submit} disabled={createUser.isPending}>
            {createUser.isPending ? "Criando…" : "Criar usuário"}
          </Button>
        </div>
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {removeTarget?.name} de {org.name}? Esta ação não exclui a conta do
              usuário, apenas o vínculo com esta empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={removeUser.isPending}>
              {removeUser.isPending ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  );
}
