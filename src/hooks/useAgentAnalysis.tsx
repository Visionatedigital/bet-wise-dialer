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
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const { data, error } = await supabase.functions.invoke('analyze-agents', {
          body: { dateRange },
          signal: controller.signal as any
        });

        clearTimeout(timeoutId);

        if (error) {
          console.error('Error from analyze-agents function:', error);
          // Set empty data instead of throwing - this is non-critical
          setAgents([]);
          setInsights([]);
          setMessage(null); // Don't show error message, just silently fail
          return;
        }

        // Handle error response from function
        if (data?.error) {
          console.error('Error in function response:', data.error);
          setAgents([]);
          setInsights([]);
          setMessage(null); // Don't show error message
          return;
        }

        setAgents(data?.agents || []);
        setInsights(data?.insights || []);
        setMessage(data?.message || null);
      } catch (error: any) {
        // Handle abort and other errors gracefully
        if (error?.name === 'AbortError') {
          console.warn('Agent analysis request timed out');
        } else {
          console.error('Error fetching agent analysis:', error);
        }
        // Set empty data instead of breaking - this feature is non-critical
        setAgents([]);
        setInsights([]);
        setMessage(null); // Don't show error to user
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we have a user
    fetchAnalysis();
  }, [user, dateRange]);

  return { agents, insights, loading, message };
}