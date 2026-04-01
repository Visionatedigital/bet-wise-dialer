import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { User } from "../types";

interface UserWithApproval extends User {
  created_at?: string;
}

export function useUsers() {
  return useQuery<UserWithApproval[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
    refetchInterval: 15000,
  });
}
