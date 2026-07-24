-- InnovaFlow — allow AI agents to exist standalone, without a mandatory link
-- to a process/activity of the value chain (user wants to catalog agents
-- that aren't tied to a mapped process yet).
alter table public.ai_agents drop constraint ai_agents_check;
