import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, addDays, getDay } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  published: boolean;
  standby: boolean;
  locations?: { name: string };
  is_fulltimer?: boolean;
}

function getDayOfWeek(date: Date): number {
  const d = getDay(date);
  return d === 0 ? 6 : d - 1;
}

export default function WorkerSchedule() {
  const { user, role } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;

    async function fetchSchedule() {
      // Fetch real shifts
      const { data: realShifts } = await supabase
        .from("shifts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("published", true)
        .gte("date", weekStartStr)
        .lte("date", weekEndStr)
        .order("date")
        .order("start_time");

      let mappedShifts: Shift[] = [];
      if (realShifts && realShifts.length > 0) {
        const locIds = [...new Set(realShifts.map((s: any) => s.location_id))];
        const { data: locs } = await supabase.from("locations").select("id, name").in("id", locIds);
        const locMap = new Map((locs || []).map((l: any) => [l.id, l]));
        mappedShifts = realShifts.map((s: any) => ({ ...s, locations: locMap.get(s.location_id) })) as Shift[];
      }

      // For fulltimers, also fetch recurring schedule
      if (role === "fulltimer") {
        const { data: ftSchedules } = await supabase
          .from("fulltimer_schedules")
          .select("*, locations:location_id(name)")
          .eq("user_id", user!.id);

        if (ftSchedules) {
          const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
          for (const ft of ftSchedules as any[]) {
            for (const day of weekDays) {
              const dow = getDayOfWeek(day);
              if (dow !== ft.day_of_week) continue;
              const dateStr = format(day, "yyyy-MM-dd");
              if (mappedShifts.some((s) => s.date === dateStr)) continue;
              mappedShifts.push({
                id: `ft-${ft.id}-${dateStr}`,
                date: dateStr,
                start_time: ft.start_time,
                end_time: ft.end_time,
                published: true,
                standby: false,
                locations: ft.locations,
                is_fulltimer: true,
              });
            }
          }
        }
      }

      // Sort by date, then start_time
      mappedShifts.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
      setShifts(mappedShifts);
    }

    fetchSchedule();
  }, [user, role, weekStartStr, weekEndStr]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: format(d, "yyyy-MM-dd"), dayObj: d };
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <AppLayout>
      {/* Header with week navigation */}
      <div className="flex items-center justify-between mb-5">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-foreground">
            {format(weekStart, "dd MMM")} – {format(addDays(weekStart, 6), "dd MMM yyyy")}
          </h1>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-primary font-medium mt-1 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all">
              Go to this week
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setWeekOffset((o) => o + 1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Day cards */}
      <div className="space-y-3">
        {weekDays.map(({ date, dayObj }) => {
          const dayShifts = shifts.filter((s) => s.date === date);
          const isToday = date === todayStr;

          return (
            <div key={date} className="flex gap-3">
              {/* Date bubble */}
              <div
                className={`flex flex-col items-center justify-center rounded-2xl w-16 min-h-[72px] shrink-0 ${
                  dayShifts.length > 0
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span className="text-[10px] font-bold uppercase leading-none">
                  {format(dayObj, "EEE")}
                </span>
                <span className="text-xl font-bold leading-tight">
                  {format(dayObj, "d")}
                </span>
                <span className="text-[10px] font-semibold uppercase leading-none">
                  {format(dayObj, "MMM")}
                </span>
              </div>

              {/* Shift entries */}
              <div className="flex-1 min-w-0">
                {dayShifts.length > 0 ? (
                  <div className="space-y-2">
                    {dayShifts.map((s) => (
                      <div
                        key={s.id}
                        className={`rounded-2xl border px-4 py-3 ${
                          s.standby
                            ? "bg-warning/5 border-warning/20"
                            : s.is_fulltimer
                              ? "bg-primary/5 border-primary/20"
                              : "bg-card border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg font-bold text-foreground">
                            {s.start_time} – {s.end_time}
                          </span>
                          {s.standby && (
                            <span className="bg-warning/10 text-warning text-xs px-2.5 py-0.5 rounded-full font-semibold">
                              Standby
                            </span>
                          )}
                          {s.is_fulltimer && (
                            <span className="bg-primary/10 text-primary text-xs px-2.5 py-0.5 rounded-full font-semibold">
                              Fulltimer
                            </span>
                          )}
                        </div>
                        {s.locations && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{s.locations.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center h-full">
                    <p className="text-sm text-muted-foreground italic">No shifts</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
