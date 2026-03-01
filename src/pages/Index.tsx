import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function IndexPage() {
  const { role, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    const routes: Record<string, string> = {
      admin: "/admin",
      manager: "/manager",
      shiftleader: "/shiftleader",
      worker: "/worker",
      kiosk: "/kiosk",
    };
    navigate(routes[role || ""] || "/login", { replace: true });
  }, [role, loading, user, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground animate-pulse">Redirecting...</p>
    </div>
  );
}
