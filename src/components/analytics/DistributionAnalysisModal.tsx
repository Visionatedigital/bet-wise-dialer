import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AgentAnalysis {
    id: string;
    name: string;
    assignedLeads: number;
    totalScore: number;
    status: string;
}

interface DistributionAnalysisModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agents: AgentAnalysis[];
}

export function DistributionAnalysisModal({
    open,
    onOpenChange,
    agents,
}: DistributionAnalysisModalProps) {
    // Calculate stats
    const totalLeads = agents.reduce((sum, a) => sum + a.assignedLeads, 0);
    const totalScore = agents.reduce((sum, a) => sum + a.totalScore, 0);

    const avgLeads = totalLeads / (agents.length || 1);
    const avgScore = totalScore / (agents.length || 1);

    // Fairness Analysis
    const isZeroScore = totalScore === 0;

    const isFair = isZeroScore
        ? agents.every(a => Math.abs(a.assignedLeads - avgLeads) <= 1) // Count fairness (allow +/- 1)
        : agents.every(a => {
            // Check if score is within 20% of average (or very low volume)
            if (avgScore < 10) return true;
            const deviation = Math.abs(a.totalScore - avgScore);
            return deviation / avgScore < 0.2;
        });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-500" />
                        AI Distribution Analysis
                    </DialogTitle>
                    <DialogDescription>
                        Deep dive into how the AI has distributed leads based on Value and Quality.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-lg">Overall Fairness</h3>
                                    {isFair ? (
                                        <Badge className="bg-green-500 hover:bg-green-600">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Balanced
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive">
                                            <AlertCircle className="w-3 h-3 mr-1" /> Imbalanced
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {isZeroScore ? (
                                        "Scores are unavailable (Legacy Data or Pending Sync). Distribution was balanced based on **Lead Count** to ensure every agent has an equal workload."
                                    ) : (
                                        "The AI aims to distribute equal <strong>Total Lead Value</strong> (Score) to each agent, ensuring fairness in commission potential rather than just lead count."
                                    )}
                                </p>
                                <div className="mt-4 space-y-2">
                                    {isZeroScore ? (
                                        <div className="flex justify-between text-sm">
                                            <span>Target Count per Agent:</span>
                                            <span className="font-bold">{Math.round(avgLeads)} leads</span>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between text-sm">
                                            <span>Target Value per Agent:</span>
                                            <span className="font-bold">{Math.round(avgScore)} pts</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                        <span>{isZeroScore ? "Total Leads Distributed:" : "Total Distributed Value:"}</span>
                                        <span className="font-bold text-purple-600">
                                            {isZeroScore ? totalLeads : totalScore.toLocaleString() + " pts"}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Brain className="h-5 w-5 text-purple-500" />
                                    <h3 className="font-semibold">AI Insights</h3>
                                </div>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    {isZeroScore ? (
                                        <>
                                            <li className="flex gap-2">
                                                <span className="text-yellow-500">•</span>
                                                AI Scoring is pending or database update is required.
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="text-green-500">•</span>
                                                <b>Fallback Active:</b> System successfully balanced lead counts.
                                            </li>
                                        </>
                                    ) : (
                                        <>
                                            <li className="flex gap-2">
                                                <span className="text-purple-500">•</span>
                                                Leads are scored based on Deposit Value (LTV) and Betting Patterns.
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="text-purple-500">•</span>
                                                High-value leads (Gold/Platinum) count for more "points".
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="text-purple-500">•</span>
                                                Agents with fewer leads might have higher quality leads to balance the workload.
                                            </li>
                                        </>
                                    )}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Agent</TableHead>
                                    <TableHead className="text-right">Lead Count</TableHead>
                                    {!isZeroScore && <TableHead className="text-right">Avg Quality</TableHead>}
                                    <TableHead className="w-[200px]">{isZeroScore ? "Distribution Balance" : "Value Distribution (Score)"}</TableHead>
                                    {!isZeroScore && <TableHead className="text-right">Total Score</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agents.map((agent) => {
                                    const percentOfMax = avgScore > 0 ? (agent.totalScore / (avgScore * 1.5)) * 100 :
                                        avgLeads > 0 ? (agent.assignedLeads / (avgLeads * 1.5)) * 100 : 0;

                                    const avgQuality = agent.assignedLeads > 0 ? Math.round(agent.totalScore / agent.assignedLeads) : 0;

                                    return (
                                        <TableRow key={agent.id}>
                                            <TableCell className="font-medium">{agent.name}</TableCell>
                                            <TableCell className="text-right">{agent.assignedLeads}</TableCell>
                                            {!isZeroScore && (
                                                <TableCell className="text-right">
                                                    <Badge variant="outline" className={avgQuality > 70 ? "text-green-600 border-green-200" : "text-slate-500"}>
                                                        {avgQuality}/100
                                                    </Badge>
                                                </TableCell>
                                            )}

                                            <TableCell>
                                                <Progress value={Math.min(percentOfMax, 100)} className="h-2" />
                                            </TableCell>

                                            {!isZeroScore && (
                                                <TableCell className="text-right font-bold text-purple-600">
                                                    {agent.totalScore}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
