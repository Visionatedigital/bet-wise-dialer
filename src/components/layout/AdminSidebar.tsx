import { Users, UserCog, FileText, Settings, LayoutDashboard, Phone, Upload, RefreshCcw } from "lucide-react";
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
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const adminMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "User Management", url: "/user-management", icon: UserCog },
  { title: "Import Leads", url: "/manager/import-leads", icon: Upload },
  { title: "Refresh Performance", url: "/manager/refresh-performance", icon: RefreshCcw },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500 text-[#FFE600]">
            <Phone className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-black text-[#333333] tracking-tight uppercase">Bangbet</h1>
              <p className="text-xs text-[#333333]/70 font-medium">Admin Panel</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[#333333]/50 font-bold uppercase tracking-wider text-[10px]">
            Administration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClasses}
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
