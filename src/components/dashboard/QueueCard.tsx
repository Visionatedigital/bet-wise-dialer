import { Clock, User, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { maskPhone } from "@/lib/formatters";
interface Lead {
  id: string;
  name: string;
  phone: string;
  campaign: string;
  priority: "high" | "medium" | "low";
  slaMinutes: number;
  lastContact?: string;
  intent?: string;
  score: number;
}

interface QueueCardProps {
  nextLead: Lead | null;
  queueLength: number;
  onCallLead: (lead: Lead) => void;
}

export function QueueCard({ nextLead, queueLength, onCallLead }: QueueCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive text-destructive-foreground";
      case "medium": return "bg-warning text-warning-foreground";
      case "low": return "bg-success text-success-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSLAProgress = (minutes: number) => {
    // Assume 60 minutes is 100% (deadline)
    return Math.min((minutes / 60) * 100, 100);
  };

  const getSLAColor = (progress: number) => {
    if (progress > 80) return "bg-destructive";
    if (progress > 60) return "bg-warning";
    return "bg-success";
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (!nextLead) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Next in Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No leads in queue</p>
            <p className="text-xs mt-1">Queue length: {queueLength}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const slaProgress = getSLAProgress(nextLead.slaMinutes);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Next in Queue
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {queueLength} leads
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Lead Info */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {getInitials(nextLead.name)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{nextLead.name}</h3>
              <Badge className={`text-xs ${getPriorityColor(nextLead.priority)}`}>
                {nextLead.priority}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-1">
              {maskPhone(nextLead.phone)}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {nextLead.campaign}
              </span>
              {nextLead.intent && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {nextLead.intent}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* SLA Timer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              SLA Timer
            </span>
            <span className={slaProgress > 80 ? "text-destructive font-medium" : "text-muted-foreground"}>
              {nextLead.slaMinutes}min
            </span>
          </div>
          
          <Progress 
            value={slaProgress} 
            className="h-1"
          />
        </div>

        {/* Lead Score */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Lead Score</span>
          <span className="font-medium">{nextLead.score}/100</span>
        </div>

        {/* Quick Hints */}
        {nextLead.lastContact && (
          <div className="bg-muted/50 rounded-lg p-2 text-xs">
            <strong>Last contact:</strong> {nextLead.lastContact}
          </div>
        )}

        {/* Call Button */}
        <Button 
          onClick={() => onCallLead(nextLead)} 
          className="w-full"
          size="sm"
        >
          Call Now (Press C)
        </Button>
      </CardContent>
    </Card>
  );
}