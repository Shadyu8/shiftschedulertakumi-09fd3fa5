import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfWeek, addDays } from "date-fns";

interface Shift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  standby: boolean;
  profiles?: { full_name: string };
}

interface Location {
  id: string;
  name: string;
}

export default function ShiftSchedulePage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState("");
  const [weekStart, setWeekStart] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );

  useEffect(() => {
    if (!user) return;
    supabase.from("user_locations").select("location_id, locations(id, name)").eq("user_id", user.id).then(({ data }) => {
      if (data) {
        const locs = data.map((d: any) => d.locations).filter(Boolean);
        setLocations(locs);
        if (locs.length > 0 && !selectedLoc) setSelectedLoc(locs[0].id);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!selectedLoc || !weekStart) return;
    const endDate = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
    supabase
      .from("shifts")
      .select("*")
      .eq("location_id", selectedLoc)
      .eq("published", true)
      .gte("date", weekStart)
      .lte("date", endDate)
      .order("date")
      .order("start_time")
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const userIds = [...new Set(data.map((s: any) => s.user_id))];
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
          const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
          setShifts(data.map((s: any) => ({ ...s, profiles: profileMap.get(s.user_id) })) as Shift[]);
        } else {
          setShifts([]);
        }
      });
  }, [selectedLoc, weekStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(weekStart), i);
    return { date: format(d, "yyyy-MM-dd"), label: format(d, "EEE dd/MM") };
  });

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="page-header">📆 Shift Schedule</h1>
        <div className="flex gap-3">
          <Select value={selectedLoc} onValueChange={setSelectedLoc}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="w-[180px]" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const dayShifts = shifts.filter((s) => s.date === day.date);
          return (
            <div key={day.date} className="bg-card border border-border rounded-xl p-3 min-h-[100px]">
              <h3 className="text-sm font-semibold text-foreground mb-2 border-b border-border pb-1">{day.label}</h3>
              <div className="space-y-1.5">
                {dayShifts.map((s) => (
                  <div key={s.id} className={`text-xs rounded-lg px-2 py-1.5 ${
                    s.user_id === user?.id ? "bg-primary/10 text-primary font-medium" : "bg-muted text-muted-foreground"
                  }`}>
                    <p className="font-medium">{s.profiles?.full_name}</p>
                    <p>{s.start_time}–{s.end_time}</p>
                    {s.standby && <p className="text-warning">(Standby)</p>}
                  </div>
                ))}
                {dayShifts.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
