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
    MoreHorizontal,
    Plus,
    ArrowUpRight,
    Share,
    Maximize2,
    Volume2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ActiveCallOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    leadName: string;
    phoneNumber: string;
    callStatus: "ringing" | "connected" | "hold" | "muted";
    duration: number;
    isMuted: boolean;
    onHangup: () => void;
    onToggleMute: () => void;
    onToggleHold: () => void;
}

export function ActiveCallOverlay({
    isOpen,
    onClose,
    leadName,
    phoneNumber,
    callStatus,
    duration,
    isMuted,
    onHangup,
    onToggleMute,
    onToggleHold
}: ActiveCallOverlayProps) {
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Bangbet Yellow: #FFDE00 (Tailwind yellow-400 is close)
    // Logo has Green and Black too.

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[400px] p-0 border-none bg-transparent shadow-none overflow-hidden outline-none">
                <div className="relative w-full aspect-[3/4] bg-[#FFDE00] rounded-[40px] flex flex-col items-center pt-16 pb-12 px-8 text-black shadow-2xl">

                    {/* Top Controls */}
                    <div className="absolute top-8 right-8 flex gap-4">
                        <button className="text-black/60 hover:text-black transition-colors">
                            <Maximize2 className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Profile Avatar */}
                    <div className="relative mb-8">
                        <div className="w-32 h-32 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center border-4 border-white/50 shadow-xl overflow-hidden">
                            <div className="w-full h-full bg-gradient-to-br from-white/40 to-transparent flex items-center justify-center">
                                <User className="h-16 w-16 text-black/40" />
                            </div>
                        </div>
                        {/* Signal Status Icon in corner like the image */}
                        <div className="absolute bottom-2 right-2 bg-black/10 backdrop-blur-sm rounded-full p-1.5 border border-white/20">
                            <Volume2 className="h-4 w-4 text-black/60" />
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="text-center space-y-2 mb-12">
                        <h2 className="text-3xl font-black tracking-tight leading-tight uppercase">
                            {phoneNumber}
                        </h2>
                        <p className="text-lg font-bold text-black/60">
                            {leadName}
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <div className={cn(
                                "h-2 w-2 rounded-full animate-pulse",
                                callStatus === 'connected' ? "bg-emerald-600" : "bg-red-500"
                            )} />
                            <span className="text-xl font-mono font-bold tracking-widest">
                                {formatDuration(duration)}
                            </span>
                        </div>
                    </div>

                    {/* Primary Actions */}
                    <div className="flex items-center justify-between w-full max-w-[280px] mb-12">
                        {/* Keypad */}
                        <button className="w-14 h-14 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all border border-black/10">
                            <Grid3x3 className="h-6 w-6 text-black/80" />
                        </button>

                        {/* Hold/Pause */}
                        <button
                            onClick={onToggleHold}
                            className={cn(
                                "w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg",
                                callStatus === 'hold' ? "bg-black text-[#FFDE00]" : "bg-white/50 hover:bg-white/80 text-black"
                            )}
                        >
                            {callStatus === 'hold' ? <Play className="h-7 w-7" /> : <Pause className="h-7 w-7" />}
                        </button>

                        {/* Hangup */}
                        <button
                            onClick={onHangup}
                            className="w-16 h-16 rounded-full bg-[#E53E3E] hover:bg-[#C53030] text-white flex items-center justify-center transition-all shadow-lg ring-4 ring-[#E53E3E]/20"
                        >
                            <PhoneOff className="h-7 w-7 fill-current" />
                        </button>

                        {/* Mute/Volume controls placeholder */}
                        <button
                            onClick={onToggleMute}
                            className={cn(
                                "w-14 h-14 rounded-full flex items-center justify-center transition-all border border-black/10",
                                isMuted ? "bg-black text-[#FFDE00]" : "bg-black/5 hover:bg-black/10 text-black/80"
                            )}
                        >
                            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                        </button>
                    </div>

                    {/* Secondary Actions Row */}
                    <div className="grid grid-cols-3 gap-8 w-full mt-auto">
                        <div className="flex flex-col items-center gap-2">
                            <button className="p-3 rounded-2xl bg-black/5 hover:bg-black/10 transition-colors">
                                <Plus className="h-5 w-5" />
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Add Call</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <button className="p-3 rounded-2xl bg-black/5 hover:bg-black/10 transition-colors">
                                <Share className="h-5 w-5" />
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Attend</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <button className="p-3 rounded-2xl bg-black/5 hover:bg-black/10 transition-colors">
                                <ArrowUpRight className="h-5 w-5" />
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Blind</span>
                        </div>
                    </div>

                    {/* Resize Handle handle like bottom right icon */}
                    <div className="absolute bottom-6 right-8">
                        <Maximize2 className="h-4 w-4 text-black/20" />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
