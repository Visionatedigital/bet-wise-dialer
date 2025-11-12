import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquarePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewConversationDialogProps {
  onConversationCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ onConversationCreated }: NewConversationDialogProps) {
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStartConversation = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Format phone number (ensure it starts with +)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('agent_id', user.id)
        .eq('contact_phone', formattedPhone)
        .single();

      if (existing) {
        toast.info("Conversation already exists");
        onConversationCreated(existing.id);
        setOpen(false);
        setPhoneNumber("");
        return;
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('whatsapp_conversations')
        .insert({
          agent_id: user.id,
          contact_phone: formattedPhone,
          contact_name: formattedPhone,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("New conversation started");
      onConversationCreated(newConv.id);
      setOpen(false);
      setPhoneNumber("");
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error("Failed to start conversation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full"
        variant="default"
      >
        <MessageSquarePlus className="h-4 w-4 mr-2" />
        New Conversation
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>
              Enter the phone number to start a new WhatsApp conversation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="+256700000000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleStartConversation();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +256 for Uganda)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartConversation} disabled={loading}>
              {loading ? "Starting..." : "Start Conversation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
