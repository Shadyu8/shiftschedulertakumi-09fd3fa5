import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, startOfWeek, addDays, isBefore, isToday, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Lock, Send } from "lucide-react";

// day_of_week: 1=Mon .. 7=Sun (matches schedule builder)
const DAYS = [
  { dow: 1, label: "Monday" },
  { dow: 2, label: "Tuesday" },
  { dow: 3, label: "Wednesday" },
  { dow: 4, label: "Thursday" },
  { dow: 5, label: "Friday" },
  { dow: 6, label: "Saturday" },
  { dow: 7, label: "Sunday" },
];

// Presets matching what schedule builder expects
const PRESETS = [
  { value: "ALL_DAY", label: "All Day", start: "11:30", end: "23:00" },
  { value: "UNTIL_17", label: "Until 17:00", start: "11:30", end: "17:00" },
  { value: "FROM_13", label: "From 13:00", start: "13:00", end: "23:00" },
  { value: "FROM_15", label: "From 15:00", start: "15:00", end: "23:00" },
  { value: "FROM_17", label: "From 17:00", start: "17:00", end: "23:00" },
  { value: "UNAVAILABLE", label: "Unavailable", start: null, end: null },
];

interface AvailabilityEntry {
  id?: string;
  day_of_week: number;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
  preset: string;
}

function getMonWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export default function WorkerAvailability() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [weekStart, setWeekStart] = useState(() => getMonWeekStart(new Date()));
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndDate = addDays(weekStart, 6);
  const isLocked = profile?.availability_locked;

  // Check if this week is in the past (can't edit past weeks)
  const isPastWeek = isBefore(weekEndDate, startOfDay(new Date())) && !isToday(weekEndDate);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("availability")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStartStr)
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
              return { day_of_week: d.dow, available: true, start_time: "11:30", end_time: "23:00", preset: "ALL_DAY" };
            })
          );
        } else {
          setSubmitted(false);
          setEntries(
            DAYS.map((d) => ({
              day_of_week: d.dow,
              available: true,
              start_time: "11:30",
              end_time: "23:00",
              preset: "ALL_DAY",
            }))
          );
        }
        setLoading(false);
      });
  }, [user, weekStartStr]);

  function selectPreset(index: number, presetValue: string) {
    const preset = PRESETS.find((p) => p.value === presetValue);
    if (!preset) return;
    setEntries((prev) =>
      prev.map((e, i) =>
        i === index
          ? {
              ...e,
              preset: presetValue,
              available: presetValue !== "UNAVAILABLE",
              start_time: preset.start,
              end_time: preset.end,
            }
          : e
      )
    );
  }

  async function handleSubmit() {
    if (!user) return;
    setSaving(true);
    try {
      // Delete existing for this week
      await supabase.from("availability").delete().eq("user_id", user.id).eq("week_start", weekStartStr);
      // Insert new
      const rows = entries.map((e) => ({
        user_id: user.id,
        week_start: weekStartStr,
        day_of_week: e.day_of_week,
        available: e.available,
        start_time: e.available ? e.start_time : null,
        end_time: e.available ? e.end_time : null,
        preset: e.preset,
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

  const canEdit = !submitted && !isLocked && !isPastWeek;
  const weekLabel = `${format(weekStart, "d MMM")} – ${format(weekEndDate, "d MMM yyyy")}`;

  return (
    <AppLayout>
      <h1 className="page-header mb-2">📋 Availability</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Set your availability for each week. Once submitted, it's locked so the manager can build the schedule.
      </p>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-6">
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

      {/* Today button */}
      <div className="flex justify-center mb-4">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(getMonWeekStart(new Date()))}>
          This Week
        </Button>
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
              const isSelectedPreset = (pv: string) => entry.preset === pv;

              return (
                <div key={dayInfo.dow} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{dayInfo.label}</h3>
                      <p className="text-xs text-muted-foreground">{format(dayDate, "dd/MM")}</p>
                    </div>
                    {entry.preset === "UNAVAILABLE" ? (
                      <span className="text-xs text-destructive font-medium bg-destructive/10 px-2 py-1 rounded">Unavailable</span>
                    ) : (
                      <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded">
                        {entry.start_time} – {entry.end_time}
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
                          isSelectedPreset(p.value)
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
              Your availability for this week has been submitted and locked. Navigate to another week to submit new availability.
            </p>
          )}
        </>
      )}
    </AppLayout>
  );
}
