import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { UpdateDialog } from "@/components/UpdateDialog";

// Lazy load pages for better initial load performance
const RoleBasedDashboard = lazy(() => import("@/components/RoleBasedDashboard").then(m => ({ default: m.RoleBasedDashboard })));
const RoleBasedReports = lazy(() => import("@/components/RoleBasedReports").then(m => ({ default: m.RoleBasedReports })));
const RoleBasedSettings = lazy(() => import("@/components/RoleBasedSettings").then(m => ({ default: m.RoleBasedSettings })));
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Monitor = lazy(() => import("./pages/Monitor"));
const Performance = lazy(() => import("./pages/Performance"));
const ManagementMonitor = lazy(() => import("./pages/ManagementMonitor"));
const ManagementCampaigns = lazy(() => import("./pages/ManagementCampaigns"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Callbacks = lazy(() => import("./pages/Callbacks"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Component that initializes auto-update checking and shows update dialog
function AutoUpdateChecker({ children }: { children: React.ReactNode }) {
  const { 
    currentVersion,
    updateInfo, 
    showUpdateDialog, 
    setShowUpdateDialog,
    downloadAndInstall,
    dismissUpdate 
  } = useAutoUpdate();

  return (
    <>
      {children}
      {updateInfo && (
        <UpdateDialog
          open={showUpdateDialog}
          onOpenChange={setShowUpdateDialog}
          currentVersion={currentVersion}
          newVersion={updateInfo.version}
          releaseNotes={updateInfo.releaseNotes}
          onDownload={downloadAndInstall}
          onDismiss={dismissUpdate}
        />
      )}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider defaultTheme="light" storageKey="betsure-theme">
        <TooltipProvider>
          <AutoUpdateChecker>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <RoleBasedDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <RoleBasedDashboard />
                </ProtectedRoute>
              } />
              <Route path="/monitor" element={
                <ProtectedRoute>
                  <Monitor />
                </ProtectedRoute>
              } />
              <Route path="/management-monitor" element={
                <ProtectedRoute>
                  <ManagementMonitor />
                </ProtectedRoute>
              } />
              <Route path="/performance" element={
                <ProtectedRoute>
                  <Performance />
                </ProtectedRoute>
              } />
              <Route path="/leads" element={
                <ProtectedRoute>
                  <Leads />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <RoleBasedReports />
                </ProtectedRoute>
              } />
              <Route path="/campaigns" element={
                <ProtectedRoute>
                  <Campaigns />
                </ProtectedRoute>
              } />
              <Route path="/management-campaigns" element={
                <ProtectedRoute>
                  <ManagementCampaigns />
                </ProtectedRoute>
              } />
              <Route path="/management-campaign" element={
                <ProtectedRoute>
                  <ManagementCampaigns />
                </ProtectedRoute>
              } />
              <Route path="/integrations" element={
                <ProtectedRoute>
                  <Integrations />
                </ProtectedRoute>
              } />
          <Route path="/callbacks" element={
            <ProtectedRoute>
              <Callbacks />
            </ProtectedRoute>
          } />
          <Route path="/whatsapp" element={
            <ProtectedRoute>
              <WhatsApp />
            </ProtectedRoute>
          } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <RoleBasedSettings />
                </ProtectedRoute>
              } />
              <Route path="/user-management" element={
                <ProtectedRoute>
                  <UserManagement />
                </ProtectedRoute>
              } />
              <Route path="/users" element={
                <ProtectedRoute>
                  <UserManagement />
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          </AutoUpdateChecker>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
