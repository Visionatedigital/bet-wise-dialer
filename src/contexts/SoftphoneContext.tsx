import { createContext, useContext, useState, ReactNode } from "react";

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
                registerHandlers
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
