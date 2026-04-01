import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface AgentAvailable {
  id: string;
  full_name: string;
  email: string;
  status: string;
  role: string;
  assigned_leads: string;
  total_score: string;
}

interface DistributionStats {
  total_leads: number;
  unassigned_leads: number;
  agents: {
    id: string;
    full_name: string;
    status: string;
    lead_count: string;
    total_score: string;
    avg_score: string;
  }[];
}

export function useAgentsAvailable() {
  return useQuery<AgentAvailable[]>({
    queryKey: ["agents-available"],
    queryFn: () => api.get("/leads/agents-available"),
    refetchInterval: 30000,
  });
}

export function useDistributionStats() {
  return useQuery<DistributionStats>({
    queryKey: ["distribution-stats"],
    queryFn: () => api.get("/leads/distribution-stats"),
    refetchInterval: 15000,
  });
}
