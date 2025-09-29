import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  Phone, 
  Users, 
  Target, 
  BarChart3, 
  Settings, 
  Monitor,
  Plug,
  Home,
  LogOut
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { 
    title: "Dashboard", 
    url: "/", 
    icon: Home,
    description: "Agent workspace & queue"
  },
  { 
    title: "Leads", 
    url: "/leads", 
    icon: Users,
    description: "Manage contacts & prospects"
  },
  { 
    title: "Campaigns", 
    url: "/campaigns", 
    icon: Target,
    description: "Campaign performance"
  },
  { 
    title: "Monitor", 
    url: "/monitor", 
    icon: Monitor,
    description: "Live call monitoring"
  },
  { 
    title: "Reports", 
    url: "/reports", 
    icon: BarChart3,
    description: "Analytics & insights"
  },
  { 
    title: "Integrations", 
    url: "/integrations", 
    icon: Plug,
    description: "Connect external systems"
  },
  { 
    title: "Settings", 
    url: "/settings", 
    icon: Settings,
    description: "System configuration"
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { signOut, user } = useAuth();
  
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  const getNavClasses = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-primary font-medium" 
      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  return (
    <Sidebar
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Phone className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-semibold text-sidebar-foreground">Betsure</h1>
              <p className="text-xs text-sidebar-foreground/60">Telemarketing</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">
            Navigation
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={getNavClasses}
                      title={isCollapsed ? item.description : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* User Profile and Logout */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={signOut}
                  className="text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  title={isCollapsed ? "Sign out" : undefined}
                >
                  <LogOut className="h-4 w-4" />
                  {!isCollapsed && <span>Sign Out</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}