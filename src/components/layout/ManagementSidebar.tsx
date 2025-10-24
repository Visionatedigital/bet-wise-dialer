import { BarChart3, TrendingUp, Users, Target, FileText, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const managementMenuItems = [
  { title: "Analytics", url: "/", icon: BarChart3 },
  { title: "Performance", url: "/performance", icon: TrendingUp },
  { title: "Agent Monitoring", url: "/management-monitor", icon: Users },
  { title: "Campaigns", url: "/campaigns", icon: Target },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function ManagementSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className="border-r bg-sidebar">
      <SidebarContent>
        <div className="px-6 py-4">
          <h2 className={`font-bold ${collapsed ? "text-sm" : "text-xl"} text-primary`}>
            Management
          </h2>
          {!collapsed && <p className="text-xs text-muted-foreground">Analytics & Insights</p>}
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>Performance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url}
                      className={({ isActive }) =>
                        isActive 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "hover:bg-accent"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
