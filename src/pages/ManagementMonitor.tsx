import { ManagementLayout } from "@/components/layout/ManagementLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitorData } from "@/hooks/useMonitorData";
import { PhoneCall, Pause, UserCheck, XCircle } from "lucide-react";

export default function ManagementMonitor() {
  const { agents, loading } = useMonitorData();

  const getStatus = (status: string) => {
    switch (status) {
      case "on-call": return { icon: <PhoneCall className="h-3 w-3"/>, cls: "bg-green-500/10 text-green-600 border border-green-500/20" };
      case "online": return { icon: <UserCheck className="h-3 w-3"/>, cls: "bg-blue-500/10 text-blue-600 border border-blue-500/20" };
      case "break": return { icon: <Pause className="h-3 w-3"/>, cls: "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20" };
      default: return { icon: <XCircle className="h-3 w-3"/>, cls: "bg-red-500/10 text-red-600 border border-red-500/20" };
    }
  };

  return (
    <ManagementLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Monitoring</h1>
          <p className="text-muted-foreground">Live visibility into agent status</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-10"/><Skeleton className="h-4 w-2/3"/></CardContent></Card>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No active agents found</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(a => {
              const s = getStatus(a.status);
              return (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10"><AvatarFallback>{a.avatar}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium text-sm">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.campaign}</div>
                        </div>
                      </div>
                      <Badge className={s.cls}>
                        {s.icon}
                        <span className="ml-1 capitalize">{a.status.replace('-', ' ')}</span>
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Duration</div>
                        <div className="font-medium">{a.duration}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Assigned Leads</div>
                        <div className="font-medium">{a.assignedLeads}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Calls</div>
                        <div className="font-medium">{a.calls}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ManagementLayout>
  );
}
