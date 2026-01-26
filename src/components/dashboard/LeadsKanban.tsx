import { useState, useMemo, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, User, Calendar } from "lucide-react";
import { type Lead } from "@/types/lead";
import {
    DndContext,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    defaultDropAnimationSideEffects,
    DragOverlay,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LeadsKanbanProps {
    leads: Lead[];
    onStatusChange: (leadId: string, newStatus: string) => void;
    onSelectLead: (lead: Lead) => void;
    selectedLeadId?: string;
}

const KANBAN_COLUMNS = [
    { id: "unassigned", title: "Unassigned", color: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50" },
    { id: "no_answer", title: "No Answer", color: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50" },
    { id: "unreachable", title: "Unreachable", color: "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50" },
    { id: "interested", title: "Interested", color: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" },
    { id: "not_interested", title: "Not Interested", color: "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800/50" }
];

export function LeadsKanban({ leads, onStatusChange, onSelectLead, selectedLeadId }: LeadsKanbanProps) {
    const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

    const groupedLeads = useMemo(() => {
        const grouped: Record<string, Lead[]> = {
            unassigned: [],
            no_answer: [],
            unreachable: [],
            interested: [],
            not_interested: []
        };

        leads.forEach(lead => {
            let status = lead.status?.toLowerCase() || 'unassigned';

            // Map legacy or variant statuses
            if (status === '' || status === 'pending') status = 'unassigned';
            if (status === 'called_no_answer') status = 'no_answer';

            if (grouped[status]) {
                grouped[status].push(lead);
            } else {
                grouped['unassigned'].push(lead);
            }
        });
        return grouped;
    }, [leads]);

    const activeLead = useMemo(() =>
        activeLeadId ? leads.find(l => l.id === activeLeadId) : null
        , [activeLeadId, leads]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveLeadId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveLeadId(null);
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Find the lead being dragged
        const lead = leads.find(l => l.id === activeId);
        if (!lead) return;

        // Check if over a column or another card
        let newStatus = overId;
        if (!KANBAN_COLUMNS.find(c => c.id === overId)) {
            const overLead = leads.find(l => l.id === overId);
            if (overLead) {
                newStatus = overLead.status || 'unassigned';
            }
        }

        const currentStatus = lead.status || 'unassigned';
        if (newStatus === currentStatus) return;

        onStatusChange(activeId, newStatus);
    };

    return (
        <div className="h-full overflow-hidden flex flex-col">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex gap-4 overflow-x-auto pb-4 h-full">
                    {KANBAN_COLUMNS.map(column => (
                        <div key={column.id} className="w-80 flex flex-col h-full shrink-0">
                            <div className={`mb-3 py-2.5 px-4 rounded-lg border ${column.color} flex items-center justify-between shrink-0 shadow-sm`}>
                                <span className="text-xs font-bold uppercase tracking-wider">
                                    {column.title}
                                </span>
                                <Badge variant="secondary" className="h-6 px-2 text-xs bg-white/50 dark:bg-black/20 border-none font-bold">
                                    {groupedLeads[column.id]?.length || 0}
                                </Badge>
                            </div>

                            <SortableContext
                                id={column.id}
                                items={(groupedLeads[column.id] || []).map(l => l.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div
                                    id={column.id}
                                    className="space-y-2 overflow-y-auto flex-1 pr-1 min-h-[100px] scrollbar-hide pb-20"
                                >
                                    {(groupedLeads[column.id] || []).map(lead => (
                                        <LeadCard
                                            key={lead.id}
                                            lead={lead}
                                            onClick={() => onSelectLead(lead)}
                                            isSelected={selectedLeadId === lead.id}
                                        />
                                    ))}
                                    {groupedLeads[column.id]?.length === 0 && (
                                        <div className="h-24 border-2 border-dashed border-muted rounded-xl flex items-center justify-center text-muted-foreground text-xs">
                                            Drop leads here
                                        </div>
                                    )}
                                </div>
                            </SortableContext>
                        </div>
                    ))}
                </div>

                <DragOverlay dropAnimation={{
                    duration: 200,
                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                            active: {
                                opacity: '0.4',
                            },
                        },
                    }),
                }}>
                    {activeLead ? (
                        <div className="w-80">
                            <LeadCard lead={activeLead} onClick={() => { }} isOverlay />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

interface LeadCardProps {
    lead: Lead;
    onClick: () => void;
    isOverlay?: boolean;
    isSelected?: boolean;
}

const LeadCard = memo(({ lead, onClick, isOverlay, isSelected }: LeadCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: lead.id,
        disabled: isOverlay
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.3 : 1,
        zIndex: isDragging ? 50 : 1,
    };

    const getPriorityColor = (priority: string | null) => {
        if (!priority) return "bg-slate-500";
        switch (priority.toLowerCase()) {
            case 'high': return "bg-red-500";
            case 'medium': return "bg-orange-500";
            case 'low': return "bg-emerald-500";
            default: return "bg-slate-500";
        }
    };

    // Mask phone number for data protection (show only last 4 digits)
    const maskPhoneNumber = (phone: string) => {
        if (!phone) return "****";
        const clean = phone.replace(/[^0-9]/g, '');
        const lastFour = clean.slice(-4);
        return `***${lastFour}`;
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 overflow-hidden border-2 rounded-xl ${isSelected ? 'border-primary ring-2 ring-primary/10' : 'border-border/50'
                } ${isDragging ? 'shadow-xl scale-105' : ''}`}
            onClick={(e) => {
                if (isDragging) return;
                onClick();
            }}
        >
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${getPriorityColor(lead.priority)}`} />
                        <span className="font-bold text-sm truncate">
                            {lead.name}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{maskPhoneNumber(lead.phone)}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                    {lead.segment && (
                        <Badge variant="outline" className="text-[10px] px-1.5 h-5 uppercase font-bold text-muted-foreground border-muted-foreground/20">
                            {lead.segment}
                        </Badge>
                    )}
                    {lead.trait && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-green-50 text-green-700 border-green-200 font-semibold">
                            {lead.trait}
                        </Badge>
                    )}
                </div>

                {lead.nextActionDue && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-2.5 border-t border-muted/30">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(lead.nextActionDue).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
});
