import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Image as ImageIcon, Smile } from "lucide-react";
import { toast } from "sonner";

interface MessageComposerProps {
  conversationId: string;
}

export function MessageComposer({ conversationId }: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    setIsSending(true);
    try {
      // TODO: Send message via WhatsApp Business API
      console.log("Sending message:", message, "to conversation:", conversationId);
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
    toast.info("Media upload will be available once WhatsApp API is configured");
  };

  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMediaUpload}
          className="flex-shrink-0"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMediaUpload}
          className="flex-shrink-0"
        >
          <ImageIcon className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 relative">
          <Textarea
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[44px] max-h-32 resize-none pr-10"
            rows={1}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <Smile className="h-5 w-5" />
          </Button>
        </div>

        <Button
          onClick={handleSend}
          disabled={!message.trim() || isSending}
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
