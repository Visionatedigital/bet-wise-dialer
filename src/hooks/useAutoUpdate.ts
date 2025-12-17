import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

export function useAutoUpdate() {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const checkForUpdates = async (silent = false) => {
    // Only run in Tauri environment
    if (typeof window === 'undefined' || !('__TAURI__' in window)) {
      console.log('[Updater] Not running in Tauri environment');
      return;
    }

    try {
      setChecking(true);
      
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        console.log('[Updater] Update available:', update.version);
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          date: update.date || '',
          body: update.body || 'Bug fixes and improvements'
        });

        if (!silent) {
          toast.info(`Update v${update.version} available!`, {
            description: 'Click to download and install',
            action: {
              label: 'Update Now',
              onClick: () => downloadAndInstall()
            },
            duration: 10000
          });
        }
      } else {
        console.log('[Updater] No updates available');
        if (!silent) {
          toast.success('You are on the latest version!');
        }
      }
    } catch (error) {
      console.error('[Updater] Error checking for updates:', error);
      if (!silent) {
        toast.error('Failed to check for updates');
      }
    } finally {
      setChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    if (typeof window === 'undefined' || !('__TAURI__' in window)) {
      return;
    }

    try {
      setDownloading(true);
      toast.loading('Downloading update...', { id: 'update-download' });

      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      
      const update = await check();

      if (update) {
        let downloaded = 0;
        let contentLength = 0;

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              console.log(`[Updater] Download started, size: ${contentLength}`);
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              const percent = contentLength > 0 
                ? Math.round((downloaded / contentLength) * 100) 
                : 0;
              setProgress(percent);
              break;
            case 'Finished':
              console.log('[Updater] Download finished');
              break;
          }
        });

        toast.dismiss('update-download');
        toast.success('Update installed! Restarting...', { duration: 2000 });

        // Wait a moment then relaunch
        setTimeout(async () => {
          await relaunch();
        }, 2000);
      }
    } catch (error) {
      console.error('[Updater] Error installing update:', error);
      toast.dismiss('update-download');
      toast.error('Failed to install update');
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  };

  // Check for updates on mount (silently)
  useEffect(() => {
    // Delay the check to let the app fully load
    const timer = setTimeout(() => {
      checkForUpdates(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return {
    checking,
    updateAvailable,
    updateInfo,
    downloading,
    progress,
    checkForUpdates,
    downloadAndInstall
  };
}
