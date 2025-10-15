import { supabase } from "@/integrations/supabase/client";

export interface AISuggestion {
  type: 'sentiment' | 'action' | 'compliance' | 'info';
  confidence: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: number;
}

export class RealtimeAI {
  private ws: WebSocket | null = null;
  private isActive = false;

  constructor(
    private onSuggestion: (suggestion: AISuggestion) => void,
    private onConnectionChange: (connected: boolean) => void
  ) {}

  async init() {
    try {
      console.log('[RealtimeAI] Initializing connection to OpenAI...');
      
      // Get ephemeral token from edge function
      const { data, error } = await supabase.functions.invoke('get-realtime-token');
      
      if (error) throw error;
      if (!data?.client_secret?.value) {
        throw new Error('Failed to get ephemeral token');
      }

      const token = data.client_secret.value;
      console.log('[RealtimeAI] Got ephemeral token, connecting to OpenAI...');

      // Connect to OpenAI Realtime API
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      this.ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${model}`,
        ['realtime', `openai-insecure-api-key.${token}`, 'openai-beta.realtime-v1']
      );

      this.ws.onopen = () => {
        console.log('[RealtimeAI] WebSocket connected');
        this.isActive = true;
        this.onConnectionChange(true);

        // Configure session after connection
        this.ws?.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text'],
            instructions: `You are an AI assistant helping a call center agent at Betsure Uganda. 
Your role is to:
1. Listen to the conversation and provide real-time suggestions
2. Detect customer sentiment and intent
3. Suggest next best actions based on what you hear
4. Alert about compliance requirements (data protection, responsible gaming, call recording consent)
5. Provide quick answers to common questions about bonuses, deposits, withdrawals
6. Warn if the agent is going off-script or missing key talking points

Provide concise, actionable suggestions. Focus on helping the agent close the sale while staying compliant.`,
            turn_detection: null, // Manual turn detection for call monitoring
            temperature: 0.8,
          }
        }));

        // Send initial context
        this.sendContext('Call started - monitoring conversation for suggestions');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[RealtimeAI] Received:', message.type);
          
          if (message.type === 'response.text.delta') {
            // Accumulate text deltas and create suggestions
            this.handleTextDelta(message.delta);
          } else if (message.type === 'response.text.done') {
            this.handleTextComplete(message.text);
          } else if (message.type === 'error') {
            console.error('[RealtimeAI] Error from OpenAI:', message.error);
          }
        } catch (err) {
          console.error('[RealtimeAI] Error parsing message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[RealtimeAI] WebSocket error:', error);
        this.onConnectionChange(false);
      };

      this.ws.onclose = () => {
        console.log('[RealtimeAI] WebSocket closed');
        this.isActive = false;
        this.onConnectionChange(false);
      };

    } catch (error) {
      console.error('[RealtimeAI] Error initializing:', error);
      this.onConnectionChange(false);
      throw error;
    }
  }

  private currentTextAccumulator = '';

  private handleTextDelta(delta: string) {
    this.currentTextAccumulator += delta;
  }

  private handleTextComplete(text: string) {
    const fullText = text || this.currentTextAccumulator;
    this.currentTextAccumulator = '';

    if (!fullText || fullText.length < 10) return;

    // Parse the AI response and create appropriate suggestions
    const suggestion: AISuggestion = {
      type: this.inferSuggestionType(fullText),
      confidence: 'high',
      title: this.extractTitle(fullText),
      message: fullText,
      timestamp: Date.now()
    };

    this.onSuggestion(suggestion);
  }

  private inferSuggestionType(text: string): AISuggestion['type'] {
    const lower = text.toLowerCase();
    if (lower.includes('compliance') || lower.includes('consent') || lower.includes('data protection')) {
      return 'compliance';
    }
    if (lower.includes('positive') || lower.includes('negative') || lower.includes('sentiment')) {
      return 'sentiment';
    }
    if (lower.includes('suggest') || lower.includes('recommend') || lower.includes('try')) {
      return 'action';
    }
    return 'info';
  }

  private extractTitle(text: string): string {
    // Extract first sentence or first 50 characters as title
    const firstSentence = text.split(/[.!?]/)[0];
    return firstSentence.length > 50 
      ? firstSentence.substring(0, 47) + '...'
      : firstSentence;
  }

  sendContext(context: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeAI] Cannot send context - not connected');
      return;
    }

    console.log('[RealtimeAI] Sending context:', context);
    
    // Create a conversation item with user context
    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: context
        }]
      }
    }));

    // Request AI response
    this.ws.send(JSON.stringify({
      type: 'response.create'
    }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isActive = false;
    this.onConnectionChange(false);
    console.log('[RealtimeAI] Disconnected');
  }

  isConnected(): boolean {
    return this.isActive && this.ws?.readyState === WebSocket.OPEN;
  }
}
