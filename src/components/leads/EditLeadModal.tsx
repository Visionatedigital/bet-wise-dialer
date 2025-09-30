import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lead } from "@/data/sampleData";

interface EditLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onUpdateComplete: () => void;
}

export function EditLeadModal({ open, onOpenChange, lead, onUpdateComplete }: EditLeadModalProps) {
  const [formData, setFormData] = useState({
    campaign: "",
    intent: "",
    score: 0,
    priority: "low",
    segment: "dormant",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        campaign: lead.campaign || "",
        intent: lead.intent || "",
        score: lead.score || 0,
        priority: lead.priority || "low",
        segment: lead.segment || "dormant",
      });
    }
  }, [lead]);

  const handleSave = async () => {
    if (!lead) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          campaign: formData.campaign || null,
          intent: formData.intent || null,
          score: formData.score,
          priority: formData.priority,
          segment: formData.segment,
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast.success('Lead updated successfully');
      onUpdateComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogDescription>
            Update lead details for {lead.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={lead.name} disabled />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={lead.phone} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign">Campaign</Label>
            <Input
              id="campaign"
              value={formData.campaign}
              onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
              placeholder="Enter campaign name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="intent">Intent</Label>
            <Input
              id="intent"
              value={formData.intent}
              onChange={(e) => setFormData({ ...formData, intent: e.target.value })}
              placeholder="Enter intent (e.g., Hot Lead, Cold Call)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment">Segment</Label>
            <Select value={formData.segment} onValueChange={(value) => setFormData({ ...formData, segment: value })}>
              <SelectTrigger id="segment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="semi-active">Semi-Active</SelectItem>
                <SelectItem value="dormant">Dormant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="score">Lead Score: {formData.score}</Label>
            <Slider
              id="score"
              value={[formData.score]}
              onValueChange={(value) => setFormData({ ...formData, score: value[0] })}
              min={0}
              max={100}
              step={1}
              className="py-4"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
