import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Building2, MapPin, UserCog } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ orgs: 0, locations: 0, managers: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("organizations").select("id", { count: "exact", head: true }),
      supabase.from("locations").select("id", { count: "exact", head: true }),
      supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "manager"),
    ]).then(([orgs, locs, mgrs]) => {
      setStats({
        orgs: orgs.count || 0,
        locations: locs.count || 0,
        managers: mgrs.count || 0,
      });
    });
  }, []);

  const cards = [
    { label: "Organizations", value: stats.orgs, icon: <Building2 className="w-5 h-5" />, color: "text-chart-blue", href: "/admin/organizations" },
    { label: "Locations", value: stats.locations, icon: <MapPin className="w-5 h-5" />, color: "text-chart-green", href: "/admin/locations" },
    { label: "Managers", value: stats.managers, icon: <UserCog className="w-5 h-5" />, color: "text-chart-purple", href: "/admin/managers" },
  ];

  return (
    <AppLayout>
      <h1 className="page-header mb-8">🛡️ Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {cards.map((card) => (
          <Link key={card.label} to={card.href} className="stat-card group cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <span className={card.color}>{card.icon}</span>
            </div>
            <p className={`text-4xl font-bold ${card.color}`}>{card.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: "/admin/organizations", label: "🏢 Organizations" },
          { href: "/admin/locations", label: "📍 Locations" },
          { href: "/admin/managers", label: "👥 Managers" },
        ].map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className="stat-card text-center hover:border-primary/30 transition-colors font-medium text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
