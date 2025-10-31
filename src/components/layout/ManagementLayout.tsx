import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ManagementSidebar } from "./ManagementSidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Bell, Shield, Users } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ManagementLayoutProps {
  children: React.ReactNode;
}

export function ManagementLayout({ children }: ManagementLayoutProps) {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();

  const switchDashboard = (mode: 'agent' | 'management' | 'admin') => {
    localStorage.setItem('adminViewMode', mode);
    window.location.reload();
  };

  const getInitials = (email: string): string => {
    if (!email) return "M";
    const emailPrefix = email.split("@")[0];
    return emailPrefix.substring(0, 2).toUpperCase();
  };

  const userEmail = user?.email || "manager@example.com";
  const userInitials = getInitials(userEmail);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <ManagementSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center gap-4 px-6">
              <SidebarTrigger />
              
              <div className="flex-1" />

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>

                <Button variant="ghost" size="icon">
                  <Bell className="h-5 w-5" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                        {userInitials}
                      </div>
                      <span className="hidden md:inline text-sm font-medium">{userEmail}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-sm font-medium">{userEmail}</div>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Manager</div>
                    <DropdownMenuSeparator />
                    {isAdmin && (
                      <>
                        <DropdownMenuItem onClick={() => switchDashboard('agent')}>
                          <Users className="mr-2 h-4 w-4" />
                          Switch to Agent View
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

          <main className="flex-1 p-6">{children}</main>

          <footer className="border-t bg-muted/30 px-6 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Management Portal v1.0</span>
              <span>Betsure Uganda • Performance Analytics</span>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
