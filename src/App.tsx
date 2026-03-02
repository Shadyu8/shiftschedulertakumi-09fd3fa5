import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MascotProvider } from "@/contexts/MascotContext";
import MascotLayer from "@/components/mascot/MascotLayer";
import ProtectedRoute from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrganizations from "./pages/admin/AdminOrganizations";
import AdminLocations from "./pages/admin/AdminLocations";
import AdminManagers from "./pages/admin/AdminManagers";

import ManagerDashboard from "./pages/manager/ManagerDashboard";
import ManagerUsers from "./pages/manager/ManagerUsers";
import ManagerSchedule from "./pages/manager/ManagerSchedule";
import ManagerExports from "./pages/manager/ManagerExports";
import ManagerSettings from "./pages/manager/ManagerSettings";
import ManagerPunchApprovals from "./pages/manager/ManagerPunchApprovals";

import WorkerDashboard from "./pages/worker/WorkerDashboard";
import WorkerSchedule from "./pages/worker/WorkerSchedule";
import WorkerPunches from "./pages/worker/WorkerPunches";
import WorkerAvailability from "./pages/worker/WorkerAvailability";

import ShiftleaderDashboard from "./pages/shiftleader/ShiftleaderDashboard";
import KioskPage from "./pages/kiosk/KioskPage";
import ShiftSchedulePage from "./pages/shiftschedule/ShiftSchedulePage";
import AccountPage from "./pages/account/AccountPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MascotProvider>
          <MascotLayer />
          <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/organizations" element={<ProtectedRoute allowedRoles={["admin"]}><AdminOrganizations /></ProtectedRoute>} />
            <Route path="/admin/locations" element={<ProtectedRoute allowedRoles={["admin"]}><AdminLocations /></ProtectedRoute>} />
            <Route path="/admin/managers" element={<ProtectedRoute allowedRoles={["admin"]}><AdminManagers /></ProtectedRoute>} />

            {/* Manager routes */}
            <Route path="/manager" element={<ProtectedRoute allowedRoles={["manager"]}><ManagerDashboard /></ProtectedRoute>} />
            <Route path="/manager/users" element={<ProtectedRoute allowedRoles={["manager"]}><ManagerUsers /></ProtectedRoute>} />
            <Route path="/manager/schedule" element={<ProtectedRoute allowedRoles={["manager"]}><ManagerSchedule /></ProtectedRoute>} />
            <Route path="/manager/exports" element={<ProtectedRoute allowedRoles={["manager"]}><ManagerExports /></ProtectedRoute>} />
            <Route path="/manager/settings" element={<ProtectedRoute allowedRoles={["manager"]}><ManagerSettings /></ProtectedRoute>} />
            <Route path="/manager/approvals" element={<ProtectedRoute allowedRoles={["manager"]}><ManagerPunchApprovals /></ProtectedRoute>} />

            {/* Worker routes */}
            <Route path="/worker" element={<ProtectedRoute allowedRoles={["worker", "shiftleader"]}><WorkerDashboard /></ProtectedRoute>} />
            <Route path="/worker/schedule" element={<ProtectedRoute allowedRoles={["worker", "shiftleader"]}><WorkerSchedule /></ProtectedRoute>} />
            <Route path="/worker/punches" element={<ProtectedRoute allowedRoles={["worker", "shiftleader"]}><WorkerPunches /></ProtectedRoute>} />
            <Route path="/worker/availability" element={<ProtectedRoute allowedRoles={["worker", "shiftleader"]}><WorkerAvailability /></ProtectedRoute>} />

            {/* Shift leader */}
            <Route path="/shiftleader" element={<ProtectedRoute allowedRoles={["shiftleader"]}><ShiftleaderDashboard /></ProtectedRoute>} />

            {/* Shared routes */}
            <Route path="/kiosk" element={<ProtectedRoute allowedRoles={["shiftleader", "manager", "kiosk"]}><KioskPage /></ProtectedRoute>} />
            <Route path="/shiftschedule" element={<ProtectedRoute><ShiftSchedulePage /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
        </MascotProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
