import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { Search, Phone, Clock, User } from "lucide-react";
import { toast } from "sonner";

interface CallActivity {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  phone_number: string;
  lead_name: string;
  notes: string | null;
  status: string;
  deposit_amount: number;
}

interface CallHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallHistoryModal({ open, onOpenChange }: CallHistoryModalProps) {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open && user) {
      fetchCallHistory();
    }
  }, [open, user]);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('call_activities')
        .select('*')
        .eq('user_id', user?.id)
        .order('start_time', { ascending: false })
        .limit(100);

      if (error) throw error;

      setCalls(data || []);
    } catch (error) {
      console.error('Error fetching call history:', error);
      toast.error('Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls.filter(call => 
    call.lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    call.phone_number?.includes(searchTerm) ||
    call.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Call History & Notes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[500px] pr-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading call history...
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No calls found matching your search' : 'No calls yet'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCalls.map((call) => (
                  <div
                    key={call.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
                  >
                    {/* Call Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{call.lead_name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{call.phone_number}</span>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-1">
                        <Badge variant={call.status === 'converted' ? 'default' : 'secondary'}>
                          {call.status}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(call.duration_seconds || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(call.start_time), { addSuffix: true })}
                    </div>

                    {/* Notes */}
                    {call.notes && (
                      <div className="bg-muted/50 rounded p-3 text-sm">
                        <div className="font-medium mb-1 text-xs text-muted-foreground">Notes:</div>
                        <div className="whitespace-pre-wrap">{call.notes}</div>
                      </div>
                    )}

                    {/* Deposit Info */}
                    {call.deposit_amount > 0 && (
                      <div className="text-sm text-success">
                        Deposit: UGX {call.deposit_amount.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
