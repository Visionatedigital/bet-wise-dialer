import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";

interface DashboardSelectionDialogProps {
  open: boolean;
  onSelect: (dashboard: 'agent' | 'management' | 'admin') => void;
}

export function DashboardSelectionDialog({ open, onSelect }: DashboardSelectionDialogProps) {
  const [selected, setSelected] = useState<'agent' | 'management' | 'admin' | null>(null);

  const dashboards = [
    {
      id: 'agent' as const,
      title: 'Agent Dashboard',
      description: 'Access agent view with call queue, campaigns, and leads',
      icon: Users,
    },
    {
      id: 'management' as const,
      title: 'Management Dashboard',
      description: 'View team performance, analytics, and reports',
      icon: LayoutDashboard,
    },
    {
      id: 'admin' as const,
      title: 'Admin Dashboard',
      description: 'Full system control, user management, and settings',
      icon: Shield,
    },
  ];

  const handleSelect = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Choose Your Dashboard</DialogTitle>
          <DialogDescription>
            Select which dashboard you'd like to access. You can switch between them anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          {dashboards.map((dashboard) => {
            const Icon = dashboard.icon;
            return (
              <Card
                key={dashboard.id}
                className={`p-4 cursor-pointer transition-all hover:border-primary ${
                  selected === dashboard.id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => setSelected(dashboard.id)}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className={`p-3 rounded-full ${
                    selected === dashboard.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{dashboard.title}</h3>
                    <p className="text-xs text-muted-foreground">{dashboard.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSelect} disabled={!selected}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
