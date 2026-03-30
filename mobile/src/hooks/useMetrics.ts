import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { DailyMetrics } from "../types";

export function useTodayMetrics() {
  return useQuery({
    queryKey: ["daily-metrics"],
    queryFn: async () => {
      const data = await api.get<DailyMetrics[]>("/daily-metrics");
      // Backend returns array; find today's entry
      const today = new Date().toISOString().split("T")[0];
      return (
        data.find((m) => m.date?.startsWith(today)) || {
          calls_made: 0,
          connects: 0,
          conversions: 0,
          total_handle_time_seconds: 0,
          total_deposit_value: 0,
        }
      );
    },
    refetchInterval: 15000,
  });
}
