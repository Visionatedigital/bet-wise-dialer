import { Phone, Clock, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Callback } from "@/hooks/useCallbacks";
import { formatDistanceToNow, isPast, isToday } from "date-fns";

interface CallbackCardProps {
  callback: Callback;
  isDragging?: boolean;
}

export function CallbackCard({ callback, isDragging }: CallbackCardProps) {
  const callbackDate = new Date(callback.scheduled_for);
  const isOverdue = isPast(callbackDate) && !isToday(callbackDate);
  const isUrgent = callback.priority === 'urgent' || isOverdue;

  const priorityColors = {
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    urgent: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const cardColor = isOverdue 
    ? 'border-red-500 bg-red-500/5' 
    : isUrgent 
    ? 'border-orange-500 bg-orange-500/5'
    : 'border-border';

  return (
    <Card 
      className={`p-4 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${cardColor} ${
        isDragging ? 'opacity-50 rotate-2' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">{callback.lead_name}</h4>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{callback.phone_number}</span>
          </div>
        </div>
        <Badge className={priorityColors[callback.priority]}>
          {callback.priority}
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-xs mt-3">
        {isOverdue ? (
          <div className="flex items-center gap-1 text-red-500">
            <AlertCircle className="h-3 w-3" />
            <span className="font-medium">Overdue</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(callbackDate, { addSuffix: true })}</span>
          </div>
        )}
      </div>

      {callback.notes && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {callback.notes}
        </p>
      )}
    </Card>
  );
}
