import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Search, User, Settings, Moon, Sun, Coffee, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { supabase } from "@/integrations/supabase/client";
import { NotificationDropdown } from "./NotificationDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { status, updateStatus } = useAgentStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [todayCallsCount, setTodayCallsCount] = useState(0);
  const [isAdminViewing, setIsAdminViewing] = useState(false);

  // Check if admin is viewing as agent
  useEffect(() => {
    const checkAdminView = async () => {
      if (!user) return;
      
      const adminViewMode = localStorage.getItem('adminViewMode');
      if (adminViewMode === 'agent') {
        // Verify user is actually an admin
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (data?.role === 'admin') {
          setIsAdminViewing(true);
        }
      }
    };
    
    checkAdminView();
  }, [user]);

  const handleBackToAdmin = () => {
    localStorage.setItem('adminViewMode', 'admin');
    window.location.reload();
  };

  useEffect(() => {
    if (!user) return;

    const fetchHeaderStats = async () => {
      try {
        // Fetch queue count (leads count)
        const { count: leadsCount } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        setQueueCount(leadsCount || 0);

        // Fetch today's calls count
        const today = new Date().toISOString().split('T')[0];
        const { count: callsCount } = await supabase
          .from('call_activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('start_time', `${today}T00:00:00`)
          .lt('start_time', `${today}T23:59:59`);

        setTodayCallsCount(callsCount || 0);
      } catch (error) {
        console.error('Error fetching header stats:', error);
      }
    };

    fetchHeaderStats();

    // Set up real-time subscriptions
    const leadsChannel = supabase
      .channel('leads-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchHeaderStats();
        }
      )
      .subscribe();

    const callsChannel = supabase
      .channel('calls-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_activities',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchHeaderStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(callsChannel);
    };
  }, [user]);

  // Generate initials from email
  const getInitials = (email: string): string => {
    if (!email) return "U";
    const emailPrefix = email.split("@")[0];
    const words = emailPrefix.split(/[._-]/);
    
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    
    return emailPrefix.substring(0, 2).toUpperCase();
  };

  const userEmail = user?.email || "user@example.com";
  const userInitials = getInitials(userEmail);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-dashboard-bg">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center gap-4 px-4">
              <SidebarTrigger className="md:hidden" />
              
              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search leads, campaigns, calls..."
                    className="pl-9 bg-muted/50"
                  />
                </div>
              </div>

              {/* Quick Stats */}
              <div className="hidden lg:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
                  <span className="text-muted-foreground">Live Queue:</span>
                  <span className="font-medium">{queueCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Today's Calls:</span>
                  <span className="font-medium">{todayCallsCount}</span>
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                {/* Back to Admin Button */}
                {isAdminViewing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBackToAdmin}
                    className="gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    <span className="hidden md:inline">Back to Admin</span>
                  </Button>
                )}

                {/* Theme Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>

                {/* Notifications */}
                <NotificationDropdown />

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {userInitials}
                      </div>
                      <span className="hidden md:inline text-sm">{userEmail}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-sm font-medium">
                      {userEmail}
                    </div>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Agent • <span className="capitalize">{status}</span>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => updateStatus(status === 'break' ? 'online' : 'break')}
                    >
                      <Coffee className="mr-2 h-4 w-4" />
                      {status === 'break' ? 'End Break' : 'Take Break'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => signOut()}>
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>

          {/* Compliance Footer */}
          <footer className="border-t bg-muted/30 px-6 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Please bet responsibly. 18+ Only.</span>
              <span>Betsure Uganda • EAT (UTC+3) • Support: +256 800 123456</span>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}