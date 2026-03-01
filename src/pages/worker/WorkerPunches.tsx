import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Punch {
  id: string;
  date: string;
  punch_in: string;
  punch_out: string | null;
  notes: string | null;
  approved: boolean | null;
  locations?: { name: string };
}

export default function WorkerPunches() {
  const { user } = useAuth();
  const [punches, setPunches] = useState<Punch[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("time_punches")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("punch_in", { ascending: false })
      .limit(50)
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const locIds = [...new Set(data.map((p: any) => p.location_id))];
          const { data: locs } = await supabase.from("locations").select("id, name").in("id", locIds);
          const locMap = new Map((locs || []).map((l: any) => [l.id, l]));
          setPunches(data.map((p: any) => ({ ...p, locations: locMap.get(p.location_id) })) as Punch[]);
        } else {
          setPunches([]);
        }
      });
  }, [user]);

  function getStatusBadge(punch: Punch) {
    if (punch.punch_out === null) {
      return <Badge className="bg-primary/10 text-primary border-0">Active</Badge>;
    }
    if (punch.approved === true) {
      return <Badge className="bg-primary/10 text-primary border-0">Approved</Badge>;
    }
    if (punch.approved === false) {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>;
  }

  return (
    <AppLayout>
      <h1 className="page-header mb-6">🕒 My Punches</h1>

      <div className="space-y-3">
        {punches.map((p) => (
          <div key={p.id} className="stat-card flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{format(new Date(p.date), "EEEE dd/MM/yyyy")}</p>
              <p className="text-sm text-muted-foreground">{p.locations?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-mono text-sm text-foreground">
                  {p.punch_in} → {p.punch_out || "—"}
                </p>
                {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
              </div>
              {getStatusBadge(p)}
            </div>
          </div>
        ))}
        {punches.length === 0 && <p className="text-muted-foreground text-center py-8">No punches yet.</p>}
      </div>
    </AppLayout>
  );
}
