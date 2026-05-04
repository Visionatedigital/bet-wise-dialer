import { useState, useEffect } from 'react';
import { api } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, KeyRound, UserCheck, UserX, Users, Clock } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { COUNTRY_MAP } from '@/config/countries';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  approved: boolean;
  rejected?: boolean;
  created_at: string;
  roles: string[];
  country?: string;
}

const UserManagementContent = () => {
  const { user: currentUser } = useAuth();
  const { isManagement } = useUserRole();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingAll, setApprovingAll] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get<UserProfile[]>('/users');
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      await api.patch(`/users/${userId}/approve`, { approved: true });
      toast.success('Agent approved successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error approving user:', error);
      toast.error(error.message || 'Failed to approve agent');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      toast.success(`Role updated to ${newRole} successfully`);
      fetchUsers();
    } catch (error: any) {
      console.error('[UserManagement] Error updating role:', error);
      toast.error(`Failed to update role: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await api.patch(`/users/${userId}/reject`);
      toast.success('Agent rejected — they can now re-sign up with the correct country');
      fetchUsers();
    } catch (error: any) {
      console.error('Error rejecting user:', error);
      toast.error(error.message || 'Failed to reject agent');
    }
  };

  const handleApproveAll = async () => {
    const pendingUsers = users.filter(u => !u.approved && !u.rejected);
    if (pendingUsers.length === 0) {
      toast.info('No pending agents to approve');
      return;
    }

    if (!confirm(`Are you sure you want to approve ${pendingUsers.length} pending agent(s)?`)) {
      return;
    }

    setApprovingAll(true);
    try {
      await Promise.all(pendingUsers.map(u => api.patch(`/users/${u.id}/approve`, { approved: true })));
      toast.success(`${pendingUsers.length} agent(s) approved successfully`);
      fetchUsers();
    } catch (error: any) {
      console.error('Error approving users:', error);
      toast.error(error.message || 'Failed to approve agents');
    } finally {
      setApprovingAll(false);
    }
  };

  const handleDeleteClick = (user: UserProfile) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/users/${userToDelete.id}`);
      toast.success('Agent deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete agent');
    }
  };

  const handleManualPasswordClick = (user: UserProfile) => {
    setUserToResetPassword(user);
    setNewPassword('');
    setPasswordDialogOpen(true);
  };

  const handleManualPasswordSet = async () => {
    if (!userToResetPassword || !newPassword) return;
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }

    setSettingPassword(true);
    try {
      await api.post(`/users/${userToResetPassword.id}/reset-password`, { new_password: newPassword });
      toast.success('Password updated successfully');
      setPasswordDialogOpen(false);
      setUserToResetPassword(null);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error setting password:', error);
      toast.error(error.message || 'Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };

  const pendingUsers = users.filter(u => !u.approved && !u.rejected);
  const approvedUsers = users.filter(u => u.approved);
  const rejectedUsers = users.filter(u => u.rejected);

  const CountryCell = ({ country }: { country?: string }) =>
    country ? (
      <span title={COUNTRY_MAP[country]?.name || country}>
        {COUNTRY_MAP[country]?.flag || ''} {country}
      </span>
    ) : <span className="text-muted-foreground">—</span>;

  const renderApprovedTable = (list: UserProfile[]) => (
    list.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground">
        <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>No approved agents found</p>
      </div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.full_name}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
              <TableCell><CountryCell country={user.country} /></TableCell>
              <TableCell>
                {isManagement ? (
                  <Badge variant="outline" className="text-xs capitalize">
                    {user.roles[0] || 'agent'}
                  </Badge>
                ) : (
                  <Select
                    value={user.roles[0] || 'agent'}
                    onValueChange={(value) => handleRoleChange(user.id, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="crm">CRM Agent</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleManualPasswordClick(user)}
                    title="Change Password"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span className="ml-1.5 hidden sm:inline">Password</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteClick(user)}
                    title="Delete Agent"
                    className="bg-red-500 hover:bg-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-1.5 hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  const renderPendingTable = (list: UserProfile[]) => (
    list.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>No pending agents — all caught up!</p>
      </div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.full_name}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
              <TableCell><CountryCell country={user.country} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(user.id)}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <UserCheck className="h-4 w-4 mr-1.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(user.id)}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <UserX className="h-4 w-4 mr-1.5" />
                    Reject
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  const renderRejectedTable = (list: UserProfile[]) => (
    list.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground">
        <UserX className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>No rejected agents</p>
      </div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.full_name}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
              <TableCell><CountryCell country={user.country} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(user.id)}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <UserCheck className="h-4 w-4 mr-1.5" />
                    Re-approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteClick(user)}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approve Agents</h1>
          <p className="text-muted-foreground">
            Manage agent accounts in your team
          </p>
        </div>
        {pendingUsers.length > 0 && (
          <Button
            onClick={handleApproveAll}
            disabled={approvingAll}
            className="bg-green-500 hover:bg-green-600"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            {approvingAll ? 'Approving...' : `Approve All (${pendingUsers.length})`}
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-700">{pendingUsers.length}</p>
                <p className="text-xs text-yellow-600 font-medium">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700">{approvedUsers.length}</p>
                <p className="text-xs text-green-600 font-medium">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <UserX className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700">{rejectedUsers.length}</p>
                <p className="text-xs text-red-600 font-medium">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4" />
              <p className="text-muted-foreground">Loading agents...</p>
            </div>
          ) : (
            <Tabs defaultValue="all">
              <TabsList className="mb-4">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending
                  {pendingUsers.length > 0 && (
                    <Badge className="ml-1 bg-yellow-500 text-white text-xs h-5 px-1.5">
                      {pendingUsers.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  All Approved
                  <Badge variant="outline" className="ml-1 text-xs h-5 px-1.5">
                    {approvedUsers.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="rejected" className="flex items-center gap-2">
                  <UserX className="h-4 w-4" />
                  Rejected
                  {rejectedUsers.length > 0 && (
                    <Badge className="ml-1 bg-red-500 text-white text-xs h-5 px-1.5">
                      {rejectedUsers.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                {renderPendingTable(pendingUsers)}
              </TabsContent>

              <TabsContent value="all">
                {renderApprovedTable(approvedUsers)}
              </TabsContent>

              <TabsContent value="rejected">
                {renderRejectedTable(rejectedUsers)}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{userToDelete?.full_name || userToDelete?.email}</strong>'s account.
              This action cannot be undone. All associated data including leads, calls, and metrics will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{userToResetPassword?.full_name || userToResetPassword?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 6 characters)"
                onKeyDown={(e) => e.key === 'Enter' && handleManualPasswordSet()}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPasswordDialogOpen(false)}
                disabled={settingPassword}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleManualPasswordSet}
                disabled={!newPassword || newPassword.length < 6 || settingPassword}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {settingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const UserManagement = () => {
  const { isManagement } = useUserRole();

  if (isManagement) {
    return (
      <ManagementLayout>
        <UserManagementContent />
      </ManagementLayout>
    );
  }

  return (
    <AdminLayout>
      <UserManagementContent />
    </AdminLayout>
  );
};

export default UserManagement;
