import { useEffect, useState } from "react";
import { api } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Callback {
  id: string;
  lead_id?: string;
  user_id: string;
  call_activity_id: string | null;
  scheduled_for: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'completed' | 'cancelled' | 'rescheduled';
  notes: string | null;
  lead_name: string;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export function useCallbacks() {
  const { user } = useAuth();
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCallbacks = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await api.get<Callback[]>(`/callbacks?status=pending`);
      setCallbacks(data || []);
    } catch (error) {
      console.error("Error fetching callbacks:", error);
      toast.error("Failed to load callbacks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallbacks();

    // Replaced realtime subscription with polling
    const interval = setInterval(fetchCallbacks, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const updateCallback = async (id: string, updates: Partial<Callback>) => {
    try {
      await api.patch(`/callbacks/${id}`, updates);
      toast.success("Callback updated");
      await fetchCallbacks();
    } catch (error) {
      console.error("Error updating callback:", error);
      toast.error("Failed to update callback");
    }
  };

  const createCallback = async (callback: Omit<Callback, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await api.post("/callbacks", callback);
      toast.success("Callback created");
      await fetchCallbacks();
    } catch (error) {
      console.error("Error creating callback:", error);
      toast.error("Failed to create callback");
    }
  };

  const deleteCallback = async (id: string) => {
    try {
      await api.delete(`/callbacks/${id}`);
      toast.success("Callback deleted");
      await fetchCallbacks();
    } catch (error) {
      console.error("Error deleting callback:", error);
      toast.error("Failed to delete callback");
    }
  };

  return {
    callbacks,
    loading,
    updateCallback,
    createCallback,
    deleteCallback,
    refetch: fetchCallbacks,
  };
}
