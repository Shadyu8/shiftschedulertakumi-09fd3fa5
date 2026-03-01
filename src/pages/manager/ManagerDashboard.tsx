import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Users, Clock, Calendar } from "lucide-react";

export default function ManagerDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ workers: 0, clockedIn: 0 });

  useEffect(() => {
    if (!profile?.organization_id) return;
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .then(({ count }) => setStats((s) => ({ ...s, workers: count || 0 })));
  }, [profile]);

  const cards = [
    { label: "Total Workers", value: stats.workers, icon: <Users className="w-5 h-5" />, color: "text-chart-blue" },
    { label: "Clocked In Today", value: stats.clockedIn, icon: <Clock className="w-5 h-5" />, color: "text-chart-green" },
  ];

  const links = [
    { href: "/manager/users", label: "👥 Workers" },
    { href: "/manager/schedule", label: "📅 Schedule Builder" },
    { href: "/manager/exports", label: "📊 Exports" },
    { href: "/manager/settings", label: "⚙️ Settings" },
    { href: "/shiftschedule", label: "📆 Shift Schedule" },
    { href: "/kiosk", label: "🖥️ Kiosk" },
  ];

  return (
    <AppLayout>
      <h1 className="page-header mb-8">📊 Manager Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <span className={card.color}>{card.icon}</span>
            </div>
            <p className={`text-4xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        {links.map((link) => (
          <Link key={link.href} to={link.href} className="stat-card text-center hover:border-primary/30 transition-colors font-medium text-foreground">
            {link.label}
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
