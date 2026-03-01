import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Monitor, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface KioskAccount {
  id: string;
  user_id: string;
  location_id: string;
  location_name: string;
  email: string;
  created_at: string;
}

function generate30MinOptions(earliest: string, latest: string): string[] {
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

export default function ManagerSettings() {
  const { user, profile } = useAuth();
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedLoc, setSelectedLoc] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);

  // Kiosk accounts state
  const [kioskAccounts, setKioskAccounts] = useState<KioskAccount[]>([]);
  const [showCreateKiosk, setShowCreateKiosk] = useState(false);
  const [kioskLocId, setKioskLocId] = useState("");
  const [kioskEmail, setKioskEmail] = useState("");
  const [kioskPassword, setKioskPassword] = useState("");
  const [showKioskPassword, setShowKioskPassword] = useState(false);
  const [kioskCreating, setKioskCreating] = useState(false);

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

  // Fetch kiosk accounts
  useEffect(() => {
    if (!profile?.organization_id) return;
    fetchKioskAccounts();
  }, [profile]);

  async function fetchKioskAccounts() {
    const { data: accounts } = await supabase
      .from("kiosk_accounts" as any)
      .select("id, user_id, location_id, created_at, locations(name)");
    if (!accounts) return;

    const userIds = (accounts as any[]).map((a) => a.user_id);
    if (userIds.length === 0) { setKioskAccounts([]); return; }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);
    const emailMap = new Map((profiles || []).map((p: any) => [p.user_id, p.username]));

    setKioskAccounts(
      (accounts as any[]).map((a) => ({
        id: a.id,
        user_id: a.user_id,
        location_id: a.location_id,
        location_name: a.locations?.name || "Unknown",
        email: emailMap.get(a.user_id) || "—",
        created_at: a.created_at,
      }))
    );
  }

  async function handleCreateKiosk() {
    if (!kioskEmail || !kioskPassword || !kioskLocId) {
      toast.error("Fill in all fields");
      return;
    }
    if (kioskPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setKioskCreating(true);
    const res = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: kioskEmail,
        full_name: `Kiosk – ${locations.find((l) => l.id === kioskLocId)?.name || ""}`,
        password: kioskPassword,
        role: "kiosk",
        organization_id: profile?.organization_id,
        location_id: kioskLocId,
      },
    });
    setKioskCreating(false);
    if (res.error || res.data?.error) {
      toast.error(res.data?.error || res.error?.message || "Failed to create kiosk account");
      return;
    }
    toast.success("Kiosk account created");
    setShowCreateKiosk(false);
    setKioskEmail("");
    setKioskPassword("");
    setKioskLocId("");
    fetchKioskAccounts();
  }

  async function handleDeleteKiosk(account: KioskAccount) {
    if (!confirm(`Delete kiosk account for ${account.location_name}?`)) return;
    const res = await supabase.functions.invoke("admin-create-user", {
      body: { action: "delete", user_id: account.user_id },
    });
    if (res.error || res.data?.error) {
      toast.error(res.data?.error || "Failed to delete");
      return;
    }
    toast.success("Kiosk account deleted");
    fetchKioskAccounts();
  }

  async function handleSave() {
    if (!settings) return;
    const { id, ...data } = settings;
    // Include the availability time range fields
    const saveData = {
      ...data,
      availability_from_start: (settings as any).availability_from_start || "12:00",
      availability_from_end: (settings as any).availability_from_end || "18:00",
      availability_to_start: (settings as any).availability_to_start || "15:00",
      availability_to_end: (settings as any).availability_to_end || "22:00",
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
              <Select value={settings.earliest_shift_start} onValueChange={(v) => setSettings({ ...settings, earliest_shift_start: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{generate30MinOptions("06:00", "23:30").map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Latest Shift End</Label>
              <Select value={settings.latest_shift_end} onValueChange={(v) => setSettings({ ...settings, latest_shift_end: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{generate30MinOptions("06:00", "23:30").map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
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
            Configure the time ranges workers can choose from when setting custom availability "From" and "To" (30-min intervals).
          </p>
          <div className="space-y-3">
            <p className="text-xs font-medium text-foreground">Custom "From" range</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Earliest</Label>
                <Select value={(settings as any).availability_from_start || "12:00"} onValueChange={(v) => setSettings({ ...settings, availability_from_start: v } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{generate30MinOptions("06:00", "23:30").map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Latest</Label>
                <Select value={(settings as any).availability_from_end || "18:00"} onValueChange={(v) => setSettings({ ...settings, availability_from_end: v } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{generate30MinOptions("06:00", "23:30").map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs font-medium text-foreground">Custom "To" range</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Earliest</Label>
                <Select value={(settings as any).availability_to_start || "15:00"} onValueChange={(v) => setSettings({ ...settings, availability_to_start: v } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{generate30MinOptions("06:00", "23:30").map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Latest</Label>
                <Select value={(settings as any).availability_to_end || "22:00"} onValueChange={(v) => setSettings({ ...settings, availability_to_end: v } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{generate30MinOptions("06:00", "23:30").map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <Button onClick={handleSave}>Save Settings</Button>

        {/* Kiosk Accounts Section */}
        <div className="stat-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Kiosk Accounts
            </h2>
            <Button size="sm" onClick={() => setShowCreateKiosk(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Kiosk
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Each location can have a dedicated kiosk login for the iPad. Workers use their PIN to clock in/out.
          </p>

          {kioskAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No kiosk accounts yet.</p>
          ) : (
            <div className="space-y-2">
              {kioskAccounts.map((ka) => (
                <div key={ka.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground text-sm">{ka.location_name}</p>
                    <p className="text-xs text-muted-foreground">{ka.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteKiosk(ka)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Kiosk Dialog */}
      <Dialog open={showCreateKiosk} onOpenChange={setShowCreateKiosk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Kiosk Account</DialogTitle>
            <DialogDescription>
              Create a dedicated login for an iPad kiosk at a specific location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={kioskLocId} onValueChange={setKioskLocId}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email (kiosk login)</Label>
              <Input
                type="email"
                value={kioskEmail}
                onChange={(e) => setKioskEmail(e.target.value)}
                placeholder="kiosk-location@yourcompany.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showKioskPassword ? "text" : "password"}
                  value={kioskPassword}
                  onChange={(e) => setKioskPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowKioskPassword(!showKioskPassword)}
                >
                  {showKioskPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleCreateKiosk}
              disabled={kioskCreating || !kioskEmail || !kioskPassword || !kioskLocId}
            >
              {kioskCreating ? "Creating..." : "Create Kiosk Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
