import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  approved: boolean;
  created_at: string;
  roles: string[];
}

const UserManagement = () => {
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
      
      // Fetch all profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Fetch roles for each user
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: userRoles?.filter(r => r.user_id === profile.id).map(r => r.role) || []
      })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approved: true })
        .eq('id', userId);

      if (error) throw error;

      toast.success('User approved successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Failed to approve user');
    }
  };

const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // Remove existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Add new role
      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role: newRole as any }]);

      if (error) throw error;

      toast.success('Role updated successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleApproveAll = async () => {
    const pendingUsers = users.filter(u => !u.approved);
    if (pendingUsers.length === 0) {
      toast.info('No pending users to approve');
      return;
    }

    if (!confirm(`Are you sure you want to approve ${pendingUsers.length} pending user(s)?`)) {
      return;
    }

    setApprovingAll(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approved: true })
        .in('id', pendingUsers.map(u => u.id));

      if (error) throw error;

      toast.success(`${pendingUsers.length} user(s) approved successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error approving users:', error);
      toast.error('Failed to approve users');
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
      // Delete user roles first
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userToDelete.id);

      // Delete profile (this will cascade from auth.users deletion)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userToDelete.id);

      if (profileError) throw profileError;

      // Call edge function to delete auth user
      const { error: authError } = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete.id }
      });

      if (authError) {
        console.error('Error deleting auth user:', authError);
        toast.warning('User profile deleted but auth account may remain');
      } else {
        toast.success('User deleted successfully');
      }

      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handlePasswordReset = async (email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { email }
      });

      if (error) throw error;

      if (data?.resetLink) {
        toast.success('Password reset link generated! Check console for link.');
        console.log('Password reset link:', data.resetLink);
      } else {
        toast.success('Password reset email sent to user');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
    }
  };

  const handleManualPasswordClick = (user: UserProfile) => {
    setUserToResetPassword(user);
    setNewPassword('');
    setPasswordDialogOpen(true);
  };

  const handleManualPasswordSet = async () => {
    if (!userToResetPassword || !newPassword) return;

    setSettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-set-password', {
        body: { 
          email: userToResetPassword.email,
          password: newPassword
        }
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setPasswordDialogOpen(false);
      setUserToResetPassword(null);
      setNewPassword('');
    } catch (error) {
      console.error('Error setting password:', error);
      toast.error('Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };

const pendingCount = users.filter(u => !u.approved).length;

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
                        {user.approved ? (
                          <Badge variant="default" className="bg-green-500">Approved</Badge>
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
                          {!user.approved ? (
                            <Button
                              size="sm"
                              onClick={() => handleApprove(user.id)}
                              className="bg-green-500 hover:bg-green-600"
                            >
                              Approve
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Approved</span>
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
