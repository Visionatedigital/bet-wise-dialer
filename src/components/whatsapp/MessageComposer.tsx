import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Image as ImageIcon, Smile, X, Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
// supabase removed
import { useAuth } from "@/contexts/AuthContext";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { cn } from "@/lib/utils";
import { isRateLimitError, getRateLimitMessage } from "@/utils/rateLimitHandler";

interface MessageComposerProps {
  conversationId: string;
  disabled?: boolean;
  onOptimisticStart?: (msg: any) => void;
  onOptimisticResolve?: (id: string, outcome: 'success' | 'failed') => void;
}

export function MessageComposer({ conversationId, disabled = false, onOptimisticStart, onOptimisticResolve }: MessageComposerProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const {
    isRecording,
    recordingDuration,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  } = useVoiceRecorder();

  const handleSend = async (useTemplate = false, voiceNote?: Blob) => {
    toast.error('WhatsApp messaging is not available in this version');
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

  const handleToggleVoiceMode = async () => {
    if (isVoiceMode) {
      // Switching back to text mode
      if (isRecording) {
        cancelRecording();
      }
      setIsVoiceMode(false);
    } else {
      // Switching to voice mode
      setIsVoiceMode(true);
    }
  };

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      toast.error("Failed to access microphone. Please check permissions.");
      setIsVoiceMode(false);
    }
  };

const handleSendVoiceNote = async () => {
  if (!audioBlob) return;

  // 1) Create optimistic local message immediately
  const tempId = `temp-${Date.now()}`;
  const localUrl = URL.createObjectURL(audioBlob);
  onOptimisticStart?.({
    id: tempId,
    conversation_id: conversationId,
    whatsapp_message_id: null,
    sender_type: 'agent',
    content: '🎤 Voice message',
    media_url: localUrl,
    media_type: audioBlob.type || 'audio/webm',
    status: 'pending',
    timestamp: new Date().toISOString(),
  });

  // 2) Send directly (no conversion - backend will handle it)
  try {
    await handleSend(false, audioBlob);
    onOptimisticResolve?.(tempId, 'success');
  } catch (e) {
    console.error('[Voice Note] Send failed:', e);
    onOptimisticResolve?.(tempId, 'failed');
  }
};

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 border-t border-border">
      {selectedFile && !isVoiceMode && (
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
        
        {!isVoiceMode ? (
          <>
            {/* Text Mode UI */}
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
              variant="ghost"
              size="icon"
              onClick={handleToggleVoiceMode}
              className="flex-shrink-0"
              disabled={disabled}
            >
              <Mic className="h-5 w-5" />
            </Button>

            <Button
              onClick={() => handleSend(false)}
              disabled={(!message.trim() && !selectedFile) || isSending || disabled}
              className="flex-shrink-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            {/* Voice Mode UI */}
            {!isRecording && !audioBlob ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleVoiceMode}
                  className="flex-shrink-0"
                >
                  <X className="h-5 w-5" />
                </Button>
                
                <div className="flex-1 flex items-center justify-center gap-2 bg-muted rounded-lg py-3 px-4">
                  <Mic className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Ready to record</span>
                </div>

                <Button
                  onClick={handleStartRecording}
                  className="flex-shrink-0 bg-primary"
                >
                  <Mic className="h-5 w-5" />
                </Button>
              </>
            ) : isRecording ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cancelRecording}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                </Button>
                
                <div className="flex-1 flex items-center justify-center gap-3 bg-destructive/10 rounded-lg py-3 px-4 animate-pulse">
                  <div className="flex gap-1">
                    <div className="w-1 h-8 bg-destructive rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-6 bg-destructive rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-10 bg-destructive rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    <div className="w-1 h-7 bg-destructive rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                  </div>
                  <span className="text-sm font-medium text-destructive">
                    Recording: {formatDuration(recordingDuration)}
                  </span>
                </div>

                <Button
                  onClick={stopRecording}
                  className="flex-shrink-0 bg-destructive hover:bg-destructive/90"
                >
                  <Square className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    resetRecording();
                    setIsVoiceMode(false);
                  }}
                  className="flex-shrink-0"
                >
                  <X className="h-5 w-5" />
                </Button>
                
                <div className="flex-1 flex items-center justify-center gap-2 bg-primary/10 rounded-lg py-3 px-4">
                  <Mic className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">
                    Voice note ready ({formatDuration(recordingDuration)})
                  </span>
                </div>

                <Button
                  onClick={handleSendVoiceNote}
                  disabled={isSending}
                  className="flex-shrink-0"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </>
            )}
          </>
        )}
      </div>
      
      {!isVoiceMode && (
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      )}
    </div>
  );
}
