import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Shift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  standby: boolean;
  profile_name?: string;
  profile_picture?: string | null;
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
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [loading, setLoading] = useState(false);

  // Fetch user locations
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_locations")
      .select("location_id, locations(id, name)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          const locs = data.map((d: any) => d.locations).filter(Boolean);
          setLocations(locs);
          if (locs.length > 0 && !selectedLoc) setSelectedLoc(locs[0].id);
        }
      });
  }, [user]);

  // Fetch shifts for the week containing selectedDate
  useEffect(() => {
    if (!selectedLoc) return;
    setLoading(true);
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekStartStr = format(ws, "yyyy-MM-dd");
    const weekEndStr = format(addDays(ws, 6), "yyyy-MM-dd");

    supabase
      .from("shifts")
      .select("*")
      .eq("location_id", selectedLoc)
      .eq("published", true)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr)
      .order("date")
      .order("start_time")
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const userIds = [...new Set(data.map((s: any) => s.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, profile_picture")
            .in("user_id", userIds);
          const profileMap = new Map(
            (profiles || []).map((p: any) => [p.user_id, p])
          );
          setShifts(
            data.map((s: any) => ({
              ...s,
              profile_name: profileMap.get(s.user_id)?.full_name,
              profile_picture: profileMap.get(s.user_id)?.profile_picture,
            })) as Shift[]
          );
        } else {
          setShifts([]);
        }
        setLoading(false);
      });
  }, [selectedLoc, selectedDate]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dayShifts = shifts
    .filter((s) => s.date === dateStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  function prevDay() {
    setSelectedDate((d) => addDays(d, -1));
  }
  function nextDay() {
    setSelectedDate((d) => addDays(d, 1));
  }
  function goToday() {
    setSelectedDate(new Date());
  }

  const dayLabel = format(selectedDate, "EEEE, dd MMM yyyy");

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="page-header">📆 Shift Schedule</h1>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Select value={selectedLoc} onValueChange={setSelectedLoc}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-foreground min-w-[180px] text-center text-sm">
              {dayLabel}
            </span>
            <Button variant="outline" size="icon" onClick={nextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday} className="ml-1 text-xs">
              Today
            </Button>
          </div>
        </div>
      </div>

      {!selectedLoc ? (
        <p className="text-muted-foreground">Select a location to view the shift schedule.</p>
      ) : loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          {dayShifts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No shifts scheduled for this day.</p>
          ) : (
            <div className="space-y-2">
              {dayShifts.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                    s.user_id === user?.id
                      ? "bg-primary/10 border-primary/20"
                      : "bg-muted/50 border-border"
                  }`}
                >
                  {s.profile_picture ? (
                    <img
                      src={s.profile_picture}
                      alt={s.profile_name || ""}
                      className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0 select-none">
                      {(s.profile_name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-primary font-medium text-sm w-28 shrink-0">
                    {s.start_time}{s.end_time ? ` – ${s.end_time}` : ""}
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {s.profile_name || "Unknown"}
                  </span>
                  {s.standby && (
                    <span className="bg-warning/10 text-warning text-xs px-2 py-0.5 rounded-full ml-auto">
                      Standby
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
