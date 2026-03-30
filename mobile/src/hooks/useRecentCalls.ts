import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { CallActivity } from "../types";

export function useRecentCalls() {
  return useQuery({
    queryKey: ["recent-calls"],
    queryFn: () => api.get<CallActivity[]>("/call-activities?limit=10"),
    refetchInterval: 30000,
  });
}
