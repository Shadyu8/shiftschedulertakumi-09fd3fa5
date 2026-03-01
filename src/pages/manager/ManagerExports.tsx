import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, getDaysInMonth } from "date-fns";

interface WorkerProfile {
  user_id: string;
  full_name: string;
}

interface PunchRow {
  user_id: string;
  date: string;
  punch_in: string;
  punch_out: string | null;
  approved: boolean | null;
  location_id: string;
}

export default function ManagerExports() {
  const { profile } = useAuth();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [selectedWorker, setSelectedWorker] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!profile?.organization_id) return;
    // Fetch workers
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("organization_id", profile.organization_id)
      .eq("active", true)
      .order("full_name")
      .then(({ data }) => {
        if (data) setWorkers(data);
      });
    // Fetch locations
    supabase
      .from("locations")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .then(({ data }) => {
        if (data) setLocations(new Map(data.map((l) => [l.id, l.name])));
      });
  }, [profile]);

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  function calcHours(punch_in: string, punch_out: string | null): number {
    if (!punch_out) return 0;
    const [inH, inM] = punch_in.split(":").map(Number);
    const [outH, outM] = punch_out.split(":").map(Number);
    return Math.max(0, (outH * 60 + outM - (inH * 60 + inM)) / 60);
  }

  function formatHours(h: number): string {
    return h.toFixed(2).replace(".", ",") + " hrs";
  }

  async function generatePDF() {
    if (!profile?.organization_id) return;
    setLoading(true);

    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${getDaysInMonth(new Date(year, month - 1)).toString().padStart(2, "0")}`;

      // Fetch approved punches for the month
      let query = supabase
        .from("time_punches")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("approved", true)
        .order("date")
        .order("punch_in");

      if (selectedWorker !== "all") {
        query = query.eq("user_id", selectedWorker);
      }

      // Also need to filter by org locations
      const locIds = Array.from(locations.keys());
      if (locIds.length > 0) {
        query = query.in("location_id", locIds);
      }

      const { data: punches, error } = await query;

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      if (!punches || punches.length === 0) {
        toast.error("No approved punches found for this period");
        setLoading(false);
        return;
      }

      // Build worker name map
      const workerMap = new Map(workers.map((w) => [w.user_id, w.full_name]));
      const monthLabel = format(new Date(year, month - 1), "MMMM yyyy");

      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.text("Time Punch Report", 14, 20);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(monthLabel, 14, 28);
      if (selectedWorker !== "all") {
        doc.text(`Worker: ${workerMap.get(selectedWorker) || "Unknown"}`, 14, 34);
      }

      // ── Summary table: total hours per worker ──
      const hoursByWorker = new Map<string, number>();
      for (const p of punches as PunchRow[]) {
        const h = calcHours(p.punch_in, p.punch_out);
        hoursByWorker.set(p.user_id, (hoursByWorker.get(p.user_id) || 0) + h);
      }

      const summaryRows = Array.from(hoursByWorker.entries())
        .map(([uid, total]) => [workerMap.get(uid) || uid, formatHours(total)])
        .sort((a, b) => a[0].localeCompare(b[0]));

      const grandTotal = Array.from(hoursByWorker.values()).reduce((a, b) => a + b, 0);

      let startY = selectedWorker !== "all" ? 40 : 34;

      doc.setFontSize(13);
      doc.setTextColor(0);
      doc.text("Summary", 14, startY);

      autoTable(doc, {
        startY: startY + 4,
        head: [["Worker", "Total Hours"]],
        body: [...summaryRows, ["TOTAL", formatHours(grandTotal)]],
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 10 },
        didParseCell: (data: any) => {
          // Bold total row
          if (data.row.index === summaryRows.length) {
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // ── Detail table: each punch ──
      const detailY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(13);
      doc.text("Detailed Punches", 14, detailY);

      const detailRows = (punches as PunchRow[]).map((p) => [
        workerMap.get(p.user_id) || p.user_id,
        format(new Date(p.date), "dd/MM/yyyy"),
        p.punch_in,
        p.punch_out || "—",
        formatHours(calcHours(p.punch_in, p.punch_out)),
        locations.get(p.location_id) || "—",
      ]);

      autoTable(doc, {
        startY: detailY + 4,
        head: [["Worker", "Date", "Clock In", "Clock Out", "Hours", "Location"]],
        body: detailRows,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
      });

      doc.save(`punches_${selectedMonth}${selectedWorker !== "all" ? `_${workerMap.get(selectedWorker)?.replace(/\s/g, "_")}` : ""}.pdf`);
      toast.success("PDF exported!");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
    setLoading(false);
  }

  return (
    <AppLayout>
      <h1 className="page-header mb-6">📊 Exports</h1>

      <div className="stat-card max-w-lg space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground text-lg">Time Punch PDF</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Export a PDF with total hours per worker and detailed clock in/out records for the selected month.
          Only approved punches are included.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Worker</Label>
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.map((w) => (
                  <SelectItem key={w.user_id} value={w.user_id}>{w.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={generatePDF} disabled={loading} className="w-full">
          <Download className="w-4 h-4 mr-2" />
          {loading ? "Generating..." : "Export PDF"}
        </Button>
      </div>
    </AppLayout>
  );
}
