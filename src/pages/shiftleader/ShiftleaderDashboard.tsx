import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";

export default function ShiftleaderDashboard() {
  const links = [
    { href: "/kiosk", label: "🖥️ Kiosk" },
    { href: "/worker/schedule", label: "📅 My Schedule" },
    { href: "/worker/punches", label: "🕒 My Punches" },
    { href: "/worker/availability", label: "📋 Availability" },
    { href: "/shiftschedule", label: "📆 Shift Schedule" },
  ];

  return (
    <AppLayout>
      <h1 className="page-header mb-8">🏷️ Shift Leader Dashboard</h1>
      <div className="dashboard-grid">
        {links.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className="stat-card text-center hover:border-primary/30 transition-colors font-medium text-foreground text-lg py-8"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
