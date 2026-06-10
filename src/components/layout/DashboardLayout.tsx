import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Search, User, Settings, Moon, Sun, Coffee, Shield, LayoutDashboard, HeartHandshake } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { supabase } from "@/integrations/supabase/client";
import { NotificationDropdown } from "./NotificationDropdown";
import { useUserRole } from "@/hooks/useUserRole";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { AdminSidebar } from "./AdminSidebar";
import { ManagementSidebar } from "./ManagementSidebar";
import { CrmSidebar } from "./CrmSidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Softphone } from "@/components/dashboard/Softphone";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { X } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { status, updateStatus } = useAgentStatus();
  const { isAdmin, isManagement, isCrm, role } = useUserRole();
  const isAdminUser = user?.role === 'admin';

  const { currentVersion } = useAutoUpdate();
  const [queueCount, setQueueCount] = useState(0);
  const [todayCallsCount, setTodayCallsCount] = useState(0);
  const { showSoftphone, setShowSoftphone, activeLead } = useSoftphone();

  const switchDashboard = (mode: 'agent' | 'management' | 'admin' | 'crm') => {
    localStorage.setItem('adminViewMode', mode);
    window.location.reload();
  };

  useEffect(() => {
    if (!user) return;

    const fetchHeaderStats = async () => {
      try {
        // Determine which user IDs to fetch data for
        let userIds: string[] = [];

        if (isManagement && !isAdmin && user) {
          // For managers, fetch their assigned agents
          const { data: managerAgents } = await supabase
            .from('profiles')
            .select('id')
            .eq('manager_id', user.id)
            .eq('approved', true);

          userIds = managerAgents?.map(a => a.id) || [];

          if (userIds.length === 0) {
            setQueueCount(0);
            setTodayCallsCount(0);
            return;
          }
        } else {
          // For regular agents or admins, use their own ID
          userIds = [user.id];
        }

        // Fetch queue count (leads count) - for managers, sum across all agents
        let leadsQuery = supabase
          .from('leads')
          .select('*', { count: 'exact', head: true });

        if (isManagement && !isAdmin) {
          leadsQuery = leadsQuery.in('user_id', userIds);
        } else {
          leadsQuery = leadsQuery.eq('user_id', user.id);
        }

        const { count: leadsCount } = await leadsQuery;
        setQueueCount(leadsCount || 0);

        // Fetch today's calls count - for managers, sum across all agents
        const today = new Date().toISOString().split('T')[0];
        let callsQuery = supabase
          .from('call_activities')
          .select('*', { count: 'exact', head: true })
          .in('user_id', userIds)
          .gte('start_time', `${today}T00:00:00`)
          .lt('start_time', `${today}T23:59:59`);

        const { count: callsCount } = await callsQuery;
        setTodayCallsCount(callsCount || 0);
      } catch (error) {
        console.error('Error fetching header stats:', error);
      }
    };

    fetchHeaderStats();

    // Set up real-time subscriptions
    // For managers, subscribe to all their agents' data
    const setupSubscriptions = async () => {
      let leadsFilter = `user_id=eq.${user.id}`;
      let callsFilter = `user_id=eq.${user.id}`;

      if (isManagement && !isAdmin && user) {
        const { data: managerAgents } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', user.id)
          .eq('approved', true);

        const agentIds = managerAgents?.map(a => a.id) || [];
        if (agentIds.length > 0) {
          leadsFilter = `user_id=in.(${agentIds.join(',')})`;
          callsFilter = `user_id=in.(${agentIds.join(',')})`;
        }
      }

      const leadsChannel = supabase
        .channel('leads-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leads',
            filter: leadsFilter
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
            filter: callsFilter
          },
          () => {
            fetchHeaderStats();
          }
        )
        .subscribe();

      return () => {
        leadsChannel.unsubscribe();
        callsChannel.unsubscribe();
      };
    };

    let cleanup: (() => void) | undefined;
    setupSubscriptions().then(unsub => {
      cleanup = unsub;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [user, isManagement, isAdmin]);

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

  const location = useLocation();
  const isEmbeddedPage = location.pathname === "/" || location.pathname === "/kanban" || location.pathname === "/telemarketing";

  return (
    <SidebarProvider defaultOpen={true}>
      <div className={`flex min-h-screen w-full overflow-x-hidden ${isCrm ? 'bg-[#fffdf5] dark:bg-slate-950' : 'bg-dashboard-bg'}`}>

        {isAdminUser && (!localStorage.getItem('adminViewMode') || localStorage.getItem('adminViewMode') === 'admin') ? (
          <AdminSidebar />
        ) : isManagement ? (
          <ManagementSidebar />
        ) : isCrm ? (
          <CrmSidebar />
        ) : (
          <AppSidebar />
        )}


        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Header */}
          <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                    <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1 pt-1">
                      Version v{currentVersion}
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
                    {isAdminUser && (
                      <>
                        <DropdownMenuItem onClick={() => switchDashboard('crm')}>
                          <HeartHandshake className="mr-2 h-4 w-4" />
                          Switch to CRM View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => switchDashboard('management')}>
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Switch to Management View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => switchDashboard('admin')}>
                          <Shield className="mr-2 h-4 w-4" />
                          Switch to Admin Panel
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem className="text-destructive" onClick={() => signOut()}>
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 min-h-0 min-w-0 p-6">
            {children}
          </main>

          {/* Global Softphone Container */}
          {showSoftphone && (
            <div className="fixed bottom-6 right-6 z-[50] w-[380px] bg-background shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-3xl border border-border overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
              {/* Close Button Header */}
              <div className="flex justify-end p-2 bg-muted/20 border-b border-border/50">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-destructive hover:text-white transition-colors"
                  onClick={() => setShowSoftphone(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-1">
                <Softphone
                  currentLead={activeLead || undefined}
                />
              </div>
            </div>
          )}

          {/* Compliance Footer */}
          <footer className="border-t bg-muted/30 px-6 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Please bet responsibly. 18+ Only.</span>
              <div className="flex items-center gap-4">
                <span>Bangbet Uganda • EAT (UTC+3) • Support: +256 800 123456</span>
                <span className="font-mono">v{currentVersion}</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

    </SidebarProvider >
  );
}