import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogOut, Delete, Clock, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Location {
  id: string;
  name: string;
}

interface ShiftInfo {
  id: string;
  start_time: string;
  end_time: string;
}

interface WorkerInfo {
  user_id: string;
  full_name: string;
  profile_picture: string | null;
  activePunch?: { id: string; punch_in: string } | null;
  todayShift?: ShiftInfo | null;
}

type KioskState = "setup" | "active";

export default function KioskPage() {
  const { user, profile, role } = useAuth();
  const [kioskState, setKioskState] = useState<KioskState>("setup");
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState("");
  const [selectedLocName, setSelectedLocName] = useState("");

  // PIN entry
  const [pin, setPin] = useState("");
  const [workerInfo, setWorkerInfo] = useState<WorkerInfo | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Exit dialog
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitPassword, setExitPassword] = useState("");
  const [exitLoading, setExitLoading] = useState(false);
  const [exitError, setExitError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  // Rate limiting for PIN attempts
  const failedAttempts = useRef(0);
  const lockoutUntil = useRef(0);
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 60_000; // 1 minute lockout

  // Kiosk-role users: auto-detect location from kiosk_accounts
  useEffect(() => {
    if (!user || role !== "kiosk") return;
    supabase
      .from("kiosk_accounts")
      .select("location_id, locations(id, name)")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const loc = data.locations as any;
          setSelectedLoc(data.location_id);
          setSelectedLocName(loc?.name || "Kiosk");
          setKioskState("active");
        }
      });
  }, [user, role]);

  // Fetch locations for manager/shiftleader setup
  useEffect(() => {
    if (!user || !profile) return;
    if (role === "kiosk") return; // handled above
    if (role === "manager" || role === "admin") {
      supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", profile.organization_id || "")
        .then(({ data }) => {
          if (data) {
            setLocations(data);
            if (data.length === 1) {
              setSelectedLoc(data[0].id);
              setSelectedLocName(data[0].name);
            }
          }
        });
    } else {
      // Shiftleaders: fetch assigned locations
      supabase
        .from("user_locations")
        .select("location_id, locations(id, name)")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (data) {
            const locs = data.map((d: any) => d.locations).filter(Boolean);
            setLocations(locs);
            if (locs.length === 1) {
              setSelectedLoc(locs[0].id);
              setSelectedLocName(locs[0].name);
            }
          }
        });
    }
  }, [user, profile, role]);

  // Check if kiosk mode was previously active (persist across refreshes)
  useEffect(() => {
    const stored = localStorage.getItem("kiosk_mode");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setSelectedLoc(data.locationId);
        setSelectedLocName(data.locationName);
        setKioskState("active");
      } catch { /* ignore */ }
    }
  }, []);

  function enterKioskMode() {
    if (!selectedLoc) {
      toast.error("Please select a location first");
      return;
    }
    const locName = locations.find((l) => l.id === selectedLoc)?.name || "";
    setSelectedLocName(locName);
    localStorage.setItem("kiosk_mode", JSON.stringify({ locationId: selectedLoc, locationName: locName }));
    setKioskState("active");
  }

  function handleNumpadPress(digit: string) {
    if (pin.length >= 5) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 5) {
      lookupWorker(newPin);
    }
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
    setWorkerInfo(null);
    setFeedback(null);
  }

  function handleClear() {
    setPin("");
    setWorkerInfo(null);
    setFeedback(null);
  }

  // Round clock-in time based on shift start with quarter-hour rounding (7-min boundary)
  function roundClockInTime(shiftStart: string | null): string {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    if (shiftStart) {
      const [sh, sm] = shiftStart.split(":").map(Number);
      const shiftMins = sh * 60 + sm;
      // If early, use shift start
      if (nowMins <= shiftMins) {
        return shiftStart;
      }
    }

    // Quarter-hour rounding: remainder < 7 → round down, >= 7 → round up
    const remainder = nowMins % 15;
    const roundedMins = remainder < 7 ? nowMins - remainder : nowMins + (15 - remainder);

    if (shiftStart) {
      const [sh, sm] = shiftStart.split(":").map(Number);
      const shiftMins = sh * 60 + sm;
      const finalMins = Math.max(roundedMins, shiftMins);
      return `${String(Math.floor(finalMins / 60)).padStart(2, "0")}:${String(finalMins % 60).padStart(2, "0")}`;
    }

    return `${String(Math.floor(roundedMins / 60)).padStart(2, "0")}:${String(roundedMins % 60).padStart(2, "0")}`;
  }

  const lookupWorker = useCallback(async (uniqueKey: string) => {
    // Rate limiting check
    const now = Date.now();
    if (now < lockoutUntil.current) {
      const secsLeft = Math.ceil((lockoutUntil.current - now) / 1000);
      setFeedback({ type: "error", message: `Too many attempts. Try again in ${secsLeft}s` });
      return;
    }

    setLookupLoading(true);
    setFeedback(null);
    setWorkerInfo(null);

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, profile_picture")
      .eq("unique_key", uniqueKey)
      .single();

    if (error || !profileData) {
      failedAttempts.current += 1;
      if (failedAttempts.current >= MAX_ATTEMPTS) {
        lockoutUntil.current = Date.now() + LOCKOUT_MS;
        failedAttempts.current = 0;
        setFeedback({ type: "error", message: "Too many failed attempts. Please wait." });
      } else {
        // Delay response to slow brute-force
        await new Promise((r) => setTimeout(r, 1500));
        setFeedback({ type: "error", message: "Invalid PIN" });
      }
      setLookupLoading(false);
      return;
    }

    // Reset on success
    failedAttempts.current = 0;

    // Fetch today's shift and active punch in parallel
    const [punchRes, shiftRes] = await Promise.all([
      supabase
        .from("time_punches")
        .select("id, punch_in")
        .eq("user_id", profileData.user_id)
        .eq("location_id", selectedLoc)
        .eq("date", today)
        .is("punch_out", null)
        .maybeSingle(),
      supabase
        .from("shifts")
        .select("id, start_time, end_time")
        .eq("user_id", profileData.user_id)
        .eq("location_id", selectedLoc)
        .eq("date", today)
        .maybeSingle(),
    ]);

    setWorkerInfo({
      ...profileData,
      activePunch: punchRes.data || null,
      todayShift: shiftRes.data || null,
    });
    setLookupLoading(false);
  }, [selectedLoc, today]);

  async function handleClockIn() {
    if (!workerInfo) return;
    setActionLoading(true);
    const clockInTime = roundClockInTime(workerInfo.todayShift?.start_time || null);
    const { error } = await supabase.from("time_punches").insert({
      user_id: workerInfo.user_id,
      location_id: selectedLoc,
      date: today,
      punch_in: clockInTime,
      recorded_in_by_id: user?.id,
    });
    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({ type: "success", message: `${workerInfo.full_name} clocked in at ${clockInTime}` });
    }
    setActionLoading(false);
    setTimeout(() => {
      setPin("");
      setWorkerInfo(null);
      setFeedback(null);
    }, 2500);
  }

  // Round time to nearest quarter-hour (7-min boundary)
  function roundToQuarter(date: Date): string {
    const mins = date.getHours() * 60 + date.getMinutes();
    const remainder = mins % 15;
    const rounded = remainder < 7 ? mins - remainder : mins + (15 - remainder);
    return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
  }

  async function handleClockOut() {
    if (!workerInfo?.activePunch) return;
    setActionLoading(true);
    const now = roundToQuarter(new Date());
    const { error } = await supabase.from("time_punches").update({
      punch_out: now,
      recorded_out_by_id: user?.id,
    }).eq("id", workerInfo.activePunch.id);
    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({ type: "success", message: `${workerInfo.full_name} clocked out at ${now}` });
    }
    setActionLoading(false);
    setTimeout(() => {
      setPin("");
      setWorkerInfo(null);
      setFeedback(null);
    }, 2500);
  }

  async function handleExitKiosk() {
    setExitLoading(true);
    setExitError("");
    // Verify manager password by re-authenticating
    const email = user?.email;
    if (!email) {
      setExitError("Unable to verify identity");
      setExitLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: exitPassword,
    });
    if (error) {
      setExitError("Incorrect password");
      setExitLoading(false);
      return;
    }
    localStorage.removeItem("kiosk_mode");
    setKioskState("setup");
    setPin("");
    setWorkerInfo(null);
    setFeedback(null);
    setShowExitDialog(false);
    setExitPassword("");
    setExitLoading(false);
    toast.success("Exited kiosk mode");
  }

  // ── SETUP SCREEN ──
  if (kioskState === "setup") {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-12">
          <h1 className="text-2xl font-bold text-foreground mb-2">🖥️ Kiosk Setup</h1>
          <p className="text-muted-foreground mb-8">
            Select a location to set up this device as a kiosk terminal. Workers will clock in/out using their unique 5-digit PIN.
          </p>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={selectedLoc} onValueChange={setSelectedLoc}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" size="lg" onClick={enterKioskMode} disabled={!selectedLoc}>
              Enter Kiosk Mode
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── ACTIVE KIOSK SCREEN ──
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">{selectedLocName}</span>
        </div>
        {role !== "kiosk" && (
          <Button variant="ghost" size="sm" onClick={() => setShowExitDialog(true)}>
            <LogOut className="w-4 h-4 mr-1" />
            Exit Kiosk
          </Button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Feedback banner */}
        {feedback && (
          <div className={`w-full max-w-sm mb-6 rounded-xl px-6 py-4 text-center text-lg font-semibold animate-fade-in ${
            feedback.type === "success" 
              ? "bg-primary/10 text-primary border border-primary/20" 
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}>
            <div className="flex items-center justify-center gap-2">
              {feedback.type === "success" ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
              {feedback.message}
            </div>
          </div>
        )}

        {/* Worker info card */}
        {workerInfo && !feedback && (
          <div className="w-full max-w-sm mb-6 bg-card border border-border rounded-2xl p-6 text-center animate-fade-in">
            {workerInfo.profile_picture ? (
              <img
                src={workerInfo.profile_picture}
                alt={workerInfo.full_name}
                className="w-20 h-20 rounded-full mx-auto mb-3 object-cover border-2 border-primary/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {workerInfo.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            )}
            <p className="text-xl font-bold text-foreground mb-1">{workerInfo.full_name}</p>
            {workerInfo.todayShift ? (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2 mb-3">
                <p className="text-sm font-medium text-primary">Today's shift</p>
                <p className="text-lg font-bold text-foreground">{workerInfo.todayShift.start_time} – {workerInfo.todayShift.end_time}</p>
              </div>
            ) : (
              <div className="bg-muted rounded-lg px-4 py-2 mb-3">
                <p className="text-sm font-medium text-muted-foreground">Not working today</p>
              </div>
            )}
            {workerInfo.activePunch ? (
              <p className="text-sm text-muted-foreground mb-4">Clocked in since {workerInfo.activePunch.punch_in}</p>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">{workerInfo.todayShift ? "Not clocked in yet" : "Not clocked in"}</p>
            )}
            <div className="flex gap-3">
              {workerInfo.activePunch ? (
                <Button
                  className="flex-1"
                  variant="destructive"
                  size="lg"
                  onClick={handleClockOut}
                  disabled={actionLoading}
                >
                  {actionLoading ? "..." : "Clock Out"}
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleClockIn}
                  disabled={actionLoading}
                >
                  {actionLoading ? "..." : "Clock In"}
                </Button>
              )}
              <Button variant="outline" size="lg" onClick={handleClear}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* PIN display */}
        {!workerInfo && !feedback && (
          <>
            <p className="text-muted-foreground mb-4 text-lg">Enter your 5-digit PIN</p>
            <div className="flex gap-3 mb-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                    i < pin.length
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {i < pin.length
                      ? "★"
                      : ""}
                </div>
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  className="h-16 text-2xl font-semibold"
                  onClick={() => handleNumpadPress(digit)}
                  disabled={lookupLoading}
                >
                  {digit}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-16"
                onClick={handleClear}
                disabled={lookupLoading}
              >
                Clear
              </Button>
              <Button
                variant="outline"
                className="h-16 text-2xl font-semibold"
                onClick={() => handleNumpadPress("0")}
                disabled={lookupLoading}
              >
                0
              </Button>
              <Button
                variant="outline"
                className="h-16"
                onClick={handleBackspace}
                disabled={lookupLoading}
              >
                <Delete className="w-6 h-6" />
              </Button>
            </div>

            {lookupLoading && (
              <p className="text-muted-foreground mt-4 animate-pulse">Looking up worker...</p>
            )}
          </>
        )}
      </div>

      {/* Exit Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit Kiosk Mode</DialogTitle>
            <DialogDescription>Enter your password to exit kiosk mode.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {exitError && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3">
                {exitError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="exit-password">Password</Label>
              <Input
                id="exit-password"
                type="password"
                value={exitPassword}
                onChange={(e) => setExitPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && handleExitKiosk()}
              />
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={handleExitKiosk}
                disabled={exitLoading || !exitPassword}
              >
                {exitLoading ? "Verifying..." : "Exit Kiosk Mode"}
              </Button>
              <Button variant="outline" onClick={() => { setShowExitDialog(false); setExitPassword(""); setExitError(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
