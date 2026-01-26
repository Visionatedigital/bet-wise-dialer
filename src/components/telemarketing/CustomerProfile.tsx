import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, User, Calendar, TrendingUp, DollarSign, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CallScriptViewer } from "./CallScriptViewer";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { CenterDialerModal } from "./CenterDialerModal";

interface TelemarketingLead {
    id: string;
    player_id: string;
    phone: string;
    player_name: string | null;
    vip_level: string | null;
    preferred_product: string | null;
    language_preference: string | null;
    status: string;
    priority: string;
    follow_up_at: string | null;
    last_outcome: string | null;
    notes: string | null;
    campaign: {
        name: string;
        code: string;
    };
}

interface CustomerDetails {
    player_id: string;
    phone: string;
    name: string;
    vip_level: string;
    current_balance: number;
    total_deposits: number;
    lifetime_value: number;
    days_inactive: number;
    preferred_product: string;
    last_login: string;
}

interface CustomerProfileProps {
    leadId: string;
    onClose: () => void;
    onNextLead?: () => void;
}

export function CustomerProfile({ leadId, onClose, onNextLead }: CustomerProfileProps) {
    const [lead, setLead] = useState<TelemarketingLead | null>(null);
    const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { startCall, isCallActive } = useSoftphone();
    const [showDialer, setShowDialer] = useState(false);

    useEffect(() => {
        loadLeadAndCustomer();
    }, [leadId]);

    const loadLeadAndCustomer = async () => {
        try {
            // Load lead from database
            const { data: leadData, error: leadError } = await supabase
                .from("leads")
                .select('*')
                .eq("id", leadId)
                .single();

            if (leadError) throw leadError;
            const row = leadData as any;

            // Map leads table to TelemarketingLead interface
            const mappedLead: TelemarketingLead = {
                id: row.id,
                player_id: row.id.substring(0, 8).toUpperCase(),
                phone: row.phone,
                player_name: row.name,
                vip_level: row.segment,
                preferred_product: row.intent,
                language_preference: "English", // Default
                status: row.status || "new",
                priority: row.priority,
                follow_up_at: row.next_action_due,
                last_outcome: row.last_activity,
                notes: null,
                campaign: {
                    name: row.campaign || "Unknown",
                    code: row.campaign_id || "GEN"
                }
            };

            setLead(mappedLead);

            // Fetch customer details from BangBet API (or mock)
            // We make this non-fatal because the UUID won't match mock API IDs
            try {
                const response = await supabase.functions.invoke("mock-bangbet-api", {
                    body: {
                        path: `/customers/${mappedLead.player_id}`, // This might fail if mock doesn't support generic IDs
                        method: "GET"
                    }
                });

                if (response.data?.customer) {
                    setCustomerDetails(response.data.customer);
                } else {
                    // Fallback mock stats if API fails
                    setCustomerDetails({
                        player_id: mappedLead.player_id,
                        phone: mappedLead.phone,
                        name: mappedLead.player_name || "Unknown",
                        vip_level: mappedLead.vip_level || "bronze",
                        current_balance: (leadData as any).last_deposit_ugx || 0,
                        total_deposits: ((leadData as any).last_deposit_ugx || 0) * 5, // Mock estimate
                        lifetime_value: ((leadData as any).last_deposit_ugx || 0) * 10,
                        days_inactive: 5,
                        preferred_product: mappedLead.preferred_product || "Sports",
                        last_login: new Date().toISOString()
                    });
                }
            } catch (apiError) {
                console.warn("API load failed, using fallback data:", apiError);
                // Fallback mock stats
                setCustomerDetails({
                    player_id: mappedLead.player_id,
                    phone: mappedLead.phone,
                    name: mappedLead.player_name || "Unknown",
                    vip_level: mappedLead.vip_level || "bronze",
                    current_balance: (leadData as any).last_deposit_ugx || 0,
                    total_deposits: ((leadData as any).last_deposit_ugx || 0) * 5,
                    lifetime_value: ((leadData as any).last_deposit_ugx || 0) * 10,
                    days_inactive: 5,
                    preferred_product: mappedLead.preferred_product || "Sports",
                    last_login: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error("Error loading customer:", error);
            toast({
                title: "Error",
                description: "Failed to load lead details",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCall = () => {
        if (!lead) return;
        setShowDialer(true);
    };

    if (loading) {
        return <div className="p-6">Loading...</div>;
    }

    if (!lead) {
        return <div className="p-6">Lead not found</div>;
    }

    const vipColor = {
        platinum: "bg-purple-500",
        gold: "bg-yellow-500",
        silver: "bg-gray-400",
        bronze: "bg-orange-600"
    }[lead.vip_level || "bronze"] || "bg-gray-500";

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold">{lead.player_name || "Unknown"}</h2>
                    <p className="text-muted-foreground">{lead.player_id}</p>
                </div>
                <div className="flex gap-2">
                    <Badge className={vipColor}>{lead.vip_level?.toUpperCase()}</Badge>
                    <Badge variant="outline">{lead.status}</Badge>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
                <Button
                    onClick={handleCall}
                    className="flex-1 bg-[#FFDE00] hover:bg-[#FFDE00]/90 text-black font-bold"
                >
                    <Phone className="mr-2 h-4 w-4" />
                    Call Now
                </Button>
                <Button variant="outline" onClick={onClose}>
                    Close
                </Button>
            </div>

            {/* Tabs for Profile and Call Script */}
            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="profile">Customer Profile</TabsTrigger>
                    <TabsTrigger value="script">Call Script</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4">
                    {/* Contact Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Phone:</span>
                                {/* Masked Phone Number */}
                                <span className="font-medium">
                                    {lead.phone.length > 6
                                        ? `${lead.phone.substring(0, 4)} **** ${lead.phone.substring(lead.phone.length - 2)}`
                                        : lead.phone}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Language:</span>
                                <span className="font-medium capitalize">{lead.language_preference || "English"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Priority:</span>
                                <Badge variant={lead.priority === "high" ? "destructive" : "secondary"}>
                                    {lead.priority}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Customer Analysis */}
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
                                <TrendingUp className="h-4 w-4" />
                                AI Customer Analysis
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm italic text-muted-foreground">
                                {customerDetails
                                    ? `This customer is a ${customerDetails.vip_level} user with a high lifetime value of ${customerDetails.lifetime_value.toLocaleString()} UGX. They prefer ${customerDetails.preferred_product} and have been inactive for ${customerDetails.days_inactive} days. Suggest checking in on their recent withdrawal satisfaction or offering a ${customerDetails.preferred_product} bonus.`
                                    : "AI is analyzing customer betting patterns..."}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    {lead.notes && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm">{lead.notes}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Last Outcome */}
                    {lead.last_outcome && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Last Outcome</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm">{lead.last_outcome}</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="script">
                    <CallScriptViewer
                        leadName={customerDetails?.name || lead.player_name || "Customer"}
                        vipLevel={customerDetails?.vip_level || lead.vip_level}
                        preferredProduct={customerDetails?.preferred_product || lead.preferred_product}
                        campaignType={lead.campaign?.code || "VIP_DORMANT"}
                        lastObjective={lead.last_outcome}
                    />
                </TabsContent>

            </Tabs>


            {/* Center Dialer Modal */}
            <CenterDialerModal
                isOpen={showDialer}
                onClose={() => setShowDialer(false)}
                leadName={lead.player_name || "Unknown"}
                phoneNumber={lead.phone}
                leadId={lead.player_id}
                leadDbId={lead.id}
                onFeedbackSuccess={() => {
                    setShowDialer(false);
                    if (onNextLead) {
                        // Small delay for UX transition
                        setTimeout(() => onNextLead(), 300);
                    } else {
                        onClose();
                    }
                }}
            />
        </div >
    );
}
