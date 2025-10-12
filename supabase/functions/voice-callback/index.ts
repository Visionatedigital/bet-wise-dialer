import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callFlows, generateXML } from "./callFlows.ts";

serve(async (req) => {
  try {
    console.log('========================================');
    console.log('[Voice Callback] 📞 New request received');
    console.log('[Voice Callback] Method:', req.method);
    console.log('[Voice Callback] URL:', req.url);
    console.log('[Voice Callback] Content-Type:', req.headers.get('content-type'));
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      console.log('[Voice Callback] ✅ Handling CORS preflight');
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      });
    }

    // Log raw body for debugging
    const bodyText = await req.text();
    console.log('[Voice Callback] 📦 Raw body:', bodyText);
    console.log('[Voice Callback] 📦 Body length:', bodyText.length);

    // Try to parse as JSON, if it fails, try form-urlencoded
    let params: any = {};
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      console.log('[Voice Callback] 🔄 Parsing as JSON');
      try {
        params = JSON.parse(bodyText);
      } catch (e) {
        console.error('[Voice Callback] ❌ JSON parse error:', e);
        throw new Error('Invalid JSON body');
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      console.log('[Voice Callback] 🔄 Parsing as form-urlencoded');
      const searchParams = new URLSearchParams(bodyText);
      params = Object.fromEntries(searchParams.entries());
    } else {
      console.log('[Voice Callback] ⚠️ Unknown content type, attempting JSON parse');
      try {
        params = JSON.parse(bodyText);
      } catch (e) {
        console.error('[Voice Callback] ❌ Could not parse body as JSON');
        // Try form-urlencoded as fallback
        const searchParams = new URLSearchParams(bodyText);
        params = Object.fromEntries(searchParams.entries());
      }
    }

    const isActive = params.isActive;
    const callerNumber = params.callerNumber;
    const destinationNumber = params.destinationNumber || params.clientDialedNumber;
    const direction = params.direction;
    const dtmfDigits = params.dtmfDigits;

    console.log('[Voice Callback] 📋 Parsed parameters:', {
      isActive,
      callerNumber,
      destinationNumber,
      direction,
      dtmfDigits,
      allParams: params
    });

    // Determine which call flow to use
    let flowKey = 'inbound'; // default
    
    if (direction === 'outbound' || destinationNumber) {
      flowKey = 'outbound';
      console.log('[Voice Callback] 🎯 Using OUTBOUND flow');
    } else if (dtmfDigits) {
      flowKey = 'ivr';
      console.log('[Voice Callback] 🎯 Using IVR flow');
    } else {
      console.log('[Voice Callback] 🎯 Using INBOUND flow');
    }

    // Get the call flow configuration
    const flow = callFlows[flowKey];
    
    if (!flow) {
      console.error('[Voice Callback] ❌ Call flow not found:', flowKey);
      throw new Error(`Call flow '${flowKey}' not found`);
    }

    console.log('[Voice Callback] 📝 Flow configuration:', flow);

    // Generate XML response from call flow
    const response = generateXML(flow.actions, {
      callerNumber: (callerNumber as string) || '',
      destinationNumber: (destinationNumber as string) || '',
      dtmfDigits: (dtmfDigits as string) || '',
    });

    console.log('[Voice Callback] 📤 Sending XML response:');
    console.log(response);
    console.log('[Voice Callback] ✅ Response sent successfully');
    console.log('========================================');

    return new Response(response, {
      headers: { 'Content-Type': 'application/xml' },
    });

  } catch (error) {
    console.error('[Voice Callback] ❌❌❌ ERROR OCCURRED ❌❌❌');
    console.error('[Voice Callback] Error details:', error);
    console.error('[Voice Callback] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[Voice Callback] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.log('========================================');
    
    // Return a simple error response in XML format
    const errorResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">
    We're sorry, but we're experiencing technical difficulties. Please try again later.
  </Say>
  <Hangup/>
</Response>`;

    return new Response(errorResponse, {
      headers: { 'Content-Type': 'application/xml' },
    });
  }
});
