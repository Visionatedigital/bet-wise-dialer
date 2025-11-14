import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Image as ImageIcon, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MessageComposerProps {
  conversationId: string;
  disabled?: boolean;
}

export function MessageComposer({ conversationId, disabled = false }: MessageComposerProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (useTemplate = false) => {
    if ((!message.trim() && !selectedFile) || isSending || !user) return;

    setIsSending(true);
    try {
      let mediaUrl = null;
      let mediaType = null;

      // Upload file to storage if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(fileName, selectedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
        mediaType = selectedFile.type;
      }

      const payload: any = {
        conversationId,
        message: message.trim() || (mediaUrl ? '📎 Media file' : undefined),
        mediaUrl,
        mediaType,
      };

      // Add template parameters if sending template
      if (useTemplate) {
        payload.templateName = 'test_template_1';
        payload.templateLanguage = 'en';
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: payload,
      });

      if (error) {
        const msg = (error as any)?.message || '';
        const ctxBody = (error as any)?.context?.body;
        const payload = (() => { try { return typeof ctxBody === 'string' ? JSON.parse(ctxBody) : ctxBody; } catch { return null; }})();
        const code = (payload && (payload.error || payload.code)) || '';
        if (msg.includes('409') || code === 'WHATSAPP_24H_WINDOW') {
          // Automatically retry with template
          if (!useTemplate) {
            toast.info('Sending template message to initiate conversation...');
            await handleSend(true);
            return;
          }
        }
        throw error;
      }

      console.log("Message sent:", data);
      toast.success(useTemplate ? "Template message sent!" : "Message sent!");
      setMessage("");
      setSelectedFile(null);
      setPreviewUrl(null);
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

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return (
    <div className="p-4 border-t border-border">
      {selectedFile && (
        <div className="mb-2 p-2 bg-muted rounded-lg flex items-center gap-2">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="h-16 w-16 object-cover rounded" />
          ) : (
            <div className="h-16 w-16 bg-background rounded flex items-center justify-center">
              <Paperclip className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemoveFile}
            className="flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          disabled={disabled}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          disabled={disabled}
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0"
          disabled={disabled || !!selectedFile}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => imageInputRef.current?.click()}
          className="flex-shrink-0"
          disabled={disabled || !!selectedFile}
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
          onClick={() => handleSend(false)}
          disabled={(!message.trim() && !selectedFile) || isSending || disabled}
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
