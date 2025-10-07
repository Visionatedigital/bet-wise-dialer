import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const params = await req.formData();
    const isActive = params.get('isActive');
    const callerNumber = params.get('callerNumber');
    const direction = params.get('direction');

    console.log('Voice callback received:', {
      isActive,
      callerNumber,
      direction,
      allParams: Object.fromEntries(params.entries())
    });

    // Generate TwiML-style response for Africa's Talking
    const response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">
    Thank you for contacting Betsure. Please hold while we connect you to an agent.
  </Say>
  <Play url="https://demo.twilio.com/docs/classic.mp3"/>
  <Say voice="woman">
    An agent will be with you shortly.
  </Say>
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
