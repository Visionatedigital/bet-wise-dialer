import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [approved, setApproved] = useState<boolean | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!user) {
        setCheckingApproval(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('approved')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking approval status:', error);
          setApproved(false);
        } else {
          setApproved(data?.approved ?? false);
        }
      } catch (error) {
        console.error('Error checking approval:', error);
        setApproved(false);
      } finally {
        setCheckingApproval(false);
      }
    };

    checkApprovalStatus();
  }, [user]);

  if (loading || checkingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (approved === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert className="border-yellow-500 bg-yellow-500/10">
            <AlertDescription className="text-center space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Account Pending Approval</h2>
                <p className="text-muted-foreground">
                  Your account has been created successfully but is awaiting administrator approval. 
                  Please contact your administrator to activate your account.
                </p>
              </div>
              <Button 
                onClick={signOut}
                variant="outline"
                className="w-full"
              >
                Sign Out
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;