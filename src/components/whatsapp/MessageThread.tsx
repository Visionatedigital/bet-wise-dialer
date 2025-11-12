import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageComposer } from "./MessageComposer";
import { format } from "date-fns";
import { Check, CheckCheck, MoreVertical, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface MessageThreadProps {
  conversationId: string | null;
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const { messages, loading, markAsRead } = useWhatsAppMessages(conversationId);
  const { conversations } = useWhatsAppConversations();
  const [aiMode, setAiMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const previousMessageCountRef = useRef(messages.length);

  const conversation = conversations.find(c => c.id === conversationId);

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

  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markAsRead();
    }
  }, [conversationId, messages.length, markAsRead]);

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
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
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
        </div>
      </ScrollArea>

      {/* Composer */}
      <MessageComposer conversationId={conversationId} disabled={aiMode} />
    </div>
  );
}
