import { ReactNode } from "react";
import AppNavigation from "./AppNavigation";
import { SidebarStateProvider, useSidebarState } from "@/contexts/SidebarContext";

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { sidebarOpen } = useSidebarState();

  return (
    <div className="h-[100dvh] md:min-h-screen bg-background flex flex-col overflow-hidden md:overflow-visible">
      <AppNavigation />
      <main className={`flex-1 overflow-y-auto transition-all duration-200 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0 ${sidebarOpen ? "md:ml-64" : "md:ml-16"}`}>
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
