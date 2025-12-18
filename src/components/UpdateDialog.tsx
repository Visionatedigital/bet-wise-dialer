import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Sparkles } from "lucide-react";

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion: string;
  newVersion: string;
  releaseNotes: string;
  onDownload: () => void;
  onDismiss: () => void;
}

export function UpdateDialog({
  open,
  onOpenChange,
  currentVersion,
  newVersion,
  releaseNotes,
  onDownload,
  onDismiss,
}: UpdateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            New update available
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                A new version of BetSure Dialer is available. Install now to get the latest fixes and improvements.
              </p>
              
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current version:</span>
                  <span className="font-mono">v{currentVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New version:</span>
                  <span className="font-mono text-primary font-semibold">v{newVersion}</span>
                </div>
              </div>

              {releaseNotes && (
                <div className="text-sm">
                  <p className="font-medium mb-1">What's new:</p>
                  <p className="text-muted-foreground whitespace-pre-line text-xs">
                    {releaseNotes.slice(0, 300)}
                    {releaseNotes.length > 300 && '...'}
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDismiss}>
            Remind me later
          </AlertDialogCancel>
          <AlertDialogAction onClick={onDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Install now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


