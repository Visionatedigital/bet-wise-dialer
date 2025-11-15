import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageComposer } from "./MessageComposer";
import { AudioPlayer } from "./AudioPlayer";
import { format } from "date-fns";
import { Check, CheckCheck, MoreVertical, Bot, Trash2, Paperclip, AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MessageThreadProps {
  conversationId: string | null;
  onConversationDeleted?: () => void;
}

export function MessageThread({ conversationId, onConversationDeleted }: MessageThreadProps) {
  const { messages, loading, markAsRead } = useWhatsAppMessages(conversationId);
  const { conversations } = useWhatsAppConversations();
  const [aiMode, setAiMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const previousMessageCountRef = useRef(messages.length);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find(c => c.id === conversationId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Check if 24-hour window has passed
  const check24HourWindow = () => {
    if (!messages.length) return false;
    
    // Find the last message from agent
    const lastAgentMessage = [...messages].reverse().find(m => m.sender_type === 'agent');
    if (!lastAgentMessage) return false;
    
    // Check if there's any user message after the last agent message
    const lastAgentMessageIndex = messages.findIndex(m => m.id === lastAgentMessage.id);
    const hasUserResponseAfter = messages.slice(lastAgentMessageIndex + 1).some(m => m.sender_type === 'user');
    
    if (hasUserResponseAfter) return false;
    
    // Check if 24 hours have passed
    const lastMessageTime = new Date(lastAgentMessage.timestamp).getTime();
    const now = Date.now();
    const hoursPassed = (now - lastMessageTime) / (1000 * 60 * 60);
    
    return hoursPassed >= 24;
  };

  const needs24HourTemplate = check24HourWindow();

  // Handle sending follow-up template
  const handleSendFollowUpTemplate = async () => {
    if (!conversationId) return;

    setIsSendingTemplate(true);
    try {
      const { error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          conversationId,
          templateName: 'test_template_1',
        },
      });

      if (error) throw error;
      
      toast.success('Follow-up message sent');
    } catch (error) {
      console.error('Error sending template:', error);
      toast.error('Failed to send follow-up message');
    } finally {
      setIsSendingTemplate(false);
    }
  };

  // Load AI mode from localStorage
  useEffect(() => {
    if (conversationId) {
      const stored = localStorage.getItem(`ai-mode-${conversationId}`);
      setAiMode(stored === 'true');
    }
  }, [conversationId]);

  // Handle AI mode toggle
  const toggleAiMode = (checked: boolean) => {
    setAiMode(checked);
    if (conversationId) {
      localStorage.setItem(`ai-mode-${conversationId}`, checked.toString());
      toast.success(checked ? 'AI Assistant enabled' : 'AI Assistant disabled');
    }
  };

  // Handle delete conversation
  const handleDeleteConversation = async () => {
    if (!conversationId) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      toast.success('Chat deleted successfully');
      setShowDeleteDialog(false);
      onConversationDeleted?.();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete chat');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle incoming messages when AI mode is on
  useEffect(() => {
    const handleIncomingMessage = async () => {
      if (!conversationId || !aiMode || isProcessing) return;
      
      // Check if new message came in
      if (messages.length > previousMessageCountRef.current) {
        const latestMessage = messages[messages.length - 1];
        
        // Only respond to user messages
        if (latestMessage.sender_type === 'user') {
          setIsProcessing(true);
          
          try {
            console.log('[AI] Generating response for message:', latestMessage.content);
            
            // Get AI response
            const { data: aiData, error: aiError } = await supabase.functions.invoke(
              'whatsapp-ai-response',
              {
                body: { 
                  messages: messages.slice(-10), // Last 10 messages for context
                  conversationContext: {
                    contact_name: conversation?.contact_name,
                    contact_phone: conversation?.contact_phone
                  }
                }
              }
            );

            console.log('[AI] Response received:', aiData);

            if (aiError) {
              console.error('[AI] Error from AI function:', aiError);
              throw aiError;
            }

            if (!aiData?.response) {
              console.error('[AI] No response in AI data:', aiData);
              throw new Error('AI returned empty response');
            }

            console.log('[AI] Sending message:', aiData.response);

            // Send AI response
            const { data: sendData, error: sendError } = await supabase.functions.invoke(
              'whatsapp-send-message',
              {
                body: {
                  conversationId,
                  message: aiData.response
                }
              }
            );

            if (sendError) {
              const msg = (sendError as any)?.message || '';
              const ctxBody = (sendError as any)?.context?.body;
              const payload = (() => { try { return typeof ctxBody === 'string' ? JSON.parse(ctxBody) : ctxBody; } catch { return null; }})();
              const code = (payload && (payload.error || payload.code)) || '';
              if (msg.includes('409') || code === 'WHATSAPP_24H_WINDOW') {
                toast.error('24h window closed. Enable template sending to re-engage.');
                return;
              }
              console.error('[AI] Error sending message:', sendError);
              throw sendError;
            }

            console.log('[AI] Message sent successfully:', sendData);

          } catch (error) {
            console.error('[AI] Full error:', error);
            toast.error('Failed to generate AI response: ' + (error instanceof Error ? error.message : 'Unknown error'));
          } finally {
            setIsProcessing(false);
          }
        }
      }
      
      previousMessageCountRef.current = messages.length;
    };

    handleIncomingMessage();
  }, [messages.length, conversationId, aiMode, isProcessing, messages, conversation]);

  // Mark conversation as read when opened or when new messages arrive
  useEffect(() => {
    if (conversationId) {
      // Add a small delay to ensure the UI has rendered
      const timer = setTimeout(() => {
        markAsRead();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [conversationId, messages.length]);

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">Select a conversation to start messaging</p>
          <p className="text-sm">Your WhatsApp conversations will appear here</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  const displayName = conversation?.contact_name || conversation?.contact_phone || 'Unknown';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{displayName}</h3>
            <p className="text-sm text-muted-foreground">{conversation?.contact_phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="ai-mode"
              checked={aiMode}
              onCheckedChange={toggleAiMode}
              disabled={isProcessing}
            />
            <Label htmlFor="ai-mode" className="flex items-center gap-2 cursor-pointer">
              <Bot className={cn("h-4 w-4", aiMode && "text-primary")} />
              <span className="text-sm font-medium">AI Chat</span>
            </Label>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* 24-hour window warning */}
          {needs24HourTemplate && !isSendingTemplate && (
            <Alert className="border-warning bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span className="text-sm">
                  It's been over 24 hours since your last message. You need to send a template message to re-engage with this customer.
                </span>
                <Button
                  size="sm"
                  onClick={handleSendFollowUpTemplate}
                  disabled={isSendingTemplate}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Follow-up
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "flex animate-fade-in",
                  message.sender_type === 'agent' ? "justify-end" : "justify-start"
                )}
                style={{
                  animationDelay: `${index * 0.05}s`,
                  animationFillMode: 'both'
                }}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg p-3",
                    message.sender_type === 'agent'
                      ? "bg-primary text-primary-foreground animate-slide-in-from-right"
                      : "bg-muted animate-slide-in-from-left"
                  )}
                  style={{
                    animationDelay: `${index * 0.05}s`,
                    animationFillMode: 'both'
                  }}
                >
                  {message.media_url && message.media_type?.startsWith('image/') && (
                    <img 
                      src={message.media_url} 
                      alt="Shared media" 
                      className="max-w-full rounded mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(message.media_url!, '_blank')}
                    />
                  )}
                  {message.media_url && message.media_type?.startsWith('audio/') && (
                    <div className="mb-2">
                      <AudioPlayer 
                        audioUrl={message.media_url} 
                        isAgent={message.sender_type === 'agent'}
                      />
                    </div>
                  )}
                  {message.media_url && !message.media_type?.startsWith('image/') && !message.media_type?.startsWith('audio/') && (
                    <a 
                      href={message.media_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm underline mb-2"
                    >
                      <Paperclip className="h-4 w-4" />
                      View attachment
                    </a>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-xs opacity-70">
                      {format(new Date(message.timestamp), 'HH:mm')}
                    </span>
                    {message.sender_type === 'agent' && (
                      <>
                        {message.status === 'read' && (
                          <CheckCheck className="h-4 w-4 text-blue-400" />
                        )}
                        {message.status === 'delivered' && (
                          <CheckCheck className="h-4 w-4" />
                        )}
                        {message.status === 'sent' && (
                          <Check className="h-4 w-4" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <MessageComposer conversationId={conversationId} disabled={aiMode} />
    </div>
  );
}
