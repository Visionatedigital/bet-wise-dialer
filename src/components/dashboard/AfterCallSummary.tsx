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

type Disposition = "no_answer" | "callback" | "interested" | "converted" | "dnc" | "escalate";

interface AfterCallSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  callDuration: number;
}

const dispositionOptions = [
  { value: "no_answer", label: "No Answer", color: "bg-muted" },
  { value: "callback", label: "Callback Scheduled", color: "bg-info" },
  { value: "interested", label: "Interested", color: "bg-warning" },
  { value: "converted", label: "Converted", color: "bg-success" },
  { value: "dnc", label: "Do Not Call", color: "bg-destructive" },
  { value: "escalate", label: "Escalate", color: "bg-primary" },
];

const availableTags = [
  "Bonus Inquiry",
  "Payment Issue", 
  "KYC Required",
  "Technical Support",
  "Account Verification",
  "Promotional Offer"
];

export function AfterCallSummary({ open, onOpenChange, leadName, callDuration }: AfterCallSummaryProps) {
  const [disposition, setDisposition] = useState<Disposition | "">("");
  const [interestScore, setInterestScore] = useState(3);
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

  const handleSave = () => {
    if (!disposition) {
      alert("Please select a call disposition");
      return;
    }

    // Here you would save the call summary
    console.log({
      disposition,
      interestScore,
      notes,
      nextAction,
      nextActionDate,
      selectedTags,
      conversionLikelihood,
      escalateToOperations
    });

    // Show success message
    alert(`Great work! Disposition saved. ${nextAction && nextActionDate ? `Next callback set for ${nextActionDate}` : ''}`);
    
    onOpenChange(false);
    
    // Reset form
    setDisposition("");
    setInterestScore(3);
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

          {/* Interest Score */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Interest Score (1-5)</Label>
            <RadioGroup 
              value={interestScore.toString()} 
              onValueChange={(value) => setInterestScore(parseInt(value))}
              className="flex gap-4"
            >
              {[1, 2, 3, 4, 5].map((score) => (
                <div key={score} className="flex items-center space-x-2">
                  <RadioGroupItem value={score.toString()} id={`score-${score}`} />
                  <Label htmlFor={`score-${score}`} className="cursor-pointer">
                    {score}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* AI Insights */}
          <div className="bg-accent/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">AI Insights</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>• Conversion likelihood: <strong>{conversionLikelihood}</strong></p>
              <p>• Detected intent: Bonus eligibility questions</p>
              <p>• Suggested next action: Follow up with bonus details</p>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

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
          <div className="grid grid-cols-2 gap-4">
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
                  <SelectItem value="email">Send Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp Follow-up</SelectItem>
                  <SelectItem value="meeting">Schedule Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextActionDate" className="text-base font-medium">Due Date</Label>
              <Input
                id="nextActionDate"
                type="datetime-local"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                disabled={!nextAction}
              />
            </div>
          </div>

          {/* Escalation */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="escalate"
              checked={escalateToOperations}
              onCheckedChange={(checked) => setEscalateToOperations(checked as boolean)}
            />
            <Label htmlFor="escalate" className="flex items-center gap-2 cursor-pointer">
              <Send className="h-4 w-4" />
              Escalate to operations@betsure.com
            </Label>
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