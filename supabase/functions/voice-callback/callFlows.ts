// Call flow configurations for voice callback
export type CallFlowType = 'outbound' | 'inbound' | 'ivr';

export interface CallFlowAction {
  type: 'dial' | 'say' | 'play' | 'getDigits' | 'record' | 'redirect';
  phoneNumbers?: string;
  text?: string;
  voice?: 'man' | 'woman';
  playBeep?: boolean;
  finishOnKey?: string;
  callbackUrl?: string;
  url?: string;
}

export interface CallFlow {
  type: CallFlowType;
  actions: CallFlowAction[];
}

// Default call flows
export const callFlows: Record<string, CallFlow> = {
  outbound: {
    type: 'outbound',
    actions: [
      {
        type: 'dial',
        phoneNumbers: 'destinationNumber', // Will be replaced dynamically
      }
    ]
  },
  
  inbound: {
    type: 'inbound',
    actions: [
      {
        type: 'dial',
        phoneNumbers: 'agent1.betsure@ug.sip.africastalking.com',
      }
    ]
  },
  
  ivr: {
    type: 'ivr',
    actions: [
      {
        type: 'say',
        text: 'Welcome to BetSure. Press 1 for sales, press 2 for support.',
        voice: 'woman',
      },
      {
        type: 'getDigits',
        finishOnKey: '#',
        callbackUrl: 'https://hahkgifqajdnhvkbzwfx.supabase.co/functions/v1/voice-callback',
      }
    ]
  },
  
  voicemail: {
    type: 'inbound',
    actions: [
      {
        type: 'say',
        text: 'Please leave a message after the beep.',
        voice: 'woman',
      },
      {
        type: 'record',
        playBeep: true,
        finishOnKey: '#',
      }
    ]
  }
};

// Generate XML from call flow actions
export function generateXML(actions: CallFlowAction[], params: Record<string, string>): string {
  const actionXML = actions.map(action => {
    switch (action.type) {
      case 'dial':
        const phoneNumber = action.phoneNumbers === 'destinationNumber' 
          ? (params.destinationNumber || params.callerNumber)
          : action.phoneNumbers;
        return `  <Dial phoneNumbers="${phoneNumber}"/>`;
      
      case 'say':
        return `  <Say voice="${action.voice || 'woman'}">\n    ${action.text}\n  </Say>`;
      
      case 'play':
        return `  <Play url="${action.url}"/>`;
      
      case 'getDigits':
        return `  <GetDigits finishOnKey="${action.finishOnKey}" callbackUrl="${action.callbackUrl}"/>`;
      
      case 'record':
        return `  <Record playBeep="${action.playBeep ? 'true' : 'false'}" finishOnKey="${action.finishOnKey}"/>`;
      
      case 'redirect':
        return `  <Redirect>${action.url}</Redirect>`;
      
      default:
        return '';
    }
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${actionXML}
</Response>`;
}
