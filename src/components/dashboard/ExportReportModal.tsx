import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExportReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportReportModal({ open, onOpenChange }: ExportReportModalProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [includeAgents, setIncludeAgents] = useState(true);
  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [includeQueues, setIncludeQueues] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    if (endDate < startDate) {
      toast.error("End date must be after start date");
      return;
    }

    setIsGenerating(true);
    setGeneratedReport(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          includeAgents,
          includeMetrics,
          includeQueues,
        }
      });

      if (error) throw error;

      if (data?.report) {
        setGeneratedReport(data.report);
        toast.success("Report generated successfully!");
      } else {
        throw new Error("No report data received");
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error("Failed to generate report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedReport) return;

    const blob = new Blob([generatedReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-center-report-${format(startDate || new Date(), 'yyyy-MM-dd')}-to-${format(endDate || new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  };

  const handleClose = () => {
    setGeneratedReport(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Call Center Report</DialogTitle>
        </DialogHeader>

        {!generatedReport ? (
          <div className="space-y-6 py-4">
            {/* Date Range Selection */}
            <div className="space-y-4">
              <Label>Date Range</Label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Content Selection */}
            <div className="space-y-4">
              <Label>Include in Report</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metrics"
                    checked={includeMetrics}
                    onCheckedChange={(checked) => setIncludeMetrics(checked as boolean)}
                  />
                  <Label htmlFor="metrics" className="font-normal cursor-pointer">
                    Performance Metrics (calls, conversions, handle times)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="agents"
                    checked={includeAgents}
                    onCheckedChange={(checked) => setIncludeAgents(checked as boolean)}
                  />
                  <Label htmlFor="agents" className="font-normal cursor-pointer">
                    Agent Performance (individual statistics)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="queues"
                    checked={includeQueues}
                    onCheckedChange={(checked) => setIncludeQueues(checked as boolean)}
                  />
                  <Label htmlFor="queues" className="font-normal cursor-pointer">
                    Campaign Analysis (queue status and performance)
                  </Label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateReport} 
                disabled={isGenerating || !startDate || !endDate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg max-h-[50vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {generatedReport}
              </pre>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleDownload}>
                Download Report
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
