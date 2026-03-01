import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, Timer, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Punch {
  id: string;
  date: string;
  punch_in: string;
  punch_out: string | null;
  notes: string | null;
  approved: boolean | null;
  location_name: string;
}

interface MonthGroup {
  key: string;
  label: string;
  punches: Punch[];
  totalHours: number;
}

function calcHours(punchIn: string, punchOut: string | null): number {
  if (!punchOut) return 0;
  const [ih, im] = punchIn.split(":").map(Number);
  const [oh, om] = punchOut.split(":").map(Number);
  return Math.max(0, (oh * 60 + om - (ih * 60 + im)) / 60);
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export default function WorkerPunches() {
  const { user } = useAuth();
  const [punches, setPunches] = useState<Punch[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("time_punches")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("punch_in", { ascending: false })
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const locIds = [...new Set(data.map((p: any) => p.location_id))];
          const { data: locs } = await supabase.from("locations").select("id, name").in("id", locIds);
          const locMap = new Map((locs || []).map((l: any) => [l.id, l.name]));
          setPunches(
            data.map((p: any) => ({
              id: p.id,
              date: p.date,
              punch_in: p.punch_in,
              punch_out: p.punch_out,
              notes: p.notes,
              approved: p.approved,
              location_name: locMap.get(p.location_id) || "Unknown",
            }))
          );
        } else {
          setPunches([]);
        }
        setLoading(false);
      });
  }, [user]);

  const monthGroups = useMemo<MonthGroup[]>(() => {
    const groups = new Map<string, Punch[]>();
    for (const p of punches) {
      const key = p.date.slice(0, 7); // YYYY-MM
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: format(parseISO(key + "-01"), "MMMM yyyy"),
      punches: items,
      totalHours: items.reduce((sum, p) => sum + calcHours(p.punch_in, p.punch_out), 0),
    }));
  }, [punches]);

  const grandTotal = useMemo(() => monthGroups.reduce((s, g) => s + g.totalHours, 0), [monthGroups]);

  // Auto-expand current month
  useEffect(() => {
    if (monthGroups.length > 0) {
      setExpandedMonths(new Set([monthGroups[0].key]));
    }
  }, [monthGroups]);

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function StatusIcon({ punch }: { punch: Punch }) {
    if (!punch.punch_out) {
      return <CircleDot className="w-4 h-4 text-primary" />;
    }
    if (punch.approved === true) {
      return <CheckCircle className="w-4 h-4 text-primary" />;
    }
    if (punch.approved === false) {
      return <XCircle className="w-4 h-4 text-destructive" />;
    }
    return <Timer className="w-4 h-4 text-muted-foreground" />;
  }

  function StatusLabel({ punch }: { punch: Punch }) {
    if (!punch.punch_out) {
      return <span className="text-xs font-medium text-primary">Active</span>;
    }
    if (punch.approved === true) {
      return <span className="text-xs font-medium text-primary">Approved</span>;
    }
    if (punch.approved === false) {
      return <span className="text-xs font-medium text-destructive">Rejected</span>;
    }
    return <span className="text-xs font-medium text-muted-foreground">Pending</span>;
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-1">My Punches</h1>
        <p className="text-sm text-muted-foreground mb-6">Your clock-in & clock-out history</p>

        {/* Grand total banner */}
        {punches.length > 0 && (
          <div className="bg-primary/5 border border-primary/15 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Hours</p>
              <p className="text-3xl font-bold text-foreground">{formatHours(grandTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{punches.length} punches</p>
              {monthGroups.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {monthGroups[monthGroups.length - 1].label.split(" ")[0]} – {monthGroups[0].label.split(" ")[0]}
                </p>
              )}
            </div>
          </div>
        )}

        {loading && <p className="text-muted-foreground text-center py-12 animate-pulse">Loading punches...</p>}

        {!loading && punches.length === 0 && (
          <div className="text-center py-16">
            <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No punches yet</p>
          </div>
        )}

        {/* Month groups */}
        <div className="space-y-4">
          {monthGroups.map((group) => {
            const isOpen = expandedMonths.has(group.key);
            return (
              <div key={group.key} className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Month header */}
                <button
                  onClick={() => toggleMonth(group.key)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{group.label}</p>
                      <p className="text-xs text-muted-foreground">{group.punches.length} punches</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-foreground">{formatHours(group.totalHours)}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Punch list */}
                {isOpen && (
                  <div className="border-t border-border">
                    {group.punches.map((p, i) => {
                      const hours = calcHours(p.punch_in, p.punch_out);
                      const dateObj = parseISO(p.date);
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-4 px-5 py-3.5 ${
                            i < group.punches.length - 1 ? "border-b border-border/50" : ""
                          }`}
                        >
                          {/* Date bubble */}
                          <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-muted flex flex-col items-center justify-center">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase leading-tight">
                              {format(dateObj, "MMM")}
                            </span>
                            <span className="text-lg font-bold text-foreground leading-tight">
                              {format(dateObj, "d")}
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-tight">
                              {format(dateObj, "EEE")}
                            </span>
                          </div>

                          {/* Hours + time range */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-bold text-foreground">
                                {p.punch_out ? formatHours(hours) : "—"}
                              </span>
                              {!p.punch_out && (
                                <Badge className="bg-primary/10 text-primary border-0 text-[10px] px-1.5 py-0">
                                  In progress
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {p.punch_in} → {p.punch_out || "..."}
                            </p>
                            <p className="text-xs text-muted-foreground/70 truncate">{p.location_name}</p>
                          </div>

                          {/* Status */}
                          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                            <StatusIcon punch={p} />
                            <StatusLabel punch={p} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
