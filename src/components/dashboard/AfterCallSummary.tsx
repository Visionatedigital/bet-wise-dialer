import { useState } from "react";
import { Save, Send, AlertTriangle, Calendar, Tag, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Disposition = "no_answer" | "not_interested" | "interested" | "unreachable" | "escalate";

export interface AfterCallSummaryData {
  disposition: string;
  interestScore: number;
  leadStrength: "hot" | "warm" | "cold" | "";
  notes: string;
  nextAction: string;
  nextActionDate: string;
  selectedTags: string[];
  conversionLikelihood: string;
  escalateToOperations: boolean;
}

interface AfterCallSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  callDuration: number;
  onSave?: (data: AfterCallSummaryData) => Promise<void> | void;
}

const dispositionOptions = [
  { value: "no_answer", label: "No Answer", color: "bg-muted" },
  { value: "not_interested", label: "Not Interested", color: "bg-orange-500" },
  { value: "interested", label: "Interested", color: "bg-warning" },
  { value: "unreachable", label: "Unreachable", color: "bg-destructive" },

];

const availableTags = [
  "Bonus Inquiry",
  "Payment Issue",
  "KYC Required",
  "Technical Support",
  "Account Verification",
  "Promotional Offer"
];

export function AfterCallSummary({ open, onOpenChange, leadName, callDuration, onSave }: AfterCallSummaryProps) {
  const [disposition, setDisposition] = useState<Disposition | "">("");
  const [interestScore, setInterestScore] = useState(3);
  const [leadStrength, setLeadStrength] = useState<"hot" | "warm" | "cold" | "">("warm");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [conversionLikelihood, setConversionLikelihood] = useState("Medium");
  const [escalateToOperations, setEscalateToOperations] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!disposition) {
      alert("Please select a call disposition");
      return;
    }

    const summaryData: AfterCallSummaryData = {
      disposition,
      interestScore,
      leadStrength,
      notes,
      nextAction,
      nextActionDate,
      selectedTags,
      conversionLikelihood,
      escalateToOperations
    };

    console.log("Saving summary:", summaryData);

    if (onSave) {
      await onSave(summaryData);
    } else {
      // Show success message if no onSave provided (demo mode)
      alert(`Great work! Disposition saved. ${nextAction && nextActionDate ? `Next callback set for ${nextActionDate}` : ''}`);
    }

    onOpenChange(false);

    // Reset form
    setDisposition("");
    setInterestScore(3);
    setLeadStrength("warm");
    setNotes("");
    setNextAction("");
    setNextActionDate("");
    setSelectedTags([]);
    setConversionLikelihood("Medium");
    setEscalateToOperations(false);
  };

  const canSave = disposition !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            After-Call Summary
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Call with {leadName} • Duration: {formatDuration(callDuration)}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Disposition (Required) */}
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Call Disposition *
            </Label>
            <RadioGroup
              value={disposition}
              onValueChange={(value) => setDisposition(value as Disposition)}
              className="grid grid-cols-2 gap-3"
            >
              {dispositionOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label
                    htmlFor={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className={`h-2 w-2 rounded-full ${option.color}`} />
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>




          {/* Lead Strength (for callback prioritization) - Only show if interested is selected */}
          {disposition === 'interested' && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Lead Strength (Callback Priority)</Label>
              <RadioGroup
                value={leadStrength}
                onValueChange={(value) => setLeadStrength(value as "hot" | "warm" | "cold")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hot" id="strength-hot" />
                  <Label htmlFor="strength-hot" className="cursor-pointer flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    Hot (High Priority)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="warm" id="strength-warm" />
                  <Label htmlFor="strength-warm" className="cursor-pointer flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    Warm (Medium Priority)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cold" id="strength-cold" />
                  <Label htmlFor="strength-cold" className="cursor-pointer flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    Cold (Low Priority)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Rate this lead's potential for conversion to help prioritize callbacks
              </p>
            </div>
          )}





          {/* Notes */}
          <div className="space-y-3">
            <Label htmlFor="notes" className="text-base font-medium">Call Notes</Label>
            <Textarea
              id="notes"
              placeholder="Key discussion points, customer concerns, objections handled..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Next Action */}
          <div className="space-y-2">
            <Label htmlFor="nextAction" className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Next Action
            </Label>
            <Select value={nextAction} onValueChange={setNextAction}>
              <SelectTrigger>
                <SelectValue placeholder="Select next step" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No next step</SelectItem>
                <SelectItem value="callback">Schedule Callback</SelectItem>
                <SelectItem value="whatsapp">WhatsApp Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>



          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Summary (Press S)
            </Button>

            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>

          {/* Validation Message */}
          {!canSave && (
            <div className="text-sm text-destructive text-center">
              Please select a call disposition to complete the summary
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}