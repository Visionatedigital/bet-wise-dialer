import { HeartHandshake, Settings, Phone, Upload, LayoutDashboard } from "lucide-react";
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

const crmMenuItems = [
  { title: "Dashboard", url: "/crm/dashboard", icon: LayoutDashboard },
  { title: "Import Clients", url: "/crm/import-leads", icon: Upload },
  { title: "WhatsApp", url: "/whatsapp", icon: Phone },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function CrmSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const getNavClasses = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-[hsl(var(--crm-sidebar-accent))] text-[hsl(var(--crm-sidebar-accent-fg))] font-bold shadow-sm"
      : "text-[hsl(var(--crm-sidebar-fg))]/70 hover:bg-[hsl(var(--crm-sidebar-accent))]/50 hover:text-[hsl(var(--crm-sidebar-fg))] font-medium transition-all duration-200";

  return (
    <Sidebar
      collapsible="icon"
      className="bg-[hsl(var(--crm-sidebar-bg))] text-[hsl(var(--crm-sidebar-fg))] border-r border-[hsl(var(--crm-sidebar-border))] [&_[data-sidebar=sidebar]]:bg-[hsl(var(--crm-sidebar-bg))]"
    >
      <SidebarHeader className="border-b border-[hsl(var(--crm-sidebar-border))]/50 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFE600] shadow-lg shadow-yellow-500/20 text-black transform transition-transform hover:scale-105">
            <HeartHandshake className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-xl font-black text-white tracking-tighter uppercase italic">Bangbet</h1>
              <p className="text-[10px] text-primary/70 font-bold uppercase tracking-[0.2em] -mt-1">CRM Portal</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[hsl(var(--crm-sidebar-fg))]/30 font-bold uppercase tracking-widest text-[9px] px-4">
            Client Relations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {crmMenuItems.map((item) => (
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
