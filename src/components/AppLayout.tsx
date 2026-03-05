import { ReactNode } from "react";
import AppNavigation from "./AppNavigation";
import { SidebarStateProvider, useSidebarState } from "@/contexts/SidebarContext";

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { sidebarOpen } = useSidebarState();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppNavigation />
      <main className={`pt-12 md:pt-0 pb-16 md:pb-0 flex-1 overflow-y-auto transition-all duration-200 ${sidebarOpen ? "md:ml-64" : "md:ml-16"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>
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
