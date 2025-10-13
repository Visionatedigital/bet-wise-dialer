import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callFlows, generateXML } from "./callFlows.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    const clientDialedNumber = params.clientDialedNumber;
    const destinationNumber = params.destinationNumber;
    const direction = params.direction;
    const dtmfDigits = params.dtmfDigits;
    const sessionId = params.sessionId;
    const callSessionState = params.callSessionState;
    const durationInSeconds = params.durationInSeconds;
    const dialDurationInSeconds = params.dialDurationInSeconds;
    const callStartTime = params.callStartTime;
    const status = params.status;

    console.log('[Voice Callback] 📋 ALL PARAMETERS:', JSON.stringify(params, null, 2));
    console.log('[Voice Callback] 📋 Parsed parameters:', {
      isActive,
      callerNumber,
      clientDialedNumber,
      destinationNumber,
      direction,
      dtmfDigits,
      sessionId,
      callSessionState,
      durationInSeconds,
      dialDurationInSeconds,
      status
    });

    // Log call activity to database
    await logCallActivity({
      sessionId,
      callerNumber,
      clientDialedNumber,
      destinationNumber,
      isActive,
      callSessionState,
      durationInSeconds,
      dialDurationInSeconds,
      callStartTime,
      status
    });

    // Determine which call flow to use
    // For outbound calls from WebRTC, callerNumber contains the SIP client name
    // and clientDialedNumber contains the actual number to dial
    let flowKey = 'inbound'; // default
    
    const isWebRTCClient = callerNumber && (callerNumber.includes('agent_') || callerNumber.includes('betsure.'));
    
    if (isWebRTCClient && clientDialedNumber) {
      flowKey = 'outbound';
      console.log('[Voice Callback] 🎯 Using OUTBOUND flow (WebRTC client detected)');
      console.log('[Voice Callback] 📱 Dialing number:', clientDialedNumber);
    } else if (direction === 'outbound' || (destinationNumber && !isWebRTCClient)) {
      flowKey = 'outbound';
      console.log('[Voice Callback] 🎯 Using OUTBOUND flow (explicit direction or destination)');
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
      clientDialedNumber: (clientDialedNumber as string) || '',
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

async function logCallActivity(params: {
  sessionId: string;
  callerNumber: string;
  clientDialedNumber?: string;
  destinationNumber: string;
  isActive: string;
  callSessionState?: string;
  durationInSeconds?: string;
  dialDurationInSeconds?: string;
  callStartTime?: string;
  status?: string;
}) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract user_id from caller number if it's a WebRTC client
    let userId: string | null = null;
    if (params.callerNumber && params.callerNumber.includes('agent_')) {
      const agentId = params.callerNumber.split('agent_')[1]?.split('.')[0];
      if (agentId) {
        userId = agentId;
        console.log('[Voice Callback] 📝 Extracted user ID:', userId);
      }
    }

    const phoneNumber = params.clientDialedNumber || params.destinationNumber;
    const isWebRTCCall = params.callerNumber?.includes('agent_') || params.callerNumber?.includes('betsure.');

    // Only log WebRTC outbound calls
    if (!isWebRTCCall) {
      console.log('[Voice Callback] ⏭️ Skipping non-WebRTC call logging');
      return;
    }

    if (!userId) {
      console.log('[Voice Callback] ⚠️ Could not extract user ID from caller number');
      return;
    }

    // Check if this is a new call or an update
    const { data: existingCall } = await supabase
      .from('call_activities')
      .select('id, status')
      .eq('notes', `session:${params.sessionId}`)
      .maybeSingle();

    if (existingCall) {
      // Update existing call
      console.log('[Voice Callback] 📝 Updating existing call:', existingCall.id);
      
      const updateData: any = {};
      
      if (params.isActive === '0' && params.callSessionState === 'Completed') {
        // Call ended
        updateData.end_time = new Date().toISOString();
        updateData.status = params.status === 'Success' ? 'connected' : 'failed';
        
        if (params.dialDurationInSeconds) {
          updateData.duration_seconds = parseInt(params.dialDurationInSeconds);
        }
        
        console.log('[Voice Callback] 📞 Call ended - Duration:', params.dialDurationInSeconds, 'seconds');
      } else if (params.callSessionState === 'Answered') {
        updateData.status = 'connected';
        console.log('[Voice Callback] ✅ Call answered');
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('call_activities')
          .update(updateData)
          .eq('id', existingCall.id);

        if (error) {
          console.error('[Voice Callback] ❌ Error updating call:', error);
        } else {
          console.log('[Voice Callback] ✅ Call activity updated');
        }
      }
    } else if (params.isActive === '1' && params.callSessionState === 'Ringing') {
      // New call starting
      console.log('[Voice Callback] 📝 Creating new call activity');
      
      const { error } = await supabase
        .from('call_activities')
        .insert({
          user_id: userId,
          phone_number: phoneNumber,
          call_type: 'outbound',
          status: 'ringing',
          start_time: params.callStartTime || new Date().toISOString(),
          notes: `session:${params.sessionId}`,
          duration_seconds: 0
        });

      if (error) {
        console.error('[Voice Callback] ❌ Error creating call activity:', error);
      } else {
        console.log('[Voice Callback] ✅ Call activity created');
      }
    }
  } catch (error) {
    console.error('[Voice Callback] ❌ Error in logCallActivity:', error);
  }
}
