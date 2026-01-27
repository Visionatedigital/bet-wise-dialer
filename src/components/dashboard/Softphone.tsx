import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, Clock, Pause, Play, Grid3x3, Delete, TestTube, RefreshCw, ChevronLeft, ChevronRight, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCallMetrics } from "@/hooks/useCallMetrics";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { maskPhone } from "@/lib/formatters";
import { AfterCallSummary, AfterCallSummaryData } from "./AfterCallSummary";
import { parseCallbackIntent } from "@/utils/parseCallbackIntent";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { SipClient } from "@/utils/SipClient";
import { SessionState } from "sip.js";
import { ActiveCallOverlay } from "./ActiveCallOverlay";
import { cn } from "@/lib/utils";

// @ts-ignore - AfricasTalking WebRTC SDK
declare const Africastalking: any;

type CallStatus = "idle" | "ringing" | "connected" | "hold" | "muted";
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type ConnectionMode = 'sip' | 'webrtc';

interface SoftphoneProps {
  currentLead?: {
    id: string; // Added id to prop
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
  // Optional hooks so the parent dashboard can react to call lifecycle (e.g. start/stop AI, update UI)
  onCallStart?: () => void;
  onCallEnd?: () => void;
}

export function Softphone({
  currentLead,
  onNextLead,
  onPreviousLead,
  hasNextLead = false,
  hasPreviousLead = false,
  currentLeadPosition = 1,
  totalLeads = 0,
  onCallStart,
  onCallEnd,
}: SoftphoneProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [dialedNumber, setDialedNumber] = useState("");
  const [showDialPad, setShowDialPad] = useState(false);
  // Detect if running in Tauri (desktop) - use SIP, otherwise use WebRTC (browser)
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(isTauri ? 'sip' : 'webrtc');
  const [isWebRTCReady, setIsWebRTCReady] = useState(false);
  const [webrtcToken, setWebrtcToken] = useState<string | null>(null);
  const [sipConnectionStatus, setSipConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [showPostCallNotes, setShowPostCallNotes] = useState(false);
  const [pendingCallData, setPendingCallData] = useState<{
    phoneNumber: string;
    duration: number;
    leadName: string;
    campaign: string;
    callId?: string; // Added callId to pending data
    leadId?: string; // Added leadId to pending data
  } | null>(null);

  const { createCallActivity, updateCallActivity } = useCallMetrics();
  const { user } = useAuth();
  const {
    setCallId: setContextCallId,
    setIsCallActive: setContextIsCallActive,
    callId: contextCallId,
    activeLead: contextActiveLead,
    autoDialTrigger,
    registerControls,
    setConnectionQuality: setContextConnectionQuality,
    showSoftphone
  } = useSoftphone();

  // Effective lead is either the prop (if passed) or the context active lead
  const effectiveLead = currentLead || contextActiveLead ? {
    id: currentLead?.id || contextActiveLead?.id, // Capture ID from either source
    name: currentLead?.name || contextActiveLead?.name || "Unknown",
    phone: currentLead?.phone || contextActiveLead?.phone || "",
    campaign: currentLead?.campaign || contextActiveLead?.campaign || "Direct Dial"
  } : undefined;

  const sipClientRef = useRef<SipClient | null>(null);
  const webrtcClientRef = useRef<any>(null);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sipStatusRef = useRef<ConnectionStatus>('disconnected');
  const sipRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qualityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dial when trigger increments
  useEffect(() => {
    // Only auto-dial if we have a phone number and we're not already in a call
    if (autoDialTrigger > 0 && effectiveLead?.phone && callStatus === 'idle') {
      console.log("[Softphone] Auto-dial trigger received:", autoDialTrigger);
      handleCall(effectiveLead.phone);
    }
  }, [autoDialTrigger]);

  // Auto-fill dialed number when effective lead changes
  useEffect(() => {
    if (effectiveLead?.phone) {
      setDialedNumber(effectiveLead.phone);
    }
  }, [effectiveLead?.phone]);

  // Sync internal call state with context
  useEffect(() => {
    if (callStatus === 'connected') {
      setContextIsCallActive(true);
    } else {
      setContextIsCallActive(false);
    }
  }, [callStatus, setContextIsCallActive]);

  // Keep ref in sync with state for background retry logic
  useEffect(() => {
    sipStatusRef.current = sipConnectionStatus;
  }, [sipConnectionStatus]);

  // Helper to create call activity on connect
  const createActivityOnConnect = async (number: string) => {
    try {
      const { data, error } = await supabase
        .from('call_activities')
        .insert({
          user_id: user?.id,
          lead_name: effectiveLead?.name || "Unknown",
          phone_number: number,
          campaign_id: effectiveLead?.campaign ? undefined : undefined, // Placeholder logic, ideally lookup ID
          status: 'connected',
          start_time: new Date().toISOString(),
          call_type: 'outbound'
        } as any)
        .select()
        .single();

      if (data) {
        const activity = data as any;
        setCurrentCallId(activity.id);
        setContextCallId(activity.id);
        return activity.id;
      }
    } catch (err) {
      console.error("Failed to create call activity on connect:", err);
    }
    return null;
  };

  // Initialize WebRTC client
  const initializeWebRTC = async () => {
    try {
      console.log('========================================');
      console.log('[WebRTC-INIT] ???? Starting WebRTC initialization');
      toast.info("Connecting to WebRTC...");

      // First, check if we have a valid token in the database
      console.log('[WebRTC-INIT] ???? Checking for existing token in database...');
      const { data: existingTokenData, error: tokenError } = await supabase
        .from('webrtc_tokens')
        .select('*')
        .single();

      let tokenData;

      if (!tokenError && existingTokenData && new Date((existingTokenData as any).expires_at) > new Date()) {
        // Use existing valid token
        const token = existingTokenData as any;
        console.log('[WebRTC-INIT] ??? Found valid token in database');
        console.log('[WebRTC-INIT] Token expires at:', token.expires_at);
        tokenData = {
          token: token.token,
          clientName: token.client_name,
          lifeTimeSec: Math.floor((new Date(token.expires_at).getTime() - Date.now()) / 1000)
        };
      } else {
        // Fetch new token
        console.log('[WebRTC-INIT] ???? Fetching new token from Supabase...');
        const { data, error } = await supabase.functions.invoke('get-webrtc-token');

        if (error) {
          console.error('[WebRTC-INIT] ??? Token request failed:', error);
          throw error;
        }

        if (!data.token) {
          console.error('[WebRTC-INIT] ??? No token in response:', data);
          throw new Error('No token received');
        }

        console.log('[WebRTC-INIT] ??? New token received successfully');
        tokenData = data;

        // Store token in database
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        const { error: storeError } = await supabase
          .from('webrtc_tokens')
          .upsert(
            {
              user_id: user?.id,
              token: tokenData.token,
              client_name: tokenData.clientName,
              expires_at: expiresAt.toISOString()
            } as any,
            {
              onConflict: 'user_id', // use unique user_id key for upsert
            }
          );

        if (storeError && storeError.code !== '23505') {
          // 23505 = unique violation; safe to ignore here because upsert semantics still hold
          console.error('[WebRTC-INIT] ?????? Failed to store token:', storeError);
        } else if (!storeError) {
          console.log('[WebRTC-INIT] ??? Token stored in database');
        }
      }

      console.log('[WebRTC-INIT] Client name:', tokenData.clientName);
      console.log('[WebRTC-INIT] Token (first 30 chars):', tokenData.token?.substring(0, 30) + '...');
      console.log('[WebRTC-INIT] Token lifetime:', tokenData.lifeTimeSec, 'seconds');
      setWebrtcToken(tokenData.token);

      // Initialize Africastalking client
      console.log('[WebRTC-INIT] ???? Looking for Africastalking SDK...');
      const AT = (window as any).Africastalking;
      if (typeof AT === 'undefined') {
        console.error('[WebRTC-INIT] ??? Africastalking SDK not found on window object');
        console.log('[WebRTC-INIT] Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('afric')));
        throw new Error('Africastalking SDK not loaded');
      }
      console.log('[WebRTC-INIT] ??? SDK found:', typeof AT);

      console.log('[WebRTC-INIT] ???? Creating client instance...');
      const client = new AT.Client(tokenData.token);
      // Simulate jitter/quality for UI
      if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current);
      qualityIntervalRef.current = setInterval(() => {
        const qualities: ('good' | 'fair' | 'poor')[] = ['good', 'good', 'good', 'fair', 'good'];
        const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
        setContextConnectionQuality(randomQuality);
      }, 3000);

      webrtcClientRef.current = client;
      console.log('[WebRTC-INIT] ??? Client instance created');
      console.log('[WebRTC-INIT] Client object:', client);

      // Set up event listeners
      console.log('[WebRTC-INIT] ???? Registering event listeners...');

      client.on('ready', () => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] ???? READY - Client is ready to make calls');
        console.log('[WebRTC-EVENT] Timestamp:', new Date().toISOString());
        console.log('========================================');
        setIsWebRTCReady(true);
        // Explicit "popup" notification for user
        toast.success("System Ready: Dialer Connected", {
          description: "WebRTC Phone Link Established",
          duration: 5000,
        });
      });

      client.on('notready', () => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] ???? NOT READY');
        console.log('========================================');
        setIsWebRTCReady(false);
        toast.error("WebRTC not ready");
      });

