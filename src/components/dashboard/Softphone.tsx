import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock, Pause, Play, Grid3x3, Delete, TestTube, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCallMetrics } from "@/hooks/useCallMetrics";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SipClient } from "@/utils/SipClient";
import { SessionState } from "sip.js";

// @ts-ignore - AfricasTalking WebRTC SDK
declare const Africastalking: any;

type CallStatus = "idle" | "ringing" | "connected" | "hold" | "muted";
type ConnectionMode = 'webrtc' | 'sip';

interface SoftphoneProps {
  currentLead?: {
    name: string;
    phone: string;
    campaign: string;
  };
}

export function Softphone({ currentLead }: SoftphoneProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [dialedNumber, setDialedNumber] = useState("");
  const [showDialPad, setShowDialPad] = useState(false);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('webrtc');
  const [isWebRTCReady, setIsWebRTCReady] = useState(false);
  const [webrtcToken, setWebrtcToken] = useState<string | null>(null);
  
  const { createCallActivity, updateCallActivity } = useCallMetrics();
  const sipClientRef = useRef<SipClient | null>(null);
  const webrtcClientRef = useRef<any>(null);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize WebRTC client
  const initializeWebRTC = async () => {
    try {
      toast.info("Connecting to WebRTC...");
      
      const { data, error } = await supabase.functions.invoke('get-webrtc-token');
      
      if (error) throw error;
      
      if (!data.token) {
        throw new Error('No token received');
      }

      console.log('[WebRTC] Token received:', data.clientName);
      setWebrtcToken(data.token);

      // Initialize Africastalking client
      if (typeof window.Africastalking === 'undefined') {
        throw new Error('Africastalking SDK not loaded');
      }

      const client = new window.Africastalking.WebRTCClient(data.token);
      webrtcClientRef.current = client;

      // Set up event listeners
      client.on('ready', () => {
        console.log('[WebRTC] Client ready');
        setIsWebRTCReady(true);
        toast.success("WebRTC connected!");
      });

      client.on('notready', () => {
        console.log('[WebRTC] Client not ready');
        setIsWebRTCReady(false);
        toast.error("WebRTC not ready");
      });

      client.on('calling', () => {
        console.log('[WebRTC] Calling...');
        setCallStatus('ringing');
      });

      client.on('incomingcall', (params: any) => {
        console.log('[WebRTC] Incoming call from:', params.from);
        toast.info(`Incoming call from ${params.from}`);
        setCallStatus('ringing');
      });

      client.on('callaccepted', () => {
        console.log('[WebRTC] Call accepted');
        setCallStatus('connected');
        setCallStartTime(new Date());
        
        // Start call timer
        const timer = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        callIntervalRef.current = timer;
      });

      client.on('hangup', (hangupCause: any) => {
        console.log('[WebRTC] Call ended:', hangupCause);
        handleCallEnd();
      });

      client.on('offline', () => {
        console.log('[WebRTC] Token expired');
        setIsWebRTCReady(false);
        toast.warning("Session expired");
      });

      client.on('closed', () => {
        console.log('[WebRTC] Connection closed');
        setIsWebRTCReady(false);
        toast.error("Connection lost");
      });

    } catch (error) {
      console.error('[WebRTC] Initialization error:', error);
      toast.error("Failed to connect WebRTC");
      setIsWebRTCReady(false);
    }
  };

  // Disconnect WebRTC
  const disconnectWebRTC = () => {
    if (webrtcClientRef.current) {
      webrtcClientRef.current = null;
    }
    setIsWebRTCReady(false);
    setWebrtcToken(null);
    toast.info("WebRTC disconnected");
  };

  useEffect(() => {
    // Auto-connect WebRTC on mount
    if (connectionMode === 'webrtc') {
      initializeWebRTC();
    }

    return () => {
      if (sipClientRef.current) {
        sipClientRef.current.unregister();
      }
      if (webrtcClientRef.current) {
        webrtcClientRef.current = null;
      }
      if (callIntervalRef.current) {
        clearInterval(callIntervalRef.current);
      }
    };
  }, []);

  const handleCallEnd = () => {
    if (callIntervalRef.current) {
      clearInterval(callIntervalRef.current);
    }

    if (callStartTime) {
      const duration = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
      createCallActivity({
        phone_number: currentLead?.phone || dialedNumber,
        duration_seconds: duration,
        status: 'completed',
        notes: ''
      } as any);
    }

    setCallStatus('idle');
    setCallDuration(0);
    setCallStartTime(null);
    setCurrentCallId(null);
  };

  const handleCall = async (phoneNumber?: string) => {
    try {
      const numberToCall = phoneNumber || currentLead?.phone || dialedNumber;
      
      if (connectionMode === 'webrtc') {
        // Use WebRTC client
        if (!webrtcClientRef.current || !isWebRTCReady) {
          toast.error("WebRTC not ready. Please wait or reconnect.");
          return;
        }

        console.log('[WebRTC] Calling:', numberToCall);
        webrtcClientRef.current.call(numberToCall);
        setCallStatus('ringing');
        setDialedNumber("");
        return;
      }

      // SIP fallback (existing code)
      if (!numberToCall) {
        toast.error('No phone number to call');
        return;
      }
      
      setCallStatus("ringing");
      toast.loading('Connecting to call server...');
      
      // Initialize SIP client if not already done
      if (!sipClientRef.current) {
        const initialized = await initializeSipClient();
        if (!initialized) {
          setCallStatus("idle");
          return;
        }
      }

      toast.dismiss();
      toast.loading('Calling customer...');
      
      // Close dial pad if open
      setShowDialPad(false);
      
      // Make SIP call
      await sipClientRef.current!.makeCall(
        numberToCall,
        (state) => {
          console.log('Call state changed:', state);
          
          if (state === SessionState.Establishing) {
            toast.dismiss();
            toast.loading('Ringing...');
          } else if (state === SessionState.Established) {
            toast.dismiss();
            toast.success('Call connected - You can now speak');
            setCallStatus("connected");
            setCallStartTime(new Date());
            setIsRecording(true);
            
            // Start call timer
            const timer = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 1000);
            callIntervalRef.current = timer;
          } else if (state === SessionState.Terminated) {
            handleHangup();
          }
        }
      );

    } catch (error) {
      console.error('Error starting call:', error);
      toast.dismiss();
      toast.error(error instanceof Error ? error.message : 'Failed to start call');
      setCallStatus("idle");
    }
  };

  const initializeSipClient = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-sip-credentials');
      
      if (error) throw error;
      
      if (!data?.username || !data?.password) {
        throw new Error('SIP credentials not available');
      }

      sipClientRef.current = new SipClient();
      await sipClientRef.current.initialize(data.username, data.password);
      
      toast.success('Connected to call server');
      return true;
    } catch (error) {
      console.error('Error initializing SIP client:', error);
      toast.error('Failed to connect to call server');
      return false;
    }
  };

  const handleHangup = () => {
    if (connectionMode === 'webrtc' && webrtcClientRef.current) {
      webrtcClientRef.current.hangup();
    } else if (sipClientRef.current) {
      sipClientRef.current.hangup();
    }
    handleCallEnd();
  };

  const handleHold = () => {
    if (connectionMode === 'webrtc' && webrtcClientRef.current) {
      if (callStatus === 'hold') {
        webrtcClientRef.current.unhold();
        setCallStatus('connected');
      } else {
        webrtcClientRef.current.hold();
        setCallStatus('hold');
      }
    } else {
      setCallStatus(callStatus === 'hold' ? 'connected' : 'hold');
    }
  };

  const toggleMute = () => {
    if (connectionMode === 'webrtc' && webrtcClientRef.current) {
      if (isMuted) {
        webrtcClientRef.current.unmute();
      } else {
        webrtcClientRef.current.mute();
      }
      setIsMuted(!isMuted);
      toast.info(isMuted ? 'Microphone unmuted' : 'Microphone muted');
    } else {
      setIsMuted(!isMuted);
      toast.info(isMuted ? 'Microphone unmuted' : 'Microphone muted');
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case "ringing": return "call-ringing";
      case "connected": return "call-active";
      case "hold": return "call-hold";
      default: return "";
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case "ringing": return "Ringing...";
      case "connected": return "Connected";
      case "hold": return "On Hold";
      default: return "Ready to Call";
    }
  };

  const handleDialPadClick = (digit: string) => {
    setDialedNumber(prev => prev + digit);
  };

  const handleDialPadDelete = () => {
    setDialedNumber(prev => prev.slice(0, -1));
  };

  const handleDialPadCall = () => {
    if (dialedNumber) {
      handleCall(dialedNumber);
      setDialedNumber("");
    }
  };

  const handleTestApiCall = async () => {
    try {
      const testNumber = dialedNumber || currentLead?.phone || '+256702282029';
      
      toast.loading('Testing direct API call to Africa\'s Talking...');
      
      const { data, error } = await supabase.functions.invoke('test-voice-call', {
        body: { phoneNumber: testNumber }
      });
      
      toast.dismiss();
      
      if (error) {
        console.error('API test error:', error);
        toast.error(`API Error: ${error.message}`);
        return;
      }
      
      if (data.error) {
        console.error('Call failed:', data);
        toast.error(`Call failed: ${data.error}`);
        toast.info('Check edge function logs for details');
      } else {
        console.log('Call response:', data);
        toast.success('API call successful!');
      }
    } catch (error) {
      console.error('Error testing API call:', error);
      toast.dismiss();
      toast.error('Failed to test API call');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Softphone
            <Badge variant={isWebRTCReady ? "default" : "secondary"} className="text-xs">
              {isWebRTCReady ? "WebRTC Ready" : "Connecting..."}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isWebRTCReady) {
                disconnectWebRTC();
              } else {
                initializeWebRTC();
              }
            }}
            className="h-8 w-8 p-0"
          >
            <Plug className={`h-4 w-4 ${isWebRTCReady ? 'text-success' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Lead Info */}
        {currentLead && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="font-medium">{currentLead.name}</div>
            <div className="text-muted-foreground">{currentLead.phone}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Campaign: {currentLead.campaign}
            </div>
          </div>
        )}

        {/* Call Timer */}
        {callStatus !== "idle" && (
          <div className="flex items-center justify-center gap-2 text-lg font-mono">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(callDuration)}</span>
            {isRecording && (
              <div className="flex items-center gap-1 text-destructive">
                <div className="h-2 w-2 bg-destructive rounded-full animate-pulse" />
                <span className="text-xs">REC</span>
              </div>
            )}
          </div>
        )}

        {/* Call Controls */}
        <div className="flex items-center justify-center gap-2">
          {callStatus === "idle" ? (
            <>
              <Button 
                onClick={() => handleCall()}
                className="h-12 w-12 rounded-full bg-success hover:bg-success/90"
                disabled={!currentLead || !isWebRTCReady}
              >
                <Phone className="h-5 w-5" />
              </Button>
              
              <Dialog open={showDialPad} onOpenChange={setShowDialPad}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline"
                    className="h-12 w-12 rounded-full"
                  >
                    <Grid3x3 className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Dial Pad</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Number Display */}
                    <div className="relative">
                      <Input 
                        value={dialedNumber}
                        onChange={(e) => setDialedNumber(e.target.value)}
                        placeholder="Enter phone number"
                        className="text-center text-xl font-mono h-12"
                      />
                      {dialedNumber && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                          onClick={handleDialPadDelete}
                        >
                          <Delete className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Dial Pad Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                        <Button
                          key={digit}
                          variant="outline"
                          className="h-14 text-2xl"
                          onClick={() => handleDialPadClick(digit)}
                        >
                          {digit}
                        </Button>
                      ))}
                    </div>
                    
                    {/* Call Button */}
                    <Button
                      onClick={handleDialPadCall}
                      disabled={!dialedNumber || !isWebRTCReady}
                      className="w-full h-12 bg-success hover:bg-success/90"
                    >
                      <Phone className="h-5 w-5 mr-2" />
                      Call
                    </Button>
                    
                    {/* Test API Call Button */}
                    <Button
                      onClick={handleTestApiCall}
                      variant="outline"
                      className="w-full h-12"
                    >
                      <TestTube className="h-5 w-5 mr-2" />
                      Test Direct API Call
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleMute}
                className={isMuted ? "bg-destructive text-destructive-foreground" : ""}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleHold}
                className={callStatus === "hold" ? "bg-warning text-warning-foreground" : ""}
              >
                {callStatus === "hold" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>

              <Button
                onClick={handleHangup}
                className="h-12 w-12 rounded-full bg-destructive hover:bg-destructive/90"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleRecording}
                className={isRecording ? "bg-destructive text-destructive-foreground" : ""}
              >
                <div className="h-2 w-2 bg-current rounded-full" />
              </Button>
            </>
          )}
        </div>

        {/* Quick Actions - Only show when call is connected */}
        {callStatus === "connected" && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                Transfer
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                Conference
              </Button>
            </div>
          </div>
        )}

        {/* Compliance Note */}
        <div className="text-xs text-muted-foreground text-center">
          All calls are recorded for quality assurance
        </div>
      </CardContent>
    </Card>
  );
}
