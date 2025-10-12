import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const params = await req.formData();
    const isActive = params.get('isActive');
    const callerNumber = params.get('callerNumber');
    const destinationNumber = params.get('destinationNumber');
    const direction = params.get('direction');

    console.log('Voice callback received:', {
      isActive,
      callerNumber,
      destinationNumber,
      direction,
      allParams: Object.fromEntries(params.entries())
    });

    // Handle outbound calls from SIP client
    // When calling from SIP phone, Africa's Talking will call this callback
    // We respond with Dial action to forward the call to the dialed number
    if (direction === 'outbound' || destinationNumber) {
      const targetNumber = destinationNumber || callerNumber;
      const response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial phoneNumbers="${targetNumber}"/>
</Response>`;

      return new Response(response, {
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    // Handle inbound calls to virtual number
    // Forward incoming calls to SIP phone
    const response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial phoneNumbers="agent1.betsure@ug.sip.africastalking.com"/>
</Response>`;

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
