import { TrendingUp, Phone, Target, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatUGX } from "@/data/sampleData";

interface KPICardProps {
  title: string;
  value: string | number;
  target?: number;
  change?: string;
  icon: React.ElementType;
  color?: string;
}

function KPICard({ title, value, target, change, icon: Icon, color = "text-primary" }: KPICardProps) {
  const progress = target ? (typeof value === 'number' ? (value / target) * 100 : 0) : undefined;
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-1">
          {typeof value === 'number' && title.includes('Value') ? formatUGX(value) : value}
        </div>
        
        {change && (
          <p className="text-xs text-muted-foreground mb-2">
            <span className={change.startsWith('+') ? 'text-success' : 'text-destructive'}>
              {change}
            </span>
            {' '}from yesterday
          </p>
        )}
        
        {progress !== undefined && target && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{typeof value === 'number' ? value : 0}/{target}</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AgentKPIs() {
  // Mock data for today's KPIs
  const kpis = {
    callsMade: { value: 47, target: 60, change: "+12%" },
    connects: { value: 29, target: 40, change: "+8%" },
    avgHandleTime: { value: "6:42", target: undefined, change: "-15s" },
    conversions: { value: 8, target: 12, change: "+3%" },
    depositValue: { value: 2450000, target: 3000000, change: "+18%" },
    callbacksDue: { value: 5, target: undefined, change: undefined }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KPICard
        title="Calls Made"
        value={kpis.callsMade.value}
        target={kpis.callsMade.target}
        change={kpis.callsMade.change}
        icon={Phone}
        color="text-primary"
      />
      
      <KPICard
        title="Connects"
        value={kpis.connects.value}
        target={kpis.connects.target}
        change={kpis.connects.change}
        icon={Target}
        color="text-success"
      />
      
      <KPICard
        title="Avg Handle Time"
        value={kpis.avgHandleTime.value}
        change={kpis.avgHandleTime.change}
        icon={Clock}
        color="text-info"
      />
      
      <KPICard
        title="Conversions"
        value={kpis.conversions.value}
        target={kpis.conversions.target}
        change={kpis.conversions.change}
        icon={TrendingUp}
        color="text-warning"
      />
      
      <KPICard
        title="Deposit Value"
        value={kpis.depositValue.value}
        target={kpis.depositValue.target}
        change={kpis.depositValue.change}
        icon={DollarSign}
        color="text-success"
      />
      
      <KPICard
        title="Callbacks Due"
        value={kpis.callbacksDue.value}
        icon={Clock}
        color="text-destructive"
      />
    </div>
  );
}