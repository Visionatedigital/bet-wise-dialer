import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { open } from '@tauri-apps/plugin-shell';
import { isRateLimitError, getRateLimitMessage } from '@/utils/rateLimitHandler';

// Current app version - update this when releasing new versions
const CURRENT_VERSION = '1.0.6';
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  // Store the Tauri update object so we can reuse it for installation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tauriUpdate, setTauriUpdate] = useState<any>(null);

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
      const hasWindow = typeof window !== 'undefined';
      const hasTauri = hasWindow && '__TAURI__' in window;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tauriObj = hasWindow ? (window as any).__TAURI__ : null;
      console.log('[Updater] Environment check:', {
        hasWindow,
        hasTauri,
        tauriExists: !!tauriObj,
        tauriKeys: tauriObj ? Object.keys(tauriObj) : [],
        currentUrl: hasWindow ? window.location.href : 'N/A'
      });
      
      // Check if running in Tauri
      if (hasTauri) {
        console.log('[Updater] Running in Tauri environment, using updater plugin');
        // Use Tauri's updater plugin
        let update;
        try {
          console.log('[Updater] Calling Tauri check()...');
          update = await check();
          console.log('[Updater] Tauri check() result:', {
            available: update?.available,
            version: update?.version,
            currentVersion: update?.currentVersion,
            hasUpdate: !!update,
            updateType: typeof update,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hasInstall: update ? typeof (update as any).install === 'function' : false
          });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (checkError: any) {
          console.error('[Updater] Tauri check() failed:', {
            error: checkError,
            message: checkError?.message,
            stack: checkError?.stack,
            name: checkError?.name
          });
          // Fall through to GitHub API check
          update = null;
        }
        
        if (update?.available) {
          console.log('[Updater] Update available via Tauri updater:', update.version);
          console.log('[Updater] Update object details:', {
            available: update.available,
            version: update.version,
            hasInstall: typeof update.install === 'function',
            updateType: typeof update
          });
          
          // Store the update object so we can use it for installation
          setTauriUpdate(update);
          
          // Fetch release notes from GitHub
          let releaseNotes = 'Bug fixes and improvements';
          try {
            const response = await fetch(GITHUB_RELEASES_URL);
            if (response.ok) {
              const release = await response.json();
              releaseNotes = release.body || releaseNotes;
            }
          } catch (e) {
            console.warn('[Updater] Could not fetch release notes:', e);
          }
          
          setUpdateAvailable(true);
          setUpdateInfo({
            version: update.version,
            releaseNotes: releaseNotes,
            downloadUrl: DOWNLOAD_URL,
            installerUrl: ''
          });
          
          if (!silent) {
            toast.info(`Update v${update.version} available!`, {
              description: 'A new version is ready to install',
              duration: 15000
            });
          }
          
          // Check if user already dismissed or accepted this version
          const dismissedVersion = localStorage.getItem('dismissedUpdate');
          const acceptedVersion = localStorage.getItem('acceptedUpdate');
          if (dismissedVersion !== update.version && acceptedVersion !== update.version) {
            setShowUpdateDialog(true);
          }
          
          return true;
        } else {
          console.log('[Updater] Already on latest version (Tauri check)');
          // Clear stored update if no update available
          setTauriUpdate(null);
          if (!silent) {
            toast.success('You are on the latest version!');
          }
          return false;
        }
      } else {
        // Fallback to GitHub API check for browser/development
        const isDevMode = hasWindow && (window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1'));
        if (isDevMode) {
          console.warn('[Updater] Running in dev mode - Tauri updater only works in production builds');
          console.warn('[Updater] To test the updater: build with "npm run tauri:build" and install the .exe file');
        } else {
          console.log('[Updater] Not running in Tauri, using GitHub API fallback');
        }
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const exeAsset = assets.find((a: any) => a.name.endsWith('-setup.exe') || a.name.endsWith('.exe'));
          const installerUrl = exeAsset?.browser_download_url || '';
          
          setUpdateAvailable(true);
          setUpdateInfo({
            version: latestVersion,
            releaseNotes: release.body || 'Bug fixes and improvements',
            downloadUrl: DOWNLOAD_URL,
            installerUrl: installerUrl
          });
          
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
          
          const dismissedVersion = localStorage.getItem('dismissedUpdate');
          const acceptedVersion = localStorage.getItem('acceptedUpdate');
          if (dismissedVersion !== latestVersion && acceptedVersion !== latestVersion) {
            setShowUpdateDialog(true);
          }
          
          return true;
        } else {
          console.log('[Updater] Already on latest version');
          if (!silent) {
            toast.success('You are on the latest version!');
          }
          return false;
        }
      }
    } catch (error) {
      console.error('[Updater] Error checking for updates:', error);
      
      // Check if it's a rate limit error
      const rateLimit = isRateLimitError(error);
      if (rateLimit.isRateLimit) {
        const message = getRateLimitMessage(rateLimit);
        if (!silent) {
          toast.error(message, {
            duration: 10000,
            description: 'The update check will be retried automatically later.'
          });
        }
        console.warn('[Updater] Rate limit hit:', rateLimit);
        return false;
      }
      
      if (!silent) {
        toast.error('Failed to check for updates', {
          description: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return false;
    }
  };

  const openDownloadPage = () => {
    // Fallback to browser download
    window.open(DOWNLOAD_URL, '_blank');
  };

  const downloadAndInstall = async () => {
    console.log('[Updater] downloadAndInstall called');
    console.log('[Updater] Current version:', CURRENT_VERSION);
    console.log('[Updater] Update info:', updateInfo);
    console.log('[Updater] Stored Tauri update object:', tauriUpdate);
    
    // Mark update as accepted so the dialog doesn't reappear
    if (updateInfo?.version) {
      localStorage.setItem('acceptedUpdate', updateInfo.version);
      setShowUpdateDialog(false); // Close the dialog immediately
      console.log('[Updater] Marked update as accepted:', updateInfo.version);
    }

    try {
      // Check if running in Tauri
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        console.log('[Updater] Running in Tauri, using updater plugin');
        
        // Use the stored update object if available, otherwise check again
        let update = tauriUpdate;
        
        if (!update) {
          console.log('[Updater] No stored update object, checking again...');
          update = await check();
          if (update?.available) {
            setTauriUpdate(update);
          }
        }
        
        console.log('[Updater] Using update object:', {
          available: update?.available,
          version: update?.version,
          hasInstall: typeof update?.install === 'function',
          isStored: update === tauriUpdate
        });
        
        if (update?.available) {
          setIsDownloading(true);
          setDownloadProgress(50); // Show progress as downloading
          
          toast.info('Downloading and installing update...', { duration: 5000 });
          
          try {
            // The update object should have an install method
            // Download and install the update
            console.log('[Updater] Update object details:', {
              available: update.available,
              version: update.version,
              hasInstall: typeof update.install === 'function',
              updateObject: update
            });
            
            if (update.install && typeof update.install === 'function') {
              console.log('[Updater] Starting installation...');
              console.log('[Updater] Calling update.install()...');
              
              // Call install with proper error handling
              await update.install();
              
              console.log('[Updater] Installation completed successfully!');
              setDownloadProgress(100);
              toast.success('Update installed! Restarting app in 2 seconds...', { 
                duration: 3000,
                description: 'The app will close and restart automatically.'
              });
              
              // Relaunch the app after installation
              console.log('[Updater] Scheduling app restart in 2 seconds...');
              setTimeout(async () => {
                console.log('[Updater] Relaunching app now...');
                try {
                  await relaunch();
                } catch (relaunchError) {
                  console.error('[Updater] Relaunch error:', relaunchError);
                  toast.error('Please restart the app manually to complete the update.', {
                    duration: 10000
                  });
                }
              }, 2000);
            } else {
              // Fallback: open download page if install method not available
              console.warn('[Updater] Install method not available on update object');
              console.warn('[Updater] Update object keys:', Object.keys(update));
              console.warn('[Updater] Update object:', update);
              setIsDownloading(false);
              setDownloadProgress(0);
              toast.warning('Automatic installation not available. Opening download page...');
              openDownloadPage();
            }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (installError: any) {
            console.error('[Updater] Install error:', installError);
            console.error('[Updater] Error details:', {
              message: installError?.message,
              stack: installError?.stack,
              error: installError,
              name: installError?.name
            });
            
            // Check if it's a rate limit error
            const rateLimit = isRateLimitError(installError);
            if (rateLimit.isRateLimit) {
              setIsDownloading(false);
              setDownloadProgress(0);
              const message = getRateLimitMessage(rateLimit);
              toast.error(message, {
                duration: 10000,
                description: 'Please wait before trying again, or download manually from GitHub.'
              });
              // Don't open download page for rate limits - user should wait
              return;
            }
            
            setIsDownloading(false);
            setDownloadProgress(0);
            toast.error('Installation failed. Opening download page...', {
              description: installError?.message || 'Check console for details'
            });
            openDownloadPage();
          }
          
        } else {
          // Fallback: open download page if Tauri updater doesn't work
          console.warn('[Updater] No update available or update object is invalid');
          toast.warning('Automatic update not available. Opening download page...');
          openDownloadPage();
        }
      } else {
        // Not in Tauri, open download page
        if (updateInfo?.installerUrl) {
          const { open: openShell } = await import('@tauri-apps/plugin-shell');
          await openShell(updateInfo.installerUrl);
          toast.info('Once downloaded, run the installer to update.', { 
            duration: 10000,
            description: 'The app will close when you start the installer.'
          });
        } else {
          openDownloadPage();
        }
      }
    } catch (error) {
      console.error('[Updater] Installation error:', error);
      
      // Check if it's a rate limit error
      const rateLimit = isRateLimitError(error);
      if (rateLimit.isRateLimit) {
        setIsDownloading(false);
        const message = getRateLimitMessage(rateLimit);
        toast.error(message, {
          duration: 10000,
          description: 'Please wait before trying again, or download manually from GitHub.'
        });
        return; // Don't open download page for rate limits
      }
      
      setIsDownloading(false);
      toast.error('Installation failed. Opening download page...');
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
      checkForUpdates(true);
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // checkForUpdates is stable and doesn't need to be in deps

  // Handle dismissed/accepted updates after updateInfo is set
  useEffect(() => {
    if (updateInfo) {
      const dismissedVersion = localStorage.getItem('dismissedUpdate');
      const acceptedVersion = localStorage.getItem('acceptedUpdate');
      if (dismissedVersion === updateInfo.version || acceptedVersion === updateInfo.version) {
        // User already dismissed or accepted this version, don't show dialog again
        setShowUpdateDialog(false);
      }
    }
  }, [updateInfo]);

  return {
    currentVersion: CURRENT_VERSION,
    updateAvailable,
    updateInfo,
    showUpdateDialog,
    setShowUpdateDialog,
    isDownloading,
    downloadProgress,
    checkForUpdates,
    openDownloadPage,
    downloadAndInstall,
    dismissUpdate
  };
}


