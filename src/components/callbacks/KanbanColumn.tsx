import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SortableCallbackCard } from "./SortableCallbackCard";
import { Callback } from "@/hooks/useCallbacks";

interface KanbanColumnProps {
  id: string;
  title: string;
  callbacks: Callback[];
  color: string;
}

export function KanbanColumn({ id, title, callbacks, color }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <Card className={`p-4 min-h-[500px] ${isOver ? 'bg-accent/50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          {title}
        </h3>
        <Badge variant="secondary">{callbacks.length}</Badge>
      </div>

      <div ref={setNodeRef} className="space-y-3 min-h-[400px]">
        <SortableContext items={callbacks.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {callbacks.map((callback) => (
            <SortableCallbackCard key={callback.id} callback={callback} />
          ))}
        </SortableContext>

        {callbacks.length === 0 && (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            No callbacks
          </div>
        )}
      </div>
    </Card>
  );
}
