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
        const rawUser = parts[0];
        const rawDomain = parts[1];
        sipUser = rawUser.trim();
        sipDomain = rawDomain.trim();
      } else {
        sipUser = sipUsername.trim();
        sipDomain = 'ug.sip.africastalking.com';
      }

      // Extra debugging for hidden characters
      console.debug('[SIP] Parsed credentials', {
        sipUser,
        sipDomain,
        sipUserLength: sipUser.length,
        sipDomainLength: sipDomain.length,
      });
      if (sipUser !== sipUser.replace(/\s/g, '') || sipDomain !== sipDomain.replace(/\s/g, '')) {
        console.warn('[SIP] Detected whitespace in credentials');
      }

      const sipUriString = `sip:${sipUser}@${sipDomain}`;
      console.debug('[SIP] Attempting to create URI from:', sipUriString);
      const uri = UserAgent.makeURI(sipUriString);
      if (!uri) {
        console.error('[SIP] makeURI failed', { sipUriString, sipUser, sipDomain });
        throw new Error('Failed to create SIP URI');
      }

      const serverUrl = `wss://${sipDomain}:5060`;
      console.debug('[SIP] Using WebSocket server:', serverUrl);

      // Configure UserAgent with WebSocket server
      this.userAgent = new UserAgent({
        uri,
        transportOptions: {
          server: serverUrl,
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
      console.debug('[SIP] Starting User Agent...');
      await this.userAgent.start();
      console.log('SIP User Agent started');

      // Register with the SIP server
      console.debug('[SIP] Creating Registerer and registering...');
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
      console.debug('[SIP] Placing call to:', formattedPhone);
      
      // Extract domain from our registered URI
      const ourUri = this.userAgent.configuration.uri;
      console.debug('[SIP] Our registered URI:', String(ourUri));
      const sipDomain = (ourUri as any).host ?? (ourUri as any).normal?.host ?? '';
      console.debug('[SIP] Using SIP domain for target:', sipDomain);
      
      // Create target URI using the same domain
      const targetString = `sip:${formattedPhone}@${sipDomain}`;
      console.debug('[SIP] Target URI string:', targetString);
      const target = UserAgent.makeURI(targetString);
      if (!target) {
        console.error('[SIP] Failed to create target URI from string', { targetString });
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
      } else {
        console.warn('[SIP] No remoteMediaStream present on SessionDescriptionHandler');
      }
    } else {
      console.warn('[SIP] sessionDescriptionHandler is not an instance of SessionDescriptionHandler', sessionDescriptionHandler);
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
