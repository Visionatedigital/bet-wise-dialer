import { useState } from 'react';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Bell, BarChart3, User, Download, RefreshCw } from 'lucide-react';
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const ManagementSettings = () => {
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
    <ManagementLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Management Settings</h1>
          <p className="text-muted-foreground">Configure your preferences and notifications</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@example.com" />
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Report Preferences
                </CardTitle>
                <CardDescription>Configure automated reports and exports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Weekly Summary</Label>
                    <p className="text-sm text-muted-foreground">Receive weekly performance summary</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Monthly Report</Label>
                    <p className="text-sm text-muted-foreground">Comprehensive monthly analytics</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Preferences
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
                <CardDescription>Manage your notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Performance Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get notified about performance changes</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Team Updates</Label>
                    <p className="text-sm text-muted-foreground">Updates about team members</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Notifications
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="updates" className="space-y-4">
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
          </TabsContent>
        </Tabs>
      </div>
    </ManagementLayout>
  );
};

export default ManagementSettings;
