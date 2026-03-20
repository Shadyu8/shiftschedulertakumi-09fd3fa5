import { ReactNode } from "react";
import AppNavigation from "./AppNavigation";
import { SidebarStateProvider, useSidebarState } from "@/contexts/SidebarContext";

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { sidebarOpen } = useSidebarState();

  return (
    <div className="h-[100dvh] md:min-h-screen bg-background flex flex-col overflow-hidden md:overflow-visible">
      <AppNavigation />
      {/* Mobile top spacer — exactly matches the fixed header height */}
      <div
        className="md:hidden shrink-0"
        style={{ height: 'calc(3rem + env(safe-area-inset-top))' }}
      />
      <main
        className={`flex-1 min-h-0 overflow-y-auto transition-all duration-200 md:pt-0 md:pb-0 ${sidebarOpen ? "md:ml-64" : "md:ml-16"}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-8">
          {children}
        </div>
      </main>
      {/* Mobile bottom spacer — exactly matches the fixed bottom nav height */}
      <div
        className="md:hidden shrink-0"
        style={{ height: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      />
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
