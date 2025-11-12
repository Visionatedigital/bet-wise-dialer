import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationContext } = await req.json();
    console.log('[AI Response] Received request with', messages?.length || 0, 'messages');
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      console.error('[AI Response] OPENAI_API_KEY not configured');
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (!messages || messages.length === 0) {
      console.error('[AI Response] No messages provided');
      throw new Error('No messages provided');
    }

    const systemPrompt = `You are a virtual assistant for BetSure, a premier sports betting platform.

BetSure Information:
- We offer competitive odds on football, basketball, tennis, and other major sports
- 24/7 customer support
- Fast deposits and withdrawals
- Welcome bonus for new customers
- Live betting available

Your role:
- Be helpful, friendly, and conversational
- Keep responses brief and human-like
- Prioritize learning from the conversation history to maintain context
- Be sentiment-aware and adjust your tone accordingly
- Focus on helping customers with betting questions, account issues, and general inquiries
- If you don't know something specific, be honest and offer to connect them with support

Remember: You're representing BetSure, so maintain professionalism while being approachable.`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg: any) => ({
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    console.log('[AI Response] Chat messages being sent:', JSON.stringify(chatMessages.map(m => ({
      role: m.role,
      contentLength: m.content.length,
      contentPreview: m.content.substring(0, 50)
    })), null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[AI Response] OpenAI API error:', response.status, error);
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('[AI Response] OpenAI full response:', JSON.stringify(data, null, 2));
    
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse || aiResponse.trim().length === 0) {
      console.error('[AI Response] Empty content from OpenAI. Full response:', JSON.stringify(data, null, 2));
      
      // Check if there's an error in the response
      if (data.error) {
        throw new Error(`OpenAI error: ${JSON.stringify(data.error)}`);
      }
      
      throw new Error(`OpenAI returned empty content. Response keys: ${JSON.stringify(Object.keys(data))}`);
    }

    console.log('[AI Response] Generated response length:', aiResponse.length);
    console.log('[AI Response] Response preview:', aiResponse.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in whatsapp-ai-response:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
