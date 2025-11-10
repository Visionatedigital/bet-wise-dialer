import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CallbackCard } from "./CallbackCard";
import { Callback } from "@/hooks/useCallbacks";

interface SortableCallbackCardProps {
  callback: Callback;
}

export function SortableCallbackCard({ callback }: SortableCallbackCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: callback.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CallbackCard callback={callback} isDragging={isDragging} />
    </div>
  );
}
