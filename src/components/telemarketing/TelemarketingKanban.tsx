import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, User, Calendar, Filter } from "lucide-react";
import { CustomerProfile } from "./CustomerProfile";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MOCK_TELEMARKETING_LEADS } from "@/data/mockTelemarketingLeads";
import { Softphone } from "@/components/dashboard/Softphone";
import { useSoftphone } from "@/contexts/SoftphoneContext";

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
    notes: string | null;
    betting_habits: {
        favorite_sport?: string;
        favorite_teams?: string[];
        casino_favorite?: string;
    } | null;
}


const KANBAN_COLUMNS = [
    { id: "unreachable", title: "Unreachable", color: "bg-red-500" },
    { id: "not_interested", title: "Not Interested", color: "bg-gray-500" }, // Changed color to gray for better contrast
    { id: "interested", title: "Interested", color: "bg-green-500" },
    { id: "no_answer", title: "No Answer", color: "bg-yellow-500" }
];

export function TelemarketingKanban() {
    const [leads, setLeads] = useState<TelemarketingLead[]>([]);
    const [selectedLead, setSelectedLead] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { showSoftphone } = useSoftphone();
    const { toast } = useToast();

    useEffect(() => {
        loadLeads();

        // Subscribe to real-time updates
        const subscription = supabase
            .channel("leads_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "leads"
                },
                () => {
                    console.log("Real-time update received!");
                    loadLeads();
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
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedLeads: TelemarketingLead[] = (data || []).map((lead: any) => ({
                id: lead.id,
                player_id: lead.id.substring(0, 8).toUpperCase(), // Generate a short ID
                phone: lead.phone,
                player_name: lead.name,
                vip_level: lead.segment,
                preferred_product: lead.intent || 'Sports',
                status: lead.status || '', // Only show if status is set
                priority: lead.priority, // Don't default to 'medium', allow null for no strength
                follow_up_at: lead.next_action_due,
                notes: null, // Notes are in call activities
                betting_habits: {
                    favorite_sport: "Football",
                    favorite_teams: [],
                    casino_favorite: null
                }
            }));

            setLeads(mappedLeads);
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

    const getLeadsByStatus = (status: string) => {
        return leads.filter(lead => lead.status === status);
    };

    if (loading) {
        return <div className="p-6">Loading leads...</div>;
    }

    return (
        <>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight font-serif">Kanban Board</h1>
                        <p className="text-muted-foreground">
                            Manage your telemarketing leads • {new Date().toLocaleDateString('en-UG', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                timeZone: 'Africa/Kampala'
                            })}
                        </p>
                    </div>
                    <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter
                    </Button>
                </div>

                <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
                    {/* Kanban Columns - Scrollable */}
                    <div className={`${showSoftphone ? 'col-span-9' : 'col-span-12'} overflow-x-auto pb-4 transition-all duration-300`}>
                        <div className="flex gap-4 min-w-max h-full">
                            {KANBAN_COLUMNS.map(column => (
                                <div key={column.id} className="w-80 flex flex-col h-full">
                                    <Card className="mb-2 shrink-0">
                                        <CardHeader className={`${column.color} text-white py-3`}>
                                            <CardTitle className="text-sm font-medium">
                                                {column.title}
                                                <Badge variant="secondary" className="ml-2">
                                                    {getLeadsByStatus(column.id).length}
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                    </Card>

                                    <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                                        {getLeadsByStatus(column.id).map(lead => (
                                            <LeadCard
                                                key={lead.id}
                                                lead={lead}
                                                onClick={() => setSelectedLead(lead.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
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
}

function LeadCard({ lead, onClick }: LeadCardProps) {
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

    return (
        <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={onClick}
        >
            <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm font-mono">
                            {lead.player_id}
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

                {lead.preferred_product && !personalizationPreview && (
                    <Badge variant="outline" className="text-xs">
                        {lead.preferred_product}
                    </Badge>
                )}

                {lead.follow_up_at && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(lead.follow_up_at).toLocaleDateString()}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
