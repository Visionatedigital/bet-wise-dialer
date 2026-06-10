import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Users,
  Settings as SettingsIcon,
  FileText,
  Clock,
  Shield,
  Plus,
  Edit2,
  Trash2,
  Save,
  AlertTriangle,
  Building,
  Phone,
  Mail,
  Globe,
  Download,
  RefreshCw,
  Camera,
  User,
  KeyRound,
} from "lucide-react";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { toast } from "sonner";
import React, { useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/supabase/client";

const Settings = () => {
  const {
    currentVersion,
    updateAvailable,
    updateInfo,
    checkForUpdates,
    downloadAndInstall,
  } = useAutoUpdate();
  const [checking, setChecking] = React.useState(false);

  // Profile state
  const { user } = useAuth();
  const [profileName, setProfileName] = React.useState(user?.full_name || "");
  const [profileEmail, setProfileEmail] = React.useState(user?.email || "");
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) { toast.error("Name cannot be empty"); return; }
    setSavingProfile(true);
    try {
      await api.patch(`/profiles/${user!.id}`, {
        full_name: profileName.trim(),
        email: profileEmail.trim().toLowerCase(),
        ...(avatarPreview ? { avatar_url: avatarPreview } : {}),
      });
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields"); return;
    }
    if (newPassword.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setSavingPassword(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast.success("Password changed successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (user?.full_name || user?.email || "?")[0].toUpperCase();

  const handleCheckForUpdates = async () => {
    setChecking(true);
    try {
      await checkForUpdates(false);
      // The checkForUpdates function will automatically set updateInfo and showUpdateDialog
      // if an update is available
    } catch (error) {
      console.error('Error checking for updates:', error);
      toast.error('Failed to check for updates. Please try again later.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your system configuration and preferences
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="users">Users & Roles</TabsTrigger>
            <TabsTrigger value="dispositions">Dispositions</TabsTrigger>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="hours">Business Hours</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          {/* ── My Profile ── */}
          <TabsContent value="profile" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">

              {/* Profile info card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>Update your name, email and photo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Avatar */}
                  <div className="flex flex-col items-center gap-3 pb-2">
                    <div className="relative">
                      {avatarPreview || user?.avatar_url ? (
                        <img
                          src={avatarPreview || user?.avatar_url!}
                          alt="Avatar"
                          className="w-20 h-20 rounded-full object-cover border-2 border-green-500"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center text-white text-3xl font-bold">
                          {initials}
                        </div>
                      )}
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center border border-gray-200 hover:bg-gray-50"
                      >
                        <Camera className="h-3.5 w-3.5 text-gray-600" />
                      </button>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <p className="text-xs text-muted-foreground">Click camera icon to change photo (max 2MB)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Full Name</Label>
                    <Input
                      id="profile-name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Role</Label>
                    <Badge variant="secondary" className="capitalize">{user?.role}</Badge>
                  </div>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="w-full bg-green-500 hover:bg-green-600"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </Button>
                </CardContent>
              </Card>

              {/* Change password card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription>Update your account password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-pw">Current Password</Label>
                    <Input
                      id="current-pw"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pw">New Password</Label>
                    <Input
                      id="new-pw"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pw">Confirm New Password</Label>
                    <Input
                      id="confirm-pw"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={savingPassword}
                    className="w-full bg-green-500 hover:bg-green-600"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {savingPassword ? "Updating..." : "Change Password"}
                  </Button>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Company Information
                  </CardTitle>
                  <CardDescription>
                    Update your company details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input id="company-name" defaultValue="Bangbet Telemarketing" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-website">Website</Label>
                      <Input id="company-website" defaultValue="https://bangbet.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Phone Number</Label>
                      <Input id="company-phone" defaultValue="+1 (555) 123-4567" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Email</Label>
                      <Input id="company-email" defaultValue="info@bangbet.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-address">Address</Label>
                    <Textarea 
                      id="company-address" 
                      defaultValue="123 Business Street, Suite 100, City, State 12345"
                      rows={3}
                    />
                  </div>
                  <Button className="w-fit">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    System Preferences
                  </CardTitle>
                  <CardDescription>
                    Configure system-wide settings and defaults
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Enable Call Recording</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically record all incoming and outgoing calls
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="timezone">Default Timezone</Label>
                        <Select defaultValue="africa/nairobi">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="africa/nairobi">East Africa Time (EAT)</SelectItem>
                            <SelectItem value="america/new_york">Eastern Time (EST)</SelectItem>
                            <SelectItem value="america/chicago">Central Time (CST)</SelectItem>
                            <SelectItem value="america/denver">Mountain Time (MST)</SelectItem>
                            <SelectItem value="america/los_angeles">Pacific Time (PST)</SelectItem>
                            <SelectItem value="europe/london">Greenwich Mean Time (GMT)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">Default Currency</Label>
                        <Select defaultValue="ugx">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ugx">UGX (USh)</SelectItem>
                            <SelectItem value="usd">USD ($)</SelectItem>
                            <SelectItem value="eur">EUR (€)</SelectItem>
                            <SelectItem value="gbp">GBP (£)</SelectItem>
                            <SelectItem value="kes">KES (KSh)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <Button className="w-fit">
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </Button>
                </CardContent>
              </Card>

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
                  
                  <p className="text-xs text-muted-foreground">
                    The app automatically checks for updates when you start it. 
                    Click "Check for Updates" to manually check now.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Management
                    </CardTitle>
                    <CardDescription>
                      Manage user accounts and role assignments
                    </CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">John Smith</TableCell>
                      <TableCell>john@betsure.com</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Manager</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-600">Active</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Sarah Johnson</TableCell>
                      <TableCell>sarah@betsure.com</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Agent</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-600">Active</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dispositions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Call Dispositions</CardTitle>
                    <CardDescription>
                      Configure call outcome options for agents
                    </CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Disposition
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {[
                    { name: "Sale", color: "green", description: "Successful conversion" },
                    { name: "Callback", color: "blue", description: "Schedule follow-up call" },
                    { name: "Not Interested", color: "red", description: "Prospect declined" },
                    { name: "Voicemail", color: "yellow", description: "Left message" },
                    { name: "No Answer", color: "gray", description: "No response" }
                  ].map((disposition) => (
                    <div key={disposition.name} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full bg-${disposition.color}-500`}></div>
                        <div>
                          <p className="font-medium">{disposition.name}</p>
                          <p className="text-sm text-muted-foreground">{disposition.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scripts" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Call Scripts
                    </CardTitle>
                    <CardDescription>
                      Manage call scripts and versioning
                    </CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Script
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "Opening Script", version: "v2.1", status: "Active", lastModified: "2 days ago" },
                    { name: "Objection Handling", version: "v1.5", status: "Active", lastModified: "1 week ago" },
                    { name: "Closing Script", version: "v3.0", status: "Draft", lastModified: "3 hours ago" }
                  ].map((script) => (
                    <div key={script.name} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{script.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{script.version}</span>
                          <span>•</span>
                          <span>Modified {script.lastModified}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={script.status === 'Active' ? 'default' : 'secondary'}>
                          {script.status}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Business Hours
                </CardTitle>
                <CardDescription>
                  Configure operating hours and holiday schedules
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                    <div key={day} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Switch defaultChecked={day !== 'Saturday' && day !== 'Sunday'} />
                        <span className="font-medium">{day}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select defaultValue="09:00">
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="08:00">8:00 AM</SelectItem>
                            <SelectItem value="09:00">9:00 AM</SelectItem>
                            <SelectItem value="10:00">10:00 AM</SelectItem>
                          </SelectContent>
                        </Select>
                        <span>to</span>
                        <Select defaultValue="17:00">
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:00">4:00 PM</SelectItem>
                            <SelectItem value="17:00">5:00 PM</SelectItem>
                            <SelectItem value="18:00">6:00 PM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="w-fit">
                  <Save className="h-4 w-4 mr-2" />
                  Save Hours
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Compliance Settings
                </CardTitle>
                <CardDescription>
                  Configure compliance banners and legal requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Call Recording Notification</Label>
                      <p className="text-sm text-muted-foreground">
                        Play recording notice at call start
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="recording-banner">Recording Banner Text</Label>
                    <Textarea 
                      id="recording-banner"
                      defaultValue="This call may be recorded for quality and training purposes."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compliance-notice">Compliance Notice</Label>
                    <Textarea 
                      id="compliance-notice"
                      defaultValue="By continuing this call, you consent to our terms and conditions as outlined in our privacy policy."
                      rows={4}
                    />
                  </div>
                  <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800">Compliance Reminder</p>
                      <p className="text-amber-700">
                        Ensure all compliance notices meet your local regulatory requirements. 
                        Consult with legal counsel if needed.
                      </p>
                    </div>
                  </div>
                  <Button className="w-fit">
                    <Save className="h-4 w-4 mr-2" />
                    Save Compliance Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;