import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callFlows, generateXML } from "./callFlows.ts";

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      });
    }

    const params = await req.json();
    const isActive = params.isActive;
    const callerNumber = params.callerNumber;
    const destinationNumber = params.destinationNumber || params.clientDialedNumber;
    const direction = params.direction;
    const dtmfDigits = params.dtmfDigits; // For IVR responses

    console.log('Voice callback received:', {
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
    } else if (dtmfDigits) {
      // Handle IVR digit responses
      flowKey = 'ivr'; // You can extend this to handle different digit responses
    }

    // Get the call flow configuration
    const flow = callFlows[flowKey];
    
    if (!flow) {
      throw new Error(`Call flow '${flowKey}' not found`);
    }

    // Generate XML response from call flow
    const response = generateXML(flow.actions, {
      callerNumber: (callerNumber as string) || '',
      destinationNumber: (destinationNumber as string) || '',
      dtmfDigits: (dtmfDigits as string) || '',
    });

    console.log(`Using ${flowKey} call flow:`, response);

    return new Response(response, {
      headers: { 'Content-Type': 'application/xml' },
    });

  } catch (error) {
    console.error('Error in voice callback:', error);
    
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
