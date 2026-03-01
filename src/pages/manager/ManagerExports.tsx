import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ManagerExports() {
  function handleExport() {
    toast.info("Export functionality coming soon!");
  }

  return (
    <AppLayout>
      <h1 className="page-header mb-6">📊 Exports</h1>
      <div className="stat-card max-w-lg">
        <p className="text-muted-foreground mb-4">Export shift data, time punches, and availability reports.</p>
        <div className="space-y-3">
          <Button onClick={handleExport} variant="outline" className="w-full justify-start">📅 Export Shifts (CSV)</Button>
          <Button onClick={handleExport} variant="outline" className="w-full justify-start">🕒 Export Time Punches (CSV)</Button>
          <Button onClick={handleExport} variant="outline" className="w-full justify-start">📋 Export Availability (CSV)</Button>
        </div>
      </div>
    </AppLayout>
  );
}
