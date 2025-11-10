import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { useState, useMemo, useEffect } from "react";
import { KanbanColumn } from "@/components/callbacks/KanbanColumn";
import { CallbackCard } from "@/components/callbacks/CallbackCard";
import { useCallbacks, Callback } from "@/hooks/useCallbacks";
import { startOfDay, addDays, addWeeks, isWithinInterval, isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { Bell } from "lucide-react";

export default function Callbacks() {
  const { callbacks, loading, updateCallback } = useCallbacks();
  const [activeCallback, setActiveCallback] = useState<Callback | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);

  // Check for overdue callbacks and show notifications
  useEffect(() => {
    const overdue = callbacks.filter(c => 
      isPast(new Date(c.scheduled_for)) && !isToday(new Date(c.scheduled_for))
    );
    
    if (overdue.length > overdueCount && overdueCount > 0) {
      toast.error(`You have ${overdue.length} overdue callback(s)!`, {
        icon: <Bell className="h-4 w-4" />,
        duration: 5000,
      });
    }
    
    setOverdueCount(overdue.length);
  }, [callbacks]);

  const columns = useMemo(() => {
    const today = startOfDay(new Date());
    const endOfToday = addDays(today, 1);
    const endOfWeek = addDays(today, 7);
    const endOfNextWeek = addWeeks(today, 2);

    return {
      today: callbacks.filter(c => {
        const date = new Date(c.scheduled_for);
        return isWithinInterval(date, { start: today, end: endOfToday }) || 
               (isPast(date) && !isToday(date));
      }),
      thisWeek: callbacks.filter(c => {
        const date = new Date(c.scheduled_for);
        return isWithinInterval(date, { start: endOfToday, end: endOfWeek });
      }),
      nextWeek: callbacks.filter(c => {
        const date = new Date(c.scheduled_for);
        return isWithinInterval(date, { start: endOfWeek, end: endOfNextWeek });
      }),
      later: callbacks.filter(c => {
        const date = new Date(c.scheduled_for);
        return date >= endOfNextWeek;
      }),
    };
  }, [callbacks]);

  const handleDragStart = (event: DragStartEvent) => {
    const callback = callbacks.find(c => c.id === event.active.id);
    setActiveCallback(callback || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveCallback(null);
      return;
    }

    const callback = callbacks.find(c => c.id === active.id);
    if (!callback) return;

    const columnId = over.id as string;
    const today = startOfDay(new Date());
    
    let newDate: Date;
    switch (columnId) {
      case 'today':
        newDate = today;
        break;
      case 'thisWeek':
        newDate = addDays(today, 3);
        break;
      case 'nextWeek':
        newDate = addWeeks(today, 1);
        break;
      case 'later':
        newDate = addWeeks(today, 3);
        break;
      default:
        return;
    }

    await updateCallback(callback.id, {
      scheduled_for: newDate.toISOString(),
      status: 'rescheduled',
    });

    setActiveCallback(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Smart Callback Board</h1>
        <p className="text-muted-foreground">
          Drag and drop callbacks to reschedule them across different time periods
        </p>
        {overdueCount > 0 && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500">
            <Bell className="h-5 w-5" />
            <span className="font-medium">You have {overdueCount} overdue callback(s)</span>
          </div>
        )}
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KanbanColumn 
            id="today" 
            title="Today & Overdue" 
            callbacks={columns.today}
            color="bg-red-500"
          />
          <KanbanColumn 
            id="thisWeek" 
            title="This Week" 
            callbacks={columns.thisWeek}
            color="bg-orange-500"
          />
          <KanbanColumn 
            id="nextWeek" 
            title="Next Week" 
            callbacks={columns.nextWeek}
            color="bg-yellow-500"
          />
          <KanbanColumn 
            id="later" 
            title="Follow-up Later" 
            callbacks={columns.later}
            color="bg-blue-500"
          />
        </div>

        <DragOverlay>
          {activeCallback ? <CallbackCard callback={activeCallback} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
