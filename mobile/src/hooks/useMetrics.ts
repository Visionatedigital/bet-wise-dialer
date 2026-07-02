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

export function useTeamMetrics(period: 'today' | 'week' | 'month' | 'all' = 'today') {
  const { user } = useAuth();
  const countryCode = user?.country || 'UG';
  const tz = COUNTRY_MAP[countryCode]?.timezone || 'Africa/Kampala';

  return useQuery({
    queryKey: ["team-metrics", countryCode, period],
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
      let url = '/daily-metrics';

      if (period === 'today') {
        url += `?date=${today}`;
      } else if (period !== 'all') {
        const endDateStr = today;
        let startDateStr = '';
        const d = new Date();
        if (period === 'week') {
          // Monday as start of week
          const day = d.getDay();
          const diff = (day + 6) % 7;
          d.setDate(d.getDate() - diff);
          startDateStr = d.toLocaleDateString('en-CA', { timeZone: tz });
        } else if (period === 'month') {
          d.setDate(1);
          startDateStr = d.toLocaleDateString('en-CA', { timeZone: tz });
        }
        url += `?start_date=${startDateStr}&end_date=${endDateStr}`;
      }

      const data = await api.get<DailyMetrics[]>(url);

      // Aggregate multiple days per agent if period is not 'today'
      const agentMap = new Map<string, DailyMetrics>();
      data.forEach((m) => {
        if (!m.user_id) return;
        const existing = agentMap.get(m.user_id) || {
          id: m.id || "",
          user_id: m.user_id,
          date: m.date,
          calls_made: 0,
          connects: 0,
          conversions: 0,
          total_handle_time_seconds: 0,
          total_deposit_value: 0,
        };
        existing.calls_made = (existing.calls_made || 0) + (m.calls_made || 0);
        existing.connects = (existing.connects || 0) + (m.connects || 0);
        existing.conversions = (existing.conversions || 0) + (m.conversions || 0);
        existing.total_handle_time_seconds = (existing.total_handle_time_seconds || 0) + (m.total_handle_time_seconds || 0);
        existing.total_deposit_value = (existing.total_deposit_value || 0) + (m.total_deposit_value || 0);
        agentMap.set(m.user_id, existing);
      });

      const byAgent = Array.from(agentMap.values());

      const totals = byAgent.reduce(
        (acc, m) => ({
          calls_made: acc.calls_made + (m.calls_made || 0),
          connects: acc.connects + (m.connects || 0),
          conversions: acc.conversions + (m.conversions || 0),
          total_deposit_value: acc.total_deposit_value + (m.total_deposit_value || 0),
        }),
        { calls_made: 0, connects: 0, conversions: 0, total_deposit_value: 0 }
      );

      return { totals, byAgent };
    },
    refetchInterval: 15000,
  });
}
