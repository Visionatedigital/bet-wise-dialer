import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock, Pause, Play, Grid3x3, Delete, TestTube, Plug, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCallMetrics } from "@/hooks/useCallMetrics";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SipClient } from "@/utils/SipClient";
import { SessionState } from "sip.js";
import { maskPhone } from "@/lib/formatters";
import { PostCallNotesDialog } from "./PostCallNotesDialog";
import { parseCallbackIntent } from "@/utils/parseCallbackIntent";

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
  onNextLead?: () => void;
  onPreviousLead?: () => void;
  hasNextLead?: boolean;
  hasPreviousLead?: boolean;
  currentLeadPosition?: number;
  totalLeads?: number;
}

export function Softphone({ 
  currentLead, 
  onNextLead, 
  onPreviousLead, 
  hasNextLead = false,
  hasPreviousLead = false,
  currentLeadPosition = 1,
  totalLeads = 0
}: SoftphoneProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [dialedNumber, setDialedNumber] = useState("");
  const [showDialPad, setShowDialPad] = useState(false);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('sip');
  const [isWebRTCReady, setIsWebRTCReady] = useState(false);
  const [webrtcToken, setWebrtcToken] = useState<string | null>(null);
  const [showPostCallNotes, setShowPostCallNotes] = useState(false);
  const [pendingCallData, setPendingCallData] = useState<{
    phoneNumber: string;
    duration: number;
    leadName: string;
    campaign: string;
  } | null>(null);
  
  const { createCallActivity, updateCallActivity } = useCallMetrics();
  const { user } = useAuth();
  const sipClientRef = useRef<SipClient | null>(null);
  const webrtcClientRef = useRef<any>(null);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize WebRTC client
  const initializeWebRTC = async () => {
    try {
      console.log('========================================');
      console.log('[WebRTC-INIT] 🚀 Starting WebRTC initialization');
      toast.info("Connecting to WebRTC...");
      
      // First, check if we have a valid token in the database
      console.log('[WebRTC-INIT] 📂 Checking for existing token in database...');
      const { data: existingTokenData, error: tokenError } = await supabase
        .from('webrtc_tokens')
        .select('*')
        .single();
      
      let tokenData;
      
      if (!tokenError && existingTokenData && new Date(existingTokenData.expires_at) > new Date()) {
        // Use existing valid token
        console.log('[WebRTC-INIT] ✅ Found valid token in database');
        console.log('[WebRTC-INIT] Token expires at:', existingTokenData.expires_at);
        tokenData = {
          token: existingTokenData.token,
          clientName: existingTokenData.client_name,
          lifeTimeSec: Math.floor((new Date(existingTokenData.expires_at).getTime() - Date.now()) / 1000)
        };
      } else {
        // Fetch new token
        console.log('[WebRTC-INIT] 📡 Fetching new token from Supabase...');
        const { data, error } = await supabase.functions.invoke('get-webrtc-token');
        
        if (error) {
          console.error('[WebRTC-INIT] ❌ Token request failed:', error);
          throw error;
        }
        
        if (!data.token) {
          console.error('[WebRTC-INIT] ❌ No token in response:', data);
          throw new Error('No token received');
        }

        console.log('[WebRTC-INIT] ✅ New token received successfully');
        tokenData = data;
        
        // Store token in database
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        const { error: storeError } = await supabase
          .from('webrtc_tokens')
          .upsert({
            user_id: user?.id,
            token: tokenData.token,
            client_name: tokenData.clientName,
            expires_at: expiresAt.toISOString()
          });
        
        if (storeError) {
          console.error('[WebRTC-INIT] ⚠️ Failed to store token:', storeError);
        } else {
          console.log('[WebRTC-INIT] ✅ Token stored in database');
        }
      }

      console.log('[WebRTC-INIT] Client name:', tokenData.clientName);
      console.log('[WebRTC-INIT] Token (first 30 chars):', tokenData.token?.substring(0, 30) + '...');
      console.log('[WebRTC-INIT] Token lifetime:', tokenData.lifeTimeSec, 'seconds');
      setWebrtcToken(tokenData.token);

      // Initialize Africastalking client
      console.log('[WebRTC-INIT] 🔍 Looking for Africastalking SDK...');
      const AT = (window as any).Africastalking;
      if (typeof AT === 'undefined') {
        console.error('[WebRTC-INIT] ❌ Africastalking SDK not found on window object');
        console.log('[WebRTC-INIT] Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('afric')));
        throw new Error('Africastalking SDK not loaded');
      }
      console.log('[WebRTC-INIT] ✅ SDK found:', typeof AT);

      console.log('[WebRTC-INIT] 🔧 Creating client instance...');
      const client = new AT.Client(tokenData.token);
      webrtcClientRef.current = client;
      console.log('[WebRTC-INIT] ✅ Client instance created');
      console.log('[WebRTC-INIT] Client object:', client);

      // Set up event listeners
      console.log('[WebRTC-INIT] 📝 Registering event listeners...');
      
      client.on('ready', () => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] 🟢 READY - Client is ready to make calls');
        console.log('[WebRTC-EVENT] Timestamp:', new Date().toISOString());
        console.log('========================================');
        setIsWebRTCReady(true);
        toast.success("WebRTC connected!");
      });

      client.on('notready', () => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] 🔴 NOT READY');
        console.log('========================================');
        setIsWebRTCReady(false);
        toast.error("WebRTC not ready");
      });

      client.on('calling', (callInfo: any) => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] 📞 CALLING');
        console.log('[WebRTC-EVENT] Call info:', callInfo);
        console.log('[WebRTC-EVENT] Info keys:', Object.keys(callInfo || {}));
        console.log('========================================');
        setCallStatus('ringing');
        toast.info('Dialing...');
      });

      client.on('incomingcall', (params: any) => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] 📲 INCOMING CALL');
        console.log('[WebRTC-EVENT] From:', params);
        console.log('========================================');
        toast.info(`Incoming call from ${params.from}`);
        setCallStatus('ringing');
      });

      client.on('callaccepted', (acceptInfo: any) => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] ✅ CALL ACCEPTED');
        console.log('[WebRTC-EVENT] Accept info:', acceptInfo);
        console.log('========================================');
        setCallStatus('connected');
        setCallStartTime(new Date());
        toast.success('Call connected!');
        
        // Start call timer
        const timer = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        callIntervalRef.current = timer;
      });

      client.on('hangup', (hangupCause: any) => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] 📴 CALL ENDED');
        console.log('[WebRTC-EVENT] Cause object:', hangupCause);
        console.log('[WebRTC-EVENT] Code:', hangupCause?.code);
        console.log('[WebRTC-EVENT] Reason:', hangupCause?.reason);
        console.log('========================================');
        toast.info('Call ended');
        handleCallEnd();
      });

      client.on('offline', () => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] ⏸️ OFFLINE - Token expired');
        console.log('========================================');
        setIsWebRTCReady(false);
        toast.warning("Session expired");
      });

      client.on('closed', () => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] 🔌 CONNECTION CLOSED');
        console.log('========================================');
        setIsWebRTCReady(false);
        toast.error("Connection lost");
      });

      client.on('error', (error: any) => {
        console.log('========================================');
        console.error('[WebRTC-EVENT] ❌❌❌ ERROR ❌❌❌');
        console.error('[WebRTC-EVENT] Error object:', error);
        console.error('[WebRTC-EVENT] Error message:', error?.message);
        console.error('[WebRTC-EVENT] Error code:', error?.code);
        console.log('========================================');
        toast.error(`Call error: ${error.message || 'Unknown error'}`);
      });

      console.log('[WebRTC-INIT] ✅ All event listeners registered');
      console.log('[WebRTC-INIT] Waiting for "ready" event...');
      console.log('========================================');

    } catch (error) {
      console.log('========================================');
      console.error('[WebRTC-INIT] ❌❌❌ INITIALIZATION FAILED ❌❌❌');
      console.error('[WebRTC-INIT] Error:', error);
      console.error('[WebRTC-INIT] Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.log('========================================');
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
    // Cleanup on unmount
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

function normalizePhoneNumber(input: string) {
  const trimmed = (input || '').trim();
  if (!trimmed) return trimmed;
  const clean = trimmed.replace(/[^0-9+]/g, '');
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('00')) return '+' + clean.slice(2);
  return '+' + clean;
}

const handleCallEnd = () => {
    if (callIntervalRef.current) {
      clearInterval(callIntervalRef.current);
    }

    // Always show post-call notes dialog after any call attempt
    // Calculate duration if call was connected, otherwise use 0
    const duration = callStartTime 
      ? Math.floor((Date.now() - callStartTime.getTime()) / 1000)
      : 0;
    
    // Store call data for any call attempt (ringing, connected, or failed)
    setPendingCallData({
      phoneNumber: currentLead?.phone || dialedNumber,
      duration: duration,
      leadName: currentLead?.name || 'Unknown',
      campaign: currentLead?.campaign || 'No Campaign'
    });
    setShowPostCallNotes(true);

    setCallStatus('idle');
    setCallDuration(0);
    setCallStartTime(null);
    setCurrentCallId(null);
  };

  const handleSaveCallNotes = async (notes: string) => {
    if (!pendingCallData) return;

    try {
      // Get campaign_id if available
      let campaignId = null;
      if (pendingCallData.campaign !== 'No Campaign') {
        const { data: campaignData } = await supabase
          .from('campaigns')
          .select('id')
          .eq('name', pendingCallData.campaign)
          .single();
        
        if (campaignData) {
          campaignId = campaignData.id;
        }
      }

      // Get lead_id from phone number
      let leadId = null;
      const { data: leadData } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', pendingCallData.phoneNumber)
        .single();
      
      if (leadData) {
        leadId = leadData.id;
      }

      // Determine call status based on duration
      // If duration is 0, call wasn't answered (failed/no answer)
      const callStatus = pendingCallData.duration > 0 ? 'completed' : 'failed';

      // Save call activity with notes
      const callActivityData = await createCallActivity({
        phone_number: pendingCallData.phoneNumber,
        lead_name: pendingCallData.leadName,
        duration_seconds: pendingCallData.duration,
        status: callStatus,
        notes: notes,
        campaign_id: campaignId,
        call_type: 'outbound'
      } as any);

      // Parse notes for callback intent
      const callbackIntent = parseCallbackIntent(notes);
      
      if (callbackIntent.shouldCreateCallback && user && leadId) {
        // Automatically create callback
        await supabase.from('callbacks').insert([{
          lead_id: leadId,
          user_id: user.id,
          call_activity_id: callActivityData?.id || null,
          scheduled_for: callbackIntent.callbackDate!.toISOString(),
          priority: callbackIntent.priority,
          status: 'pending',
          notes: notes,
          lead_name: pendingCallData.leadName,
          phone_number: pendingCallData.phoneNumber
        }]);

        toast.success("Call notes saved and callback scheduled", {
          description: `Callback set for ${callbackIntent.callbackDate!.toLocaleDateString()}`
        });
      } else {
        toast.success("Call notes saved successfully");
      }

      setShowPostCallNotes(false);
      setPendingCallData(null);
    } catch (error) {
      console.error('Error saving call notes:', error);
      toast.error("Failed to save call notes");
    }
  };

  const handleCall = async (phoneNumber?: string) => {
    try {
      const numberToCall = phoneNumber || currentLead?.phone || dialedNumber;
      
      if (connectionMode === 'webrtc') {
        // Use WebRTC client
        console.log('========================================');
        console.log('[WebRTC-CALL] 📞 INITIATING CALL');
        console.log('[WebRTC-CALL] Raw input number:', numberToCall);
        
        if (!webrtcClientRef.current || !isWebRTCReady) {
          console.error('[WebRTC-CALL] ❌ Client not ready');
          console.log('[WebRTC-CALL] Has client:', !!webrtcClientRef.current);
          console.log('[WebRTC-CALL] Is ready:', isWebRTCReady);
          console.log('========================================');
          toast.error("WebRTC not ready. Please wait or reconnect.");
          return;
        }

        const normalizedNumber = normalizePhoneNumber(numberToCall);
        console.log('[WebRTC-CALL] Normalized number:', normalizedNumber);
        console.log('[WebRTC-CALL] Client ready:', isWebRTCReady);
        console.log('[WebRTC-CALL] Token:', webrtcToken);
        console.log('[WebRTC-CALL] Client object type:', typeof webrtcClientRef.current);
        console.log('[WebRTC-CALL] Client methods:', Object.keys(webrtcClientRef.current || {}));

        // Close dial pad if open
        setShowDialPad(false);
        
        try {
          console.log('[WebRTC-CALL] 🔄 Calling client.call() with:', normalizedNumber);
          console.log('[WebRTC-CALL] Call parameters:', {
            phoneNumber: normalizedNumber,
            timestamp: new Date().toISOString()
          });
          
          const callResult = webrtcClientRef.current.call(normalizedNumber);
          
          console.log('[WebRTC-CALL] ✅ Call method returned');
          console.log('[WebRTC-CALL] Result:', callResult);
          console.log('[WebRTC-CALL] Result type:', typeof callResult);
          if (callResult) {
            console.log('[WebRTC-CALL] Result keys:', Object.keys(callResult));
          }
          console.log('========================================');
          
          setCallStatus('ringing');
          setDialedNumber("");
        } catch (error) {
          console.error('========================================');
          console.error('[WebRTC-CALL] ❌❌❌ CALL FAILED ❌❌❌');
          console.error('[WebRTC-CALL] Error:', error);
          console.error('[WebRTC-CALL] Error message:', error instanceof Error ? error.message : 'Unknown');
          console.error('[WebRTC-CALL] Error stack:', error instanceof Error ? error.stack : 'No stack');
          console.error('========================================');
          toast.error('Failed to initiate call');
          setCallStatus('idle');
        }
        return;
      }

      // SIP path
      if (!numberToCall) {
        toast.error('No phone number to call');
        return;
      }
      
      setCallStatus("ringing");
      
      // Initialize SIP client if not already done
      if (!sipClientRef.current) {
        toast.loading('Connecting to call server...');
        const initialized = await initializeSipClient();
        if (!initialized) {
          setCallStatus("idle");
          toast.dismiss();
          return;
        }
        toast.dismiss();
      }

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
        webrtcClientRef.current.unmuteAudio();
      } else {
        webrtcClientRef.current.muteAudio();
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
    setDialedNumber(prev => {
      // Auto-add "+" if empty and digit is clicked
      if (!prev && digit !== '+') {
        return '+' + digit;
      }
      return prev + digit;
    });
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
              {isWebRTCReady ? "Ready" : "Connecting..."}
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
        {/* Current Lead Info with Navigation */}
        {currentLead && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={onPreviousLead}
                disabled={!hasPreviousLead}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-xs text-muted-foreground">
                Lead {currentLeadPosition} of {totalLeads}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={onNextLead}
                disabled={!hasNextLead}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="font-medium">{currentLead.name}</div>
              <div className="text-muted-foreground">{maskPhone(currentLead.phone)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Campaign: {currentLead.campaign}
              </div>
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

      {/* Post-Call Notes Dialog */}
      {pendingCallData && (
        <PostCallNotesDialog
          open={showPostCallNotes}
          onSave={handleSaveCallNotes}
          leadName={pendingCallData.leadName}
          phoneNumber={pendingCallData.phoneNumber}
          campaign={pendingCallData.campaign}
          callDuration={pendingCallData.duration}
        />
      )}
    </Card>
  );
}
