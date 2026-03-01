import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Location {
  id: string;
  name: string;
}

interface TodayShift {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  profiles?: { full_name: string };
}

interface ActivePunch {
  id: string;
  user_id: string;
  punch_in: string;
  profiles?: { full_name: string };
}

export default function KioskPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState("");
  const [todayShifts, setTodayShifts] = useState<TodayShift[]>([]);
  const [activePunches, setActivePunches] = useState<ActivePunch[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    supabase.from("user_locations").select("location_id, locations(id, name)").eq("user_id", user?.id || "").then(({ data }) => {
      if (data) {
        const locs = data.map((d: any) => d.locations).filter(Boolean);
        setLocations(locs);
        if (locs.length > 0) setSelectedLoc(locs[0].id);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!selectedLoc) return;
    // Fetch today's shifts
    supabase
      .from("shifts")
      .select("*")
      .eq("location_id", selectedLoc)
      .eq("date", today)
      .eq("published", true)
      .order("start_time")
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const userIds = data.map((s: any) => s.user_id);
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
          const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
          setTodayShifts(data.map((s: any) => ({ ...s, profiles: profileMap.get(s.user_id) })) as TodayShift[]);
        } else {
          setTodayShifts([]);
        }
      });

    // Fetch active punches
    supabase
      .from("time_punches")
      .select("*")
      .eq("location_id", selectedLoc)
      .eq("date", today)
      .is("punch_out", null)
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const userIds = data.map((p: any) => p.user_id);
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
          const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
          setActivePunches(data.map((p: any) => ({ ...p, profiles: profileMap.get(p.user_id) })) as ActivePunch[]);
        } else {
          setActivePunches([]);
        }
      });
  }, [selectedLoc]);

  async function clockIn(userId: string) {
    const now = new Date().toTimeString().slice(0, 5);
    const { error } = await supabase.from("time_punches").insert({
      user_id: userId,
      location_id: selectedLoc,
      date: today,
      punch_in: now,
      recorded_in_by_id: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked in!");
    // Refresh
    window.location.reload();
  }

  async function clockOut(punchId: string) {
    const now = new Date().toTimeString().slice(0, 5);
    const { error } = await supabase.from("time_punches").update({
      punch_out: now,
      recorded_out_by_id: user?.id,
    }).eq("id", punchId);
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked out!");
    window.location.reload();
  }

  const activeUserIds = activePunches.map((p) => p.user_id);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="page-header">🕐 Kiosk</h1>
        <Select value={selectedLoc} onValueChange={setSelectedLoc}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent>
            {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's shifts */}
        <div>
          <h2 className="text-lg font-semibold mb-4">📅 Today's Shifts</h2>
          <div className="space-y-2">
            {todayShifts.map((s) => {
              const isActive = activeUserIds.includes(s.user_id);
              return (
                <div key={s.id} className="stat-card flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{s.profiles?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{s.start_time} – {s.end_time}</p>
                  </div>
                  {isActive ? (
                    <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full font-medium">Active</span>
                  ) : (
                    <Button size="sm" onClick={() => clockIn(s.user_id)}>Clock In</Button>
                  )}
                </div>
              );
            })}
            {todayShifts.length === 0 && <p className="text-muted-foreground text-center py-8">No shifts today.</p>}
          </div>
        </div>

        {/* Active workers */}
        <div>
          <h2 className="text-lg font-semibold mb-4">🟢 Active Workers</h2>
          <div className="space-y-2">
            {activePunches.map((p) => (
              <div key={p.id} className="stat-card flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{p.profiles?.full_name}</p>
                  <p className="text-sm text-muted-foreground">In since {p.punch_in}</p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => clockOut(p.id)}>Clock Out</Button>
              </div>
            ))}
            {activePunches.length === 0 && <p className="text-muted-foreground text-center py-8">No active workers.</p>}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
