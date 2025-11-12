import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Image as ImageIcon, Smile } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MessageComposerProps {
  conversationId: string;
  disabled?: boolean;
}

export function MessageComposer({ conversationId, disabled = false }: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          conversationId,
          message: message.trim(),
        },
      });

      if (error) throw error;

      console.log("Message sent:", data);
      toast.success("Message sent!");
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMediaUpload = () => {
    // TODO: Implement media upload
    toast.info("Media upload will be available soon");
  };

  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMediaUpload}
          className="flex-shrink-0"
          disabled={disabled}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMediaUpload}
          className="flex-shrink-0"
          disabled={disabled}
        >
          <ImageIcon className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 relative">
          <Textarea
            placeholder={disabled ? "AI mode active - responses automated" : "Type a message..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[44px] max-h-32 resize-none pr-10"
            rows={1}
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            disabled={disabled}
          >
            <Smile className="h-5 w-5" />
          </Button>
        </div>

        <Button
          onClick={handleSend}
          disabled={!message.trim() || isSending || disabled}
          className="flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
