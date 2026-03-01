import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, startOfWeek, addDays, isBefore, isToday, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Lock, Send, Save, Download, MapPin } from "lucide-react";

const DAYS = [
  { dow: 0, label: "Monday" },
  { dow: 1, label: "Tuesday" },
  { dow: 2, label: "Wednesday" },
  { dow: 3, label: "Thursday" },
  { dow: 4, label: "Friday" },
  { dow: 5, label: "Saturday" },
  { dow: 6, label: "Sunday" },
];

const PRESETS = [
  { value: "ALL_DAY", label: "All Day" },
  { value: "UNTIL_16", label: "Until 16:00" },
  { value: "UNTIL_17", label: "Until 17:00" },
  { value: "FROM_13", label: "From 13:00" },
  { value: "FROM_14", label: "From 14:00" },
  { value: "FROM_15", label: "From 15:00" },
  { value: "FROM_16", label: "From 16:00" },
  { value: "FROM_17", label: "From 17:00" },
  { value: "CUSTOM", label: "Custom" },
  { value: "UNAVAILABLE", label: "Unavailable" },
];

interface AvailabilityEntry {
  id?: string;
  day_of_week: number;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
  preset: string;
}

interface LocationConfig {
  earliest_shift_start: string;
  latest_shift_end: string;
  availability_from_start: string;
  availability_from_end: string;
  availability_to_start: string;
  availability_to_end: string;
}

interface UserLocation {
  id: string;
  name: string;
}

function getMonWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function generate30MinSlots(earliest: string, latest: string): string[] {
  const [eh, em] = earliest.split(":").map(Number);
  const [lh, lm] = latest.split(":").map(Number);
  const startMins = eh * 60 + em;
  const endMins = lh * 60 + lm;
  const slots: string[] = [];
  for (let t = startMins; t <= endMins; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getPresetTimes(preset: string, config: LocationConfig): { start: string | null; end: string | null } {
  switch (preset) {
    case "ALL_DAY": return { start: config.earliest_shift_start, end: null };
    case "UNTIL_16": return { start: config.earliest_shift_start, end: "16:00" };
    case "UNTIL_17": return { start: config.earliest_shift_start, end: "17:00" };
    case "FROM_13": return { start: "13:00", end: null };
    case "FROM_14": return { start: "14:00", end: null };
    case "FROM_15": return { start: "15:00", end: null };
    case "FROM_16": return { start: "16:00", end: null };
    case "FROM_17": return { start: "17:00", end: null };
    case "UNAVAILABLE": return { start: null, end: null };
    default: return { start: null, end: null };
  }
}

function formatBadge(entry: AvailabilityEntry): string {
  if (entry.preset === "UNAVAILABLE") return "Unavailable";
  if (entry.preset === "ALL_DAY") return "All Day";
  if (entry.preset === "CUSTOM" && entry.start_time && entry.end_time) return `${entry.start_time} – ${entry.end_time}`;
  if (entry.start_time && !entry.end_time) return `From ${entry.start_time}`;
  if (!entry.start_time && entry.end_time) return `Until ${entry.end_time}`;
  if (entry.start_time && entry.end_time) return `${entry.start_time} – ${entry.end_time}`;
  return "";
}

export default function WorkerAvailability() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [weekStart, setWeekStart] = useState(() => getMonWeekStart(new Date()));
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasTemplate, setHasTemplate] = useState(false);

  // Location state
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState(() => {
    return localStorage.getItem("worker_availability_location") || "";
  });
  const [locationsLoading, setLocationsLoading] = useState(true);

  const [locationConfig, setLocationConfig] = useState<LocationConfig>({
    earliest_shift_start: "11:30",
    latest_shift_end: "23:00",
    availability_from_start: "12:00",
    availability_from_end: "18:00",
    availability_to_start: "15:00",
    availability_to_end: "22:00",
  });

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndDate = addDays(weekStart, 6);
  const isLocked = profile?.availability_locked;
  const isPastWeek = isBefore(weekEndDate, startOfDay(new Date())) && !isToday(weekEndDate);

  const customFromSlots = useMemo(
    () => generate30MinSlots(locationConfig.availability_from_start, locationConfig.availability_from_end),
    [locationConfig.availability_from_start, locationConfig.availability_from_end]
  );
  const customToSlots = useMemo(
    () => generate30MinSlots(locationConfig.availability_to_start, locationConfig.availability_to_end),
    [locationConfig.availability_to_start, locationConfig.availability_to_end]
  );

  // Persist selected location
  useEffect(() => {
    if (selectedLocationId) {
      localStorage.setItem("worker_availability_location", selectedLocationId);
    }
  }, [selectedLocationId]);

  // Fetch user's assigned locations
  useEffect(() => {
    if (!user) return;
    setLocationsLoading(true);
    supabase
      .from("user_locations")
      .select("location_id, locations(id, name)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const locs: UserLocation[] = (data || [])
          .map((d: any) => d.locations)
          .filter(Boolean);
        setUserLocations(locs);

        const saved = localStorage.getItem("worker_availability_location");
        const resolvedSelection =
          saved && locs.some((l) => l.id === saved)
            ? saved
            : locs[0]?.id || "";
        setSelectedLocationId(resolvedSelection);
        setLocationsLoading(false);
      });
  }, [user]);

  // Fetch location config for selected location
  useEffect(() => {
    if (!selectedLocationId) return;
    supabase
      .from("location_settings")
      .select("*")
      .eq("location_id", selectedLocationId)
      .maybeSingle()
      .then(({ data: settings }) => {
        if (settings) {
          setLocationConfig({
            earliest_shift_start: settings.earliest_shift_start,
            latest_shift_end: settings.latest_shift_end,
            availability_from_start: (settings as any).availability_from_start || "12:00",
            availability_from_end: (settings as any).availability_from_end || "18:00",
            availability_to_start: (settings as any).availability_to_start || "15:00",
            availability_to_end: (settings as any).availability_to_end || "22:00",
          });
        }
      });
  }, [selectedLocationId]);

  // Check if template exists for this location
  useEffect(() => {
    if (!user || !selectedLocationId) return;
    (supabase as any)
      .from("availability_templates")
      .select("id")
      .eq("user_id", user.id)
      .eq("location_id", selectedLocationId)
      .limit(1)
      .then(({ data }: any) => {
        setHasTemplate(data && data.length > 0);
      });
  }, [user, selectedLocationId]);

  // Fetch availability for current week + location
  useEffect(() => {
    if (!user || !selectedLocationId) return;
    setLoading(true);
    supabase
      .from("availability")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStartStr)
      .eq("location_id", selectedLocationId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSubmitted(true);
          setEntries(
            DAYS.map((d) => {
              const existing = data.find((row: any) => row.day_of_week === d.dow);
              if (existing) {
                return {
                  id: existing.id,
                  day_of_week: d.dow,
                  available: existing.available,
                  start_time: existing.start_time,
                  end_time: existing.end_time,
                  preset: existing.preset || "ALL_DAY",
                };
              }
              return makeDefaultEntry(d.dow);
            })
          );
        } else {
          setSubmitted(false);
          setEntries(DAYS.map((d) => makeDefaultEntry(d.dow)));
        }
        setLoading(false);
      });
  }, [user, weekStartStr, selectedLocationId]);

  function makeDefaultEntry(dow: number): AvailabilityEntry {
    return {
      day_of_week: dow,
      available: true,
      start_time: locationConfig.earliest_shift_start,
      end_time: null,
      preset: "ALL_DAY",
    };
  }

  function selectPreset(index: number, presetValue: string) {
    const times = getPresetTimes(presetValue, locationConfig);
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        if (presetValue === "CUSTOM") {
          const defaultStart = customFromSlots[0] || locationConfig.availability_from_start;
          const defaultEndIdx = Math.min(customToSlots.length - 1, 6);
          const defaultEnd = customToSlots[defaultEndIdx] || locationConfig.availability_to_end;
          return {
            ...e,
            preset: "CUSTOM",
            available: true,
            start_time: e.preset === "CUSTOM" ? e.start_time : defaultStart,
            end_time: e.preset === "CUSTOM" ? e.end_time : defaultEnd,
          };
        }
        return {
          ...e,
          preset: presetValue,
          available: presetValue !== "UNAVAILABLE",
          start_time: times.start,
          end_time: times.end,
        };
      })
    );
  }

  function setCustomTime(index: number, field: "start_time" | "end_time", value: string) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  }

  function validateEntries(): string | null {
    for (const entry of entries) {
      if (entry.preset === "CUSTOM" && entry.available) {
        if (!entry.start_time || !entry.end_time) {
          const day = DAYS.find((d) => d.dow === entry.day_of_week);
          return `${day?.label}: Please set both start and end times for custom availability.`;
        }
        const diff = timeToMinutes(entry.end_time) - timeToMinutes(entry.start_time);
        if (diff < 180) {
          const day = DAYS.find((d) => d.dow === entry.day_of_week);
          const hrs = Math.floor(diff / 60);
          const mins = diff % 60;
          return `${day?.label}: Custom availability must be at least 3 hours (${entry.start_time} – ${entry.end_time} is only ${hrs}h${mins > 0 ? ` ${mins}m` : ""}).`;
        }
      }
    }
    return null;
  }

  async function handleSubmit() {
    if (!user || !selectedLocationId) return;
    const validationError = validateEntries();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      await supabase
        .from("availability")
        .delete()
        .eq("user_id", user.id)
        .eq("week_start", weekStartStr)
        .eq("location_id", selectedLocationId);
      const rows = entries.map((e) => ({
        user_id: user.id,
        week_start: weekStartStr,
        day_of_week: e.day_of_week,
        available: e.available,
        start_time: e.available ? e.start_time : null,
        end_time: e.available ? e.end_time : null,
        preset: e.preset,
        location_id: selectedLocationId,
      }));
      const { error } = await supabase.from("availability").insert(rows);
      if (error) throw error;
      setSubmitted(true);
      toast.success("Availability submitted! 🎉");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    if (!user || !selectedLocationId) return;
    const templateData = entries.map((e) => ({
      day_of_week: e.day_of_week,
      available: e.available,
      start_time: e.start_time,
      end_time: e.end_time,
      preset: e.preset,
    }));
    try {
      await (supabase as any)
        .from("availability_templates")
        .delete()
        .eq("user_id", user.id)
        .eq("location_id", selectedLocationId);
      const { error } = await (supabase as any).from("availability_templates").insert({
        user_id: user.id,
        name: "My Template",
        entries: templateData,
        location_id: selectedLocationId,
      });
      if (error) throw error;
      setHasTemplate(true);
      toast.success("Template saved! You can load it for future weeks.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    }
  }

  async function loadTemplate() {
    if (!user || !selectedLocationId) return;
    try {
      const { data, error } = await (supabase as any)
        .from("availability_templates")
        .select("entries")
        .eq("user_id", user.id)
        .eq("location_id", selectedLocationId)
        .limit(1)
        .single();
      if (error || !data) {
        toast.error("No template found for this location. Save your current availability as a template first.");
        return;
      }
      const templateEntries = (data.entries as any[]).map((e: any) => ({
        day_of_week: e.day_of_week,
        available: e.available,
        start_time: e.start_time,
        end_time: e.end_time,
        preset: e.preset,
      }));
      setEntries(templateEntries);
      toast.success("Template loaded! Review and submit when ready.");
    } catch (err: any) {
      toast.error(err.message || "Failed to load template");
    }
  }

  const canEdit = !submitted && !isLocked && !isPastWeek;
  const weekLabel = `${format(weekStart, "d MMM")} – ${format(weekEndDate, "d MMM yyyy")}`;
  const selectedLocationName = userLocations.find((l) => l.id === selectedLocationId)?.name;

  return (
    <AppLayout>
      <h1 className="page-header mb-2">📋 Availability</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Set your availability for each week per location. Once submitted, it's locked so the manager can build the schedule.
      </p>

      {/* Location selector */}
      {locationsLoading ? (
        <p className="text-muted-foreground text-sm mb-4">Loading locations...</p>
      ) : userLocations.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <p className="text-muted-foreground text-sm">No locations assigned. Ask an admin/manager to assign you to a location.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
          {userLocations.length === 1 ? (
            <span className="text-sm font-medium text-foreground">{userLocations[0].name}</span>
          ) : (
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {userLocations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {!selectedLocationId ? null : (
        <>
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <p className="font-semibold text-foreground text-sm">{weekLabel}</p>
              {submitted && (
                <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-1">
                  <Lock className="w-3 h-3" /> Submitted
                </span>
              )}
              {isPastWeek && !submitted && (
                <span className="text-xs text-muted-foreground mt-1 block">Past week</span>
              )}
              {isLocked && (
                <span className="inline-flex items-center gap-1 text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full mt-1">
                  <Lock className="w-3 h-3" /> Locked by manager
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* This Week + Template buttons */}
          <div className="flex justify-center gap-2 mb-4 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setWeekStart(getMonWeekStart(new Date()))}>
              This Week
            </Button>
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={saveTemplate}>
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save Template
                </Button>
                {hasTemplate && (
                  <Button variant="outline" size="sm" onClick={loadTemplate}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Use Template
                  </Button>
                )}
              </>
            )}
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-8 animate-pulse">Loading...</p>
          ) : (
            <>
              {/* Day entries */}
              <div className="space-y-2 mb-6">
                {entries.map((entry, i) => {
                  const dayInfo = DAYS[i];
                  const dayDate = addDays(weekStart, i);

                  return (
                    <div key={dayInfo.dow} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-foreground text-sm">{dayInfo.label}</h3>
                          <p className="text-xs text-muted-foreground">{format(dayDate, "dd/MM")}</p>
                        </div>
                        {entry.preset === "UNAVAILABLE" ? (
                          <span className="text-xs text-destructive font-medium bg-destructive/10 px-2 py-1 rounded">
                            Unavailable
                          </span>
                        ) : (
                          <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded">
                            {formatBadge(entry)}
                          </span>
                        )}
                      </div>

                      {/* Preset buttons */}
                      <div className="flex flex-wrap gap-1.5">
                        {PRESETS.map((p) => (
                          <button
                            key={p.value}
                            onClick={() => canEdit && selectPreset(i, p.value)}
                            disabled={!canEdit}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              entry.preset === p.value
                                ? p.value === "UNAVAILABLE"
                                  ? "bg-destructive text-destructive-foreground border-destructive"
                                  : "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-border hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom time pickers */}
                      {entry.preset === "CUSTOM" && entry.available && (
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">From</label>
                            <Select
                              value={entry.start_time || ""}
                              onValueChange={(v) => canEdit && setCustomTime(i, "start_time", v)}
                              disabled={!canEdit}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Start" />
                              </SelectTrigger>
                              <SelectContent>
                                {customFromSlots.map((slot) => (
                                  <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <span className="text-muted-foreground mt-5">–</span>
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">To</label>
                            <Select
                              value={entry.end_time || ""}
                              onValueChange={(v) => canEdit && setCustomTime(i, "end_time", v)}
                              disabled={!canEdit}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="End" />
                              </SelectTrigger>
                              <SelectContent>
                                {customToSlots.map((slot) => (
                                  <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit button */}
              {canEdit && (
                <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
                  <Send className="w-4 h-4 mr-2" />
                  {saving ? "Submitting..." : "Submit Availability"}
                </Button>
              )}

              {submitted && (
                <p className="text-sm text-muted-foreground text-center">
                  Your availability for this week at {selectedLocationName} has been submitted and locked. Navigate to another week to submit new availability.
                </p>
              )}
            </>
          )}
        </>
      )}
    </AppLayout>
  );
}
