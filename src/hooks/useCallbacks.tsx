import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
      const { data, error } = await supabase
        .from("callbacks")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("scheduled_for", { ascending: true });

      if (error) throw error;

      setCallbacks((data || []) as Callback[]);
    } catch (error) {
      console.error("Error fetching callbacks:", error);
      toast.error("Failed to load callbacks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallbacks();

    // Set up real-time subscription
    const subscription = supabase
      .channel('callbacks-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'callbacks',
          filter: `user_id=eq.${user?.id}`
        },
        () => fetchCallbacks()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const updateCallback = async (id: string, updates: Partial<Callback>) => {
    try {
      const { error } = await supabase
        .from("callbacks")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Callback updated");
      await fetchCallbacks();
    } catch (error) {
      console.error("Error updating callback:", error);
      toast.error("Failed to update callback");
    }
  };

  const createCallback = async (callback: Omit<Callback, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from("callbacks")
        .insert([callback]);

      if (error) throw error;
      
      toast.success("Callback created");
      await fetchCallbacks();
    } catch (error) {
      console.error("Error creating callback:", error);
      toast.error("Failed to create callback");
    }
  };

  const deleteCallback = async (id: string) => {
    try {
      const { error } = await supabase
        .from("callbacks")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
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
