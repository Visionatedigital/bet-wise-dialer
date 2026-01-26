import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Phone, Search, Users, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CustomerProfile } from "@/components/telemarketing/CustomerProfile";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Lead {
    id: string;
    name: string;
    phone: string;
    segment: string | null;
    trait: string | null;
    status: string | null;
    priority: string | null;
}

export default function Kanban() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();

    const loadLeads = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('leads')
                .select('id, name, phone, segment, trait, status, priority')
                .order('created_at', { ascending: false })
                .limit(500);

            if (error) throw error;

            setLeads(data || []);
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

    useEffect(() => {
        loadLeads();
    }, []);

    // Filter leads based on search
    const filteredLeads = leads.filter(lead => {
        const query = searchQuery.toLowerCase();
        return (
            (lead.name?.toLowerCase() || '').includes(query) ||
            (lead.phone?.toLowerCase() || '').includes(query) ||
            (lead.segment?.toLowerCase() || '').includes(query) ||
            (lead.trait?.toLowerCase() || '').includes(query)
        );
    });

    const maskPhoneNumber = (phone: string) => {
        if (!phone) return "****";
        const clean = phone.replace(/[^0-9]/g, '');
        const lastFour = clean.slice(-4);
        return `***${lastFour}`;
    };

    const getStatusColor = (status: string | null) => {
        switch (status?.toLowerCase()) {
            case 'interested': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'not_interested': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'unreachable': return 'bg-red-100 text-red-700 border-red-200';
            case 'no_answer': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    const getPriorityColor = (priority: string | null) => {
        switch (priority?.toLowerCase()) {
            case 'high': return 'bg-red-500';
            case 'medium': return 'bg-orange-500';
            case 'low': return 'bg-emerald-500';
            default: return 'bg-slate-400';
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-xl">
                            <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
                            <p className="text-sm text-muted-foreground">
                                {filteredLeads.length} leads assigned to you
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search leads..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 w-64"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={loadLeads} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Trait</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                Loading leads...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLeads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No leads found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLeads.map((lead) => (
                                        <TableRow
                                            key={lead.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => setSelectedLeadId(lead.id)}
                                        >
                                            <TableCell>
                                                <div className={`h-2.5 w-2.5 rounded-full ${getPriorityColor(lead.priority)}`} />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {lead.name || 'Customer'}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-muted-foreground">
                                                {maskPhoneNumber(lead.phone)}
                                            </TableCell>
                                            <TableCell>
                                                {lead.segment && (
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                                        {lead.segment}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {lead.trait && (
                                                    <Badge variant="secondary" className="text-[10px] font-bold bg-green-50 text-green-700 border-green-200">
                                                        {lead.trait}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`text-[10px] font-bold border ${getStatusColor(lead.status)}`}>
                                                    {lead.status?.replace('_', ' ') || 'Unassigned'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-3"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedLeadId(lead.id);
                                                    }}
                                                >
                                                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Customer Profile Modal */}
            <Dialog open={!!selectedLeadId} onOpenChange={() => setSelectedLeadId(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
                    <DialogTitle className="sr-only">Customer Profile</DialogTitle>
                    <DialogDescription className="sr-only">
                        Detailed view of the customer profile
                    </DialogDescription>
                    {selectedLeadId && (
                        <CustomerProfile
                            leadId={selectedLeadId}
                            onClose={() => setSelectedLeadId(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
