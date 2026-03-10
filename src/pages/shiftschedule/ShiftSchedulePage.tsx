import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format, addDays, startOfWeek, getDay } from "date-fns";
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
  staff_type?: string;
  is_fulltimer?: boolean;
}

interface Location {
  id: string;
  name: string;
}

type ViewMode = "day" | "week";

function getDayOfWeek(date: Date): number {
  const d = getDay(date);
  return d === 0 ? 6 : d - 1;
}

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
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

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

  // Fetch locations
  useEffect(() => {
    if (!user) return;

    async function fetchLocations() {
      setLocationsLoading(true);
      let locs: Location[] = [];

      if (role === "admin") {
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

  // Fetch shifts + fulltimer schedules for the week containing selectedDate
  useEffect(() => {
    if (!selectedLoc) return;
    setLoading(true);
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekStartStr = format(ws, "yyyy-MM-dd");
    const weekEndStr = format(addDays(ws, 6), "yyyy-MM-dd");

    Promise.all([
      supabase
        .from("shifts")
        .select("*")
        .eq("location_id", selectedLoc)
        .eq("published", true)
        .gte("date", weekStartStr)
        .lte("date", weekEndStr)
        .order("date")
        .order("start_time"),
      supabase
        .from("fulltimer_schedules")
        .select("user_id, day_of_week, start_time, end_time")
        .eq("location_id", selectedLoc),
    ]).then(async ([shiftsRes, ftRes]) => {
      const realShifts = shiftsRes.data || [];
      const ftSchedules = ftRes.data || [];

      // Get all user IDs (from real shifts + fulltimer schedules)
      const allUserIds = [...new Set([
        ...realShifts.map((s: any) => s.user_id),
        ...ftSchedules.map((f: any) => f.user_id),
      ])];

      // Fetch profiles + roles
      const [profilesRes, rolesRes] = await Promise.all([
        allUserIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name, profile_picture, staff_type").in("user_id", allUserIds)
          : Promise.resolve({ data: [] }),
        allUserIds.length > 0
          ? supabase.from("user_roles").select("user_id, role").in("user_id", allUserIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map(
        ((profilesRes.data || []) as any[]).map((p) => [p.user_id, p])
      );
      const roleMap = new Map(
        ((rolesRes.data || []) as any[]).map((r) => [r.user_id, r.role])
      );

      // Build real shifts with profile data
      const mappedShifts: Shift[] = realShifts.map((s: any) => ({
        ...s,
        profile_name: profileMap.get(s.user_id)?.full_name,
        profile_picture: profileMap.get(s.user_id)?.profile_picture,
        staff_type: profileMap.get(s.user_id)?.staff_type || "floor",
        is_fulltimer: roleMap.get(s.user_id) === "fulltimer",
      }));

      // Generate virtual fulltimer shifts
      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
      const virtualShifts: Shift[] = [];
      for (const ft of ftSchedules as any[]) {
        if (roleMap.get(ft.user_id) !== "fulltimer") continue;
        for (const day of weekDays) {
          const dow = getDayOfWeek(day);
          if (dow !== ft.day_of_week) continue;
          const dateStr = format(day, "yyyy-MM-dd");
          // Skip if real shift exists
          if (mappedShifts.some((s) => s.user_id === ft.user_id && s.date === dateStr)) continue;
          virtualShifts.push({
            id: `ft-${ft.user_id}-${dateStr}`,
            user_id: ft.user_id,
            date: dateStr,
            start_time: ft.start_time,
            end_time: ft.end_time,
            standby: false,
            profile_name: profileMap.get(ft.user_id)?.full_name,
            profile_picture: profileMap.get(ft.user_id)?.profile_picture,
            staff_type: profileMap.get(ft.user_id)?.staff_type || "floor",
            is_fulltimer: true,
          });
        }
      }

      setShifts([...mappedShifts, ...virtualShifts]);
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

  // Group by staff type
  const floorShifts = dayShifts.filter((s) => s.staff_type !== "kitchen");
  const kitchenShifts = dayShifts.filter((s) => s.staff_type === "kitchen");

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
      <button
        key={s.id}
        onClick={() => setSelectedShift(s)}
        className={`flex items-center gap-4 px-4 py-4 rounded-xl border w-full text-left transition-colors active:scale-[0.98] ${
          s.user_id === user?.id
            ? "bg-primary/10 border-primary/20"
            : "bg-muted/50 border-border"
        }`}
      >
        {s.profile_picture ? (
          <img
            src={s.profile_picture}
            alt={s.profile_name || ""}
            className="w-11 h-11 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0 select-none">
            {(s.profile_name || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-foreground text-base font-semibold truncate">
            {s.profile_name || "Unknown"}
          </span>
          <span className="text-muted-foreground text-sm">
            {s.start_time}{s.end_time ? ` – ${s.end_time}` : ""}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {s.standby && (
            <span className="bg-warning/10 text-warning text-xs px-2.5 py-1 rounded-full font-medium">
              Standby
            </span>
          )}
          {s.is_fulltimer && (
            <span className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
              FT
            </span>
          )}
        </div>
      </button>
    );
  }

  function renderGroupedDayView() {
    const hasFloor = floorShifts.length > 0;
    const hasKitchen = kitchenShifts.length > 0;

    if (!hasFloor && !hasKitchen) {
      return (
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-muted-foreground text-sm">No shifts scheduled for this day.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {hasFloor && (
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              🏠 Floor Staff
            </h3>
            <div className="space-y-2.5">
              {floorShifts.map(renderShiftCard)}
            </div>
          </div>
        )}
        {hasKitchen && (
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              🍳 Kitchen Staff
            </h3>
            <div className="space-y-2.5">
              {kitchenShifts.map(renderShiftCard)}
            </div>
          </div>
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

          const dayFloor = dayS.filter((s) => s.staff_type !== "kitchen");
          const dayKitchen = dayS.filter((s) => s.staff_type === "kitchen");

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
                <div className="space-y-2">
                  {dayFloor.length > 0 && (
                    <div>
                      <p className="text-[9px] text-muted-foreground font-semibold uppercase mb-0.5">🏠 Floor</p>
                      <div className="space-y-1">
                        {dayFloor.map((s) => renderWeekShiftCard(s))}
                      </div>
                    </div>
                  )}
                  {dayKitchen.length > 0 && (
                    <div>
                      <p className="text-[9px] text-muted-foreground font-semibold uppercase mb-0.5">🍳 Kitchen</p>
                      <div className="space-y-1">
                        {dayKitchen.map((s) => renderWeekShiftCard(s))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderWeekShiftCard(s: Shift) {
    return (
      <button
        key={s.id}
        onClick={() => setSelectedShift(s)}
        className={`w-full text-left px-2 py-2 rounded-lg text-xs border transition-colors active:scale-[0.98] ${
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
          {s.is_fulltimer && <span className="text-primary ml-1">(FT)</span>}
        </div>
      </button>
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
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs ml-auto rounded-full" disabled={!selectedLoc}>
            Today
          </Button>
        </div>

        {/* Week day strip */}
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
          {viewMode === "day" ? renderGroupedDayView() : renderWeekView()}
        </div>
      )}

      {/* Worker detail popup */}
      <Dialog open={!!selectedShift} onOpenChange={(o) => !o && setSelectedShift(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="sr-only">Worker Details</DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <div className="flex flex-col items-center gap-4 py-2">
              <Avatar className="w-20 h-20">
                {selectedShift.profile_picture ? (
                  <AvatarImage src={selectedShift.profile_picture} alt={selectedShift.profile_name || ""} />
                ) : null}
                <AvatarFallback className="text-2xl font-bold bg-primary/20 text-primary">
                  {(selectedShift.profile_name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{selectedShift.profile_name || "Unknown"}</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {format(new Date(selectedShift.date + "T00:00:00"), "EEE, dd MMM yyyy")}
                </p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground capitalize">
                    {selectedShift.staff_type === "kitchen" ? "🍳 Kitchen" : "🏠 Floor"}
                  </span>
                  {selectedShift.is_fulltimer && (
                    <span className="text-xs text-primary font-medium">Fulltimer</span>
                  )}
                </div>
              </div>
              <div className="bg-muted/50 rounded-xl px-6 py-3 text-center">
                <p className="text-2xl font-bold text-primary">
                  {selectedShift.start_time} – {selectedShift.end_time}
                </p>
              </div>
              {selectedShift.standby && (
                <span className="bg-warning/10 text-warning text-sm px-4 py-1.5 rounded-full font-medium">
                  Standby
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
