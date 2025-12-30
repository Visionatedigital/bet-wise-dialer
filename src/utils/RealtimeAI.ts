import { supabase } from "@/integrations/supabase/client";

export interface AISuggestion {
  type: 'sentiment' | 'action' | 'compliance' | 'info';
  confidence: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: number;
}

export type CallSentiment = 'neutral' | 'positive' | 'negative' | 'critical';

export class RealtimeAI {
  private ws: WebSocket | null = null;
  private isActive = false;
  private conversationContext = '';

  constructor(
    private onSuggestion: (suggestion: AISuggestion) => void,
    private onConnectionChange: (connected: boolean) => void,
    private onSentimentChange: (sentiment: CallSentiment) => void
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
          console.log('[RealtimeAI] Received event:', message.type);
          
          // Handle different response event types
          if (message.type === 'response.output_item.added') {
            console.log('[RealtimeAI] Output item added');
          } else if (message.type === 'response.content_part.added') {
            console.log('[RealtimeAI] Content part added');
          } else if (message.type === 'response.text.delta') {
            const delta = message.delta || '';
            if (delta) {
              this.handleTextDelta(delta);
            }
          } else if (message.type === 'response.output_item.done') {
            // Extract the complete text from the output item
            const text = message.item?.content?.[0]?.text || '';
            if (text && text.trim().length > 0) {
              console.log('[RealtimeAI] Complete response:', text);
              this.handleTextComplete(text);
            }
          } else if (message.type === 'response.done') {
            // Fallback: extract text from the response
            const outputs = message.response?.output || [];
            let foundText = false;
            outputs.forEach((output: any) => {
              output.content?.forEach((content: any) => {
                if (content.type === 'text' && content.text && content.text.trim().length > 0) {
                  console.log('[RealtimeAI] Response text:', content.text);
                  this.handleTextComplete(content.text);
                  foundText = true;
                }
              });
            });
            if (!foundText && this.currentTextAccumulator.trim().length > 0) {
              // Use accumulated text if no text found in response
              console.log('[RealtimeAI] Using accumulated text:', this.currentTextAccumulator);
              this.handleTextComplete(this.currentTextAccumulator);
            }
          } else if (message.type === 'error') {
            console.error('[RealtimeAI] Error from OpenAI:', message.error);
            this.onConnectionChange(false);
          } else if (message.type === 'session.created') {
            console.log('[RealtimeAI] Session created successfully');
          } else if (message.type === 'session.updated') {
            console.log('[RealtimeAI] Session updated successfully');
          }
        } catch (err) {
          console.error('[RealtimeAI] Error parsing message:', err, event.data);
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

    if (!fullText || fullText.trim().length < 10) {
      console.log('[RealtimeAI] Text too short, skipping:', fullText);
      return;
    }

    console.log('[RealtimeAI] Processing complete text:', fullText.substring(0, 100) + '...');

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(fullText);
    console.log('[RealtimeAI] Analyzed sentiment:', sentiment);
    this.onSentimentChange(sentiment);

    // Parse the AI response and create appropriate suggestions
    const suggestion: AISuggestion = {
      type: this.inferSuggestionType(fullText),
      confidence: 'high',
      title: this.extractTitle(fullText),
      message: fullText,
      timestamp: Date.now()
    };

    console.log('[RealtimeAI] Creating suggestion:', suggestion.title);
    this.onSuggestion(suggestion);
  }

  private analyzeSentiment(text: string): CallSentiment {
    const lowerText = text.toLowerCase();
    
    // Critical negative indicators
    const criticalIndicators = ['cancel', 'unsubscribe', 'not interested', 'stop calling', 'remove me', 'annoyed', 'angry'];
    if (criticalIndicators.some(indicator => lowerText.includes(indicator))) {
      return 'critical';
    }
    
    // Negative indicators
    const negativeIndicators = ['concern', 'worried', 'hesitant', 'unsure', 'doubt', 'problem', 'issue'];
    if (negativeIndicators.some(indicator => lowerText.includes(indicator))) {
      return 'negative';
    }
    
    // Positive indicators
    const positiveIndicators = ['interested', 'yes', 'sounds good', 'tell me more', 'excited', 'great', 'perfect'];
    if (positiveIndicators.some(indicator => lowerText.includes(indicator))) {
      return 'positive';
    }
    
    return 'neutral';
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
      console.warn('[RealtimeAI] Cannot send context - not connected. WS state:', this.ws?.readyState);
      return;
    }

    if (!context || context.trim().length === 0) {
      console.warn('[RealtimeAI] Empty context, skipping');
      return;
    }

    console.log('[RealtimeAI] Sending context:', context.substring(0, 100) + (context.length > 100 ? '...' : ''));
    
    // Accumulate conversation context (keep last 2000 chars to avoid token limits)
    this.conversationContext += '\n' + context;
    if (this.conversationContext.length > 2000) {
      this.conversationContext = this.conversationContext.slice(-2000);
    }
    
    // Create a conversation item with user context and instructions to analyze sentiment
    try {
    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
            text: `The agent just said: "${context}"\n\nAnalyze this and provide a brief, actionable suggestion (1-2 sentences) to help the agent. Focus on:\n- Customer sentiment (positive/negative/critical)\n- Next best action to close the deal\n- Compliance reminders if needed\n\nKeep your response concise and actionable.`
        }]
      }
    }));

    // Request AI response
    this.ws.send(JSON.stringify({
      type: 'response.create'
    }));
      
      console.log('[RealtimeAI] Context sent and response requested');
    } catch (error) {
      console.error('[RealtimeAI] Error sending context:', error);
    }
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
