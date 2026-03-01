import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Settings {
  id?: string;
  location_id: string;
  time_entry_mode: string;
  time_entry_increment_mins: number;
  breaks_enabled: boolean;
  availability_deadline_day: number;
  availability_deadline_time: string;
  earliest_shift_start: string;
  latest_shift_end: string;
}

export default function ManagerSettings() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedLoc, setSelectedLoc] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!profile?.organization_id) return;
    supabase
      .from("locations")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .then(({ data }) => {
        if (data) {
          setLocations(data);
          if (data.length > 0) setSelectedLoc(data[0].id);
        }
      });
  }, [profile]);

  useEffect(() => {
    if (!selectedLoc) return;
    supabase
      .from("location_settings")
      .select("*")
      .eq("location_id", selectedLoc)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as Settings);
        else setSettings({
          location_id: selectedLoc,
          time_entry_mode: "QUARTER_HOUR_ONLY",
          time_entry_increment_mins: 15,
          breaks_enabled: false,
          availability_deadline_day: 4,
          availability_deadline_time: "23:59",
          earliest_shift_start: "11:30",
          latest_shift_end: "23:00",
        });
      });
  }, [selectedLoc]);

  async function handleSave() {
    if (!settings) return;
    const { id, ...data } = settings;
    // Include the availability time range fields
    const saveData = {
      ...data,
      availability_earliest_time: (settings as any).availability_earliest_time || "12:00",
      availability_latest_time: (settings as any).availability_latest_time || "19:00",
    };
    if (id) {
      const { error } = await supabase.from("location_settings").update(saveData as any).eq("id", id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("location_settings").insert(saveData as any);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Settings saved");
  }

  if (!settings) return <AppLayout><p className="text-muted-foreground">Loading...</p></AppLayout>;

  return (
    <AppLayout>
      <h1 className="page-header mb-6">⚙️ Location Settings</h1>

      <div className="max-w-xl space-y-6">
        <div className="flex gap-3 flex-wrap mb-4">
          {locations.map((l) => (
            <Button
              key={l.id}
              variant={selectedLoc === l.id ? "default" : "outline"}
              onClick={() => setSelectedLoc(l.id)}
            >
              {l.name}
            </Button>
          ))}
        </div>

        <div className="stat-card space-y-4">
          <h2 className="font-semibold text-foreground">Shift Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Time Increment (mins)</Label>
              <Input
                type="number"
                value={settings.time_entry_increment_mins}
                onChange={(e) => setSettings({ ...settings, time_entry_increment_mins: parseInt(e.target.value) || 15 })}
              />
            </div>
            <div>
              <Label>Deadline Day (0=Mon)</Label>
              <Input
                type="number"
                value={settings.availability_deadline_day}
                onChange={(e) => setSettings({ ...settings, availability_deadline_day: parseInt(e.target.value) || 4 })}
              />
            </div>
            <div>
              <Label>Earliest Shift Start</Label>
              <Input
                type="time"
                value={settings.earliest_shift_start}
                onChange={(e) => setSettings({ ...settings, earliest_shift_start: e.target.value })}
              />
            </div>
            <div>
              <Label>Latest Shift End</Label>
              <Input
                type="time"
                value={settings.latest_shift_end}
                onChange={(e) => setSettings({ ...settings, latest_shift_end: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={settings.breaks_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, breaks_enabled: v })}
            />
            <Label>Breaks Enabled</Label>
          </div>
        </div>

        <div className="stat-card space-y-4">
          <h2 className="font-semibold text-foreground">Worker Availability Settings</h2>
          <p className="text-xs text-muted-foreground">
            Configure the time range workers can choose from when setting custom availability (30-min intervals).
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Custom Earliest Time</Label>
              <Input
                type="time"
                value={(settings as any).availability_earliest_time || "12:00"}
                onChange={(e) => setSettings({ ...settings, availability_earliest_time: e.target.value } as any)}
                step="1800"
              />
            </div>
            <div>
              <Label>Custom Latest Time</Label>
              <Input
                type="time"
                value={(settings as any).availability_latest_time || "19:00"}
                onChange={(e) => setSettings({ ...settings, availability_latest_time: e.target.value } as any)}
                step="1800"
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </AppLayout>
  );
}
