// Enterprise-only capability, but Starter can use it up to STARTER_AGENT_LIMIT
// (shared with governance-page.tsx's own cap) — same "try it, then upgrade"
// pattern as the rest of the AI Agent Governance module. Kept as an isolated
// component so the (Free/Enterprise-shared) triagem detail route only needs a
// single conditional import, per AGENTS.md's Free/Enterprise split.
import { useNavigate } from "@tanstack/react-router";
import { Bot, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { type IdeaRow } from "@/hooks/use-ideas";
import { usePromoteIdeaToAgent, useAiAgents } from "./use-ai-agents";

const STARTER_AGENT_LIMIT = 3;

export function PromoteIdeaButton({ idea }: { idea: IdeaRow }) {
  const { currentOrg } = useCurrentOrg();
  const navigate = useNavigate();
  const promote = usePromoteIdeaToAgent();
  const { data: agents = [] } = useAiAgents();

  if (idea.promoted_agent_id) return null;

  const isEnterprise = currentOrg?.plan === "enterprise";
  const atLimit = !isEnterprise && agents.length >= STARTER_AGENT_LIMIT;

  if (atLimit) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.error(`Limite do plano Starter atingido (${STARTER_AGENT_LIMIT} agentes) — faça upgrade para Enterprise para cadastrar mais.`)}
      >
        <Lock className="mr-1.5 h-3.5 w-3.5" /> Promover a agente de IA
      </Button>
    );
  }

  const promoteIdea = async () => {
    try {
      const agent = await promote.mutateAsync({
        idea_id: idea.id,
        title: idea.title,
        process_id: idea.process_id,
        owner_id: idea.author_id,
      });
      toast.success("Ideia promovida a projeto de agente de IA.");
      navigate({ to: "/governanca-ia/$agentId", params: { agentId: agent.id } });
    } catch (err) {
      toast.error("Não foi possível promover a ideia.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={promoteIdea} disabled={promote.isPending}>
      <Bot className="mr-1.5 h-3.5 w-3.5" /> {promote.isPending ? "Promovendo…" : "Promover a agente de IA"}
    </Button>
  );
}
