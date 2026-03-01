import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, startOfWeek, addDays } from "date-fns";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PRESETS = [
  { value: "morning", label: "Morning (11:30–17:00)" },
  { value: "evening", label: "Evening (17:00–23:00)" },
  { value: "full", label: "Full Day (11:30–23:00)" },
  { value: "custom", label: "Custom" },
];

interface AvailabilityEntry {
  id?: string;
  day_of_week: number;
  available: boolean;
  start_time: string;
  end_time: string;
  preset: string;
}

export default function WorkerAvailability() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [weekStart, setWeekStart] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("availability")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setEntries(
            DAYS.map((_, i) => {
              const existing = data.find((d: any) => d.day_of_week === i);
              return existing
                ? { id: existing.id, day_of_week: i, available: existing.available, start_time: existing.start_time || "", end_time: existing.end_time || "", preset: existing.preset || "full" }
                : { day_of_week: i, available: true, start_time: "11:30", end_time: "23:00", preset: "full" };
            })
          );
        } else {
          setEntries(DAYS.map((_, i) => ({
            day_of_week: i, available: true, start_time: "11:30", end_time: "23:00", preset: "full",
          })));
        }
      });
  }, [user, weekStart]);

  function updateEntry(index: number, updates: Partial<AvailabilityEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...updates } : e)));
  }

  function applyPreset(index: number, preset: string) {
    const times: Record<string, { start: string; end: string }> = {
      morning: { start: "11:30", end: "17:00" },
      evening: { start: "17:00", end: "23:00" },
      full: { start: "11:30", end: "23:00" },
    };
    const t = times[preset] || { start: "11:30", end: "23:00" };
    updateEntry(index, { preset, start_time: t.start, end_time: t.end });
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      // Delete existing for this week
      await supabase.from("availability").delete().eq("user_id", user.id).eq("week_start", weekStart);
      // Insert new
      const rows = entries.map((e) => ({
        user_id: user.id,
        week_start: weekStart,
        day_of_week: e.day_of_week,
        available: e.available,
        start_time: e.available ? e.start_time : null,
        end_time: e.available ? e.end_time : null,
        preset: e.preset,
      }));
      const { error } = await supabase.from("availability").insert(rows);
      if (error) throw error;
      toast.success("Availability saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const locked = profile?.availability_locked;

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="page-header">📋 Availability</h1>
        <div className="flex gap-3 items-center">
          <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="w-[180px]" />
          {locked && <span className="text-xs text-warning font-medium bg-warning/10 px-2 py-1 rounded">🔒 Locked</span>}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {entries.map((entry, i) => {
          const dayDate = addDays(new Date(weekStart), i);
          return (
            <div key={i} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{DAYS[i]}</h3>
                  <p className="text-xs text-muted-foreground">{format(dayDate, "dd/MM/yyyy")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{entry.available ? "Available" : "Off"}</span>
                  <Switch
                    checked={entry.available}
                    onCheckedChange={(v) => updateEntry(i, { available: v })}
                    disabled={!!locked}
                  />
                </div>
              </div>
              {entry.available && (
                <div className="flex flex-wrap gap-3 items-end">
                  <Select value={entry.preset} onValueChange={(v) => applyPreset(i, v)} disabled={!!locked}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {entry.preset === "custom" && (
                    <>
                      <Input
                        type="time"
                        value={entry.start_time}
                        onChange={(e) => updateEntry(i, { start_time: e.target.value })}
                        className="w-[120px]"
                        disabled={!!locked}
                      />
                      <Input
                        type="time"
                        value={entry.end_time}
                        onChange={(e) => updateEntry(i, { end_time: e.target.value })}
                        className="w-[120px]"
                        disabled={!!locked}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={saving || !!locked} className="w-full sm:w-auto">
        {saving ? "Saving..." : "Save Availability"}
      </Button>
    </AppLayout>
  );
}
