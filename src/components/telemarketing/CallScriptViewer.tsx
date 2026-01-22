import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, CheckCircle, Lightbulb, Target, MessageSquare } from "lucide-react";

interface CallScript {
    opening: string;
    rapport_building: string;
    value_proposition: string;
    offer: string;
    objection_handling: string[];
    closing: string;
    talking_points: string[];
    personalization_notes: string[];
}

interface CallScriptViewerProps {
    leadName?: string;
    vipLevel?: string | null;
    preferredProduct?: string | null;
    campaignType: string;
    lastObjective?: string | null;
}

export function CallScriptViewer({
    leadName = "Customer",
    vipLevel = "bronze",
    preferredProduct = "Sports",
    campaignType,
    lastObjective
}: CallScriptViewerProps) {
    const [script, setScript] = useState<CallScript | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        generateScript();
    }, [leadName, vipLevel, preferredProduct, campaignType]);

    const generateScript = () => {
        setLoading(true);

        // Simulate "AI" generation time for effect
        setTimeout(() => {
            const product = preferredProduct || "Sports";
            const benefit = product === "Casino" ? "free spins" : "risk-free bets";
            const level = vipLevel?.toLowerCase() || "bronze";

            const isVip = level === "gold" || level === "platinum";
            const greeting = isVip
                ? `Good afternoon ${leadName}, this is a priority call from the VIP desk at Betsure.`
                : `Hello ${leadName}, this is calling from Betsure.`;

            const generatedScript: CallScript = {
                opening: greeting,
                rapport_building: `I noticed you've been a loyal fan of our ${product} games. How have your recent games been going?`,
                value_proposition: `We've released some new ${product} features that I think you'd love, specifically designed for players who enjoy ${product}.`,
                offer: `Because you're a valued ${level} player, we've added a special 20% deposit bonus to your account today.`,
                objection_handling: [
                    "**I don't have time right now** → No problem at all, I can send this offer via SMS. Would that work?",
                    "**I'm not interested** → I understand. Just so I know for next time, are you more interested in higher odds or free bets?",
                    "**I've lost too much recently** → I'm sorry to hear that. We actually have a cashback offer available to help you recover some ground."
                ],
                closing: `I've activated that bonus for you. Good luck with your next ${product} bet!`,
                talking_points: [
                    `Mention their ${level} status`,
                    `Highlight new ${product} matches/games`,
                    "Focus on instant withdrawals"
                ],
                personalization_notes: [
                    `Player prefers ${product}`,
                    `Current status: ${level}`,
                    `Last interaction: ${lastObjective || "None"}`
                ]
            };

            setScript(generatedScript);
            setLoading(false);
        }, 800);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
            title: "Copied!",
            description: "Script copied to clipboard"
        });
    };

    if (loading) {
        return (
            <Card className="border-0 shadow-none">
                <CardContent className="flex items-center justify-center p-8">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground animate-pulse">AI is personalizing the script...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!script) return null;

    return (
        <Card className="border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Personalized Call Script
                        </CardTitle>
                        <CardDescription>
                            Tailored for {leadName} ({preferredProduct})
                        </CardDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(JSON.stringify(script, null, 2))}
                    >
                        {copied ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                            <Copy className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-0">
                <Tabs defaultValue="script" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="script">Call Script</TabsTrigger>
                        <TabsTrigger value="talking-points">Talking Points</TabsTrigger>
                        <TabsTrigger value="objections">Objections</TabsTrigger>
                    </TabsList>

                    <TabsContent value="script">
                        <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-4">
                                {/* Opening */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">1</Badge>
                                        <h3 className="font-medium text-sm">Opening</h3>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-lg text-sm">
                                        {script.opening}
                                    </div>
                                </div>

                                {/* Rapport */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">2</Badge>
                                        <h3 className="font-medium text-sm">Rapport</h3>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-lg text-sm">
                                        {script.rapport_building}
                                    </div>
                                </div>

                                {/* Offer */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center bg-primary/10 text-primary border-primary/20">3</Badge>
                                        <h3 className="font-medium text-sm text-primary">The Offer</h3>
                                    </div>
                                    <div className="bg-primary/5 border border-primary/10 p-3 rounded-lg text-sm font-medium">
                                        {script.offer}
                                    </div>
                                </div>

                                {/* Closing */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">4</Badge>
                                        <h3 className="font-medium text-sm">Closing</h3>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-lg text-sm">
                                        {script.closing}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="talking-points">
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-3">
                                {script.talking_points.map((point, index) => (
                                    <div key={index} className="flex items-start gap-2 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded text-sm">
                                        <Target className="h-4 w-4 text-blue-500 mt-0.5" />
                                        <span>{point}</span>
                                    </div>
                                ))}
                                <div className="mt-4 pt-4 border-t">
                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Context</h4>
                                    {script.personalization_notes.map((note, index) => (
                                        <div key={index} className="flex items-start gap-2 p-1 text-xs text-muted-foreground">
                                            <Lightbulb className="h-3 w-3" />
                                            <span>{note}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="objections">
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-3">
                                {script.objection_handling.map((objection, index) => {
                                    const [question, answer] = objection.split("→");
                                    return (
                                        <div key={index} className="border rounded-lg p-3">
                                            <p className="text-sm font-medium text-red-500 mb-1">{question.replace(/\*\*/g, "")}</p>
                                            <p className="text-sm text-muted-foreground">{answer?.trim()}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
