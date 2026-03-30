import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Callback } from "../types";

export function usePendingCallbacks() {
  return useQuery({
    queryKey: ["callbacks", "pending"],
    queryFn: () => api.get<Callback[]>("/callbacks?status=pending&limit=20"),
    refetchInterval: 30000,
  });
}
