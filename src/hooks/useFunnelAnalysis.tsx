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

        console.log('[useFunnelAnalysis] Calling analyze-funnel with:', {
          dateRange,
          campaignId,
          managerId: managerFilter || null
        });
        
        const { data, error: functionError } = await supabase.functions.invoke('analyze-funnel', {
          body: { 
            dateRange, 
            campaignId,
            managerId: managerFilter || null
          }
        });

        if (functionError) {
          console.error('Error from analyze-funnel function:', functionError);
          // Set empty data instead of throwing
          setFunnelData({
            dials: 0,
            connects: 0,
            qualified: 0,
            conversions: 0,
            connectRate: "0",
            qualificationRate: "0",
            conversionRate: "0"
          });
          setInsights(null);
          setMessage('Analysis temporarily unavailable');
          return;
        }

        // Handle error response from function
        if (data?.error) {
          console.error('Error in function response:', data.error);
          setFunnelData({
            dials: 0,
            connects: 0,
            qualified: 0,
            conversions: 0,
            connectRate: "0",
            qualificationRate: "0",
            conversionRate: "0"
          });
          setInsights(null);
          setMessage(data.message || 'Analysis temporarily unavailable');
          return;
        }

        setFunnelData(data?.funnelData || {
          dials: 0,
          connects: 0,
          qualified: 0,
          conversions: 0,
          connectRate: "0",
          qualificationRate: "0",
          conversionRate: "0"
        });
        
        // Log the response for debugging
        console.log('[useFunnelAnalysis] Response data:', {
          hasInsights: !!data?.insights,
          insightsCount: Array.isArray(data?.insights) ? data.insights.length : 0,
          insights: data?.insights,
          message: data?.message,
          funnelData: data?.funnelData
        });
        
        // Only set message if there are no insights
        // If insights exist, clear the message so they can be displayed
        if (data?.insights && Array.isArray(data.insights) && data.insights.length > 0) {
          setInsights(data.insights);
          setMessage(null); // Clear message when insights are available
        } else {
          setInsights(data?.insights || null);
          setMessage(data?.message || null);
        }
      } catch (err) {
        console.error('Error fetching funnel analysis:', err);
        // Set empty data instead of breaking
        setFunnelData({
          dials: 0,
          connects: 0,
          qualified: 0,
          conversions: 0,
          connectRate: "0",
          qualificationRate: "0",
          conversionRate: "0"
        });
        setInsights(null);
        setMessage('Analysis temporarily unavailable');
        setError(null); // Don't set error state, just show message
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [dateRange, campaignId, managerId, user]);

  return { funnelData, insights, message, loading, error };
}
