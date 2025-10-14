import { supabase } from "@/integrations/supabase/client";

export interface AISuggestion {
  type: 'sentiment' | 'action' | 'compliance' | 'info';
  confidence: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: number;
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
};

export class RealtimeAI {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private recorder: AudioRecorder | null = null;
  private sessionActive = false;

  constructor(
    private onSuggestion: (suggestion: AISuggestion) => void,
    private onConnectionChange: (connected: boolean) => void
  ) {}

  async init() {
    try {
      console.log('[RealtimeAI] Getting ephemeral token...');
      
      const { data, error } = await supabase.functions.invoke('get-realtime-token');
      
      if (error) throw error;
      if (!data?.client_secret?.value) {
        throw new Error("Failed to get ephemeral token");
      }

      const EPHEMERAL_KEY = data.client_secret.value;
      console.log('[RealtimeAI] Token received, establishing WebRTC connection...');

      // Create peer connection
      this.pc = new RTCPeerConnection();

      // Add local audio track
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.pc.addTrack(ms.getTracks()[0]);

      // Set up data channel for events
      this.dc = this.pc.createDataChannel("oai-events");
      
      this.dc.addEventListener("open", () => {
        console.log('[RealtimeAI] Data channel opened');
        this.sessionActive = true;
        this.onConnectionChange(true);
        
        // Send session update after connection
        this.sendSessionUpdate();
      });

      this.dc.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        console.log('[RealtimeAI] Received event:', event.type);
        this.handleEvent(event);
      });

      this.dc.addEventListener("close", () => {
        console.log('[RealtimeAI] Data channel closed');
        this.sessionActive = false;
        this.onConnectionChange(false);
      });

      // Create and set local description
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Connect to OpenAI's Realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp"
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`OpenAI connection failed: ${sdpResponse.status}`);
      }

      const answer = {
        type: "answer" as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      
      await this.pc.setRemoteDescription(answer);
      console.log('[RealtimeAI] WebRTC connection established');

    } catch (error) {
      console.error('[RealtimeAI] Error initializing:', error);
      this.onConnectionChange(false);
      throw error;
    }
  }

  private sendSessionUpdate() {
    if (!this.dc || this.dc.readyState !== 'open') return;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        temperature: 0.8,
      }
    };

    console.log('[RealtimeAI] Sending session update');
    this.dc.send(JSON.stringify(sessionUpdate));
  }

  private handleEvent(event: any) {
    // Parse AI suggestions from conversation events
    if (event.type === 'conversation.item.created') {
      const content = event.item?.content?.[0]?.text;
      if (content) {
        this.parseSuggestion(content);
      }
    }
    
    if (event.type === 'response.done') {
      const output = event.response?.output?.[0];
      if (output?.content?.[0]?.text) {
        this.parseSuggestion(output.content[0].text);
      }
    }
  }

  private parseSuggestion(text: string) {
    // Parse AI responses into structured suggestions
    // This is a simple parser - could be enhanced with more sophisticated logic
    
    let type: AISuggestion['type'] = 'info';
    let confidence: AISuggestion['confidence'] = 'medium';
    let title = 'AI Suggestion';
    
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('sentiment') || lowerText.includes('tone') || lowerText.includes('emotion')) {
      type = 'sentiment';
      title = 'Sentiment Analysis';
    } else if (lowerText.includes('compliance') || lowerText.includes('gdpr') || lowerText.includes('consent')) {
      type = 'compliance';
      title = 'Compliance Reminder';
    } else if (lowerText.includes('next') || lowerText.includes('should') || lowerText.includes('suggest')) {
      type = 'action';
      title = 'Next Best Action';
    }
    
    if (lowerText.includes('high confidence') || lowerText.includes('strongly')) {
      confidence = 'high';
    } else if (lowerText.includes('low confidence') || lowerText.includes('maybe')) {
      confidence = 'low';
    }

    this.onSuggestion({
      type,
      confidence,
      title,
      message: text,
      timestamp: Date.now()
    });
  }

  disconnect() {
    this.recorder?.stop();
    this.dc?.close();
    this.pc?.close();
    this.sessionActive = false;
    this.onConnectionChange(false);
  }

  isActive(): boolean {
    return this.sessionActive;
  }
}
