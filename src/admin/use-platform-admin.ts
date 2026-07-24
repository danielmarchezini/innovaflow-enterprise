// Enterprise-only: platform/master-admin capabilities (managing every
// organization, not just the caller's own). Deliberately isolated under
// src/enterprise/ so it's mechanically extractable into a real
// packages/enterprise workspace later — see AGENTS.md's Free/Enterprise
// split requirement.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/hooks/use-auth";

export function useIsPlatformAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_platform_admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_platform_admin");
      if (error) throw error;
      return data as boolean;
    },
  });
}

export type PlatformOrgRow = {
  id: string;
  name: string;
  plan: "starter" | "growth" | "enterprise";
  seats: number;
  hour_cost: number;
  created_at: string;
};

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: ["platform_organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, plan, seats, hour_cost, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PlatformOrgRow[];
    },
  });
}

export type PlatformOrgMember = {
  user_id: string;
  role: string;
  sector: string | null;
  name: string;
  email: string;
};

export function usePlatformOrgMembers(organizationId: string | null) {
  return useQuery({
    queryKey: ["platform_org_members", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data: members, error: mErr } = await supabase
        .from("organization_members")
        .select("user_id, sector")
        .eq("organization_id", organizationId!);
      if (mErr) throw mErr;
      if (!members.length) return [] as PlatformOrgMember[];

      const ids = members.map((m) => m.user_id);
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("user_profile").select("id, name, email").in("id", ids),
        supabase.from("user_roles").select("user_id, role").eq("organization_id", organizationId!),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;

      const profileById = new Map(profiles.map((p) => [p.id, p]));
      const roleById = new Map(roles.map((r) => [r.user_id, r.role]));

      return members.map((m) => ({
        user_id: m.user_id,
        sector: m.sector,
        name: profileById.get(m.user_id)?.name ?? "—",
        email: profileById.get(m.user_id)?.email ?? "—",
        role: roleById.get(m.user_id) ?? "—",
      }));
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; plan: "starter" | "growth" | "enterprise"; seats: number; hour_cost: number }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não carregada.");
      const { data, error } = await supabase.functions.invoke("admin-provision", {
        body: { type: "create_organization", ...input },
      });
      if (error) throw error;
      return data as PlatformOrgRow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform_organizations"] }),
  });
}

// Direct client update, not via admin-provision — RLS's "platform admins
// update any organization" policy already permits this, no service_role
// (and its bypass-everything power) needed for a plain column update.
export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      plan: "starter" | "growth" | "enterprise";
      seats: number;
      hour_cost: number;
    }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ name: input.name, plan: input.plan, seats: input.seats, hour_cost: input.hour_cost })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform_organizations"] }),
  });
}

// Removes a user's membership + role in one org (doesn't delete their auth
// account or memberships in other orgs) — RLS's "platform admins manage all
// memberships/roles" policies (FOR ALL) already cover the deletes directly.
export function useRemoveOrgUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organization_id: string; user_id: string }) => {
      const { error: roleErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("organization_id", input.organization_id)
        .eq("user_id", input.user_id);
      if (roleErr) throw roleErr;

      const { error: memberErr } = await supabase
        .from("organization_members")
        .delete()
        .eq("organization_id", input.organization_id)
        .eq("user_id", input.user_id);
      if (memberErr) throw memberErr;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["platform_org_members", variables.organization_id] }),
  });
}

export type PlatformOrgStats = {
  ideasCount: number;
  roiSum: number;
  activeProjects: number;
};

export function usePlatformOrgStats(organizationId: string | null) {
  return useQuery({
    queryKey: ["platform_org_stats", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<PlatformOrgStats> => {
      const [{ data: ideas, error: iErr }, { data: projects, error: pErr }] = await Promise.all([
        supabase.from("ideas").select("roi_estimated").eq("organization_id", organizationId!),
        supabase.from("projects").select("stage").eq("organization_id", organizationId!),
      ]);
      if (iErr) throw iErr;
      if (pErr) throw pErr;

      return {
        ideasCount: ideas.length,
        roiSum: ideas.reduce((s, i) => s + (i.roi_estimated ?? 0), 0),
        activeProjects: projects.filter((p) => p.stage !== "concluido").length,
      };
    },
  });
}

export function useCreateOrgUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      email: string;
      password: string;
      name: string;
      role: "admin_global" | "admin_empresa" | "gestor" | "colaborador";
      sector?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("admin-provision", {
        body: { type: "create_user", ...input },
      });
      if (error) throw error;
      return data as { id: string; email: string; name: string };
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["platform_org_members", variables.organization_id] }),
  });
}
