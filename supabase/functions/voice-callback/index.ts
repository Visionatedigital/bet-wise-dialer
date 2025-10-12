import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callFlows, generateXML } from "./callFlows.ts";

serve(async (req) => {
  try {
    const params = await req.formData();
    const isActive = params.get('isActive');
    const callerNumber = params.get('callerNumber');
    const destinationNumber = params.get('destinationNumber');
    const direction = params.get('direction');
    const dtmfDigits = params.get('dtmfDigits'); // For IVR responses

    console.log('Voice callback received:', {
      isActive,
      callerNumber,
      destinationNumber,
      direction,
      dtmfDigits,
      allParams: Object.fromEntries(params.entries())
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
