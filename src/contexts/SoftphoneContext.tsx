import { createContext, useContext, useState, ReactNode, useRef } from "react";

export interface SoftphoneLead {
    id?: string;
    name: string;
    phone: string;
    campaign: string;
}

interface SoftphoneContextType {
    startCall: (lead: SoftphoneLead) => void;
    activeLead: SoftphoneLead | null;
    isCallActive: boolean;
    setIsCallActive: (active: boolean) => void;
    callId: string | null;
    setCallId: (id: string | null) => void;
    setShowSoftphone: (show: boolean) => void;
    showSoftphone: boolean;
    minimized: boolean;
    setMinimized: (minimized: boolean) => void;
    autoDialTrigger: number;
    // Events for other components to listen to
    registerHandlers: (handlers: { onCallStart: () => void; onCallEnd: () => void }) => void;
    // Call Controls (exposed by Softphone component)
    hangup: () => void;
    toggleMute: () => void;
    toggleHold: () => void;
    sendDtmf: (digit: string) => void;
    connectionQuality: 'good' | 'fair' | 'poor';
    registerControls: (controls: {
        hangup: () => void;
        toggleMute: () => void;
        toggleHold: () => void;
        sendDtmf: (digit: string) => void;
    }) => void;
    setConnectionQuality: (quality: 'good' | 'fair' | 'poor') => void;
}

const SoftphoneContext = createContext<SoftphoneContextType | undefined>(undefined);

export function SoftphoneProvider({ children }: { children: ReactNode }) {
    const [activeLead, setActiveLead] = useState<SoftphoneLead | null>(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const [callId, setCallId] = useState<string | null>(null);
    const [showSoftphone, setShowSoftphone] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [autoDialTrigger, setAutoDialTrigger] = useState(0);

    // Simple event bus for start call
    // The Softphone component will listen to changes in activeLead + triggers

    const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
    const controlsRef = useRef<{
        hangup: () => void;
        toggleMute: () => void;
        toggleHold: () => void;
        sendDtmf: (digit: string) => void;
    }>({
        hangup: () => console.warn("Hangup not implemented"),
        toggleMute: () => console.warn("Mute not implemented"),
        toggleHold: () => console.warn("Hold not implemented"),
        sendDtmf: () => console.warn("DTMF not implemented"),
    });

    const startCall = (lead: SoftphoneLead) => {
        console.log("[SoftphoneContext] Starting call for:", lead);
        setActiveLead(lead);
        setShowSoftphone(true);
        setMinimized(false);
        // Increment trigger to signal auto-dial
        setAutoDialTrigger(prev => prev + 1);
    };

    const registerHandlers = (_handlers: any) => {
        // Placeholder if we need reverse communication
    };

    const registerControls = (controls: {
        hangup: () => void;
        toggleMute: () => void;
        toggleHold: () => void;
        sendDtmf: (digit: string) => void;
    }) => {
        controlsRef.current = controls;
    };

    // Proxy functions to current controls
    const hangup = () => controlsRef.current.hangup();
    const toggleMute = () => controlsRef.current.toggleMute();
    const toggleHold = () => controlsRef.current.toggleHold();
    const sendDtmf = (digit: string) => controlsRef.current.sendDtmf(digit);

    return (
        <SoftphoneContext.Provider
            value={{
                startCall,
                activeLead,
                isCallActive,
                setIsCallActive,
                callId,
                setCallId,
                setShowSoftphone,
                showSoftphone,
                minimized,
                setMinimized,
                autoDialTrigger,
                registerHandlers,
                hangup,
                toggleMute,
                toggleHold,
                sendDtmf,
                connectionQuality,
                setConnectionQuality,
                registerControls
            }}
        >
            {children}
        </SoftphoneContext.Provider>
    );
}

export function useSoftphone() {
    const context = useContext(SoftphoneContext);
    if (context === undefined) {
        throw new Error("useSoftphone must be used within a SoftphoneProvider");
    }
    return context;
}
