import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// Current app version - update this when releasing new versions
const CURRENT_VERSION = '1.0.2';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/Visionatedigital/bet-wise-dialer/releases/latest';
const DOWNLOAD_URL = 'https://github.com/Visionatedigital/bet-wise-dialer/releases/latest';

interface UpdateInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  installerUrl: string;
}

export function useAutoUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.replace('v', '').split('.').map(Number);
    const parts2 = v2.replace('v', '').split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  };

  const checkForUpdates = async (silent = false) => {
    try {
      console.log('[Updater] Checking for updates... Current version:', CURRENT_VERSION);
      
      const response = await fetch(GITHUB_RELEASES_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch release info');
      }
      
      const release = await response.json();
      const latestVersion = release.tag_name.replace('v', '');
      
      console.log('[Updater] Latest version on GitHub:', latestVersion);
      
      if (compareVersions(latestVersion, CURRENT_VERSION) > 0) {
        console.log('[Updater] Update available!');
        
        // Find the .exe installer in the release assets
        const assets = release.assets || [];
        const exeAsset = assets.find((a: any) => a.name.endsWith('-setup.exe') || a.name.endsWith('.exe'));
        const installerUrl = exeAsset?.browser_download_url || '';
        
        console.log('[Updater] Installer URL:', installerUrl);
        
        setUpdateAvailable(true);
        setUpdateInfo({
          version: latestVersion,
          releaseNotes: release.body || 'Bug fixes and improvements',
          downloadUrl: DOWNLOAD_URL,
          installerUrl: installerUrl
        });
        
        // Show toast notification
        if (!silent) {
          toast.info(`Update v${latestVersion} available!`, {
            description: 'A new version is ready to download',
            action: {
              label: 'Download',
              onClick: () => openDownloadPage()
            },
            duration: 15000
          });
        }
        
        // Always show the update dialog for new updates
        setShowUpdateDialog(true);
        
        return true;
      } else {
        console.log('[Updater] Already on latest version');
        if (!silent) {
          toast.success('You are on the latest version!');
        }
        return false;
      }
    } catch (error) {
      console.error('[Updater] Error checking for updates:', error);
      if (!silent) {
        toast.error('Failed to check for updates');
      }
      return false;
    }
  };

  const openDownloadPage = () => {
    // Fallback to browser download
    window.open(DOWNLOAD_URL, '_blank');
  };

  const downloadAndInstall = async () => {
    if (!updateInfo?.installerUrl) {
      toast.error('Installer not found. Opening download page...');
      openDownloadPage();
      return;
    }

    try {
      // Check if running in Tauri
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { open } = await import('@tauri-apps/plugin-shell');
        
        toast.info('Opening installer download...', { duration: 3000 });
        
        // Open the installer URL - browser will download it
        await open(updateInfo.installerUrl);
        
        // Show instructions
        setTimeout(() => {
          toast.info('Once downloaded, run the installer to update.', { 
            duration: 10000,
            description: 'The app will close when you start the installer.'
          });
        }, 2000);
        
      } else {
        // Not in Tauri, open download page
        openDownloadPage();
      }
    } catch (error) {
      console.error('[Updater] Download error:', error);
      toast.error('Download failed. Opening download page...');
      openDownloadPage();
    }
  };

  const dismissUpdate = () => {
    setShowUpdateDialog(false);
    // Store dismissal in localStorage so we don't keep bothering
    localStorage.setItem('dismissedUpdate', updateInfo?.version || '');
  };

  // Check for updates on mount
  useEffect(() => {
    // Delay the check to let the app fully load
    const timer = setTimeout(() => {
      const dismissedVersion = localStorage.getItem('dismissedUpdate');
      checkForUpdates(true).then((hasUpdate) => {
        if (hasUpdate && updateInfo && dismissedVersion === updateInfo.version) {
          // User already dismissed this version, don't show dialog again
          setShowUpdateDialog(false);
        }
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return {
    currentVersion: CURRENT_VERSION,
    updateAvailable,
    updateInfo,
    showUpdateDialog,
    setShowUpdateDialog,
    checkForUpdates,
    openDownloadPage,
    downloadAndInstall,
    dismissUpdate
  };
}
