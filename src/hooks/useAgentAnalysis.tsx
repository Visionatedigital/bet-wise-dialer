import { useEffect, useState } from "react";
import { api } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AgentRanking {
  id: string;
  name: string;
  calls: number;
  connects: number;
  conversions: number;
  conversionRate: number;
  avgHandleTime: number;
  revenue: number;
  rank: number;
  score: number;
  strengths?: string[];
  improvements?: string[];
}

export function useAgentAnalysis(dateRange: string) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentRanking[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false); // Start as false to avoid loading state on mount
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setAgents([]);
      setInsights([]);
      setMessage(null);
      return;
    }

    const fetchAnalysis = async () => {
      setLoading(true);
      setMessage(null);

      try {
        const data = await api.post<any>('/ai/analyze-agents', { dateRange });

        if (data?.error) {
          console.error('Error in function response:', data.error);
          setAgents([]);
          setInsights([]);
          setMessage(null);
          return;
        }

        setAgents(data?.agents || []);
        setInsights(data?.insights || []);
        setMessage(data?.message || null);
      } catch (error: any) {
        console.error('Error fetching agent analysis:', error);
        
        // Return fallback data
        setAgents([]);
        setInsights([]);
        setMessage(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [user, dateRange]);

  return { agents, insights, loading, message };
}