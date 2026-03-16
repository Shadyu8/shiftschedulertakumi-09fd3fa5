import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarState } from "@/contexts/SidebarContext";
import {
  LayoutDashboard, Users, Calendar, Clock, ClipboardList,
  Settings, LogOut, Monitor, FileText, Building2,
  MapPin, UserCog, User, CheckSquare, PanelLeftClose, PanelLeft
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  mobileLabel?: string;
}

const roleNavItems: Record<string, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", mobileLabel: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/admin/organizations", label: "Organizations", mobileLabel: "Orgs", icon: <Building2 className="w-5 h-5" /> },
    { href: "/admin/locations", label: "Locations", mobileLabel: "Locs", icon: <MapPin className="w-5 h-5" /> },
    { href: "/admin/managers", label: "Managers", mobileLabel: "Mgrs", icon: <UserCog className="w-5 h-5" /> },
  ],
  manager: [
    { href: "/manager", label: "Dashboard", mobileLabel: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/manager/users", label: "Workers", icon: <Users className="w-5 h-5" /> },
    { href: "/manager/approvals", label: "Approvals", icon: <CheckSquare className="w-5 h-5" /> },
    { href: "/manager/schedule", label: "Schedule Builder", mobileLabel: "Builder", icon: <Calendar className="w-5 h-5" /> },
    { href: "/manager/exports", label: "Exports", icon: <FileText className="w-5 h-5" /> },
    { href: "/shiftschedule", label: "Shift Schedule", mobileLabel: "Schedule", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/kiosk", label: "Kiosk", icon: <Monitor className="w-5 h-5" /> },
    { href: "/manager/settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
  ],
  shiftleader: [
    { href: "/shiftleader", label: "Dashboard", mobileLabel: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/worker/schedule", label: "My Schedule", mobileLabel: "Schedule", icon: <Calendar className="w-5 h-5" /> },
    { href: "/worker/punches", label: "My Punches", mobileLabel: "Punches", icon: <Clock className="w-5 h-5" /> },
    { href: "/worker/availability", label: "Availability", mobileLabel: "Avail", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/shiftschedule", label: "Shift Schedule", mobileLabel: "Shifts", icon: <ClipboardList className="w-5 h-5" /> },
  ],
  worker: [
    { href: "/worker", label: "Dashboard", mobileLabel: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/worker/schedule", label: "My Schedule", mobileLabel: "Schedule", icon: <Calendar className="w-5 h-5" /> },
    { href: "/worker/punches", label: "My Punches", mobileLabel: "Punches", icon: <Clock className="w-5 h-5" /> },
    { href: "/worker/availability", label: "Availability", mobileLabel: "Avail", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/shiftschedule", label: "Shift Schedule", mobileLabel: "Shifts", icon: <ClipboardList className="w-5 h-5" /> },
  ],
  fulltimer: [
    { href: "/worker", label: "Dashboard", mobileLabel: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/worker/schedule", label: "My Schedule", mobileLabel: "Schedule", icon: <Calendar className="w-5 h-5" /> },
    { href: "/shiftschedule", label: "Shift Schedule", mobileLabel: "Shifts", icon: <ClipboardList className="w-5 h-5" /> },
  ],
  kiosk: [],
};

export default function AppNavigation() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useSidebarState();

  if (!role) return null;

  const navItems = roleNavItems[role] || [];
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/");

  const profilePic = profile?.profile_picture;

  return (
    <>
      {/* Mobile top header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-card border-b border-border px-4 flex items-center justify-between" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3rem + env(safe-area-inset-top))' }}>
        <Link to="/" className="flex items-center gap-2">
          <img src="/icon.png" alt="Logo" className="w-5 h-5 object-contain" />
          <span className="font-bold text-foreground text-sm">Spike's Planner</span>
        </Link>
        <Link to="/account" className="flex items-center gap-2">
          {profilePic ? (
            <img src={profilePic} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </Link>
      </header>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:flex-col md:min-h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-30 transition-all duration-200 ${
          sidebarOpen ? "md:w-64" : "md:w-16"
        }`}
      >
        {/* Logo + collapse button */}
        <div className={`py-5 border-b border-sidebar-border flex items-center ${sidebarOpen ? "px-4 justify-between" : "px-2 justify-center flex-col gap-2"}`}>
          {sidebarOpen ? (
            <Link to="/" className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg shrink-0 overflow-hidden">
                <img src="/icon.png" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sidebar-foreground text-lg leading-tight">Spike's Planner</h1>
                <p className="text-xs text-sidebar-foreground/50 capitalize">{role}</p>
              </div>
            </Link>
          ) : (
            <Link to="/" className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center overflow-hidden">
              <img src="/icon.png" alt="Logo" className="w-7 h-7 object-contain" />
            </Link>
          )}
          <button
            onClick={toggleSidebar}
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground p-1.5 rounded-md hover:bg-sidebar-accent transition-colors shrink-0"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${sidebarOpen ? "px-3" : "px-2"}`}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              title={!sidebarOpen ? item.label : undefined}
              className={`nav-link ${
                !sidebarOpen ? "justify-center px-2" : ""
              } ${isActive(item.href) ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
            >
              <span className="shrink-0">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className={`py-4 border-t border-sidebar-border space-y-1 ${sidebarOpen ? "px-3" : "px-2"}`}>
          <Link
            to="/account"
            title={!sidebarOpen ? (profile?.full_name || "Account") : undefined}
            className={`nav-link ${!sidebarOpen ? "justify-center px-2" : ""} ${isActive("/account") ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
          >
            {profilePic ? (
              <img src={profilePic} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <User className="w-5 h-5 shrink-0" />
            )}
            {sidebarOpen && <span className="truncate">{profile?.full_name || "Account"}</span>}
          </Link>
          <button
            onClick={signOut}
            title={!sidebarOpen ? "Sign Out" : undefined}
            className={`nav-link ${!sidebarOpen ? "justify-center px-2" : ""} text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile bottom navigation — no account (moved to top) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border px-1 pt-1 flex justify-around overflow-x-auto" style={{ paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom))' }}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors min-w-0 shrink-0 ${
              isActive(item.href) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {item.icon}
            <span className="truncate max-w-[48px]">{item.mobileLabel || item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
