import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Lead } from "../types";

// The DB doesn't have a 'status' column — status is stored in last_activity.
// Normalize leads to have a consistent .status field.
const VALID_STATUSES = ["unassigned", "no_answer", "interested", "unreachable", "not_interested", "answered_no_response"];

function normalizeStatus(lead: Lead): Lead {
  let status = lead.status || lead.last_activity || "unassigned";
  status = status.toLowerCase().trim();
  if (status === "" || status === "pending") status = "unassigned";
  if (status === "called_no_answer") status = "no_answer";
  if (!VALID_STATUSES.includes(status)) status = "unassigned";
  return { ...lead, status };
}

export function useLeads(statusFilter?: string) {
  return useQuery({
    queryKey: ["leads", statusFilter],
    queryFn: async () => {
      const leads = await api.get<Lead[]>("/leads?limit=200");
      const normalized = leads.map(normalizeStatus);
      if (statusFilter && statusFilter !== "all") {
        return normalized.filter((l) => l.status === statusFilter);
      }
      return normalized;
    },
    refetchInterval: 30000,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ["lead", id],
    queryFn: () => api.get<Lead>(`/leads/${id}`),
    enabled: !!id,
  });
}

export function useNewLeads(limit = 5) {
  return useQuery({
    queryKey: ["leads-new", limit],
    queryFn: () => api.get<Lead[]>(`/leads?lifecycle_stage=new&limit=${limit}`),
    refetchInterval: 30000,
  });
}

export function useCooldownDueLeads(limit = 5) {
  return useQuery({
    queryKey: ["leads-cooldown-due", limit],
    queryFn: () => api.get<Lead[]>(`/leads?cooldown_expired=true&limit=${limit}`),
    refetchInterval: 30000,
  });
}
