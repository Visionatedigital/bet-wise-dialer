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
import { Download, Sparkles, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion: string;
  newVersion: string;
  releaseNotes: string;
  onDownload: () => void;
  onDismiss: () => void;
  isDownloading?: boolean;
  downloadProgress?: number;
}

export function UpdateDialog({
  open,
  onOpenChange,
  currentVersion,
  newVersion,
  releaseNotes,
  onDownload,
  onDismiss,
  isDownloading = false,
  downloadProgress = 0,
}: UpdateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isDownloading ? 'Installing update...' : 'New update available'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isDownloading ? (
                <div className="space-y-2">
                  <p>Downloading and installing the update. Please wait...</p>
                  <Progress value={downloadProgress} className="w-full" />
                  <p className="text-xs text-muted-foreground text-center">
                    {downloadProgress > 0 ? `${Math.round(downloadProgress)}%` : 'Starting download...'}
                  </p>
                </div>
              ) : (
                <>
                  <p>
                    A new version of Bangbet-telemarketing software is available. Install now to get the latest fixes and improvements.
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
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!isDownloading && (
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onDismiss} disabled={isDownloading}>
              Remind me later
            </AlertDialogCancel>
            <AlertDialogAction onClick={onDownload} disabled={isDownloading} className="gap-2">
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Install now
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}


