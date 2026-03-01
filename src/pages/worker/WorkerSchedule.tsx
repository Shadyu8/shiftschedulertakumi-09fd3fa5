import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { format, startOfWeek, addDays } from "date-fns";

interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  published: boolean;
  standby: boolean;
  locations?: { name: string };
}

export default function WorkerSchedule() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weekStart, setWeekStart] = useState(() => {
    return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  });

  useEffect(() => {
    if (!user) return;
    const endDate = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
    supabase
      .from("shifts")
      .select("*")
      .eq("user_id", user.id)
      .eq("published", true)
      .gte("date", weekStart)
      .lte("date", endDate)
      .order("date")
      .order("start_time")
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const locIds = [...new Set(data.map((s: any) => s.location_id))];
          const { data: locs } = await supabase.from("locations").select("id, name").in("id", locIds);
          const locMap = new Map((locs || []).map((l: any) => [l.id, l]));
          setShifts(data.map((s: any) => ({ ...s, locations: locMap.get(s.location_id) })) as Shift[]);
        } else {
          setShifts([]);
        }
      });
  }, [user, weekStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(weekStart), i);
    return { date: format(d, "yyyy-MM-dd"), label: format(d, "EEEE dd/MM") };
  });

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="page-header">📅 My Schedule</h1>
        <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="w-[180px]" />
      </div>

      <div className="space-y-3">
        {weekDays.map((day) => {
          const dayShifts = shifts.filter((s) => s.date === day.date);
          return (
            <div key={day.date} className="stat-card">
              <h3 className="text-sm font-semibold text-foreground mb-2">{day.label}</h3>
              {dayShifts.length > 0 ? (
                <div className="space-y-1.5">
                  {dayShifts.map((s) => (
                    <div key={s.id} className={`text-sm rounded-lg px-3 py-2 ${s.standby ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                      <span className="font-medium">{s.start_time} – {s.end_time}</span>
                      {s.locations && <span className="text-xs ml-2 opacity-75">@ {s.locations.name}</span>}
                      {s.standby && <span className="text-xs ml-2">(Standby)</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No shifts</p>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
