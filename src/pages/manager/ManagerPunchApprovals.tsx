import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, X, Pencil } from "lucide-react";

interface PunchWithProfile {
  id: string;
  user_id: string;
  date: string;
  punch_in: string;
  punch_out: string | null;
  notes: string | null;
  approved: boolean | null;
  location_id: string;
  location_name?: string;
  worker_name?: string;
  worker_picture?: string | null;
}

export default function ManagerPunchApprovals() {
  const { user, profile } = useAuth();
  const [punches, setPunches] = useState<PunchWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [editPunch, setEditPunch] = useState<PunchWithProfile | null>(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchPunches() {
    if (!profile?.organization_id) return;
    setLoading(true);

    const { data: locs } = await supabase
      .from("locations")
      .select("id, name")
      .eq("organization_id", profile.organization_id);

    if (!locs || locs.length === 0) {
      setPunches([]);
      setLoading(false);
      return;
    }

    const locMap = new Map(locs.map((l) => [l.id, l.name]));
    const locIds = locs.map((l) => l.id);

    const { data: punchData } = await supabase
      .from("time_punches")
      .select("*")
      .in("location_id", locIds)
      .order("date", { ascending: false })
      .order("punch_in", { ascending: false })
      .limit(200);

    if (!punchData || punchData.length === 0) {
      setPunches([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(punchData.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, profile_picture")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    setPunches(
      punchData.map((p) => ({
        ...p,
        location_name: locMap.get(p.location_id) || "Unknown",
        worker_name: profileMap.get(p.user_id)?.full_name || "Unknown",
        worker_picture: profileMap.get(p.user_id)?.profile_picture || null,
      })) as PunchWithProfile[]
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchPunches();
  }, [profile]);

  async function handleApprove(punchId: string) {
    const { error } = await supabase
      .from("time_punches")
      .update({ approved: true, approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", punchId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Punch approved");
    setPunches((prev) =>
      prev.map((p) => (p.id === punchId ? { ...p, approved: true } : p))
    );
  }

  async function handleReject(punchId: string) {
    const { error } = await supabase
      .from("time_punches")
      .update({ approved: false, approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", punchId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Punch rejected");
    setPunches((prev) =>
      prev.map((p) => (p.id === punchId ? { ...p, approved: false } : p))
    );
  }

  function openEdit(p: PunchWithProfile) {
    setEditPunch(p);
    setEditIn(p.punch_in);
    setEditOut(p.punch_out || "");
  }

  async function handleSaveEdit() {
    if (!editPunch || !editIn) return;
    setSaving(true);
    const { error } = await supabase
      .from("time_punches")
      .update({
        punch_in: editIn,
        punch_out: editOut || null,
      })
      .eq("id", editPunch.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Punch times updated");
    setPunches((prev) =>
      prev.map((p) =>
        p.id === editPunch.id ? { ...p, punch_in: editIn, punch_out: editOut || null } : p
      )
    );
    setEditPunch(null);
  }

  async function handleEditAndApprove() {
    if (!editPunch || !editIn) return;
    setSaving(true);
    const { error } = await supabase
      .from("time_punches")
      .update({
        punch_in: editIn,
        punch_out: editOut || null,
        approved: true,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", editPunch.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Punch updated & approved");
    setPunches((prev) =>
      prev.map((p) =>
        p.id === editPunch.id
          ? { ...p, punch_in: editIn, punch_out: editOut || null, approved: true }
          : p
      )
    );
    setEditPunch(null);
  }

  async function handleBulkApprove() {
    const pendingIds = filtered.map((p) => p.id);
    if (pendingIds.length === 0) return;
    const { error } = await supabase
      .from("time_punches")
      .update({ approved: true, approved_by: user?.id, approved_at: new Date().toISOString() })
      .in("id", pendingIds);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${pendingIds.length} punches approved`);
    setPunches((prev) =>
      prev.map((p) => (pendingIds.includes(p.id) ? { ...p, approved: true } : p))
    );
  }

  const filtered = punches.filter((p) => {
    if (tab === "pending") return p.approved === null && p.punch_out !== null;
    if (tab === "approved") return p.approved === true;
    if (tab === "rejected") return p.approved === false;
    if (tab === "active") return p.punch_out === null;
    return true;
  });

  const pendingCount = punches.filter((p) => p.approved === null && p.punch_out !== null).length;

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="page-header">✅ Punch Approvals</h1>
        {tab === "pending" && filtered.length > 0 && (
          <Button onClick={handleBulkApprove} size="sm">
            <Check className="w-4 h-4 mr-1" />
            Approve All ({filtered.length})
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending {pendingCount > 0 && <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {loading ? (
            <p className="text-muted-foreground text-center py-8 animate-pulse">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {tab === "pending" ? "No pending punches to approve 🎉" : `No ${tab} punches.`}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => (
                <div key={p.id} className="stat-card flex items-center gap-4">
                  {p.worker_picture ? (
                    <img src={p.worker_picture} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {p.worker_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{p.worker_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(p.date), "EEE dd/MM")} · {p.location_name}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm text-foreground">
                      {p.punch_in} → {p.punch_out || <span className="text-primary font-medium">Active</span>}
                    </p>
                  </div>

                  {/* Actions */}
                  {tab === "pending" && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => handleApprove(p.id)} title="Approve">
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-muted" onClick={() => openEdit(p)} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleReject(p.id)} title="Reject">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {(tab === "approved" || tab === "rejected") && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-muted" onClick={() => openEdit(p)} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {tab === "approved" && <Badge className="bg-primary/10 text-primary border-0">Approved</Badge>}
                      {tab === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                    </div>
                  )}

                  {tab === "active" && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-muted" onClick={() => openEdit(p)} title="Edit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Punch Dialog */}
      <Dialog open={!!editPunch} onOpenChange={(o) => !o && setEditPunch(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Punch</DialogTitle>
          </DialogHeader>
          {editPunch && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                {editPunch.worker_picture ? (
                  <img src={editPunch.worker_picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {editPunch.worker_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-foreground">{editPunch.worker_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(editPunch.date), "EEE, dd MMM yyyy")} · {editPunch.location_name}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-in" className="text-xs text-muted-foreground">Clock In</Label>
                  <Input id="edit-in" type="time" value={editIn} onChange={(e) => setEditIn(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit-out" className="text-xs text-muted-foreground">Clock Out</Label>
                  <Input id="edit-out" type="time" value={editOut} onChange={(e) => setEditOut(e.target.value)} />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={handleSaveEdit} disabled={saving}>
                  Save Only
                </Button>
                <Button className="flex-1" onClick={handleEditAndApprove} disabled={saving}>
                  <Check className="w-4 h-4 mr-1" />
                  Save & Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}