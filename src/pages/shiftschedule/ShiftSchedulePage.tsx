import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

type ViewMode = "day" | "week";

export default function ShiftSchedulePage() {
  const { user, role } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [selectedLoc, setSelectedLoc] = useState(() => {
    return localStorage.getItem("shiftschedule_selected_location") || "";
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");

  // Swipe support
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 60;
    if (Math.abs(diff) > threshold) {
      if (viewMode === "day") {
        setSelectedDate((d) => addDays(d, diff > 0 ? 1 : -1));
      } else {
        setSelectedDate((d) => addDays(d, diff > 0 ? 7 : -7));
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  }, [viewMode]);

  // Persist selected location
  useEffect(() => {
    if (selectedLoc) {
      localStorage.setItem("shiftschedule_selected_location", selectedLoc);
    }
  }, [selectedLoc]);

  // Fetch locations — managers/admins see org locations, others see assigned locations
  useEffect(() => {
    if (!user) return;

    async function fetchLocations() {
      setLocationsLoading(true);
      let locs: Location[] = [];

      if (role === "manager" || role === "admin") {
        const { data } = await supabase
          .from("locations")
          .select("id, name")
          .order("name");
        locs = (data || []) as Location[];
      } else {
        const { data } = await supabase
          .from("user_locations")
          .select("location_id, locations(id, name)")
          .eq("user_id", user.id);
        locs = (data || []).map((d: any) => d.locations).filter(Boolean);
      }

      const uniqueLocs = Array.from(new Map(locs.map((l) => [l.id, l])).values());
      setLocations(uniqueLocs);

      // Auto-select: saved valid location > first available location
      const saved = localStorage.getItem("shiftschedule_selected_location");
      const resolvedSelection =
        saved && uniqueLocs.some((l) => l.id === saved)
          ? saved
          : uniqueLocs[0]?.id || "";

      setSelectedLoc(resolvedSelection);
      setLocationsLoading(false);
    }

    fetchLocations();
  }, [user, role]);

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

  const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dayShifts = shifts
    .filter((s) => s.date === dateStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  function prevPeriod() {
    setSelectedDate((d) => addDays(d, viewMode === "day" ? -7 : -7));
  }
  function nextPeriod() {
    setSelectedDate((d) => addDays(d, viewMode === "day" ? 7 : 7));
  }
  function goToday() {
    setSelectedDate(new Date());
  }

  const headerLabel = viewMode === "day"
    ? format(selectedDate, "EEE dd MMM")
    : `${format(ws, "dd MMM")} – ${format(addDays(ws, 6), "dd MMM yyyy")}`;

  function renderShiftCard(s: Shift) {
    return (
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
    );
  }

  function renderWeekView() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayS = shifts
            .filter((s) => s.date === dayStr)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          const isToday = format(new Date(), "yyyy-MM-dd") === dayStr;

          return (
            <div
              key={dayStr}
              className={`bg-card rounded-xl border p-3 shadow-sm min-h-[120px] ${
                isToday ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {format(day, "EEE")}
                </span>
                <span className={`text-sm font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                  {format(day, "dd")}
                </span>
              </div>
              {dayS.length === 0 ? (
                <p className="text-muted-foreground text-xs">No shifts</p>
              ) : (
                <div className="space-y-1.5">
                  {dayS.map((s) => (
                    <div
                      key={s.id}
                      className={`px-2 py-1.5 rounded-md text-xs border ${
                        s.user_id === user?.id
                          ? "bg-primary/10 border-primary/20"
                          : "bg-muted/50 border-border"
                      }`}
                    >
                      <div className="font-medium text-primary">
                        {s.start_time} – {s.end_time}
                      </div>
                      <div className="text-foreground truncate">
                        {s.profile_name || "Unknown"}
                        {s.standby && <span className="text-warning ml-1">(S)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-3 mb-6">
        {/* Top row: arrows + date label + location */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={prevPeriod} disabled={!selectedLoc} className="h-8 w-8">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">{headerLabel}</h1>
            <Button variant="ghost" size="icon" onClick={nextPeriod} disabled={!selectedLoc} className="h-8 w-8">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <Select value={selectedLoc} onValueChange={setSelectedLoc}>
            <SelectTrigger className="w-[140px] h-8 text-xs" disabled={locationsLoading || locations.length === 0}>
              <SelectValue placeholder={locationsLoading ? "Loading..." : "Location"} />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View toggle + Today */}
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
            <ToggleGroupItem value="day" aria-label="Day view" className="text-xs px-4 rounded-full" disabled={!selectedLoc}>
              Day
            </ToggleGroupItem>
            <ToggleGroupItem value="week" aria-label="Week view" className="text-xs px-4 rounded-full" disabled={!selectedLoc}>
              Week
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="ghost" size="sm" onClick={goToday} className="text-xs ml-auto" disabled={!selectedLoc}>
            Today
          </Button>
        </div>

        {/* Week day strip — tap to select day */}
        {viewMode === "day" && (
          <div className="flex justify-between border-b border-border pb-2">
            {weekDays.map((day) => {
              const dayFmt = format(day, "yyyy-MM-dd");
              const isSelected = dayFmt === dateStr;
              const isToday = dayFmt === todayStr;
              return (
                <button
                  key={dayFmt}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-full transition-colors min-w-[40px] ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase">{format(day, "EEEEEE")}</span>
                  <span className="text-sm font-medium">{format(day, "d")}</span>
                  {isToday && !isSelected && <span className="w-1 h-1 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {locationsLoading ? (
        <p className="text-muted-foreground">Loading locations...</p>
      ) : !selectedLoc ? (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-sm">No locations available yet. Ask an admin/manager to assign your account to a location.</p>
        </div>
      ) : loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div
          ref={contentRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="touch-pan-y"
        >
          {viewMode === "day" ? (
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
              {dayShifts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No shifts scheduled for this day.</p>
              ) : (
                <div className="space-y-2">
                  {dayShifts.map(renderShiftCard)}
                </div>
              )}
            </div>
          ) : (
            renderWeekView()
          )}
        </div>
      )}
    </AppLayout>
  );
}
