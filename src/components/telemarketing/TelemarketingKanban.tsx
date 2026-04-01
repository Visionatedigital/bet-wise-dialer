import { useState, useEffect, useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, User, Calendar, Filter, Sparkles, MessageSquare } from "lucide-react";
import { CustomerProfile } from "./CustomerProfile";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MOCK_TELEMARKETING_LEADS } from "@/data/mockTelemarketingLeads";
import { Softphone } from "@/components/dashboard/Softphone";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import {
    DndContext,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    defaultDropAnimationSideEffects,
    DropAnimation,
    DragOverlay,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TelemarketingLead {
    id: string;
    player_id: string;
    phone: string;
    player_name: string | null;
    vip_level: string | null;
    preferred_product: string | null;
    status: string;
    priority: string;
    follow_up_at: string | null;
    next_action: string | null;
    notes: string | null;
    betting_habits: {
        favorite_sport?: string;
        favorite_teams?: string[];
        casino_favorite?: string;
    } | null;
    trait?: string | null;
}


const KANBAN_COLUMNS = [
    { id: "unassigned", title: "Unassigned", color: "bg-blue-50 text-blue-700 border-blue-100" },
    { id: "unreachable", title: "Unreachable", color: "bg-red-50 text-red-700 border-red-100" },
    { id: "not_interested", title: "Not Interested", color: "bg-slate-50 text-slate-600 border-slate-100" },
    { id: "interested", title: "Interested", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    { id: "no_answer", title: "No Answer", color: "bg-amber-50 text-amber-700 border-amber-100" }
];

const DUMMY_TRAITS = [
    "Casino Player 🎰",
    "Aviator Player 🚀",
    "Man Utd Fan 👹",
    "Arsenal Fan 🔫",
    "Chelsea Fan 🦁",
    "High Roller 💎",
    "Bonus Hunter 🎁",
    "Daily Bettor 📅",
    "Liverpool Fan 🔴",
    "Real Madrid Fan ⚪"
];

const getFallbackTrait = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return DUMMY_TRAITS[Math.abs(hash) % DUMMY_TRAITS.length];
};

export function TelemarketingKanban() {
    const [leads, setLeads] = useState<TelemarketingLead[]>([]);
    const [selectedLead, setSelectedLead] = useState<string | null>(null);
    const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { showSoftphone } = useSoftphone();
    const { toast } = useToast();

    const mapLead = (lead: any): TelemarketingLead => {
        return {
            id: lead.id,
            player_id: lead.id.substring(0, 8).toUpperCase(),
            phone: lead.phone,
            player_name: lead.name,
            vip_level: lead.segment,
            preferred_product: lead.intent || 'Sports',
            status: lead.status || '',
            priority: lead.priority,
            follow_up_at: lead.next_action_due,
            next_action: lead.next_action,
            notes: lead.last_activity,
            betting_habits: {
                favorite_teams: [],
                casino_favorite: null
            },
            trait: lead.trait || getFallbackTrait(lead.id)
        };
    };

    useEffect(() => {
        loadLeads();

        const subscription = supabase
            .channel("leads_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "leads"
                },
                (payload) => {
                    console.log("Real-time update received!", payload);
                    if (payload.eventType === 'UPDATE') {
                        setLeads(prev => prev.map(lead =>
                            lead.id === payload.new.id ? mapLead(payload.new) : lead
                        ));
                    } else if (payload.eventType === 'INSERT') {
                        setLeads(prev => [mapLead(payload.new), ...prev].slice(0, 200));
                    } else if (payload.eventType === 'DELETE') {
                        setLeads(prev => prev.filter(lead => lead.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const loadLeads = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;

            if (!data || data.length === 0) {
                console.log("No leads from Supabase, using mock data");
                setLeads(MOCK_TELEMARKETING_LEADS.map(l => ({ ...l, status: l.status || '', next_action: null })));
            } else {
                setLeads(data.map(mapLead));
            }
        } catch (error) {
            console.error("Error loading leads:", error);
            toast({
                title: "Error",
                description: "Failed to load leads",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    // Remove leadsByStatus function as it's now handled by useMemo grouping logic below

    const groupedLeads = useMemo(() => {
        const grouped: Record<string, TelemarketingLead[]> = {
            unassigned: [],
            unreachable: [],
            not_interested: [],
            interested: [],
            no_answer: []
        };

        leads.forEach(lead => {
            let status = lead.status;

            // Map common status variants to our columns
            if (!status || status === '' || status === 'unassigned' || status === 'pending') {
                status = 'unassigned';
            } else if (status === 'called_no_answer') {
                status = 'no_answer';
            }

            if (grouped[status]) {
                grouped[status].push(lead);
            } else {
                // Default fallback
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

    const handleDragEnd = async (event: DragEndEvent) => {
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
            // If dropped over a card, find that card's column
            const overLead = leads.find(l => l.id === overId);
            if (overLead) {
                newStatus = overLead.status || 'unassigned';
            }
        }

        // If status hasn't changed, don't update
        const currentStatus = lead.status || 'unassigned';
        if (newStatus === currentStatus) return;

        console.log(`[Kanban] Moving lead ${activeId} from ${currentStatus} to ${newStatus}`);

        // Optimistically update local state
        setLeads(prev => prev.map(l =>
            l.id === activeId ? { ...l, status: newStatus === 'unassigned' ? '' : newStatus } : l
        ));

        // Update Supabase
        try {
            const { error } = await supabase
                .from('leads')
                .update({ status: newStatus === 'unassigned' ? null : newStatus } as any)
                .eq('id', activeId as any);

            if (error) throw error;
            toast({
                title: "Status Updated",
                description: `Lead moved to ${newStatus.replace('_', ' ')}`,
            });
        } catch (error) {
            console.error("Error updating lead status:", error);
            // Revert on error
            setLeads(prev => prev.map(l =>
                l.id === activeId ? { ...l, status: currentStatus === 'unassigned' ? '' : currentStatus } : l
            ));
            toast({
                title: "Error",
                description: "Failed to update lead status",
                variant: "destructive"
            });
        }
    };

    const handleNextLead = () => {
        if (!selectedLead) return;
        const currentIndex = leads.findIndex(l => l.id === selectedLead);
        if (currentIndex !== -1 && currentIndex < leads.length - 1) {
            setSelectedLead(leads[currentIndex + 1].id);
        } else {
            toast({
                title: "Queue Completed",
                description: "You have reached the end of the current list.",
            });
            setSelectedLead(null);
        }
    };

    if (loading) {
        return <div className="p-6">Loading leads...</div>;
    }

    return (
        <>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-end">
                    <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter
                    </Button>
                </div>

                <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
                    {/* Kanban Columns - Scrollable */}
                    <div className={`${showSoftphone ? 'col-span-9' : 'col-span-12'} overflow-x-auto pb-4 transition-all duration-300 scrollbar-hide`}>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="flex gap-4 min-w-max h-full">
                                {KANBAN_COLUMNS.map(column => (
                                    <div key={column.id} className="w-64 flex flex-col h-full">
                                        <div className={`mb-4 py-2 px-4 rounded-xl border ${column.color} flex items-center justify-between shrink-0 shadow-sm`}>
                                            <span className="text-xs font-bold uppercase tracking-wider">
                                                {column.title}
                                            </span>
                                            <Badge variant="outline" className="ml-2 bg-white/50 border-none font-bold">
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
                                                className="space-y-2 overflow-y-auto flex-1 pr-1 min-h-[100px] scrollbar-hide"
                                            >
                                                {(groupedLeads[column.id] || []).map(lead => (
                                                    <LeadCard
                                                        key={lead.id}
                                                        lead={lead}
                                                        onClick={() => setSelectedLead(lead.id)}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </div>
                                ))}
                            </div>

                            <DragOverlay dropAnimation={{
                                duration: 250,
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
                                    <div className="w-60">
                                        <LeadCard lead={activeLead} onClick={() => { }} isOverlay />
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    </div>

                    {/* Right Sidebar - Sticky Softphone - Conditionally Shown */}
                    {showSoftphone && (
                        <div className="col-span-3 animate-in slide-in-from-right duration-300">
                            <div className="sticky top-0 space-y-4">
                                <Softphone />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogTitle className="sr-only">Customer Profile</DialogTitle>
                    <DialogDescription className="sr-only">
                        Detailed view of the customer profile and betting habits
                    </DialogDescription>
                    {selectedLead && (
                        <CustomerProfile
                            leadId={selectedLead}
                            onClose={() => setSelectedLead(null)}
                            onNextLead={handleNextLead}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

interface LeadCardProps {
    lead: TelemarketingLead;
    onClick: () => void;
    isOverlay?: boolean;
}

const LeadCard = memo(({ lead, onClick, isOverlay }: LeadCardProps) => {
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

    // Map priority to Lead Strength (Hot/Warm/Cold)
    const getLeadStrength = (priority: string | null) => {
        if (!priority) return null;
        switch (priority.toLowerCase()) {
            case 'high': return { label: 'HOT', color: 'bg-red-500' };
            case 'medium': return { label: 'WARM', color: 'bg-orange-500' };
            case 'low': return { label: 'COLD', color: 'bg-blue-400' };
            default: return null;
        }
    };

    const strength = getLeadStrength(lead.priority);

    // Mask phone number for data protection (show only last 4 digits)
    const maskPhoneNumber = (phone: string) => {
        if (!phone) return "****";
        const lastFour = phone.slice(-4);
        return `***${lastFour}`;
    };

    // Get personalization preview
    const getPersonalizationPreview = () => {
        if (!lead.betting_habits) return null;

        if (lead.betting_habits.favorite_teams?.length > 0) {
            return `⚽ ${lead.betting_habits.favorite_teams[0]} fan`;
        }
        if (lead.betting_habits.casino_favorite) {
            return `🎰 ${lead.betting_habits.casino_favorite} player`;
        }
        if (lead.betting_habits.favorite_sport) {
            return `🏆 ${lead.betting_habits.favorite_sport} bettor`;
        }
        return null;
    };

    const personalizationPreview = getPersonalizationPreview();

    const getStatusColors = (status: string | null) => {
        const s = status?.toLowerCase() || 'unassigned';
        switch (s) {
            case 'unassigned':
            case 'pending':
            case '':
                return "bg-blue-50/80 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40";
            case 'unreachable':
                return "bg-red-50/80 border-red-100 dark:bg-red-950/20 dark:border-red-900/40";
            case 'not_interested':
                return "bg-slate-50/80 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800/40";
            case 'interested':
                return "bg-emerald-50/80 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40";
            case 'no_answer':
            case 'called_no_answer':
                return "bg-amber-50/80 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40";
            default:
                return "bg-blue-50/80 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40";
        }
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={cn(
                "cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-200 overflow-hidden border-2",
                getStatusColors(lead.status),
                isDragging ? 'shadow-2xl scale-105 opacity-50 border-primary ring-2 ring-primary/20' : ''
            )}
            onClick={(e) => {
                // Prevent click when dragging
                if (isDragging) return;
                onClick();
            }}
        >
            <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold text-sm tracking-tight">
                            Customer
                        </span>
                    </div>
                    {strength && lead.status === 'interested' && (
                        <Badge className={`${strength.color} text-xs`}>
                            {strength.label}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                    <Phone className="h-3 w-3" />
                    <span>{maskPhoneNumber(lead.phone)}</span>
                </div>

                {personalizationPreview && (
                    <div className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        {personalizationPreview}
                    </div>
                )}

                {(lead.trait || lead.vip_level) && (
                    <div className="flex items-center gap-2 mt-2">
                        {lead.vip_level && (
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 border-slate-200 px-2 py-0.5">
                                {lead.vip_level}
                            </Badge>
                        )}
                        {lead.trait && (
                            <Badge variant="outline" className="text-[10px] font-bold bg-green-100 text-green-800 border-green-200 px-3 py-1 rounded-full shadow-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                {lead.trait}
                            </Badge>
                        )}
                    </div>
                )}

                {lead.preferred_product && !personalizationPreview && !lead.trait && (
                    <Badge variant="outline" className="text-xs">
                        {lead.preferred_product}
                    </Badge>
                )}

                {(lead.next_action || lead.notes) && (
                    <div className="mt-2 rounded-lg border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-black/20 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50">
                        {lead.next_action && (
                            <div className="p-2 space-y-1.5 bg-blue-50/30 dark:bg-blue-900/10">
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    AI Strategy
                                </div>
                                <p className="text-[10px] leading-tight text-slate-700 dark:text-slate-300 italic font-medium line-clamp-2">
                                    "{lead.next_action}"
                                </p>
                            </div>
                        )}
                        {lead.notes && (
                            <div className="p-2 space-y-1">
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <MessageSquare className="h-2.5 w-2.5" />
                                    Last Note
                                </div>
                                <p className="text-[10px] leading-tight text-slate-600 dark:text-slate-400 line-clamp-1">
                                    {lead.notes}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {lead.follow_up_at && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-muted/20">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(lead.follow_up_at).toLocaleDateString()}</span>
                    </div>
                )}
            </CardContent>
        </Card >
    );
});
