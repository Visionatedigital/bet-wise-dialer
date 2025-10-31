import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, Sparkles } from "lucide-react";
import { jsPDF } from "jspdf";

interface ExportReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: string;
  selectedAgent: string;
}

export function ExportReportModal({ open, onOpenChange, dateRange, selectedAgent }: ExportReportModalProps) {
  const [verbosity, setVerbosity] = useState("balanced");
  const [focusArea, setFocusArea] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      // Calculate date range
      const daysMap: Record<string, number> = {
        'today': 0,
        'week': 7,
        'month': 30,
        'quarter': 90
      };
      const daysAgo = daysMap[dateRange] || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch call activities with filters
      let query = supabase
        .from('call_activities')
        .select(`
          *,
          profiles!call_activities_user_id_fkey(full_name, email),
          campaigns(name)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (selectedAgent !== 'all') {
        query = query.eq('user_id', selectedAgent);
      }

      const { data: callActivities, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Generate AI report
      const { data, error } = await supabase.functions.invoke('generate-ai-report', {
        body: {
          callActivities,
          dateRange,
          verbosity,
          focusArea
        }
      });

      if (error) throw error;

      // Generate PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Call Center Performance Report", margin, yPosition);
      yPosition += 10;

      // Date range
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Period: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`, margin, yPosition);
      yPosition += 5;
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPosition);
      yPosition += 15;

      // Split report into lines and add to PDF
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(data.report, maxWidth);
      
      for (let i = 0; i < lines.length; i++) {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        
        // Check for section headers (lines that end with :)
        if (lines[i].trim().endsWith(':') && lines[i].trim().length < 50) {
          doc.setFont("helvetica", "bold");
          doc.text(lines[i], margin, yPosition);
          doc.setFont("helvetica", "normal");
        } else {
          doc.text(lines[i], margin, yPosition);
        }
        
        yPosition += 7;
      }

      // Download PDF
      doc.save(`call-center-report-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Report generated and downloaded!");
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Performance Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="mb-2">
              <strong>Report Period:</strong> {dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}
            </p>
            <p>
              <strong>Agent Filter:</strong> {selectedAgent === 'all' ? 'All Agents' : 'Selected Agent'}
            </p>
          </div>

          {/* Customization Options */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verbosity">Report Detail Level</Label>
              <Select value={verbosity} onValueChange={setVerbosity}>
                <SelectTrigger id="verbosity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise - Key insights only</SelectItem>
                  <SelectItem value="balanced">Balanced - Standard detail</SelectItem>
                  <SelectItem value="detailed">Detailed - Comprehensive analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="focus">Focus Area</Label>
              <Select value={focusArea} onValueChange={setFocusArea}>
                <SelectTrigger id="focus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Metrics</SelectItem>
                  <SelectItem value="conversion">Conversion Optimization</SelectItem>
                  <SelectItem value="efficiency">Call Efficiency</SelectItem>
                  <SelectItem value="quality">Call Quality & Notes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating AI Report...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate & Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
