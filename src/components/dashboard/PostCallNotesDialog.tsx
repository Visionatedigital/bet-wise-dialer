import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { maskPhone } from "@/lib/formatters";

interface PostCallNotesDialogProps {
  open: boolean;
  onSave: (notes: string) => Promise<void> | void;
  leadName: string;
  phoneNumber: string;
  campaign: string;
  callDuration: number;
}

export function PostCallNotesDialog({
  open,
  onSave,
  leadName,
  phoneNumber,
  campaign,
  callDuration
}: PostCallNotesDialogProps) {
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset notes when dialog opens
  useEffect(() => {
    if (open) {
      setNotes("");
      setIsSaving(false);
    }
  }, [open]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (!notes.trim()) {
      toast.error("Please enter call notes before saving");
      return;
    }

    if (isSaving) {
      return; // Prevent double-clicks
    }

    setIsSaving(true);
    try {
      await onSave(notes);
      setNotes("");
      // Note: Dialog will be closed by parent component after successful save
    } catch (error) {
      console.error('Error saving call notes:', error);
      toast.error("Failed to save call notes. Please try again.");
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Call Report Required
          </DialogTitle>
          <DialogDescription>
            Please add notes about what transpired during the call
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Call Details */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <div><strong>Lead:</strong> {leadName}</div>
            <div><strong>Phone:</strong> {maskPhone(phoneNumber)}</div>
            <div><strong>Campaign:</strong> {campaign}</div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span><strong>Duration:</strong> {formatDuration(callDuration)}</span>
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-2">
            <Label htmlFor="callNotes" className="text-base font-medium">
              Call Notes *
            </Label>
            <Textarea
              id="callNotes"
              placeholder='e.g., "Switched off", "Promised to deposit", "Not interested", etc.'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              className="resize-none"
              autoFocus
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              This information will be saved to the database for reporting
            </p>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleSave}
            className="w-full"
            disabled={!notes.trim() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save & Continue'
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Press Ctrl+Enter (Cmd+Enter on Mac) to save quickly
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
