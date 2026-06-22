import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { DailyMetrics } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { COUNTRY_MAP } from "../config/countries";

export function useTodayMetrics() {
  const { user } = useAuth();
  const countryCode = user?.country || 'UG';
  const tz = COUNTRY_MAP[countryCode]?.timezone || 'Africa/Kampala';

  return useQuery({
    queryKey: ["daily-metrics", countryCode],
    queryFn: async () => {
      const data = await api.get<DailyMetrics[]>("/daily-metrics");
      const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
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

export function useTeamMetrics() {
  const { user } = useAuth();
  const countryCode = user?.country || 'UG';
  const tz = COUNTRY_MAP[countryCode]?.timezone || 'Africa/Kampala';

  return useQuery({
    queryKey: ["team-metrics-today", countryCode],
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
      const data = await api.get<DailyMetrics[]>(`/daily-metrics?date=${today}`);
      const totals = data.reduce(
        (acc, m) => ({
          calls_made: acc.calls_made + (m.calls_made || 0),
          connects: acc.connects + (m.connects || 0),
          conversions: acc.conversions + (m.conversions || 0),
          total_deposit_value: acc.total_deposit_value + (m.total_deposit_value || 0),
        }),
        { calls_made: 0, connects: 0, conversions: 0, total_deposit_value: 0 }
      );
      return { totals, byAgent: data as DailyMetrics[] };
    },
    refetchInterval: 15000,
  });
}
