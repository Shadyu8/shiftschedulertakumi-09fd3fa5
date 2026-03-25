import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import AppNavigation, { MobileBottomNav, roleNavItems } from "./AppNavigation";
import { SidebarStateProvider, useSidebarState } from "@/contexts/SidebarContext";
import { useAuth } from "@/contexts/AuthContext";

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { sidebarOpen } = useSidebarState();
  const { role } = useAuth();
  const location = useLocation();

  const navItems = roleNavItems[role || ""] || [];
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/");

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <AppNavigation />

      <main
        className={`flex-1 overflow-y-auto transition-all duration-200 ${sidebarOpen ? "md:ml-64" : "md:ml-16"}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-8 pb-20 md:pb-8">
          {children}
        </div>
      </main>

      {navItems.length > 0 && (
        <MobileBottomNav navItems={navItems} isActive={isActive} />
      )}
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarStateProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarStateProvider>
  );
}