      client.on('calling', (callInfo: any) => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] ???? CALLING');
        console.log('[WebRTC-EVENT] Call info:', callInfo);
        console.log('[WebRTC-EVENT] Info keys:', Object.keys(callInfo || {}));
        console.log('========================================');
        setCallStatus('ringing');
        toast.info('Dialing...');
      });

      client.on('incomingcall', (params: any) => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] ???? INCOMING CALL');
        console.log('[WebRTC-EVENT] From:', params);
        console.log('========================================');
        toast.info(`Incoming call from ${params.from}`);
        setCallStatus('ringing');
      });

      client.on('callaccepted', (acceptInfo: any) => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] ??? CALL ACCEPTED');
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
        console.log('[WebRTC-EVENT] ???? CALL ENDED');
        console.log('[WebRTC-EVENT] Cause object:', hangupCause);
        console.log('[WebRTC-EVENT] Code:', hangupCause?.code);
        console.log('[WebRTC-EVENT] Reason:', hangupCause?.reason);
        console.log('========================================');
        toast.info('Call ended');
        handleCallEnd();
      });

      client.on('offline', () => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] ?????? OFFLINE - Token expired');
        console.log('========================================');
        setIsWebRTCReady(false);
        toast.warning("Session expired");
      });

      client.on('closed', () => {
        console.log('========================================');
        console.log('[WebRTC-EVENT] ???? CONNECTION CLOSED');
        console.log('========================================');
        setIsWebRTCReady(false);
        toast.error("Connection lost");
      });

      client.on('error', (error: any) => {
        console.log('========================================');
        console.error('[WebRTC-EVENT] ????????? ERROR ?????????');
        console.error('[WebRTC-EVENT] Error object:', error);
        console.error('[WebRTC-EVENT] Error message:', error?.message);
        console.error('[WebRTC-EVENT] Error code:', error?.code);
        console.log('========================================');
        toast.error(`Call error: ${error.message || 'Unknown error'}`);
      });

      console.log('[WebRTC-INIT] ??? All event listeners registered');
      console.log('[WebRTC-INIT] Waiting for "ready" event...');
      console.log('========================================');

    } catch (error) {
      console.log('========================================');
      console.error('[WebRTC-INIT] ????????? INITIALIZATION FAILED ?????????');
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
    // Auto-initialize based on environment
    // In Tauri (desktop): Use SIP WebSocket (works better in desktop environment)
    // In browser: Use WebRTC SDK (SIP WebSocket not supported by Africa's Talking in browsers)
    console.log('[Softphone] Environment detection:', {
      isTauri,
      hasTauriWindow: typeof window !== 'undefined' && '__TAURI__' in window,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      hasUser: !!user
    });

    if (!user) {
      console.log('[Softphone] No user logged in, skipping initialization');
      return;
    }

    if (isTauri) {
      console.log('[Softphone] ??? Running in Tauri desktop - using SIP mode');
      setSipConnectionStatus('connecting');
      // Pre-initialize SIP client in Tauri for better UX
      initializeSipClient()
        .then(() => {
          console.log('[Softphone] ??? SIP client initialized successfully');
          setSipConnectionStatus('connected');
          // Explicit "popup" notification for user
          toast.success("Dialer System Ready", {
            description: "SIP Phone Connected & Active",
            duration: 5000,
          });
        })
        .catch(err => {
          console.error('[Softphone] ??? SIP pre-initialization failed, will retry on first call:', err);
          setSipConnectionStatus('error');
          toast.error('SIP connection failed. Will retry on first call.');
        });
    } else {
      console.log('[Softphone] ??? Running in browser - initializing WebRTC');
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
      if (sipRetryTimeoutRef.current) {
        clearTimeout(sipRetryTimeoutRef.current);
        sipRetryTimeoutRef.current = null;
      }
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current);
        qualityIntervalRef.current = null;
      }
    };
  }, [isTauri, user]);

  // Background auto-retry loop for SIP connectivity in Tauri
  useEffect(() => {
    if (!isTauri) return;

    // If we're already connected or in the process of connecting, do nothing
    if (sipConnectionStatus === 'connected' || sipConnectionStatus === 'connecting') {
      return;
    }

    // Schedule a retry only if one isn't already scheduled
    if (!sipRetryTimeoutRef.current) {
      const delayMs = 5000; // 5 seconds between attempts
      console.log('[Softphone] ???? Scheduling SIP auto-retry in', delayMs, 'ms. Current status:', sipConnectionStatus);
      sipRetryTimeoutRef.current = setTimeout(async () => {
        sipRetryTimeoutRef.current = null;
        // Double-check status before retrying
        if (sipStatusRef.current === 'connected' || sipStatusRef.current === 'connecting') {
          console.log('[Softphone] ???? Auto-retry skipped, SIP already connected/connecting');
          return;
        }

        try {
          console.log('[Softphone] ???? Auto-retrying SIP initialization...');
          setSipConnectionStatus('connecting');
          const ok = await initializeSipClient();
          if (!ok) {
            console.warn('[Softphone] ?????? SIP auto-retry did not connect');
            setSipConnectionStatus('error');
          } else {
            console.log('[Softphone] ??? SIP auto-retry connected successfully');
          }
        } catch (err) {
          console.error('[Softphone] ??? SIP auto-retry failed:', err);
          setSipConnectionStatus('error');
        }
      }, delayMs);
    }

    // Cleanup: clear any pending timer when dependencies change/unmount
    return () => {
      if (sipRetryTimeoutRef.current) {
        clearTimeout(sipRetryTimeoutRef.current);
        sipRetryTimeoutRef.current = null;
      }
    };
  }, [isTauri, sipConnectionStatus, initializeSipClient]);

  function normalizePhoneNumber(input: string) {
    const trimmed = (input || '').trim();
    if (!trimmed) return trimmed;
    const clean = trimmed.replace(/[^0-9+]/g, '');
    if (clean.startsWith('+')) return clean;
    if (clean.startsWith('00')) return '+' + clean.slice(2);
    return '+' + clean;
  }
  const activeCallNumberRef = useRef<string>("");
  const activeCallLeadIdRef = useRef<string | undefined>(undefined);

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
      phoneNumber: activeCallNumberRef.current || effectiveLead?.phone || dialedNumber, // Use persisted active number first
      duration: duration,
      leadName: effectiveLead?.name || 'Unknown',
      campaign: effectiveLead?.campaign || 'No Campaign',
      callId: currentCallId || undefined,
      leadId: activeCallLeadIdRef.current || effectiveLead?.id // Use persisted ID first
    });
    setShowPostCallNotes(true);

    setCallStatus('idle');
    setCallDuration(0);
    setCallStartTime(null);
    setCurrentCallId(null);
    setContextCallId(null);
    activeCallNumberRef.current = ""; // Reset after storing pending data
    activeCallLeadIdRef.current = undefined; // Reset ID
    // Notify parent that call has ended
    onCallEnd?.();
  };

  const handleSaveCallNotes = async (data: AfterCallSummaryData) => {
    if (!pendingCallData) {
      console.error('[Softphone] No pending call data to save');
      toast.error("No call data to save");
      return;
    }

    try {
      console.log('[Softphone] Saving call notes:', { data, pendingCallData });

      // key information to append to notes
      const notesHeader = `[Disposition: ${data.disposition}] [Strength: ${data.leadStrength}] [Interest: ${data.interestScore}/5]`;
      const fullNotes = `${notesHeader}\n${data.notes}`;

      // Get campaign_id if available
      let campaignId = null;
      if (pendingCallData.campaign !== 'No Campaign') {
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('id')
          .eq('name' as any, pendingCallData.campaign as any)
          .single();

        if (campaignError) {
          console.warn('[Softphone] Could not find campaign:', campaignError);
        } else if (campaignData) {
          campaignId = (campaignData as any).id;
        }
      }

      // Determine call status based on duration
      // If duration is 0, call wasn't answered (no_answer)
      // If duration > 0, call was connected
      const callActivityStatus = pendingCallData.duration > 0 ? 'connected' : 'no_answer';

      // Save call activity with notes
      console.log('[Softphone] Attempting to save call activity...');

      let savePromise;
      if (pendingCallData.callId) {
        // Update existing
        savePromise = updateCallActivity(pendingCallData.callId, {
          status: callActivityStatus,
          notes: fullNotes,
          campaign_id: campaignId || undefined,
          end_time: new Date().toISOString(),
          duration_seconds: pendingCallData.duration || 0
        });
      } else {
        // Create new (fallback)
        savePromise = createCallActivity({
          phone_number: pendingCallData.phoneNumber,
          lead_name: pendingCallData.leadName,
          duration_seconds: pendingCallData.duration || 0,
          status: callActivityStatus,
          notes: fullNotes,
          campaign_id: campaignId || undefined,
          call_type: 'outbound',
          start_time: new Date().toISOString(), // Warning: inaccurate start time
          end_time: new Date().toISOString()
        } as any);
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Save operation timed out after 30 seconds')), 30000)
      );

      const callActivityData = await Promise.race([savePromise, timeoutPromise]);

      console.log('[Softphone] ??? Call activity saved successfully:', callActivityData);

      // Parse notes for callback intent
      const callbackIntent = parseCallbackIntent(data.notes);

      if (callbackIntent.shouldCreateCallback && user) {
        // Automatically create callback - only use fields that exist in the schema
        const { error: callbackError } = await supabase.from('callbacks').insert([{
          user_id: user.id,
          scheduled_for: callbackIntent.callbackDate!.toISOString(),
          status: 'pending',
          notes: data.notes,
          lead_name: pendingCallData.leadName,
          phone_number: pendingCallData.phoneNumber
        } as any]);

        if (callbackError) {
          console.error('[Softphone] Error creating callback:', callbackError);
          toast.success("Call notes saved (callback scheduling failed)");
        } else {
          const formattedDate = callbackIntent.callbackDate!.toLocaleDateString();
          toast.success("Call notes saved and callback scheduled", {
            description: `Follow-up set for ${formattedDate}`
          });
        }
      } else {
        toast.success("Call notes saved successfully");
      }

      // Fallback: If pendingCallData is missing info (e.g. ref cleared or race condition), try using current effectiveLead
      const targetLeadId = pendingCallData.leadId || effectiveLead?.id;
      const targetPhoneNumber = pendingCallData.phoneNumber || effectiveLead?.phone;

      // Update lead status in leads table
      if (targetLeadId) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            status: data.disposition,
            last_contact_at: new Date().toISOString()
          } as any)
          .eq('id' as any, targetLeadId as any);

        if (updateError) {
          console.error('[Softphone] Error updating lead status (by ID):', updateError);
        } else {
          console.log('[Softphone] Lead status updated to:', data.disposition, 'for ID:', targetLeadId);
        }
      } else if (targetPhoneNumber) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            status: data.disposition,
            last_contact_at: new Date().toISOString()
          } as any)
          .eq('phone' as any, targetPhoneNumber as any);

        if (updateError) {
          console.error('[Softphone] Error updating lead status (by ID):', updateError);
        } else {
          console.log('[Softphone] Lead status updated to:', data.disposition);
        }
      } else {
        console.warn('[Softphone] No phone number available to update lead status. Pending:', pendingCallData, 'Effective:', effectiveLead);
        toast.warning("Could not update lead status: missing ID/Phone");
      }

      setPendingCallData(null);
      setShowPostCallNotes(false); // Close dialog
      onCallEnd?.();

    } catch (error) {
      console.error('[Softphone] ??? Error saving call notes:', error);

      // Provide more specific error messages
      let errorMessage = "Failed to save call notes";
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = "Save operation timed out. Please try again.";
        } else if (error.message.includes('duplicate') || error.message.includes('unique')) {
          errorMessage = "This call may have already been saved.";
        } else if (error.message.includes('permission') || error.message.includes('policy')) {
          errorMessage = "Permission denied. Please check your access rights.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
      // Re-throw error so PostCallNotesDialog can handle it
      throw error;
    }
  };

  const handleCall = async (phoneNumber?: string) => {
    try {
      const numberToCall = phoneNumber || effectiveLead?.phone || dialedNumber;

      // Ensure we have pending call data set immediately so we don't lose the phone number
      setPendingCallData({
        phoneNumber: numberToCall,
        duration: 0,
        leadName: effectiveLead?.name || "Unknown",
        campaign: effectiveLead?.campaign || "Direct Dial"
      });

      if (connectionMode === 'webrtc') {
        // Use WebRTC client
        console.log('========================================');
        console.log('[WebRTC-CALL] ???? INITIATING CALL');
        console.log('[WebRTC-CALL] Raw input number:', numberToCall);

        if (!webrtcClientRef.current || !isWebRTCReady) {
          console.error('[WebRTC-CALL] ??? Client not ready');
          console.log('[WebRTC-CALL] Has client:', !!webrtcClientRef.current);
          console.log('[WebRTC-CALL] Is ready:', isWebRTCReady);
          console.log('========================================');
          toast.error("WebRTC not ready. Please wait or reconnect.");
          return;
        }

        const normalizedNumber = normalizePhoneNumber(numberToCall);
        // Notify parent that a call is starting (for AI, UI, etc.)
        onCallStart?.();
        console.log('[WebRTC-CALL] Normalized number:', normalizedNumber);
        console.log('[WebRTC-CALL] Client ready:', isWebRTCReady);
        console.log('[WebRTC-CALL] Token:', webrtcToken);
        console.log('[WebRTC-CALL] Client object type:', typeof webrtcClientRef.current);
        console.log('[WebRTC-CALL] Client methods:', Object.keys(webrtcClientRef.current || {}));

        // Close dial pad if open
        setShowDialPad(false);

        try {
          console.log('[WebRTC-CALL] ???? Calling client.call() with:', normalizedNumber);
          console.log('[WebRTC-CALL] Call parameters:', {
            phoneNumber: normalizedNumber,
            timestamp: new Date().toISOString()
          });

          const callResult = webrtcClientRef.current.call(normalizedNumber);

          console.log('[WebRTC-CALL] ??? Call method returned');
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
          console.error('[WebRTC-CALL] ????????? CALL FAILED ?????????');
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

      // Initialize SIP client if not already done or if previous init failed
      if (!sipClientRef.current || sipConnectionStatus !== 'connected') {
        console.log('[Softphone] SIP not initialized or connection lost, initializing now...');
        toast.loading('Connecting to call server...');
        setSipConnectionStatus('connecting');
        const initialized = await initializeSipClient();
        toast.dismiss();
        if (!initialized) {
          setCallStatus("idle");
          toast.error('Failed to connect to call server. Please try again.');
          return;
        }
      }

      toast.loading('Calling customer...');
      // Notify parent that a call is starting
      onCallStart?.();

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

            // Create activity record
            createActivityOnConnect(numberToCall);

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

  async function initializeSipClient() {
    try {
      console.log('[Softphone] ???? Initializing SIP client...');
      setSipConnectionStatus('connecting');

      const { data, error } = await supabase.functions.invoke('get-sip-credentials');

      if (error) {
        console.error('[Softphone] ??? Failed to get SIP credentials:', error);
        setSipConnectionStatus('error');
        throw error;
      }

      if (!data?.username || !data?.password) {
        console.error('[Softphone] ??? Missing SIP credentials in response:', data);
        setSipConnectionStatus('error');
        throw new Error('SIP credentials not available');
      }

      console.log('[Softphone] ??? Got credentials, initializing SIP client...');
      sipClientRef.current = new SipClient();
      const initialized = await sipClientRef.current.initialize(data.username, data.password);

      if (initialized) {
        console.log('[Softphone] ??? SIP client ready and registered');
        setSipConnectionStatus('connected');
        toast.success('SIP phone connected');
        return true;
      } else {
        console.error('[Softphone] ??? SIP initialization returned false');
        setSipConnectionStatus('error');
        return false;
      }
    } catch (error) {
      console.error('[Softphone] ??? SIP initialization failed:', error);
      setSipConnectionStatus('error');
      toast.error('SIP connection failed - will retry on first call');
      sipClientRef.current = null; // Reset so we can retry
      return false;
    }
  }

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

  // Register controls with context so other components can drive the call
  useEffect(() => {
    registerControls({
      hangup: handleHangup,
      toggleMute: toggleMute,
      toggleHold: handleHold,
      sendDtmf: handleDialPadClick
    });
  }, [handleHangup, toggleMute, handleHold, handleDialPadClick, registerControls]);

  return (
    <>
      {/* CARD INTERFACE - Only shown when NOT in a call AND explicitly shown */}
      {showSoftphone && callStatus === "idle" && (
        <Card className="fixed bottom-4 right-4 w-80 z-50 shadow-2xl border-none bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                Softphone
              </div>
              <div className="flex items-center gap-2">
                {connectionMode === 'sip' ? (
                  <Badge variant="outline" className={cn(
                    "text-[10px] px-1.5 h-5",
                    sipConnectionStatus === 'connected' ? "bg-success/10 text-success border-success/20" :
                      sipConnectionStatus === 'connecting' ? "bg-warning/10 text-warning border-warning/20 animate-pulse" :
                        "bg-destructive/10 text-destructive border-destructive/20"
                  )}>
                    {sipConnectionStatus.toUpperCase()}
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn(
                    "text-[10px] px-1.5 h-5",
                    isWebRTCReady ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20 animate-pulse"
                  )}>
                    {isWebRTCReady ? "READY" : "CONNECTING..."}
                  </Badge>
                )}
                <Plug className={cn("h-3 w-3", (connectionMode === 'sip' ? sipConnectionStatus === 'connected' : isWebRTCReady) ? "text-success" : "text-muted-foreground")} />
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* Current Lead Info with Navigation */}
            {effectiveLead && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPreviousLead}
                    disabled={!hasPreviousLead}
                    className="h-8 w-8 p-0 rounded-full"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Lead {currentLeadPosition} of {totalLeads || 1}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNextLead}
                    disabled={!hasNextLead}
                    className="h-8 w-8 p-0 rounded-full"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                  <div className="font-bold text-base">{effectiveLead.name}</div>
                  <div className="text-muted-foreground font-mono text-sm">{maskPhone(effectiveLead.phone)}</div>
                  <div className="text-[10px] uppercase font-black text-primary/60 mt-2 tracking-widest">
                    {effectiveLead.campaign}
                  </div>
                </div>
              </div>
            )}

            {/* Call Controls */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                onClick={() => handleCall()}
                className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                disabled={!effectiveLead || (connectionMode === 'webrtc' && !isWebRTCReady)}
              >
                <Phone className="h-6 w-6 text-white fill-current" />
              </Button>

              <Dialog open={showDialPad} onOpenChange={setShowDialPad}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-14 w-14 rounded-full border-2 border-border/50 hover:bg-accent transition-all"
                  >
                    <Grid3x3 className="h-6 w-6" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-3xl p-6">
                  <DialogHeader>
                    <DialogTitle className="text-center font-bold">Dial Pad</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div className="relative">
                      <Input
                        value={dialedNumber}
                        onChange={(e) => setDialedNumber(e.target.value)}
                        placeholder="Enter phone number"
                        className="text-center text-2xl font-mono h-16 rounded-2xl bg-muted/30 border-none transition-all focus:ring-2 focus:ring-primary"
                      />
                      {dialedNumber && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
                          onClick={handleDialPadDelete}
                        >
                          <Delete className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                        <Button
                          key={digit}
                          variant="ghost"
                          className="h-16 text-3xl font-light rounded-2xl hover:bg-muted transition-colors"
                          onClick={() => handleDialPadClick(digit)}
                        >
                          {digit}
                        </Button>
                      ))}
                    </div>

                    <Button
                      onClick={handleDialPadCall}
                      disabled={!dialedNumber || !isWebRTCReady}
                      className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 rounded-2xl text-xl font-bold transition-all shadow-lg"
                    >
                      <Phone className="h-6 w-6 mr-3 fill-current" />
                      CALL NOW
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Compliance Note */}
            <div className="text-[10px] text-muted-foreground text-center font-medium animate-pulse">
              All calls are recorded for quality assurance
            </div>
          </CardContent>
        </Card>
      )}

      {/* NEW BRANDED CALL OVERLAY - Shown during active call */}
      <ActiveCallOverlay
        isOpen={callStatus !== 'idle'}
        onClose={handleHangup}
        leadName={effectiveLead?.name || "Unknown"}
        phoneNumber={dialedNumber || effectiveLead?.phone || ""}
        callStatus={callStatus === 'idle' ? 'ringing' : callStatus as any}
        duration={callDuration}
        isMuted={isMuted}
        onHangup={handleHangup}
        onToggleMute={toggleMute}
        onToggleHold={handleHold}
      />

      {/* Post-Call Notes Dialog */}
      {pendingCallData && (
        <AfterCallSummary
          open={showPostCallNotes}
          onOpenChange={setShowPostCallNotes}
          onSave={handleSaveCallNotes}
          leadName={pendingCallData.leadName}
          callDuration={pendingCallData.duration}
        />
      )}
    </>
  );
}
