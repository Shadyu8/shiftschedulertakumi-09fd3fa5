import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, Calendar, Clock, ClipboardList,
  Settings, LogOut, Monitor, FileText, Shield, Building2,
  MapPin, UserCog, Menu, X, User
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const roleNavItems: Record<string, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/admin/organizations", label: "Organizations", icon: <Building2 className="w-5 h-5" /> },
    { href: "/admin/locations", label: "Locations", icon: <MapPin className="w-5 h-5" /> },
    { href: "/admin/managers", label: "Managers", icon: <UserCog className="w-5 h-5" /> },
  ],
  manager: [
    { href: "/manager", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/manager/users", label: "Workers", icon: <Users className="w-5 h-5" /> },
    { href: "/manager/schedule", label: "Schedule Builder", icon: <Calendar className="w-5 h-5" /> },
    { href: "/manager/exports", label: "Exports", icon: <FileText className="w-5 h-5" /> },
    { href: "/manager/settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
    { href: "/shiftschedule", label: "Shift Schedule", icon: <ClipboardList className="w-5 h-5" /> },
  ],
  shiftleader: [
    { href: "/shiftleader", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/kiosk", label: "Kiosk", icon: <Monitor className="w-5 h-5" /> },
    { href: "/worker/schedule", label: "My Schedule", icon: <Calendar className="w-5 h-5" /> },
    { href: "/worker/punches", label: "My Punches", icon: <Clock className="w-5 h-5" /> },
    { href: "/worker/availability", label: "Availability", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/shiftschedule", label: "Shift Schedule", icon: <ClipboardList className="w-5 h-5" /> },
  ],
  worker: [
    { href: "/worker", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/worker/schedule", label: "My Schedule", icon: <Calendar className="w-5 h-5" /> },
    { href: "/worker/punches", label: "My Punches", icon: <Clock className="w-5 h-5" /> },
    { href: "/worker/availability", label: "Availability", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/shiftschedule", label: "Shift Schedule", icon: <ClipboardList className="w-5 h-5" /> },
  ],
};

export default function AppNavigation() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!role) return null;

  const navItems = roleNavItems[role] || [];
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/");

  // Mobile bottom nav - show first 4 items
  const mobileBottomItems = navItems.slice(0, 4);

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

        {/* User section */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <Link
            to="/account"
            className={`nav-link ${isActive("/account") ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
          >
            <User className="w-5 h-5" />
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

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Calendar className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">Shift Planner</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/account" className="p-2 rounded-lg hover:bg-accent">
            <User className="w-5 h-5 text-muted-foreground" />
          </Link>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg hover:bg-accent">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-14 left-0 right-0 z-20 bg-card border-b border-border shadow-lg animate-fade-in">
          <nav className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`nav-link ${isActive(item.href) ? "nav-link-active" : "nav-link-inactive"}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
            <button
              onClick={() => { signOut(); setMobileMenuOpen(false); }}
              className="nav-link nav-link-inactive w-full"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </nav>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border px-2 py-1 flex justify-around">
        {mobileBottomItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              isActive(item.href) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
