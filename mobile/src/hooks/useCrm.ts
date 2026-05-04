import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Lead, ContactTimelineEvent, CrmCallLog } from "../types";

export function useCrmContacts(filter: string = 'all') {
  return useQuery({
    queryKey: ["crm-contacts", filter],
    queryFn: () => api.get<Lead[]>(`/crm/contacts?filter=${filter}`),
    refetchInterval: 60000,
  });
}

export function useContactTimeline(id: string) {
  return useQuery({
    queryKey: ["contact-timeline", id],
    queryFn: () => api.get<ContactTimelineEvent[]>(`/crm/contacts/${id}/timeline`),
    enabled: !!id,
  });
}

export function useLogCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CrmCallLog>) => api.post("/crm/calls", data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contact-timeline", variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["lead", variables.contact_id] });
    },
  });
}
