import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Image as ImageIcon, Smile, X, Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { cn } from "@/lib/utils";

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

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
    if ((!message.trim() && !selectedFile && !voiceNote) || isSending || !user) return;

    setIsSending(true);
    try {
      let mediaUrl = null;
      let mediaType = null;

      // Upload voice note to storage if provided
      if (voiceNote) {
        console.log('[Voice Note] Uploading voice note, size:', voiceNote.size, 'type:', voiceNote.type);
        
        // Determine file extension based on mime type - use actual type, don't fake it
        let fileExt = 'ogg';
        
        if (voiceNote.type.includes('ogg')) {
          fileExt = 'ogg';
        } else if (voiceNote.type.includes('mp4') || voiceNote.type.includes('m4a')) {
          fileExt = 'm4a';
        } else if (voiceNote.type.includes('webm')) {
          fileExt = 'webm';
        }
        
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(fileName, voiceNote, {
            cacheControl: '3600',
            upsert: false,
            contentType: voiceNote.type // Use actual recorded mime type
          });

        if (uploadError) {
          console.error('[Voice Note] Upload error:', uploadError);
          throw uploadError;
        }

        console.log('[Voice Note] Upload successful:', uploadData);

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
        mediaType = voiceNote.type; // Use actual recorded mime type
        console.log('[Voice Note] Media URL:', mediaUrl, 'Type:', mediaType);
      }
      // Upload file to storage if selected
      else if (selectedFile) {
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
        message: message.trim() || (voiceNote ? '🎤 Voice message' : mediaUrl ? '📎 Media file' : undefined),
        mediaUrl,
        mediaType,
      };

      console.log('[Send Message] Payload:', payload);

      // Add template parameters if sending template
      if (useTemplate) {
        payload.templateName = 'test_template_1';
        payload.templateLanguage = 'en';
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: payload,
      });

      if (error) {
        console.error('[Send Message] Error:', error);
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
      toast.success(useTemplate ? "Template message sent!" : voiceNote ? "Voice message sent!" : "Message sent!");
      setMessage("");
      setSelectedFile(null);
      setPreviewUrl(null);
      
      // Reset voice mode
      if (voiceNote) {
        resetRecording();
        setIsVoiceMode(false);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message: " + (error instanceof Error ? error.message : 'Unknown error'));
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
  let blobToSend = audioBlob;
  // Convert unsupported WebM/Opus recordings to OGG/Opus for WhatsApp
  if (audioBlob.type.includes('webm')) {
    try {
      toast.message('Converting voice note...', { description: 'Preparing OGG/Opus for WhatsApp' });
      const ffmpeg = new FFmpeg();
      await ffmpeg.load();
      await ffmpeg.writeFile('input.webm', await fetchFile(audioBlob));
      await ffmpeg.exec(['-i', 'input.webm', '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', '-vn', 'output.ogg']);
const data = await ffmpeg.readFile('output.ogg'); // Uint8Array from ffmpeg FS
const uint8 = data as Uint8Array;
// Create a plain ArrayBuffer to avoid SharedArrayBuffer typing issues
const ab2 = new ArrayBuffer(uint8.length);
new Uint8Array(ab2).set(uint8);
blobToSend = new Blob([ab2], { type: 'audio/ogg; codecs=opus' });
console.log('[Voice Note] Transcoded WebM->OGG. New size:', blobToSend.size);
    } catch (err) {
      console.error('[Voice Note] Transcode failed, sending original WebM:', err);
      toast.error('Conversion failed. Sending original file (may not play in WhatsApp).');
    }
  }
  await handleSend(false, blobToSend);
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
