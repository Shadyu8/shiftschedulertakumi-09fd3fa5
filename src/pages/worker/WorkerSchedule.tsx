import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Clock } from "lucide-react";

interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  published: boolean;
  standby: boolean;
  locations?: { name: string };
}

function calcHours(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return diff > 0 ? diff : 0;
}

export default function WorkerSchedule() {
  const { user } = useAuth();
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
    supabase
      .from("shifts")
      .select("*")
      .eq("user_id", user.id)
      .eq("published", true)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr)
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
  }, [user, weekStartStr, weekEndStr]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: format(d, "yyyy-MM-dd"), dayObj: d };
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const totalHours = shifts.reduce((sum, s) => sum + calcHours(s.start_time, s.end_time), 0);

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
            <button onClick={() => setWeekOffset(0)} className="text-xs text-primary font-medium mt-0.5">
              Go to this week
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setWeekOffset((o) => o + 1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Weekly total banner */}
      {shifts.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 mb-5 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">This week</span>
          <span className="text-lg font-bold text-primary">{totalHours.toFixed(1)}h</span>
        </div>
      )}

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
                  isToday
                    ? "bg-primary text-primary-foreground"
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
                    {dayShifts.map((s) => {
                      const hrs = calcHours(s.start_time, s.end_time);
                      return (
                        <div
                          key={s.id}
                          className={`rounded-2xl border px-4 py-3 ${
                            s.standby
                              ? "bg-warning/5 border-warning/20"
                              : "bg-card border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-lg font-bold text-foreground">
                              {hrs.toFixed(1)}h
                            </span>
                            {s.standby && (
                              <span className="bg-warning/10 text-warning text-xs px-2.5 py-0.5 rounded-full font-semibold">
                                Standby
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>{s.start_time} – {s.end_time}</span>
                          </div>
                          {s.locations && (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span>{s.locations.name}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
