import { TrendingUp, Phone, Target, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatUGX } from "@/data/sampleData";
import { useCallMetrics } from "@/hooks/useCallMetrics";

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
  const { 
    todayMetrics, 
    yesterdayMetrics, 
    loading, 
    getPercentageChange, 
    formatDuration, 
    getAverageHandleTime 
  } = useCallMetrics();

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent className="animate-pulse">
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-2 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const avgHandleTimeToday = getAverageHandleTime(todayMetrics);
  const avgHandleTimeYesterday = getAverageHandleTime(yesterdayMetrics);

  // Use real data for KPIs
  const kpis = {
    callsMade: { 
      value: todayMetrics?.calls_made || 0, 
      target: 60, 
      change: getPercentageChange(todayMetrics?.calls_made || 0, yesterdayMetrics?.calls_made || 0) >= 0 
        ? `+${getPercentageChange(todayMetrics?.calls_made || 0, yesterdayMetrics?.calls_made || 0)}%`
        : `${getPercentageChange(todayMetrics?.calls_made || 0, yesterdayMetrics?.calls_made || 0)}%`
    },
    connects: { 
      value: todayMetrics?.connects || 0, 
      target: 40, 
      change: getPercentageChange(todayMetrics?.connects || 0, yesterdayMetrics?.connects || 0) >= 0 
        ? `+${getPercentageChange(todayMetrics?.connects || 0, yesterdayMetrics?.connects || 0)}%`
        : `${getPercentageChange(todayMetrics?.connects || 0, yesterdayMetrics?.connects || 0)}%`
    },
    avgHandleTime: { 
      value: formatDuration(avgHandleTimeToday), 
      target: undefined,
      change: avgHandleTimeToday === 0 && avgHandleTimeYesterday === 0 
        ? undefined 
        : (getPercentageChange(avgHandleTimeYesterday, avgHandleTimeToday) <= 0 ? "-" : "+") + 
          Math.abs(avgHandleTimeToday - avgHandleTimeYesterday) + "s"
    },
    conversions: { 
      value: todayMetrics?.conversions || 0, 
      target: 12, 
      change: getPercentageChange(todayMetrics?.conversions || 0, yesterdayMetrics?.conversions || 0) >= 0 
        ? `+${getPercentageChange(todayMetrics?.conversions || 0, yesterdayMetrics?.conversions || 0)}%`
        : `${getPercentageChange(todayMetrics?.conversions || 0, yesterdayMetrics?.conversions || 0)}%`
    },
    depositValue: { 
      value: todayMetrics?.total_deposit_value || 0, 
      target: 3000000, 
      change: getPercentageChange(todayMetrics?.total_deposit_value || 0, yesterdayMetrics?.total_deposit_value || 0) >= 0 
        ? `+${getPercentageChange(todayMetrics?.total_deposit_value || 0, yesterdayMetrics?.total_deposit_value || 0)}%`
        : `${getPercentageChange(todayMetrics?.total_deposit_value || 0, yesterdayMetrics?.total_deposit_value || 0)}%`
    },
    callbacksDue: { 
      value: todayMetrics?.callbacks_due || 0, 
      target: undefined, 
      change: (todayMetrics?.callbacks_due || 0) - (yesterdayMetrics?.callbacks_due || 0) === 0 
        ? undefined 
        : ((todayMetrics?.callbacks_due || 0) - (yesterdayMetrics?.callbacks_due || 0) >= 0 ? "+" : "") + 
          ((todayMetrics?.callbacks_due || 0) - (yesterdayMetrics?.callbacks_due || 0))
    }
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