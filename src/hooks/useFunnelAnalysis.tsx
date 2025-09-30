import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FunnelData {
  dials: number;
  connects: number;
  qualified: number;
  conversions: number;
  connectRate: string;
  qualificationRate: string;
  conversionRate: string;
}

interface Insight {
  type: "opportunity" | "warning" | "insight";
  title: string;
  description: string;
  impact: "High" | "Medium" | "Low";
  category: string;
}

export function useFunnelAnalysis(dateRange: string, campaignId: string) {
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: functionError } = await supabase.functions.invoke('analyze-funnel', {
          body: { dateRange, campaignId }
        });

        if (functionError) throw functionError;

        setFunnelData(data.funnelData);
        setInsights(data.insights);
        setMessage(data.message);
      } catch (err) {
        console.error('Error fetching funnel analysis:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [dateRange, campaignId]);

  return { funnelData, insights, message, loading, error };
}
