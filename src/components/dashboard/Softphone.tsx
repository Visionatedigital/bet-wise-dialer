import { useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CallStatus = "idle" | "ringing" | "connected" | "hold" | "muted";

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

  const handleCall = () => {
    if (callStatus === "idle") {
      setCallStatus("ringing");
      // Simulate call connection after 2 seconds
      setTimeout(() => {
        setCallStatus("connected");
        // Start timer
        const timer = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
      }, 2000);
    }
  };

  const handleHangup = () => {
    setCallStatus("idle");
    setCallDuration(0);
    setIsMuted(false);
    setIsRecording(false);
  };

  const handleHold = () => {
    setCallStatus(callStatus === "hold" ? "connected" : "hold");
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
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

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Softphone</CardTitle>
          <Badge className={`${getStatusColor()} text-xs`}>
            {getStatusText()}
          </Badge>
        </div>
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
            <Button 
              onClick={handleCall}
              className="h-12 w-12 rounded-full bg-success hover:bg-success/90"
              disabled={!currentLead}
            >
              <Phone className="h-5 w-5" />
            </Button>
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

        {/* Quick Actions */}
        {callStatus === "connected" && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Button variant="outline" size="sm">Transfer</Button>
            <Button variant="outline" size="sm">Conference</Button>
          </div>
        )}

        {/* Compliance Note */}
        <div className="text-xs text-muted-foreground text-center border-t pt-2">
          Please bet responsibly. 18+ Only.
        </div>
      </CardContent>
    </Card>
  );
}