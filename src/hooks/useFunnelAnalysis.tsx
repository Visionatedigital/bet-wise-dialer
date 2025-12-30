import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

export function useFunnelAnalysis(dateRange: string, campaignId: string, managerId?: string | null) {
  const { user } = useAuth();
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
        // Determine manager ID if user is a manager
        let managerFilter = managerId;
        
        if (!managerFilter && user) {
          // Check if current user is a manager
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
          
          const roles = userRoles?.map(r => r.role) || [];
          if (roles.includes('management') && !roles.includes('admin')) {
            // User is a manager (not admin), so filter by their team
            managerFilter = user.id;
          }
        }

        const { data, error: functionError } = await supabase.functions.invoke('analyze-funnel', {
          body: { 
            dateRange, 
            campaignId,
            managerId: managerFilter || null
          }
        });

        if (functionError) throw functionError;

        setFunnelData(data.funnelData);
        setInsights(data.insights || []);
        setMessage(data.message);
      } catch (err) {
        console.error('Error fetching funnel analysis:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [dateRange, campaignId, managerId, user]);

  return { funnelData, insights, message, loading, error };
}
