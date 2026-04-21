import { useState, useEffect } from 'react';
import { api } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Trash2, KeyRound } from 'lucide-react';
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
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
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

const UserManagement = () => {
  const { user: currentUser } = useAuth();
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
      toast.success('User approved successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error approving user:', error);
      toast.error(error.message || 'Failed to approve user');
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
      toast.success('User rejected — they can now re-sign up with the correct country');
      fetchUsers();
    } catch (error: any) {
      console.error('Error rejecting user:', error);
      toast.error(error.message || 'Failed to reject user');
    }
  };

  const handleApproveAll = async () => {
    const pendingUsers = users.filter(u => !u.approved && !u.rejected);
    if (pendingUsers.length === 0) {
      toast.info('No pending users to approve');
      return;
    }

    if (!confirm(`Are you sure you want to approve ${pendingUsers.length} pending user(s)?`)) {
      return;
    }

    setApprovingAll(true);
    try {
      await Promise.all(pendingUsers.map(u => api.patch(`/users/${u.id}/approve`, { approved: true })));
      toast.success(`${pendingUsers.length} user(s) approved successfully`);
      fetchUsers();
    } catch (error: any) {
      console.error('Error approving users:', error);
      toast.error(error.message || 'Failed to approve users');
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
      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
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

const pendingCount = users.filter(u => !u.approved && !u.rejected).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Approve users and manage roles</p>
          </div>
          {pendingCount > 0 && (
            <Button 
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="bg-green-500 hover:bg-green-600"
            >
              {approvingAll ? 'Approving...' : `Approve All (${pendingCount})`}
            </Button>
          )}
        </div>
        
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.country ? (
                          <span title={COUNTRY_MAP[user.country]?.name || user.country}>
                            {COUNTRY_MAP[user.country]?.flag || ''} {user.country}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {user.approved ? (
                          <Badge variant="default" className="bg-green-500">Approved</Badge>
                        ) : user.rejected ? (
                          <Badge variant="destructive">Rejected</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-500">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.roles[0] || 'agent'}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                          disabled={!user.approved}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="management">Management</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!user.approved && !user.rejected ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(user.id)}
                                className="bg-green-500 hover:bg-green-600"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(user.id)}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                              >
                                Reject
                              </Button>
                            </>
                          ) : user.approved ? (
                            <span className="text-xs text-muted-foreground">Approved</span>
                          ) : (
                            <span className="text-xs text-red-500">Rejected</span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManualPasswordClick(user)}
                            title="Set Password Manually"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteClick(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {userToDelete?.full_name || userToDelete?.email}'s account.
              This action cannot be undone. All associated data including leads, calls, and metrics will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password for {userToResetPassword?.full_name}</DialogTitle>
            <DialogDescription>
              Manually set a new password for {userToResetPassword?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
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
                disabled={!newPassword || settingPassword}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                {settingPassword ? 'Setting...' : 'Set Password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default UserManagement;
