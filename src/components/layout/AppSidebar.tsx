import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Phone,
  Target,
  BarChart3,
  Settings,
  Monitor,
  Plug,
  Home,
  LogOut,
  CheckSquare,
  LucideProps
} from "lucide-react";
import WhatsAppLogo from "@/assets/whatsapp-logo.svg";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppUnreadCount } from "@/hooks/useWhatsAppUnreadCount";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

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
    url: "/kanban",
    icon: CheckSquare,
    description: "Lead management board"
  },
  {
    title: "WhatsApp",
    url: "/whatsapp",
    icon: ({ className }: LucideProps) => (
      <img src={WhatsAppLogo} alt="" className={className} style={{ filter: 'brightness(0)' }} />
    ),
    description: "WhatsApp messaging"
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
    title: "Performance",
    url: "/reports",
    icon: BarChart3,
    description: "Performance & analytics"
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
  const { isAdmin, isManagement } = useUserRole();
  const unreadCount = useWhatsAppUnreadCount();

  const isCollapsed = state === "collapsed";

  // Filter navigation items based on role
  const filteredNavItems = navigationItems.filter(item => {
    // Hide Monitor and Integrations from agents
    if (item.url === '/monitor' || item.url === '/integrations') {
      return isAdmin || isManagement;
    }
    return true;
  });

  const isActive = (path: string) => currentPath === path;
  const getNavClasses = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-[#333333]/20 text-[#333333] font-bold"
      : "text-[#333333]/80 hover:bg-[#333333]/10 hover:text-[#333333] font-medium";

  return (
    <Sidebar
      collapsible="icon"
      className="bg-[#FFE600] text-[#333333] border-r border-[#E6CF00] [&_[data-sidebar=sidebar]]:bg-[#FFE600]"
    >
      <SidebarHeader className="border-b border-[#333333]/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#333333] text-[#FFE600]">
            <Phone className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-black text-[#333333] tracking-tight uppercase">Bangbet</h1>
              <p className="text-xs text-[#333333]/70 font-medium">Telemarketing</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#333333]/50 font-bold uppercase tracking-wider text-[10px]">
            Navigation
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={getNavClasses}
                      title={isCollapsed ? item.description : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && (
                        <span className="flex items-center gap-2 flex-1">
                          {item.title}
                          {item.title === "WhatsApp" && unreadCount > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
                              {unreadCount}
                            </Badge>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* User Profile and Logout */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={signOut}
                  className="text-[#333333]/80 hover:bg-[#333333]/10 hover:text-[#333333] font-medium"
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