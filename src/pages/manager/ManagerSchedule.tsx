import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Send, Plus, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, addDays, getDay } from "date-fns";

// ── Types ──

interface ShiftEntry {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  published: boolean;
  standby: boolean;
  profile?: { full_name: string };
  is_fulltimer_auto?: boolean; // virtual flag for display
}

interface Worker {
  user_id: string;
  full_name: string;
  role?: string;
  staff_type?: string;
}

interface FulltimerScheduleEntry {
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Location {
  id: string;
  name: string;
}

interface LocationSettings {
  time_entry_mode: string;
  time_entry_increment_mins: number;
  earliest_shift_start: string;
  latest_shift_end: string;
}

interface AvailabilityEntry {
  user_id: string;
  day_of_week: number;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
  preset: string | null;
}

interface UserAvailability {
  userId: string;
  fullName: string;
  role: string;
  availability: Record<number, { available: boolean; startTime: string | null; endTime: string | null; preset: string | null }>;
}

// ── Helpers ──

function toLocalDateStr(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function getMonWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function getWeekDays(ws: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
}

function formatWeekRange(ws: Date): string {
  const we = addDays(ws, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${ws.toLocaleDateString("en-GB", opts)} – ${we.toLocaleDateString("en-GB", opts)}, ${ws.getFullYear()}`;
}

function formatDayWithDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}

// Map JS getDay() (0=Sun) to day_of_week (0=Mon..6=Sun) matching DB
function getDayOfWeek(date: Date): number {
  const d = getDay(date);
  return d === 0 ? 6 : d - 1;
}

function generateTimeSlots(earliest: string, latest: string, incrementMins: number): string[] {
  const [eh, em] = earliest.split(":").map(Number);
  const [lh, lm] = latest.split(":").map(Number);
  const startMins = eh * 60 + em;
  const endMins = lh * 60 + lm;
  const slots: string[] = [];
  for (let t = startMins; t <= endMins; t += incrementMins) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}

function formatAvailLabel(avail: UserAvailability["availability"][number] | undefined): string {
  if (!avail) return "";
  switch (avail.preset) {
    case "ALL_DAY": return "All day";
    case "UNAVAILABLE": return "Unavailable";
    case "UNTIL_16": return "Until 16:00";
    case "UNTIL_17": return avail.endTime ? `Until ${avail.endTime}` : "Until 17:00";
    case "FROM_13": return avail.startTime ? `From ${avail.startTime}` : "From 13:00";
    case "FROM_14": return "From 14:00";
    case "FROM_15": return avail.startTime ? `From ${avail.startTime}` : "From 15:00";
    case "FROM_16": return "From 16:00";
    case "FROM_17": return avail.startTime ? `From ${avail.startTime}` : "From 17:00";
    case "CUSTOM":
      if (avail.startTime && avail.endTime) return `${avail.startTime}–${avail.endTime}`;
      return "Custom";
    default:
      if (avail.startTime && avail.endTime) return `${avail.startTime}–${avail.endTime}`;
      if (avail.startTime) return `From ${avail.startTime}`;
      if (avail.endTime) return `Until ${avail.endTime}`;
      return "";
  }
}

const TEMPLATES = [
  { label: "1130", start: "11:30", end: "17:00" },
  { label: "1200", start: "12:00", end: "17:00" },
  { label: "1300", start: "13:00", end: "17:00" },
  { label: "1400", start: "14:00", end: "" },
  { label: "1500", start: "15:00", end: "" },
  { label: "1700", start: "17:00", end: "" },
  { label: "1800", start: "18:00", end: "" },
];

// ── Component ──

export default function ManagerSchedule() {
  const { user, profile } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [weekStart, setWeekStart] = useState(getMonWeekStart(new Date()));
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [availabilities, setAvailabilities] = useState<UserAvailability[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [fulltimerSchedules, setFulltimerSchedules] = useState<FulltimerScheduleEntry[]>([]);
  const [locationSettings, setLocationSettings] = useState<LocationSettings>({
    time_entry_mode: "QUARTER_HOUR_ONLY",
    time_entry_increment_mins: 15,
    earliest_shift_start: "11:30",
    latest_shift_end: "23:00",
  });

  // Mobile daily view toggle
  const [mobileDailyMode, setMobileDailyMode] = useState(true);

  // Add shift modal
  const [modal, setModal] = useState<{
    userId: string;
    userName: string;
    date: string;
    dayAvail?: UserAvailability["availability"][number];
  } | null>(null);
  const [newShift, setNewShift] = useState({ startTime: "", endTime: "", standby: false });

  // Add worker modal
  const [addWorkerModal, setAddWorkerModal] = useState<{ date: string } | null>(null);
  const [addWorkerSearch, setAddWorkerSearch] = useState("");

  // Date availability popup (spreadsheet header click)
  const [dateAvailPopup, setDateAvailPopup] = useState<string | null>(null);

  // Dismiss availability confirmation
  const [dismissConfirm, setDismissConfirm] = useState<{ key: string } | null>(null);

  // Drag & drop shifts
  const dragShiftId = useRef<string | null>(null);
  const dragShiftUserId = useRef<string | null>(null); // track owner for fulltimer restriction
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Drag & drop rows
  const dragRowUserId = useRef<string | null>(null);
  const [dragOverRowUserId, setDragOverRowUserId] = useState<string | null>(null);
  const [workerOrder, setWorkerOrder] = useState<string[]>([]);

  // Dismissed availability
  const [dismissedAvail, setDismissedAvail] = useState<Set<string>>(new Set());

  // Removed fulltimer virtual shifts (persisted per date)
  const [removedFulltimerDays, setRemovedFulltimerDays] = useState<Set<string>>(new Set());

  // Inline editing
  const [shiftEdits, setShiftEdits] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const shiftEditsRef = useRef(shiftEdits);
  shiftEditsRef.current = shiftEdits;
  const [pendingEdits, setPendingEdits] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const pendingEditsRef = useRef(pendingEdits);
  pendingEditsRef.current = pendingEdits;

  // Mobile day view
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());

  const [publishing, setPublishing] = useState(false);

  // ── Data fetching ──

  useEffect(() => {
    if (!profile?.organization_id || !user) return;
    // Fetch manager's assigned locations (or all org locations for admins)
    supabase
      .from("user_locations")
      .select("location_id, locations(id, name)")
      .eq("user_id", user.id)
      .then(async ({ data: ulData }) => {
        let locs: Location[] = [];
        if (ulData && ulData.length > 0) {
          locs = (ulData as any[]).map((d) => d.locations).filter(Boolean);
        } else {
          // Fallback: admin or manager with no specific assignments sees all org locations
          const { data } = await supabase.from("locations").select("id, name").eq("organization_id", profile.organization_id!);
          locs = (data || []) as Location[];
        }
        setLocations(locs);
        if (!locationId && locs.length > 0) setLocationId(locs[0].id);
      });
  }, [profile, user]);

  // Fetch workers and shiftleaders assigned to selected location
  useEffect(() => {
    if (!locationId || !profile?.organization_id) return;
    supabase
      .from("user_locations")
      .select("user_id")
      .eq("location_id", locationId)
      .then(async ({ data: ulData, error: ulError }) => {
        console.log("[ScheduleBuilder] user_locations query:", { ulData, ulError, locationId });
        if (!ulData || ulData.length === 0) { setWorkers([]); return; }
        const userIds = [...new Set(ulData.map((d: any) => d.user_id))];
        console.log("[ScheduleBuilder] userIds from location:", userIds);
        // Fetch profiles and roles in parallel
        const [profilesRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, staff_type").in("user_id", userIds),
          supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        ]);
        console.log("[ScheduleBuilder] profiles:", profilesRes.data, "error:", profilesRes.error);
        console.log("[ScheduleBuilder] roles:", rolesRes.data, "error:", rolesRes.error);
        const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, { full_name: p.full_name, staff_type: p.staff_type }]));
        const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
        const filtered: Worker[] = userIds
          .filter((uid) => {
            const r = roleMap.get(uid);
            return r === "worker" || r === "shiftleader" || r === "fulltimer";
          })
          .map((uid) => ({
            user_id: uid,
            full_name: profileMap.get(uid)?.full_name ?? "Unknown",
            role: roleMap.get(uid),
            staff_type: profileMap.get(uid)?.staff_type ?? "floor",
          }));
        console.log("[ScheduleBuilder] filtered workers:", filtered);
        setWorkers(filtered);
      });
  }, [locationId, profile]);

  // Fetch fulltimer schedules for this location
  useEffect(() => {
    if (!locationId) return;
    supabase
      .from("fulltimer_schedules")
      .select("user_id, day_of_week, start_time, end_time")
      .eq("location_id", locationId)
      .then(({ data }) => {
        setFulltimerSchedules((data || []) as FulltimerScheduleEntry[]);
      });
  }, [locationId]);

  useEffect(() => {
    if (!locationId || !profile?.organization_id) return;
    const ws = toLocalDateStr(weekStart);
    const endDate = toLocalDateStr(addDays(weekStart, 6));

    Promise.all([
      // Shifts for this location
      supabase.from("shifts").select("*").eq("location_id", locationId).gte("date", ws).lte("date", endDate).order("date").order("start_time"),
      // Availability for this location and week
      supabase.from("availability").select("user_id, day_of_week, available, start_time, end_time, preset").eq("week_start", ws).eq("location_id", locationId),
      // Location settings
      supabase.from("location_settings").select("*").eq("location_id", locationId).maybeSingle(),
      // Fulltimer schedule overrides for this week
      supabase.from("fulltimer_schedule_overrides").select("user_id, date").eq("location_id", locationId).eq("removed", true).gte("date", ws).lte("date", endDate),
    ]).then(async ([shiftsRes, availRes, settingsRes, overridesRes]) => {
      // Handle shifts with profile lookups
      if (shiftsRes.data && shiftsRes.data.length > 0) {
        const userIds = [...new Set(shiftsRes.data.map((s: any) => s.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        setShifts(shiftsRes.data.map((s: any) => ({ ...s, profile: profileMap.get(s.user_id) })));
      } else {
        setShifts([]);
      }

      // Build user availability map
      if (availRes.data) {
        const avMap = new Map<string, UserAvailability>();
        for (const a of availRes.data as AvailabilityEntry[]) {
          if (!avMap.has(a.user_id)) {
            const w = workers.find((w) => w.user_id === a.user_id);
            avMap.set(a.user_id, {
              userId: a.user_id,
              fullName: w?.full_name ?? "Unknown",
              role: "",
              availability: {},
            });
          }
          const ua = avMap.get(a.user_id)!;
          ua.availability[a.day_of_week] = {
            available: a.available,
            startTime: a.start_time,
            endTime: a.end_time,
            preset: a.preset,
          };
        }
        setAvailabilities(Array.from(avMap.values()));
      }

      if (settingsRes.data) {
        setLocationSettings({
          time_entry_mode: settingsRes.data.time_entry_mode,
          time_entry_increment_mins: settingsRes.data.time_entry_increment_mins,
          earliest_shift_start: settingsRes.data.earliest_shift_start,
          latest_shift_end: settingsRes.data.latest_shift_end,
        });
      }

      // Load persisted fulltimer overrides
      if (overridesRes.data) {
        const removed = new Set<string>();
        for (const o of overridesRes.data as any[]) {
          removed.add(`${o.user_id}|${o.date}`);
        }
        setRemovedFulltimerDays(removed);
      } else {
        setRemovedFulltimerDays(new Set());
      }
    });

    setPendingEdits({});
    setDismissedAvail(new Set());
  }, [locationId, weekStart, workers]);

  // Sync shiftEdits
  useEffect(() => {
    setShiftEdits((prev) => {
      const next: Record<string, { startTime: string; endTime: string }> = {};
      for (const s of shifts) {
        next[s.id] = prev[s.id] ?? { startTime: s.start_time, endTime: s.end_time };
      }
      return next;
    });
  }, [shifts]);

  // Sync workerOrder from ALL workers (not just those with availability)
  useEffect(() => {
    setWorkerOrder((prev) => {
      const newIds = workers.map((w) => w.user_id);
      const kept = prev.filter((id) => newIds.includes(id));
      const added = newIds.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [workers]);

  const days = getWeekDays(weekStart);
  const hasUnpublished = shifts.some((s) => !s.published);
  const timeSlots = generateTimeSlots(locationSettings.earliest_shift_start, locationSettings.latest_shift_end, locationSettings.time_entry_increment_mins);
  // Build ordered list of ALL workers with their availability (empty if none)
  const orderedAvailabilities: UserAvailability[] = workerOrder.map((id) => {
    const existing = availabilities.find((ua) => ua.userId === id);
    if (existing) return existing;
    const w = workers.find((w) => w.user_id === id);
    return { userId: id, fullName: w?.full_name ?? "Unknown", role: "", availability: {} };
  });

  // Generate virtual shifts for fulltimers based on their recurring schedules
  const fulltimerVirtualShifts: ShiftEntry[] = [];
  for (const ftEntry of fulltimerSchedules) {
    const w = workers.find((w) => w.user_id === ftEntry.user_id && w.role === "fulltimer");
    if (!w) continue;
    for (const day of days) {
      const dow = getDayOfWeek(day);
      if (dow !== ftEntry.day_of_week) continue;
      const dateStr = toLocalDateStr(day);
      // Skip if there's already a real shift for this fulltimer on this day
      const hasRealShift = shifts.some((s) => s.user_id === ftEntry.user_id && s.date === dateStr);
      if (hasRealShift) continue;
      // Skip if removed by manager (persisted override)
      if (removedFulltimerDays.has(`${ftEntry.user_id}|${dateStr}`)) continue;
      fulltimerVirtualShifts.push({
        id: `ft-${ftEntry.user_id}-${dateStr}`,
        user_id: ftEntry.user_id,
        date: dateStr,
        start_time: ftEntry.start_time,
        end_time: ftEntry.end_time,
        published: true,
        standby: false,
        is_fulltimer_auto: true,
        profile: { full_name: w.full_name },
      });
    }
  }
  // Merge fulltimer virtual shifts into the shifts for display
  const allShiftsForDisplay = [...shifts, ...fulltimerVirtualShifts];
  // Check if there are publishable yellow availability boxes (with valid start times)
  const hasPublishableAvailability = orderedAvailabilities.some((ua) =>
    days.some((day) => {
      const dateStr = toLocalDateStr(day);
      const dow = getDayOfWeek(day);
      const avail = ua.availability[dow];
      const isAvailable = avail && avail.available && avail.preset !== "UNAVAILABLE";
      const workerShifts = shifts.filter((s) => s.user_id === ua.userId && s.date === dateStr);
      const isDismissed = dismissedAvail.has(`${ua.userId}|${dateStr}`);
      if (!isAvailable || workerShifts.length > 0 || isDismissed) return false;
      const pending = getPendingEdit(ua.userId, dateStr, avail);
      return !!pending.startTime;
    })
  );
  const canPublish = hasUnpublished || hasPublishableAvailability;
  const todayStr = toLocalDateStr(new Date());

  // ── Actions ──

  async function refreshShifts() {
    const ws = toLocalDateStr(weekStart);
    const endDate = toLocalDateStr(addDays(weekStart, 6));
    const { data } = await supabase.from("shifts").select("*").eq("location_id", locationId).gte("date", ws).lte("date", endDate).order("date").order("start_time");
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      setShifts(data.map((s: any) => ({ ...s, profile: profileMap.get(s.user_id) })));
    } else {
      setShifts([]);
    }
  }

  async function createShift() {
    if (!modal) return;
    const { error } = await supabase.from("shifts").insert({
      user_id: modal.userId,
      location_id: locationId,
      date: modal.date,
      start_time: newShift.startTime,
      end_time: newShift.endTime || "",
      standby: newShift.standby,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Shift added");
    setModal(null);
    refreshShifts();
  }

  async function deleteShift(shiftId: string) {
    const shift = shifts.find((s) => s.id === shiftId);
    const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
    if (error) { toast.error(error.message); return; }
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    if (shift) {
      setDismissedAvail((prev) => {
        const next = new Set(prev);
        next.delete(`${shift.user_id}|${shift.date}`);
        return next;
      });
    }
  }

  async function removeFulltimerVirtualShift(userId: string, date: string) {
    setRemovedFulltimerDays((prev) => new Set(prev).add(`${userId}|${date}`));
    // Persist the override to DB so it survives refresh and is week-specific
    await supabase.from("fulltimer_schedule_overrides").upsert({
      user_id: userId,
      location_id: locationId,
      date,
      removed: true,
    }, { onConflict: "user_id,location_id,date" });
  }

  async function saveShiftTime(shiftId: string, overrides?: { startTime?: string; endTime?: string }) {
    const cur = { ...(shiftEditsRef.current[shiftId] ?? {}), ...overrides };
    if (!cur.startTime && !cur.endTime) return;
    await supabase.from("shifts").update({
      start_time: cur.startTime,
      end_time: cur.endTime,
    }).eq("id", shiftId);
    setShifts((prev) => prev.map((s) => s.id === shiftId ? { ...s, start_time: cur.startTime ?? s.start_time, end_time: cur.endTime ?? s.end_time } : s));
  }

  async function savePendingShift(userId: string, date: string, overrides?: { startTime?: string; endTime?: string }) {
    const key = `${userId}|${date}`;
    const cur = { ...(pendingEditsRef.current[key] ?? {}), ...overrides };
    if (!cur?.startTime) return;
    const { error } = await supabase.from("shifts").insert({
      user_id: userId,
      location_id: locationId,
      date,
      start_time: cur.startTime,
      end_time: cur.endTime || "",
      standby: false,
    });
    if (!error) {
      setPendingEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
      refreshShifts();
    }
  }

  function getPendingEdit(userId: string, dateStr: string, avail: UserAvailability["availability"][number] | undefined) {
    const key = `${userId}|${dateStr}`;
    return pendingEdits[key] ?? { startTime: avail?.startTime ?? "", endTime: avail?.endTime ?? "" };
  }

  function updatePendingEdit(userId: string, dateStr: string, avail: UserAvailability["availability"][number] | undefined, field: "startTime" | "endTime", value: string) {
    const key = `${userId}|${dateStr}`;
    const current = getPendingEdit(userId, dateStr, avail);
    setPendingEdits((prev) => ({ ...prev, [key]: { ...current, [field]: value } }));
  }

  async function publishAll() {
    setPublishing(true);
    const ws = toLocalDateStr(weekStart);
    const endDate = toLocalDateStr(addDays(weekStart, 6));

    // Auto-create shifts from yellow availability boxes that have valid start times
    const newShiftsToInsert: { user_id: string; location_id: string; date: string; start_time: string; end_time: string; standby: boolean; published: boolean }[] = [];
    for (const ua of orderedAvailabilities) {
      for (const day of days) {
        const dateStr = toLocalDateStr(day);
        const dow = getDayOfWeek(day);
        const avail = ua.availability[dow];
        const isAvailable = avail && avail.available && avail.preset !== "UNAVAILABLE";
        const workerShifts = shifts.filter((s) => s.user_id === ua.userId && s.date === dateStr);
        const availKey = `${ua.userId}|${dateStr}`;
        const isDismissed = dismissedAvail.has(availKey);

        if (isAvailable && workerShifts.length === 0 && !isDismissed) {
          const pending = getPendingEdit(ua.userId, dateStr, avail);
          const startTime = pending.startTime;
          const endTime = pending.endTime || "";
          if (startTime) {
            newShiftsToInsert.push({
              user_id: ua.userId,
              location_id: locationId,
              date: dateStr,
              start_time: startTime,
              end_time: endTime,
              standby: false,
              published: true,
            });
          }
        }
      }
    }

    // Insert auto-created shifts
    if (newShiftsToInsert.length > 0) {
      const { error: insertErr } = await supabase.from("shifts").insert(newShiftsToInsert);
      if (insertErr) { toast.error(insertErr.message); setPublishing(false); return; }
    }

    // Publish all existing unpublished shifts
    const { error } = await supabase.from("shifts").update({ published: true }).eq("location_id", locationId).gte("date", ws).lte("date", endDate);
    if (error) { toast.error(error.message); setPublishing(false); return; }

    await refreshShifts();
    toast.success(`All shifts published!${newShiftsToInsert.length > 0 ? ` (${newShiftsToInsert.length} auto-created from availability)` : ""}`);
    setPublishing(false);
  }

  // ── Drag & drop: shifts ──

  function handleDragStart(shiftId: string, userId?: string) {
    dragShiftId.current = shiftId;
    dragShiftUserId.current = userId ?? null;
    dragRowUserId.current = null;
  }

  function handleDragOver(e: React.DragEvent, date: string) {
    e.preventDefault();
    setDragOverDate(date);
  }

  function handleDragLeave() {
    setDragOverDate(null);
  }

  async function handleDrop(e: React.DragEvent, targetDate: string, targetUserId?: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDate(null);
    const shiftId = dragShiftId.current;
    if (!shiftId) return;

    const isVirtual = shiftId.startsWith("ft-");
    const sourceUserId = dragShiftUserId.current;

    if (isVirtual) {
      // Fulltimer virtual shifts can only move within the same user
      const effectiveUserId = targetUserId ?? sourceUserId;
      if (effectiveUserId !== sourceUserId) return;

      const virtualShift = fulltimerVirtualShifts.find((s) => s.id === shiftId);
      if (!virtualShift || virtualShift.date === targetDate) return;

      // Check if target date already has a shift for this user
      const hasDupe = allShiftsForDisplay.some((s) => s.user_id === sourceUserId && s.date === targetDate);
      if (hasDupe) return;

      // Create real shift on target date
      const { error } = await supabase.from("shifts").insert({
        user_id: sourceUserId!,
        location_id: locationId,
        date: targetDate,
        start_time: virtualShift.start_time,
        end_time: virtualShift.end_time,
        standby: false,
      });
      if (!error) {
        // Persist removal of source virtual shift
        setRemovedFulltimerDays((prev) => new Set(prev).add(`${sourceUserId}|${virtualShift.date}`));
        await supabase.from("fulltimer_schedule_overrides").upsert({
          user_id: sourceUserId!,
          location_id: locationId,
          date: virtualShift.date,
          removed: true,
        }, { onConflict: "user_id,location_id,date" });
        refreshShifts();
      }
      dragShiftId.current = null;
      dragShiftUserId.current = null;
      return;
    }

    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    const effectiveUserId = targetUserId ?? shift.user_id;
    if (shift.date === targetDate && shift.user_id === effectiveUserId) return;
    const hasDupe = shifts.some((s) => s.user_id === effectiveUserId && s.date === targetDate && s.id !== shiftId);
    if (hasDupe) return;

    // Prevent moving a non-fulltimer shift onto a fulltimer row (and vice versa)
    const sourceWorker = workers.find((w) => w.user_id === shift.user_id);
    const targetWorker = workers.find((w) => w.user_id === effectiveUserId);
    if (sourceWorker?.role === "fulltimer" && targetWorker?.role !== "fulltimer") return;
    if (sourceWorker?.role !== "fulltimer" && targetWorker?.role === "fulltimer") return;

    const targetProfile = workers.find((w) => w.user_id === effectiveUserId);
    setShifts((prev) => prev.map((s) => s.id === shiftId ? { ...s, date: targetDate, user_id: effectiveUserId, profile: targetProfile ? { full_name: targetProfile.full_name } : s.profile } : s));

    const updates: any = {};
    if (shift.date !== targetDate) updates.date = targetDate;
    if (shift.user_id !== effectiveUserId) updates.user_id = effectiveUserId;
    await supabase.from("shifts").update(updates).eq("id", shiftId);
    dragShiftId.current = null;
    dragShiftUserId.current = null;
  }

  // ── Drag & drop: row reorder ──

  function handleRowDragStart(userId: string) {
    dragRowUserId.current = userId;
    dragShiftId.current = null;
  }

  function handleRowDragOver(e: React.DragEvent, targetUserId: string) {
    if (!dragRowUserId.current) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverRowUserId(targetUserId);
  }

  function handleRowDrop(e: React.DragEvent, targetUserId: string) {
    if (!dragRowUserId.current) return;
    e.preventDefault();
    e.stopPropagation();
    const sourceUserId = dragRowUserId.current;
    dragRowUserId.current = null;
    setDragOverRowUserId(null);
    if (sourceUserId === targetUserId) return;
    setWorkerOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(sourceUserId);
      const toIdx = next.indexOf(targetUserId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, sourceUserId);
      return next;
    });
  }

  // ── Add worker to day ──

  function addWorkerToDay(userId: string, userName: string, date: string) {
    const ua = availabilities.find((a) => a.userId === userId);
    const dow = getDayOfWeek(new Date(date + "T12:00:00"));
    const dayAvail = ua?.availability[dow];
    setAddWorkerModal(null);
    setAddWorkerSearch("");
    setModal({ userId, userName, date, dayAvail });
    setNewShift({ startTime: dayAvail?.startTime ?? "", endTime: dayAvail?.endTime ?? "", standby: false });
  }

  // Mobile helpers
  const selectedDay = days[selectedDayIndex];
  const selectedDateStr = toLocalDateStr(selectedDay);
  const selectedDow = getDayOfWeek(selectedDay);
  // Show all workers for the selected day (available ones first, then others)
  const selectedAllWorkers = orderedAvailabilities;
  const selectedDayShifts = allShiftsForDisplay.filter((s) => s.date === selectedDateStr);

  // Workers for add modal
  const addWorkerModalDow = addWorkerModal ? getDayOfWeek(new Date(addWorkerModal.date + "T12:00:00")) : null;
  const filteredWorkers = workers
    .filter((w) => w.full_name.toLowerCase().includes(addWorkerSearch.toLowerCase()))
    .filter((w) => !addWorkerModal || !shifts.some((s) => s.user_id === w.user_id && s.date === addWorkerModal.date))
    .map((w) => {
      const ua = availabilities.find((a) => a.userId === w.user_id);
      const dayAvail = addWorkerModalDow ? ua?.availability[addWorkerModalDow] : null;
      const hasAvailForDay = !!(dayAvail && dayAvail.available && dayAvail.preset !== "UNAVAILABLE");
      return { ...w, hasAvailForDay };
    })
    .sort((a, b) => {
      if (a.hasAvailForDay && !b.hasAvailForDay) return -1;
      if (!a.hasAvailForDay && b.hasAvailForDay) return 1;
      return a.full_name.localeCompare(b.full_name);
    });

  function toggleWorkerExpand(userId: string) {
    setExpandedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  // ── Shared inline time select ──
  function TimeSelect({ value, onChange, allowEmpty = false }: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border rounded px-1 py-0.5 text-xs bg-card text-foreground"
        style={{ minWidth: "58px" }}
      >
        {allowEmpty && <option value="">--</option>}
        {value && !timeSlots.includes(value) && <option value={value}>{value}</option>}
        {timeSlots.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    );
  }

  // Helper: when start time changes, clear end time if start >= end
  function handleStartTimeChange(
    currentEndTime: string,
    newStartTime: string
  ): string {
    if (!currentEndTime) return "";
    if (newStartTime >= currentEndTime) return "";
    return currentEndTime;
  }

  // ── Render ──

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="page-header">📅 Schedule Builder</h1>
      </div>

      {/* ── Desktop controls ── */}
      <div className="hidden md:flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Location</label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Week selector */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[200px] text-center">
            {formatWeekRange(weekStart)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(getMonWeekStart(new Date()))}>
            Today
          </Button>
        </div>

        {/* Spacer - view mode toggle removed */}

        {locationId && (
          <Button onClick={publishAll} disabled={publishing || !canPublish} className="ml-auto">
            <Send className="w-4 h-4 mr-2" />
            {publishing ? "Publishing..." : "Publish Schedule"}
          </Button>
        )}
      </div>

      {/* ── Mobile sticky header ── */}
      <div className="md:hidden sticky top-0 z-20 bg-background border-b border-border pb-2 mb-3">
        <div className="flex flex-wrap gap-2 items-end mb-2 pt-2 px-1">
          <div className="flex-1 min-w-0">
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {locationId && (
            <Button onClick={publishAll} disabled={publishing || !canPublish} size="sm">
              <Send className="w-4 h-4 mr-1" />
              {publishing ? "..." : "Publish"}
            </Button>
          )}
        </div>
        {locationId && (
          <>
            <div className="flex items-center justify-between px-1 mb-2">
              <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-semibold text-foreground text-center">{formatWeekRange(weekStart)}</span>
              <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            {/* Daily mode toggle */}
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-medium text-muted-foreground">Daily view</span>
              <button
                onClick={() => setMobileDailyMode((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${mobileDailyMode ? "bg-primary" : "bg-input"}`}
              >
                <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${mobileDailyMode ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            {/* Day selector tabs — only in daily mode */}
            {mobileDailyMode && (
              <div className="flex overflow-x-auto gap-1 px-1 no-scrollbar">
                {days.map((day, i) => {
                  const label = day.toLocaleDateString("en-GB", { weekday: "short" });
                  const num = day.getDate();
                  const isSelected = i === selectedDayIndex;
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedDayIndex(i); setExpandedWorkers(new Set()); }}
                      className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                    >
                      <span>{label}</span>
                      <span className="text-sm font-bold">{num}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {locationId && (
        <>
          {/* ── Mobile daily view ── */}
          {mobileDailyMode && (
          <div className="md:hidden space-y-2 pb-24">
            {selectedAllWorkers.length === 0 && selectedDayShifts.filter((s) => !selectedAllWorkers.find((ua) => ua.userId === s.user_id)).length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-6">No workers found</p>
            )}
            {selectedAllWorkers.map((ua) => {
              const avail = ua.availability[selectedDow];
              const workerShifts = selectedDayShifts.filter((s) => s.user_id === ua.userId);
              const isExpanded = expandedWorkers.has(ua.userId);
              const pendingEdit = getPendingEdit(ua.userId, selectedDateStr, avail);
              const availKey = `${ua.userId}|${selectedDateStr}`;
              const isDismissed = dismissedAvail.has(availKey);
              if (isDismissed && workerShifts.length === 0) return null;

              return (
                <div key={ua.userId} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                  <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggleWorkerExpand(ua.userId)}>
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-semibold text-foreground text-sm truncate">{ua.fullName}</span>
                      {formatAvailLabel(avail) && (
                        <span className="text-xs text-success bg-success/10 border border-success/20 rounded px-1.5 py-0.5 shrink-0">
                          {formatAvailLabel(avail)}
                        </span>
                      )}
                      {workerShifts.length > 0 && (
                        <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-semibold shrink-0">
                          {workerShifts.length}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground text-sm ml-2">{isExpanded ? "▲" : "▼"}</span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                      {workerShifts.map((s) => {
                        if (s.is_fulltimer_auto) {
                          return (
                            <div key={s.id} className="relative px-3 pt-6 pb-2 rounded-lg bg-primary/10 border border-primary/20">
                              <button onClick={() => removeFulltimerVirtualShift(s.user_id, s.date)} className="absolute top-1 right-2 text-destructive hover:text-destructive/80 font-bold text-lg leading-none" title="Remove shift">×</button>
                              <div className="flex items-center gap-1 text-primary font-medium">
                                <span>{s.start_time}</span>
                                <span className="text-muted-foreground text-sm">–</span>
                                <span>{s.end_time}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">Fulltimer</span>
                            </div>
                          );
                        }
                        const edit = shiftEdits[s.id] ?? { startTime: s.start_time, endTime: s.end_time };
                        const isFulltimerReal = workers.find((w) => w.user_id === s.user_id)?.role === "fulltimer";
                        return (
                          <div key={s.id} className={`relative px-3 pt-6 pb-2 rounded-lg ${isFulltimerReal ? "bg-primary/10 border border-primary/20" : s.published ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
                            <button onClick={() => deleteShift(s.id)} className="absolute top-1 right-2 text-destructive hover:text-destructive/80 font-bold text-lg leading-none" title="Remove shift">×</button>
                            {s.standby && <p className="text-xs text-muted-foreground mb-1">Standby</p>}
                            <div className="flex items-center gap-1">
                              <TimeSelect value={edit.startTime} onChange={(v) => { const newEnd = handleStartTimeChange(edit.endTime, v); setShiftEdits((prev) => ({ ...prev, [s.id]: { startTime: v, endTime: newEnd } })); saveShiftTime(s.id, { startTime: v, endTime: newEnd }); }} />
                              <span className="text-muted-foreground text-sm shrink-0">–</span>
                              <TimeSelect value={edit.endTime} allowEmpty onChange={(v) => { setShiftEdits((prev) => ({ ...prev, [s.id]: { ...edit, endTime: v } })); saveShiftTime(s.id, { startTime: edit.startTime, endTime: v }); }} />
                            </div>
                            {isFulltimerReal && <span className="text-[10px] text-muted-foreground">Fulltimer</span>}
                          </div>
                        );
                      })}
                      {workerShifts.length === 0 && !isDismissed && (
                        <div className="relative px-3 pt-6 pb-2 rounded-lg bg-warning/10 border border-warning/20">
                          <button onClick={() => setDismissConfirm({ key: availKey })} className="absolute top-1 right-2 text-destructive hover:text-destructive/80 font-bold text-lg leading-none" title="Dismiss">×</button>
                          <div className="flex items-center gap-1">
                             <TimeSelect value={pendingEdit.startTime} allowEmpty onChange={(v) => { const newEnd = handleStartTimeChange(pendingEdit.endTime, v); updatePendingEdit(ua.userId, selectedDateStr, avail, "startTime", v); if (newEnd !== pendingEdit.endTime) updatePendingEdit(ua.userId, selectedDateStr, avail, "endTime", newEnd); savePendingShift(ua.userId, selectedDateStr, { startTime: v, endTime: newEnd }); }} />
                            <span className="text-muted-foreground text-sm shrink-0">–</span>
                            <TimeSelect value={pendingEdit.endTime} allowEmpty onChange={(v) => { updatePendingEdit(ua.userId, selectedDateStr, avail, "endTime", v); savePendingShift(ua.userId, selectedDateStr, { startTime: pendingEdit.startTime, endTime: v }); }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Workers with shifts but no availability for this day */}
            {selectedDayShifts
              .filter((s) => !orderedAvailabilities.find((ua) => ua.userId === s.user_id))
              .map((s) => {
                const isExpanded = expandedWorkers.has(s.user_id);
                const edit = shiftEdits[s.id] ?? { startTime: s.start_time, endTime: s.end_time };
                return (
                  <div key={s.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggleWorkerExpand(s.user_id)}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-foreground text-sm truncate">{s.profile?.full_name ?? "Unknown"}</span>
                        <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-semibold shrink-0">1</span>
                      </div>
                      <span className="text-muted-foreground text-sm ml-2">{isExpanded ? "▲" : "▼"}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                        <div className={`relative px-3 pt-6 pb-2 rounded-lg ${s.published ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
                          <button onClick={() => deleteShift(s.id)} className="absolute top-1 right-2 text-destructive hover:text-destructive/80 font-bold text-lg leading-none" title="Remove shift">×</button>
                          <div className="flex items-center gap-1">
                            <TimeSelect value={edit.startTime} onChange={(v) => { const newEnd = handleStartTimeChange(edit.endTime, v); setShiftEdits((prev) => ({ ...prev, [s.id]: { startTime: v, endTime: newEnd } })); saveShiftTime(s.id, { startTime: v, endTime: newEnd }); }} />
                            <span className="text-muted-foreground text-sm shrink-0">–</span>
                            <TimeSelect value={edit.endTime} allowEmpty onChange={(v) => { setShiftEdits((prev) => ({ ...prev, [s.id]: { ...edit, endTime: v } })); saveShiftTime(s.id, { startTime: edit.startTime, endTime: v }); }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          )}

          {/* ── Mobile FAB (daily mode only) ── */}
          {mobileDailyMode && (
            <button
              className="md:hidden fixed bottom-20 right-6 z-30 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-full shadow-lg px-5 py-3 flex items-center gap-2"
              onClick={() => { setAddWorkerModal({ date: selectedDateStr }); setAddWorkerSearch(""); }}
            >
              <Plus className="w-4 h-4" /> Add worker
            </button>
          )}

          {/* ── Spreadsheet view (desktop always, mobile when not daily) ── */}
          <div className={`overflow-x-auto rounded-xl border border-border shadow-sm ${mobileDailyMode ? "hidden md:block" : ""}`}>
            {days.map((day) => {
              const dateStr = toLocalDateStr(day);
              const dow = getDayOfWeek(day);
              const availableWorkers = availabilities.filter((ua) => {
                const avail = ua.availability[dow];
                return avail && avail.available && avail.preset !== "UNAVAILABLE";
              });
              const dayShifts = allShiftsForDisplay.filter((s) => s.date === dateStr);
              const isDropTarget = dragOverDate === dateStr;

              return (
                <div
                  key={dateStr}
                  className={`min-w-0 flex flex-col gap-2 rounded-xl transition-colors ${isDropTarget ? "bg-primary/5 ring-2 ring-primary/40" : ""}`}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dateStr)}
                >
                  <div className={`text-center text-sm font-semibold rounded-lg px-2 py-2 ${dateStr === todayStr ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>
                    {formatDayWithDate(day)}
                  </div>
                  {availableWorkers.length === 0 && dayShifts.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">No availability</p>
                  )}
                  {availableWorkers.flatMap((ua) => {
                    const avail = ua.availability[dow];
                    const workerShifts = dayShifts.filter((s) => s.user_id === ua.userId);
                    const pendingEdit = getPendingEdit(ua.userId, dateStr, avail);
                    const availKey = `${ua.userId}|${dateStr}`;
                    const isDismissed = dismissedAvail.has(availKey);

                    if (workerShifts.length > 0) {
                      return workerShifts.map((s) => {
                        if (s.is_fulltimer_auto) {
                          return (
                            <div key={s.id} draggable onDragStart={() => handleDragStart(s.id, s.user_id)} className="relative bg-primary/5 border border-primary/20 rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing">
                              <button onClick={() => removeFulltimerVirtualShift(s.user_id, s.date)} className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-all text-sm" title="Remove">×</button>
                              <div className="flex items-start gap-1 mb-2 flex-wrap pr-6">
                                <span className="font-semibold text-foreground text-sm leading-tight">{ua.fullName}</span>
                                <span className="text-xs text-primary bg-primary/10 rounded px-1 shrink-0">FT</span>
                              </div>
                              <div className="px-2 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                                <div className="flex items-center gap-1 text-primary font-medium text-sm">
                                  <span>{s.start_time}</span>
                                  <span className="text-muted-foreground">–</span>
                                  <span>{s.end_time}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        const edit = shiftEdits[s.id] ?? { startTime: s.start_time, endTime: s.end_time };
                        const isFulltimerReal = workers.find((w) => w.user_id === s.user_id)?.role === "fulltimer";
                        return (
                          <div key={s.id} draggable onDragStart={() => handleDragStart(s.id, isFulltimerReal ? s.user_id : undefined)} className={`relative rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing ${isFulltimerReal ? "bg-primary/5 border border-primary/20" : "bg-card border border-border"}`}>
                            <button onClick={() => deleteShift(s.id)} className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-all text-sm" title="Remove">×</button>
                            <div className="flex items-start gap-1 mb-2 flex-wrap pr-6">
                              <span className="font-semibold text-foreground text-sm leading-tight">{ua.fullName}</span>
                              {formatAvailLabel(avail) && (
                                <span className="text-xs text-success bg-success/10 border border-success/20 rounded px-1 shrink-0">{formatAvailLabel(avail)}</span>
                              )}
                            </div>
                            <div className={`px-2 py-1.5 rounded-lg ${isFulltimerReal ? "bg-primary/10 border border-primary/20" : s.published ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
                              {s.standby && <p className="text-muted-foreground text-xs mb-1">Standby</p>}
                              <div className="flex items-center gap-1">
                                <TimeSelect value={edit.startTime} onChange={(v) => { const newEnd = handleStartTimeChange(edit.endTime, v); setShiftEdits((prev) => ({ ...prev, [s.id]: { startTime: v, endTime: newEnd } })); saveShiftTime(s.id, { startTime: v, endTime: newEnd }); }} />
                                <span className="text-muted-foreground text-xs shrink-0">–</span>
                                <TimeSelect value={edit.endTime} allowEmpty onChange={(v) => { setShiftEdits((prev) => ({ ...prev, [s.id]: { ...edit, endTime: v } })); saveShiftTime(s.id, { startTime: edit.startTime, endTime: v }); }} />
                              </div>
                            </div>
                            {isFulltimerReal && <span className="text-[10px] text-muted-foreground mt-1 block">Fulltimer</span>}
                          </div>
                        );
                      });
                    }
                    if (isDismissed) return [];
                    return [(
                      <div key={ua.userId} className="relative bg-card border border-border rounded-xl p-3 shadow-sm">
                        <button onClick={() => setDismissConfirm({ key: availKey })} className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-all text-sm" title="Dismiss">×</button>
                        <div className="flex items-start gap-1 mb-2 flex-wrap pr-6">
                          <span className="font-semibold text-foreground text-sm leading-tight">{ua.fullName}</span>
                          {formatAvailLabel(avail) && (
                            <span className="text-xs text-success bg-success/10 border border-success/20 rounded px-1 shrink-0">{formatAvailLabel(avail)}</span>
                          )}
                        </div>
                        <div className="px-2 py-1.5 rounded-lg bg-warning/10 border border-dashed border-warning/30">
                          <div className="flex items-center gap-1">
                                <TimeSelect value={pendingEdit.startTime} allowEmpty onChange={(v) => { const newEnd = handleStartTimeChange(pendingEdit.endTime, v); updatePendingEdit(ua.userId, dateStr, avail, "startTime", v); if (newEnd !== pendingEdit.endTime) updatePendingEdit(ua.userId, dateStr, avail, "endTime", newEnd); savePendingShift(ua.userId, dateStr, { startTime: v, endTime: newEnd }); }} />
                            <span className="text-muted-foreground text-xs shrink-0">–</span>
                            <TimeSelect value={pendingEdit.endTime} allowEmpty onChange={(v) => { updatePendingEdit(ua.userId, dateStr, avail, "endTime", v); savePendingShift(ua.userId, dateStr, { startTime: pendingEdit.startTime, endTime: v }); }} />
                          </div>
                        </div>
                      </div>
                    )];
                  })}
                  {/* Workers with shifts but not in orderedAvailabilities */}
                  {dayShifts.filter((s) => !orderedAvailabilities.find((ua) => ua.userId === s.user_id)).map((s) => {
                    const edit = shiftEdits[s.id] ?? { startTime: s.start_time, endTime: s.end_time };
                    return (
                      <div key={s.id} draggable onDragStart={() => handleDragStart(s.id)} className="relative bg-card border border-border rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing">
                        <button onClick={() => deleteShift(s.id)} className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-all text-sm" title="Remove">×</button>
                        <div className="font-semibold text-foreground text-sm mb-1.5 pr-6">{s.profile?.full_name ?? "Unknown"}</div>
                        <div className={`px-2 py-1.5 rounded-lg ${s.published ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
                          <div className="flex items-center gap-1">
                            <TimeSelect value={edit.startTime} onChange={(v) => { const newEnd = handleStartTimeChange(edit.endTime, v); setShiftEdits((prev) => ({ ...prev, [s.id]: { startTime: v, endTime: newEnd } })); saveShiftTime(s.id, { startTime: v, endTime: newEnd }); }} />
                            <span className="text-muted-foreground text-xs shrink-0">–</span>
                            <TimeSelect value={edit.endTime} allowEmpty onChange={(v) => { setShiftEdits((prev) => ({ ...prev, [s.id]: { ...edit, endTime: v } })); saveShiftTime(s.id, { startTime: edit.startTime, endTime: v }); }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => { setAddWorkerModal({ date: dateStr }); setAddWorkerSearch(""); }}
                    className="w-full text-center text-muted-foreground hover:text-primary text-xs border border-dashed border-border rounded-md py-1.5 hover:border-primary mt-1 transition-colors"
                  >
                    + Add worker
                  </button>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-destructive/10 border border-destructive/30"></span> Unpublished</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-success/10 border border-success/30"></span> Published</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-warning/10 border border-dashed border-warning/30"></span> Available (no shift)</span>
            <span className="hidden md:flex items-center gap-1">Drag shift cards to move between days/workers. Drag ⠿ to reorder rows.</span>
          </div>

          {/* ── Spreadsheet (table) view ── */}
          <div className={`overflow-x-auto rounded-xl border border-border shadow-sm ${viewMode !== "table" ? "hidden" : ""}`}>
            <table className="border-collapse w-full min-w-[900px] text-xs">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="sticky left-0 z-10 bg-muted text-left px-2 py-2 font-semibold text-foreground border-r border-border min-w-[140px]">
                    Worker
                  </th>
                  {days.map((day) => {
                    const dateStr = toLocalDateStr(day);
                    const isToday = dateStr === todayStr;
                    return (
                      <th key={dateStr} className={`text-center px-2 py-2 font-semibold text-foreground border-r border-border min-w-[140px] ${isToday ? "bg-primary/5" : ""}`}>
                        <button
                          onClick={() => setDateAvailPopup(dateStr)}
                          className="w-full hover:bg-primary/10 rounded px-1 py-0.5 transition-colors cursor-pointer"
                          title="View availability for this day"
                        >
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            {day.toLocaleDateString("en-GB", { weekday: "short" })}
                          </div>
                          <div className={`text-xs font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                            {day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </div>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {orderedAvailabilities.map((ua, rowIdx) => (
                  <tr
                    key={ua.userId}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); handleRowDragStart(ua.userId); }}
                    onDragOver={(e) => handleRowDragOver(e, ua.userId)}
                    onDragLeave={() => setDragOverRowUserId(null)}
                    onDrop={(e) => handleRowDrop(e, ua.userId)}
                    className={`border-b border-border ${rowIdx % 2 === 0 ? "bg-card" : "bg-muted/20"} hover:bg-primary/5 ${dragOverRowUserId === ua.userId ? "ring-2 ring-inset ring-primary/40" : ""}`}
                  >
                    <td className={`sticky left-0 z-10 px-2 py-1 border-r border-border ${rowIdx % 2 === 0 ? "bg-card" : "bg-background"}`}>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-muted-foreground text-xs cursor-grab select-none shrink-0" title="Drag to reorder">⠿</span>
                        <span className="font-medium text-foreground text-xs truncate">{ua.fullName}</span>
                      </div>
                    </td>
                    {days.map((day) => {
                      const dateStr = toLocalDateStr(day);
                      const dow = getDayOfWeek(day);
                      const avail = ua.availability[dow];
                      const isAvailable = avail && avail.available && avail.preset !== "UNAVAILABLE";
                      const workerShifts = allShiftsForDisplay.filter((s) => s.user_id === ua.userId && s.date === dateStr);
                      const pendingEdit = getPendingEdit(ua.userId, dateStr, avail);
                      const availKey = `${ua.userId}|${dateStr}`;
                      const isDismissed = dismissedAvail.has(availKey);
                      const isDropTarget = dragOverDate === dateStr;
                      const isToday = dateStr === todayStr;
                      return (
                        <td
                          key={dateStr}
                          className={`px-1 py-1 border-r border-border align-top transition-colors ${isDropTarget ? "bg-primary/10 ring-inset ring-1 ring-primary/40" : isToday ? "bg-primary/5" : ""}`}
                          onDragOver={(e) => handleDragOver(e, dateStr)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, dateStr, ua.userId)}
                        >
                          <div className="space-y-0.5 min-h-[36px]">
                            {workerShifts.map((s) => {
                              if (s.is_fulltimer_auto) {
                                return (
                                  <div key={s.id} draggable onDragStart={(e) => { e.stopPropagation(); handleDragStart(s.id, s.user_id); }} className="relative rounded px-1 pt-3 pb-1 bg-primary/10 border border-primary/20 text-xs cursor-grab active:cursor-grabbing">
                                    <button onClick={() => removeFulltimerVirtualShift(s.user_id, s.date)} className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full text-xs flex items-center justify-center leading-none font-bold border border-border hover:border-destructive/30 transition-colors" title="Remove">×</button>
                                    <div className="flex gap-0.5 items-center text-primary font-medium">
                                      <span>{s.start_time}</span>
                                      <span className="text-muted-foreground">–</span>
                                      <span>{s.end_time}</span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground">Fulltimer</span>
                                  </div>
                                );
                              }
                              const edit = shiftEdits[s.id] ?? { startTime: s.start_time, endTime: s.end_time };
                              const isFulltimerReal = workers.find((w) => w.user_id === s.user_id)?.role === "fulltimer";
                              return (
                                <div key={s.id} draggable onDragStart={(e) => { e.stopPropagation(); handleDragStart(s.id, isFulltimerReal ? s.user_id : undefined); }} className={`relative rounded px-1 pt-3 pb-1 cursor-grab active:cursor-grabbing ${isFulltimerReal ? "bg-primary/10 border border-primary/20" : s.published ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
                                  <button onClick={() => deleteShift(s.id)} className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full text-xs flex items-center justify-center leading-none font-bold border border-border hover:border-destructive/30 transition-colors" title="Remove">×</button>
                                  {s.standby && <span className="text-xs text-muted-foreground block mb-0.5">Standby</span>}
                                  <div className="flex gap-0.5 items-center">
                                    <TimeSelect value={edit.startTime} onChange={(v) => { const newEnd = handleStartTimeChange(edit.endTime, v); setShiftEdits((prev) => ({ ...prev, [s.id]: { startTime: v, endTime: newEnd } })); saveShiftTime(s.id, { startTime: v, endTime: newEnd }); }} />
                                    <span className="text-muted-foreground text-xs shrink-0">–</span>
                                    <TimeSelect value={edit.endTime} allowEmpty onChange={(v) => { setShiftEdits((prev) => ({ ...prev, [s.id]: { ...edit, endTime: v } })); saveShiftTime(s.id, { startTime: edit.startTime, endTime: v }); }} />
                                  </div>
                                  {isFulltimerReal && <span className="text-[9px] text-muted-foreground">Fulltimer</span>}
                                </div>
                              );
                            })}
                            {workerShifts.length === 0 && isAvailable && !isDismissed && (
                              <div className="relative rounded px-1 pt-3 pb-1 bg-warning/10 border border-dashed border-warning/30">
                                <button onClick={() => setDismissConfirm({ key: availKey })} className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full text-xs flex items-center justify-center leading-none font-bold border border-border hover:border-destructive/30 transition-colors" title="Dismiss">×</button>
                                <div className="flex gap-0.5 items-center">
                                  <TimeSelect value={pendingEdit.startTime} allowEmpty onChange={(v) => { const newEnd = handleStartTimeChange(pendingEdit.endTime, v); updatePendingEdit(ua.userId, dateStr, avail, "startTime", v); if (newEnd !== pendingEdit.endTime) updatePendingEdit(ua.userId, dateStr, avail, "endTime", newEnd); savePendingShift(ua.userId, dateStr, { startTime: v, endTime: newEnd }); }} />
                                  <span className="text-muted-foreground text-xs shrink-0">–</span>
                                  <TimeSelect value={pendingEdit.endTime} allowEmpty onChange={(v) => { updatePendingEdit(ua.userId, dateStr, avail, "endTime", v); savePendingShift(ua.userId, dateStr, { startTime: pendingEdit.startTime, endTime: v }); }} />
                                </div>
                              </div>
                            )}
                            {workerShifts.length === 0 && (!isAvailable || isDismissed) && (
                              <button
                                onClick={async () => {
                                  const dayAvail = isDismissed && isAvailable ? avail : undefined;
                                  const st = dayAvail?.startTime ?? "";
                                  const et = dayAvail?.endTime ?? "";
                                  const { error } = await supabase.from("shifts").insert({
                                    user_id: ua.userId,
                                    location_id: locationId,
                                    date: dateStr,
                                    start_time: st,
                                    end_time: et,
                                    standby: false,
                                  });
                                  if (error) { toast.error(error.message); return; }
                                  refreshShifts();
                                }}
                                className="w-full min-h-[34px] flex items-center justify-center text-muted-foreground/30 hover:text-primary hover:bg-primary/5 rounded transition-colors text-sm border border-dashed border-border hover:border-primary/30"
                                title="Add shift"
                              >+</button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Workers with shifts but not in orderedAvailabilities (e.g. not assigned to location) */}
                {(() => {
                  const knownUserIds = new Set(orderedAvailabilities.map((ua) => ua.userId));
                  const extraShifts = shifts.filter((s) => !knownUserIds.has(s.user_id));
                  const extraWorkerIds = [...new Set(extraShifts.map((s) => s.user_id))];
                  return extraWorkerIds.map((userId) => {
                    const workerName = extraShifts.find((s) => s.user_id === userId)?.profile?.full_name ?? "Unknown";
                    return (
                      <tr key={userId} className="border-b border-border bg-card hover:bg-primary/5">
                        <td className="sticky left-0 z-10 bg-card px-2 py-1 border-r border-border">
                          <span className="font-medium text-foreground text-xs">{workerName}</span>
                        </td>
                        {days.map((day) => {
                          const dateStr = toLocalDateStr(day);
                          const workerDayShifts = shifts.filter((s) => s.user_id === userId && s.date === dateStr);
                          const isDropTarget = dragOverDate === dateStr;
                          return (
                            <td key={dateStr} className={`px-1 py-1 border-r border-border align-top transition-colors ${isDropTarget ? "bg-primary/10 ring-inset ring-1 ring-primary/40" : ""}`}
                              onDragOver={(e) => handleDragOver(e, dateStr)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, dateStr, userId)}>
                              <div className="space-y-0.5 min-h-[36px]">
                                {workerDayShifts.map((s) => {
                                  const edit = shiftEdits[s.id] ?? { startTime: s.start_time, endTime: s.end_time };
                                  return (
                                    <div key={s.id} draggable onDragStart={(e) => { e.stopPropagation(); handleDragStart(s.id); }} className={`relative rounded px-1 pt-3 pb-1 cursor-grab ${s.published ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
                                      <button onClick={() => deleteShift(s.id)} className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full text-xs flex items-center justify-center leading-none font-bold border border-border transition-colors" title="Remove">×</button>
                                      <div className="flex gap-0.5 items-center">
                                        <TimeSelect value={edit.startTime} onChange={(v) => { const newEnd = handleStartTimeChange(edit.endTime, v); setShiftEdits((prev) => ({ ...prev, [s.id]: { startTime: v, endTime: newEnd } })); saveShiftTime(s.id, { startTime: v, endTime: newEnd }); }} />
                                        <span className="text-muted-foreground text-xs shrink-0">–</span>
                                        <TimeSelect value={edit.endTime} allowEmpty onChange={(v) => { setShiftEdits((prev) => ({ ...prev, [s.id]: { ...edit, endTime: v } })); saveShiftTime(s.id, { startTime: edit.startTime, endTime: v }); }} />
                                      </div>
                                    </div>
                                  );
                                })}
                                {workerDayShifts.length === 0 && (
                                  <button onClick={() => { setModal({ userId, userName: workerName, date: dateStr }); setNewShift({ startTime: "", endTime: "", standby: false }); }}
                                    className="w-full min-h-[34px] flex items-center justify-center text-muted-foreground/30 hover:text-primary hover:bg-primary/5 rounded transition-colors text-sm border border-dashed border-border hover:border-primary/30" title="Add shift">+</button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Add shift modal ── */}
      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Shift</DialogTitle>
          </DialogHeader>
          {modal && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{modal.userName} — {modal.date}</p>
              {modal.dayAvail && formatAvailLabel(modal.dayAvail) && (
                <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded px-2 py-1">
                  ⏰ Availability: {formatAvailLabel(modal.dayAvail)}
                </p>
              )}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Template</p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map((t) => (
                    <Button key={t.label} variant="outline" size="sm" onClick={() => setNewShift({ ...newShift, startTime: t.start, endTime: t.end })}>
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">Start time *</label>
                  <Input type="time" value={newShift.startTime} onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })} />
                </div>
                <span className="mt-5 text-muted-foreground">–</span>
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">End time</label>
                  <Input type="time" value={newShift.endTime} onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={newShift.standby} onCheckedChange={(checked) => setNewShift({ ...newShift, standby: !!checked })} />
                Standby
              </label>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
                <Button className="flex-1" disabled={!newShift.startTime} onClick={createShift}>Add</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add worker modal ── */}
      <Dialog open={!!addWorkerModal} onOpenChange={(open) => { if (!open) { setAddWorkerModal(null); setAddWorkerSearch(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Worker</DialogTitle>
          </DialogHeader>
          {addWorkerModal && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                {format(new Date(addWorkerModal.date + "T12:00:00"), "EEEE, d MMM yyyy")}
              </p>
              <Input
                placeholder="Search worker..."
                value={addWorkerSearch}
                onChange={(e) => setAddWorkerSearch(e.target.value)}
                className="mb-3"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredWorkers.map((w) => (
                  <button
                    key={w.user_id}
                    onClick={() => addWorkerToDay(w.user_id, w.full_name, addWorkerModal.date)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${w.hasAvailForDay ? "bg-success/10 hover:bg-success/20 border border-success/20" : "hover:bg-muted"}`}
                  >
                    <span className="flex-1">{w.full_name}</span>
                    {w.hasAvailForDay && (
                      <span className="text-xs text-success font-medium shrink-0">✓ available</span>
                    )}
                  </button>
                ))}
                {filteredWorkers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No workers found</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Date availability popup (spreadsheet header click) ── */}
      <Dialog open={!!dateAvailPopup} onOpenChange={(open) => !open && setDateAvailPopup(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Workers — {dateAvailPopup && format(new Date(dateAvailPopup + "T12:00:00"), "EEEE, d MMM yyyy")}
            </DialogTitle>
          </DialogHeader>
          {dateAvailPopup && (() => {
            const dow = getDayOfWeek(new Date(dateAvailPopup + "T12:00:00"));
            const withAvail = orderedAvailabilities.filter((ua) => {
              const a = ua.availability[dow];
              return a && a.available && a.preset !== "UNAVAILABLE";
            });
            const withoutShift = withAvail.filter((ua) => !shifts.some((s) => s.user_id === ua.userId && s.date === dateAvailPopup));
            const withShift = withAvail.filter((ua) => shifts.some((s) => s.user_id === ua.userId && s.date === dateAvailPopup));
            return (
              <div className="space-y-3">
                {withoutShift.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Available (no shift yet)</p>
                    <div className="space-y-1">
                      {withoutShift.map((ua) => {
                        const a = ua.availability[dow];
                        return (
                          <button
                            key={ua.userId}
                            onClick={() => {
                              setDateAvailPopup(null);
                              setModal({ userId: ua.userId, userName: ua.fullName, date: dateAvailPopup!, dayAvail: a });
                              setNewShift({ startTime: a?.startTime ?? "", endTime: a?.endTime ?? "", standby: false });
                            }}
                            className="w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between hover:bg-muted transition-colors border border-border"
                          >
                            <span className="font-medium">{ua.fullName}</span>
                            <span className="text-xs text-success font-medium">{formatAvailLabel(a)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {withShift.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Already scheduled</p>
                    <div className="space-y-1">
                      {withShift.map((ua) => {
                        const a = ua.availability[dow];
                        return (
                          <div
                            key={ua.userId}
                            className="px-3 py-2 rounded-md text-sm flex items-center justify-between opacity-40 border border-border"
                          >
                            <span className="font-medium">{ua.fullName}</span>
                            <span className="text-xs text-muted-foreground">{formatAvailLabel(a)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {withAvail.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No availability submitted for this day</p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Dismiss availability confirmation ── */}
      <Dialog open={!!dismissConfirm} onOpenChange={(open) => !open && setDismissConfirm(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Dismiss Availability</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Remove this availability from the schedule?</p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDismissConfirm(null)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              if (dismissConfirm) {
                setDismissedAvail((prev) => new Set(prev).add(dismissConfirm.key));
              }
              setDismissConfirm(null);
            }}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
