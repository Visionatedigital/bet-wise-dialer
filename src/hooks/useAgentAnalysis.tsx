import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAnalysis = async () => {
      setLoading(true);
      setMessage(null);

      try {
        const { data, error } = await supabase.functions.invoke('analyze-agents', {
          body: { dateRange }
        });

        if (error) throw error;

        setAgents(data.agents || []);
        setInsights(data.insights || []);
        setMessage(data.message);
      } catch (error) {
        console.error('Error fetching agent analysis:', error);
        setMessage('Failed to load agent analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [user, dateRange]);

  return { agents, insights, loading, message };
}