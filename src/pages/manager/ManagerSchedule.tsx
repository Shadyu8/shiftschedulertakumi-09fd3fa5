import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, addDays } from "date-fns";

interface ShiftEntry {
  id?: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  published: boolean;
  profile?: { full_name: string };
}

interface Worker {
  user_id: string;
  full_name: string;
}

interface Location {
  id: string;
  name: string;
}

export default function ManagerSchedule() {
  const { profile } = useAuth();
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    return format(ws, "yyyy-MM-dd");
  });

  // New shift form
  const [newUserId, setNewUserId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("11:30");
  const [newEnd, setNewEnd] = useState("17:00");

  async function fetchData() {
    if (!profile?.organization_id) return;

    const [locRes, workersRes] = await Promise.all([
      supabase.from("locations").select("*").eq("organization_id", profile.organization_id),
      supabase.from("profiles").select("user_id, full_name").eq("organization_id", profile.organization_id),
    ]);

    if (locRes.data) {
      setLocations(locRes.data);
      if (!selectedLocation && locRes.data.length > 0) setSelectedLocation(locRes.data[0].id);
    }
    if (workersRes.data) setWorkers(workersRes.data);
  }

  async function fetchShifts() {
    if (!selectedLocation || !weekStart) return;
    const endDate = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");

    const { data } = await supabase
      .from("shifts")
      .select("*")
      .eq("location_id", selectedLocation)
      .gte("date", weekStart)
      .lte("date", endDate)
      .order("date")
      .order("start_time");

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      setShifts(data.map((s: any) => ({ ...s, profile: profileMap.get(s.user_id) })));
    } else {
      setShifts([]);
    }
  }

  useEffect(() => { fetchData(); }, [profile]);
  useEffect(() => { fetchShifts(); }, [selectedLocation, weekStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(weekStart), i);
    return { date: format(d, "yyyy-MM-dd"), label: format(d, "EEE dd/MM") };
  });

  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserId || !newDate || !selectedLocation) return;
    const { error } = await supabase.from("shifts").insert({
      user_id: newUserId,
      location_id: selectedLocation,
      date: newDate,
      start_time: newStart,
      end_time: newEnd,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Shift added");
    fetchShifts();
  }

  async function handleDeleteShift(id: string) {
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetchShifts();
  }

  async function publishAll() {
    const endDate = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
    const { error } = await supabase
      .from("shifts")
      .update({ published: true })
      .eq("location_id", selectedLocation)
      .gte("date", weekStart)
      .lte("date", endDate);
    if (error) { toast.error(error.message); return; }
    toast.success("All shifts published!");
    fetchShifts();
  }

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="page-header">📅 Schedule Builder</h1>
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="w-[180px]" />
          <Button onClick={publishAll} variant="default">
            <Send className="w-4 h-4 mr-2" /> Publish All
          </Button>
        </div>
      </div>

      {/* Add shift form */}
      <form onSubmit={handleAddShift} className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end">
        <Select value={newUserId} onValueChange={setNewUserId}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Worker" /></SelectTrigger>
          <SelectContent>
            {workers.map((w) => <SelectItem key={w.user_id} value={w.user_id}>{w.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={newDate} onValueChange={setNewDate}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Day" /></SelectTrigger>
          <SelectContent>
            {weekDays.map((d) => <SelectItem key={d.date} value={d.date}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-[120px]" />
        <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-[120px]" />
        <Button type="submit"><Plus className="w-4 h-4 mr-2" /> Add</Button>
      </form>

      {/* Weekly view */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const dayShifts = shifts.filter((s) => s.date === day.date);
          return (
            <div key={day.date} className="bg-card border border-border rounded-xl p-3 min-h-[120px]">
              <h3 className="text-sm font-semibold text-foreground mb-2">{day.label}</h3>
              <div className="space-y-1.5">
                {dayShifts.map((s) => (
                  <div key={s.id} className={`text-xs rounded-lg px-2 py-1.5 flex items-center justify-between ${s.published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    <div>
                      <span className="font-medium">{s.profile?.full_name}</span>
                      <br />{s.start_time}–{s.end_time}
                    </div>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => s.id && handleDeleteShift(s.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {dayShifts.length === 0 && <p className="text-xs text-muted-foreground">No shifts</p>}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
