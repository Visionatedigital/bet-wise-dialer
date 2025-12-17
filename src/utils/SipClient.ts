import { UserAgent, Registerer, Inviter, SessionState } from 'sip.js';
import { SessionDescriptionHandler } from 'sip.js/lib/platform/web';

// Africa's Talking SIP WebSocket configuration
const AT_SIP_CONFIG = {
  // WebSocket port for Africa's Talking SIP (WSS uses 443, not 5060)
  wsPort: 443,
  // Fallback ports to try if primary fails
  fallbackPorts: [5060, 8443],
  // Connection timeout in milliseconds
  connectionTimeout: 10000,
  // Registration retry attempts
  maxRetries: 3,
  // Retry delay in milliseconds
  retryDelay: 2000,
};

export class SipClient {
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private currentSession: Inviter | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private connectionAttempts = 0;
  private isConnecting = false;

  async initialize(sipUsername: string, sipPassword: string, retryCount = 0): Promise<boolean> {
    if (this.isConnecting) {
      console.warn('[SIP] Already attempting to connect, please wait...');
      return false;
    }

    this.isConnecting = true;

    try {
      console.log('========================================');
      console.log('[SIP] 🚀 Initializing SIP with username:', sipUsername);
      console.log('[SIP] Attempt:', retryCount + 1, 'of', AT_SIP_CONFIG.maxRetries);
      
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
        console.warn('[SIP] ⚠️ Detected whitespace in credentials');
      }

      const sipUriString = `sip:${sipUser}@${sipDomain}`;
      console.debug('[SIP] Attempting to create URI from:', sipUriString);
      const uri = UserAgent.makeURI(sipUriString);
      if (!uri) {
        console.error('[SIP] ❌ makeURI failed', { sipUriString, sipUser, sipDomain });
        throw new Error('Failed to create SIP URI');
      }

      // Try different ports - start with 443 (standard WSS), then fallbacks
      const portsToTry = [AT_SIP_CONFIG.wsPort, ...AT_SIP_CONFIG.fallbackPorts];
      const portToUse = portsToTry[retryCount % portsToTry.length];
      
      const serverUrl = `wss://${sipDomain}:${portToUse}`;
      console.debug('[SIP] 🔗 Using WebSocket server:', serverUrl);

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

      // Start the user agent with timeout
      console.debug('[SIP] Starting User Agent...');
      
      const startPromise = this.userAgent.start();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), AT_SIP_CONFIG.connectionTimeout)
      );
      
      await Promise.race([startPromise, timeoutPromise]);
      console.log('[SIP] ✅ User Agent started');

      // Register with the SIP server
      console.debug('[SIP] Creating Registerer and registering...');
      this.registerer = new Registerer(this.userAgent);
      
      const registerPromise = this.registerer.register();
      await Promise.race([registerPromise, timeoutPromise]);
      
      console.log('[SIP] ✅ Registered with SIP server successfully');
      console.log('========================================');
      
      this.connectionAttempts = 0;
      this.isConnecting = false;
      return true;
    } catch (error) {
      console.error('[SIP] ❌ Initialization error:', error);
      this.isConnecting = false;
      
      // Retry with different port if we haven't exhausted retries
      if (retryCount < AT_SIP_CONFIG.maxRetries - 1) {
        console.log(`[SIP] 🔄 Retrying in ${AT_SIP_CONFIG.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, AT_SIP_CONFIG.retryDelay));
        return this.initialize(sipUsername, sipPassword, retryCount + 1);
      }
      
      console.error('[SIP] ❌ All connection attempts failed');
      console.log('========================================');
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
