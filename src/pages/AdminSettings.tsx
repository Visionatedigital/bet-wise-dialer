import { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Database, Shield, Bell, Download, RefreshCw } from 'lucide-react';
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const AdminSettings = () => {
  const {
    currentVersion,
    updateAvailable,
    updateInfo,
    checkForUpdates,
    downloadAndInstall,
  } = useAutoUpdate();
  const [checking, setChecking] = useState(false);

  const handleCheckForUpdates = async () => {
    setChecking(true);
    try {
      await checkForUpdates(false);
    } catch (error) {
      console.error('Error checking for updates:', error);
      toast.error('Failed to check for updates. Please try again later.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground">Configure system-wide settings and security</p>
        </div>

        <Tabs defaultValue="system" className="space-y-4">
          <TabsList>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Application Updates
                </CardTitle>
                <CardDescription>
                  Check for and install the latest version of Bangbet-telemarketing software
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Current Version</p>
                    <p className="text-sm text-muted-foreground">v{currentVersion}</p>
                  </div>
                  {updateAvailable && (
                    <Badge variant="default" className="bg-green-500">
                      Update Available: v{updateInfo?.version}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCheckForUpdates}
                    disabled={checking}
                    className="flex-1"
                    variant="outline"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                    {checking ? 'Checking...' : 'Check for Updates'}
                  </Button>
                  {updateAvailable && updateInfo && (
                    <Button
                      onClick={downloadAndInstall}
                      variant="default"
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Update
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Configuration
                </CardTitle>
                <CardDescription>Manage database settings and backup schedules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Backup</Label>
                    <p className="text-sm text-muted-foreground">Automatically backup database daily</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2">
                  <Label>Backup Retention (days)</Label>
                  <Input type="number" defaultValue="30" />
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>Configure authentication and access controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Require 2FA for all admin accounts</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Session Timeout</Label>
                    <p className="text-sm text-muted-foreground">Auto logout after inactivity</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Security Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>Configure system notifications and alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>System Alerts</Label>
                    <p className="text-sm text-muted-foreground">Critical system notifications</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>User Activity</Label>
                    <p className="text-sm text-muted-foreground">Notify on suspicious activity</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
