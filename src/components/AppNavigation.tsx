import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, Calendar, Clock, ClipboardList,
  Settings, LogOut, Monitor, FileText, Building2,
  MapPin, UserCog, User, CheckSquare
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
    { href: "/kiosk", label: "Kiosk", icon: <Monitor className="w-5 h-5" /> },
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
};

export default function AppNavigation() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();

  if (!role) return null;

  const navItems = roleNavItems[role] || [];
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/");

  // Mobile bottom: all nav items + account (compact layout)
  const mobileItems = [
    ...navItems,
    { href: "/account", label: "Account", mobileLabel: "Account", icon: <User className="w-5 h-5" /> },
  ];

  const profilePic = profile?.profile_picture;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:min-h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-30">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Calendar className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sidebar-foreground text-lg leading-tight">Shift Planner</h1>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{role}</p>
            </div>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`nav-link ${isActive(item.href) ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User section with profile picture */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <Link
            to="/account"
            className={`nav-link ${isActive("/account") ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
          >
            {profilePic ? (
              <img src={profilePic} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <User className="w-5 h-5" />
            )}
            <span className="truncate">{profile?.full_name || "Account"}</span>
          </Link>
          <button
            onClick={signOut}
            className="nav-link text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom navigation — all items */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border px-1 py-1 flex justify-around overflow-x-auto">
        {mobileItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors min-w-0 shrink-0 ${
              isActive(item.href) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {item.href === "/account" && profilePic ? (
              <img src={profilePic} alt="" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              item.icon
            )}
            <span className="truncate max-w-[48px]">{item.mobileLabel || item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}