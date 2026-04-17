import { useState, useEffect } from "react";
import {
    Phone,
    PhoneOff,
    Mic,
    MicOff,
    Grid3x3,
    Pause,
    Play,
    User,
    Plus,
    ArrowUpRight,
    Share,
    Maximize2,
    Volume2,
    Sparkles,
    MessageSquare,
    ChevronRight,
    Save
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSoftphone } from "@/contexts/SoftphoneContext";

interface CenterDialerModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadName: string;
    phoneNumber: string;
    leadId?: string;
    leadDbId?: string;
    onFeedbackSuccess?: () => void;
}

const DISPOSITION_OPTIONS = [
    { value: "unassigned", label: "Unassigned", color: "text-blue-600" },
    { value: "unreachable", label: "Unreachable", color: "text-red-600" },
    { value: "not_interested", label: "Not Interested", color: "text-slate-600" },
    { value: "interested", label: "Interested", color: "text-emerald-600" },
    { value: "no_answer", label: "No Answer", color: "text-amber-600" },
    { value: "answered_no_response", label: "Answered-No Response", color: "text-purple-600" }
];

export function CenterDialerModal({
    isOpen,
    onClose,
    leadName,
    phoneNumber,
    leadId,
    leadDbId,
    onFeedbackSuccess
}: CenterDialerModalProps) {
    const {
        hangup,
        toggleMute,
        toggleHold,
        connectionQuality,
        isCallActive
    } = useSoftphone();

    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isHold, setIsHold] = useState(false);
    const [disposition, setDisposition] = useState<string>("");
    const [callNotes, setCallNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [aiStage, setAiStage] = useState<'listening' | 'intro' | 'offer' | 'objection'>('listening');
    const { toast } = useToast();

    // Reset duration when call becomes active
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isCallActive) {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [isCallActive]);

    // AI Assistant staged reveal
    useEffect(() => {
        if (!isOpen) {
            setAiStage('listening');
            return;
        }

        // Stage 1: Listening (initial) - 8 seconds
        const introTimer = setTimeout(() => {
            setAiStage('intro');
        }, 8000);

        // Stage 2: Special Offer - 18 seconds total (8 + 10)
        const offerTimer = setTimeout(() => {
            setAiStage('offer');
        }, 18000);

        // Stage 3: Objection Handling - 26 seconds total (18 + 8)
        const objectionTimer = setTimeout(() => {
            setAiStage('objection');
        }, 26000);

        return () => {
            clearTimeout(introTimer);
            clearTimeout(offerTimer);
            clearTimeout(objectionTimer);
        };
    }, [isOpen]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleHangup = () => {
        hangup();
        // UI cleanup logic happens locally or via parent
    };

    const handleToggleMute = () => {
        toggleMute();
        setIsMuted(!isMuted);
    };

    const handleToggleHold = () => {
        toggleHold();
        setIsHold(!isHold);
    };

    const handleSubmitFeedback = async () => {
        if (!disposition) {
            toast({
                title: "Select Disposition",
                description: "Please select a feedback status before submitting.",
                variant: "destructive"
            });
            return;
        }

        if (!leadDbId) {
            console.error("Missing Lead DB ID");
            onClose();
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Update Lead Status and Last Activity
            const { error: updateError } = await supabase
                .from('leads')
                .update({
                    status: disposition,
                    last_activity: callNotes || disposition
                } as any)
                .eq('id' as any, leadDbId as any);

            if (updateError) throw updateError;

            // 2. Generate AI Actionable Summary if notes are provided
            if (callNotes) {
                try {
                    toast({
                        title: "AI Analyzing...",
                        description: "Generating your actionable plan.",
                    });

                    const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-lead-summary', {
                        body: {
                            leadId: leadDbId,
                            notes: callNotes,
                            disposition: disposition
                        },
                    });

                    if (aiError) console.error("AI Summary Error:", aiError);
                    else {
                        toast({
                            title: "AI Ready",
                            description: "Actionable plan added to Kanban card.",
                            className: "bg-blue-600 text-white border-none"
                        });
                    }
                } catch (aiErr) {
                    console.error("AI Invocation failed:", aiErr);
                }
            }

            toast({
                title: "Feedback Saved",
                description: "Lead status has been updated successfully.",
                className: "bg-green-600 text-white border-none"
            });

            // Allow a brief moment for user to see success before closing
            setTimeout(() => {
                if (onFeedbackSuccess) {
                    onFeedbackSuccess();
                } else {
                    onClose();
                }
            }, 500);

        } catch (error) {
            console.error("Error updating lead:", error);
            toast({
                title: "Error",
                description: "Failed to update lead status.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const maskPhoneNumber = (phone: string) => {
        if (!phone) return "";
        // Take the last 3 digits
        const last3 = phone.slice(-3);
        // Mask the rest (showing 8 stars for aesthetic balance)
        return `******${last3}`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[750px] p-0 border-none bg-transparent shadow-none outline-none overflow-hidden [&>button]:hidden flex gap-4">
                <DialogTitle className="sr-only">Active Call Method</DialogTitle>
                <DialogDescription className="sr-only">
                    Dialing {leadName} at {phoneNumber}
                </DialogDescription>

                {/* Left Panel: Dialer */}
                <div className="relative w-[340px] bg-[#FFDE00] rounded-[32px] flex flex-col items-center pt-8 pb-8 px-6 text-black shadow-2xl selection:bg-black/20 shrink-0">

                    {/* Top Controls */}
                    <div className="absolute top-6 right-6 flex gap-4">
                        <button className="text-black/60 hover:text-black transition-colors p-2 rounded-full hover:bg-black/5">
                            <Maximize2 className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Profile Avatar - Generic Icon */}
                    <div className="relative mb-6 mt-4 group">
                        <div className="w-24 h-24 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center border-4 border-white/50 shadow-xl overflow-hidden transition-transform duration-500 group-hover:scale-105">
                            <Avatar className="w-full h-full">
                                <AvatarFallback className="bg-[#D8B4FE] flex items-center justify-center w-full h-full">
                                    <User className="h-14 w-14 text-white fill-white" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        {/* Signal Status Icon - Dynamic based on WebRTC stats */}
                        <div className="absolute bottom-1 right-1 bg-black/10 backdrop-blur-sm rounded-full p-1.5 border border-white/20 flex gap-0.5 items-end h-5">
                            <div className={cn("w-1 rounded-sm", connectionQuality === 'poor' ? "h-2 bg-red-500" : connectionQuality === 'fair' ? "h-2 bg-yellow-500" : "h-2 bg-green-500")}></div>
                            <div className={cn("w-1 rounded-sm", connectionQuality === 'poor' ? "h-2 bg-gray-400/50" : connectionQuality === 'fair' ? "h-3 bg-yellow-500" : "h-3 bg-green-500")}></div>
                            <div className={cn("w-1 rounded-sm", connectionQuality === 'poor' ? "h-2 bg-gray-400/50" : connectionQuality === 'fair' ? "h-3 bg-yellow-500" : "h-4 bg-green-500")}></div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="text-center space-y-1 mb-8 w-full">
                        <h2 className="text-2xl font-black tracking-tight leading-tight uppercase font-mono truncate">
                            {maskPhoneNumber(phoneNumber)}
                        </h2>
                        <p className="text-base font-bold text-black/60 truncate px-4">
                            {leadName}
                        </p>

                        <div className="flex items-center justify-center gap-2 pt-2 h-6">
                            {!isCallActive ? (
                                <span className="text-sm font-bold animate-pulse text-black/70">Connecting...</span>
                            ) : (
                                <>
                                    <div className="h-2 w-2 rounded-full animate-pulse bg-emerald-600 shadow-[0_0_10px_rgba(5,150,105,0.5)]" />
                                    <span className="text-lg font-mono font-bold tracking-widest tabular-nums">
                                        {formatDuration(duration)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Primary Actions */}
                    <div className="flex items-center justify-between w-full max-w-[240px] mb-8">
                        {/* Keypad */}
                        <button className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 active:bg-black/20 flex items-center justify-center transition-all border border-black/5 backdrop-blur-sm">
                            <Grid3x3 className="h-5 w-5 text-black/80" />
                        </button>

                        {/* Hold/Pause */}
                        <button
                            onClick={handleToggleHold}
                            className={cn(
                                "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 duration-200",
                                isHold
                                    ? "bg-black text-[#FFDE00] ring-4 ring-black/20"
                                    : "bg-white hover:bg-white/90 text-black border border-black/5"
                            )}
                        >
                            {isHold ? <Play className="h-6 w-6 fill-current" /> : <Pause className="h-6 w-6 fill-current" />}
                        </button>

                        {/* Hangup */}
                        <button
                            onClick={handleHangup}
                            className="w-14 h-14 rounded-full bg-[#E53E3E] hover:bg-[#C53030] active:bg-[#9B2C2C] text-white flex items-center justify-center transition-all shadow-lg ring-4 ring-[#E53E3E]/20 active:scale-95 duration-200"
                        >
                            <PhoneOff className="h-6 w-6 fill-current" />
                        </button>

                        {/* Mute */}
                        <button
                            onClick={handleToggleMute}
                            className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center transition-all border border-black/5 backdrop-blur-sm active:scale-95",
                                isMuted
                                    ? "bg-black text-[#FFDE00]"
                                    : "bg-black/5 hover:bg-black/10 text-black/80"
                            )}
                        >
                            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </button>
                    </div>

                    {/* Secondary Actions Row */}
                    <div className="grid grid-cols-3 gap-6 w-full mt-auto mb-2">
                        <div className="flex flex-col items-center gap-1.5 group cursor-pointer">
                            <button className="p-3 rounded-2xl bg-black/5 group-hover:bg-black/10 transition-colors backdrop-blur-sm">
                                <Plus className="h-4 w-4 text-black/70 group-hover:text-black" />
                            </button>
                            <span className="text-[9px] font-black uppercase tracking-wider opacity-50 group-hover:opacity-80 transition-opacity">Add</span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 group cursor-pointer">
                            <button className="p-3 rounded-2xl bg-black/5 group-hover:bg-black/10 transition-colors backdrop-blur-sm">
                                <Share className="h-4 w-4 text-black/70 group-hover:text-black" />
                            </button>
                            <span className="text-[9px] font-black uppercase tracking-wider opacity-50 group-hover:opacity-80 transition-opacity">Attend</span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 group cursor-pointer">
                            <button className="p-3 rounded-2xl bg-black/5 group-hover:bg-black/10 transition-colors backdrop-blur-sm">
                                <ArrowUpRight className="h-4 w-4 text-black/70 group-hover:text-black" />
                            </button>
                            <span className="text-[9px] font-black uppercase tracking-wider opacity-50 group-hover:opacity-80 transition-opacity">Blind</span>
                        </div>
                    </div>
                </div>

                {/* Right Panel: AI Suggestions */}
                <div className="flex-1 bg-white rounded-[32px] p-6 shadow-2xl flex flex-col h-[550px] animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                        <div className="bg-blue-50 p-2 rounded-xl">
                            <Sparkles className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">AI Assistant</h3>
                            <p className="text-xs text-muted-foreground">Live suggestions for {leadName}</p>
                        </div>
                    </div>

                    <div className="flex-1 pr-4 overflow-hidden">
                        <div className="space-y-6 h-full">
                            {/* AI Listening State */}
                            {aiStage === 'listening' && (
                                <div className="flex flex-col items-center justify-center h-full py-12 animate-in fade-in duration-500">
                                    <div className="relative mb-6">
                                        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-blue-500 animate-pulse flex items-center justify-center">
                                                <Sparkles className="h-6 w-6 text-white" />
                                            </div>
                                        </div>
                                        {/* Pulsing rings */}
                                        <div className="absolute inset-0 rounded-full border-2 border-blue-400/50 animate-ping" />
                                        <div className="absolute inset-[-8px] rounded-full border border-blue-300/30 animate-ping" style={{ animationDelay: '0.5s' }} />
                                    </div>
                                    <p className="text-sm font-bold text-blue-600 animate-pulse">AI is listening...</p>
                                    <p className="text-xs text-muted-foreground mt-1">Analyzing conversation</p>
                                </div>
                            )}

                            {/* Script Section: Opening */}
                            {aiStage === 'intro' && (
                                <div className="space-y-2 animate-in slide-in-from-bottom-4 fade-in duration-500">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        Introduction
                                    </h4>
                                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-sm leading-relaxed text-slate-700">
                                        "Hello, am I speaking with <span className="font-bold text-blue-700">{leadName}</span>? This is Alex from BangBet VIP support. I noticed you've been a loyal member and I wanted to personally thank you."
                                    </div>
                                </div>
                            )}

                            {/* Script Section: Value Prop */}
                            {aiStage === 'offer' && (
                                <div className="space-y-2 animate-in slide-in-from-bottom-4 fade-in duration-500">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        Special Offer
                                    </h4>
                                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-sm leading-relaxed text-slate-700">
                                        "We have unlocked a special <span className="font-bold text-emerald-700">100% Deposit Match</span> specifically for your account today. If you deposit 50,000 UGX, we'll instantly double it to 100,000 UGX."
                                    </div>
                                </div>
                            )}

                            {/* Script Section: Objection Handling */}
                            {aiStage === 'objection' && (
                                <div className="space-y-2 animate-in slide-in-from-bottom-4 fade-in duration-500">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                        If Customer Hesitates
                                    </h4>
                                    <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100 text-sm leading-relaxed text-slate-600">
                                        <div className="flex gap-2 mb-2">
                                            <MessageSquare className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                            <span className="italic">"I'm busy right now."</span>
                                        </div>
                                        <div className="pl-6 border-l-2 border-amber-200">
                                            "I completely understand. I can activate this bonus on your account for the next 24 hours via SMS. Would that work better for you?"
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Action: Disposition Select & Submit */}
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Call Outcome</label>
                            <Select value={disposition} onValueChange={setDisposition}>
                                <SelectTrigger className="w-full h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:ring-blue-500/20">
                                    <SelectValue placeholder="Select outcome..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {DISPOSITION_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                                            <span className={cn("font-medium", option.color)}>{option.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Call Notes</label>
                            <Textarea
                                placeholder="Add specific notes about this call..."
                                className="min-h-[80px] rounded-xl border-gray-200 bg-gray-50/50 focus:ring-blue-500/20 resize-none text-sm"
                                value={callNotes}
                                onChange={(e) => setCallNotes(e.target.value)}
                            />
                        </div>

                        <Button
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                            onClick={handleSubmitFeedback}
                            disabled={isSubmitting || !disposition}
                        >
                            {isSubmitting ? (
                                <span className="animate-pulse">Saving...</span>
                            ) : (
                                <>
                                    Submit Feedback
                                    <Save className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
