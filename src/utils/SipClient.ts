import { UserAgent, Registerer, Inviter, SessionState } from 'sip.js';
import { SessionDescriptionHandler } from 'sip.js/lib/platform/web';

export class SipClient {
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private currentSession: Inviter | null = null;
  private remoteAudio: HTMLAudioElement | null = null;

  async initialize(sipUsername: string, sipPassword: string) {
    try {
      console.log('Initializing SIP with username:', sipUsername);
      
      // Create audio element for remote audio
      if (!this.remoteAudio) {
        this.remoteAudio = document.createElement('audio');
        this.remoteAudio.autoplay = true;
        document.body.appendChild(this.remoteAudio);
      }

      // Parse username and domain from Africa's Talking format
      // Username format: agent1.betsure@ug.sip.africastalking.com
      let sipUser: string;
      let sipDomain: string;
      
      if (sipUsername.includes('@')) {
        const parts = sipUsername.split('@');
        sipUser = parts[0];  // agent1.betsure
        sipDomain = parts[1]; // ug.sip.africastalking.com
      } else {
        sipUser = sipUsername;
        sipDomain = 'ug.sip.africastalking.com';
      }

      console.log('SIP User:', sipUser, 'SIP Domain:', sipDomain);
      
      // Create proper SIP URI
      const uri = UserAgent.makeURI(`sip:${sipUser}@${sipDomain}`);
      if (!uri) {
        throw new Error('Failed to create SIP URI');
      }

      // Configure UserAgent with WebSocket server
      this.userAgent = new UserAgent({
        uri,
        transportOptions: {
          server: `wss://${sipDomain}:5060`,
        },
        authorizationUsername: sipUser,
        authorizationPassword: sipPassword,
        sessionDescriptionHandlerFactoryOptions: {
          constraints: {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false
          }
        },
        delegate: {
          onInvite: (invitation) => {
            console.log('Incoming call:', invitation);
            // Handle incoming calls if needed
          }
        }
      });

      // Start the user agent
      await this.userAgent.start();
      console.log('SIP User Agent started');

      // Register with the SIP server
      this.registerer = new Registerer(this.userAgent);
      await this.registerer.register();
      console.log('Registered with SIP server');

      return true;
    } catch (error) {
      console.error('SIP initialization error:', error);
      throw error;
    }
  }

  async makeCall(phoneNumber: string, onStateChange?: (state: string) => void) {
    if (!this.userAgent) {
      throw new Error('SIP client not initialized');
    }

    try {
      // Format phone number (ensure it starts with +)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      
      // Extract domain from our registered URI
      const ourUri = this.userAgent.configuration.uri;
      const sipDomain = ourUri.host;
      
      // Create target URI using the same domain
      const target = UserAgent.makeURI(`sip:${formattedPhone}@${sipDomain}`);
      if (!target) {
        throw new Error('Failed to create target URI');
      }

      // Create inviter
      this.currentSession = new Inviter(this.userAgent, target, {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false
          }
        }
      });

      // Set up session state change handler
      this.currentSession.stateChange.addListener((state) => {
        console.log('Call state:', state);
        onStateChange?.(state);

        if (state === SessionState.Established) {
          this.setupRemoteAudio();
        }
      });

      // Send INVITE
      await this.currentSession.invite();
      console.log('Call initiated to:', formattedPhone);

      return this.currentSession;
    } catch (error) {
      console.error('Error making call:', error);
      throw error;
    }
  }

  private setupRemoteAudio() {
    if (!this.currentSession || !this.remoteAudio) return;

    const sessionDescriptionHandler = this.currentSession.sessionDescriptionHandler;
    if (sessionDescriptionHandler instanceof SessionDescriptionHandler) {
      const remoteStream = sessionDescriptionHandler.remoteMediaStream;
      if (remoteStream) {
        this.remoteAudio.srcObject = remoteStream;
        console.log('Remote audio stream connected');
      }
    }
  }

  async hangup() {
    if (this.currentSession) {
      try {
        await this.currentSession.bye();
        console.log('Call ended');
      } catch (error) {
        console.error('Error ending call:', error);
      }
      this.currentSession = null;
    }
  }

  async unregister() {
    if (this.registerer) {
      try {
        await this.registerer.unregister();
        console.log('Unregistered from SIP server');
      } catch (error) {
        console.error('Error unregistering:', error);
      }
    }

    if (this.userAgent) {
      await this.userAgent.stop();
      console.log('SIP User Agent stopped');
    }

    if (this.remoteAudio && this.remoteAudio.parentNode) {
      this.remoteAudio.parentNode.removeChild(this.remoteAudio);
    }

    this.userAgent = null;
    this.registerer = null;
    this.currentSession = null;
    this.remoteAudio = null;
  }

  isRegistered(): boolean {
    return this.registerer !== null && this.registerer.state === 'Registered';
  }

  isInCall(): boolean {
    return this.currentSession !== null && 
           this.currentSession.state === SessionState.Established;
  }
}
