import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Lock, Unlock, Pencil, Shield, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";

interface Worker {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  active: boolean;
  availability_locked: boolean;
  role?: string;
}

export default function ManagerUsers() {
  const { profile, role: myRole } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("worker");
  const [creating, setCreating] = useState(false);

  // Edit dialog state
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchWorkers() {
    if (!profile?.organization_id) return;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .neq("user_id", profile.user_id)
      .order("full_name");

    if (!profileData) return;

    // Fetch roles for all workers
    const userIds = profileData.map((p: any) => p.user_id);
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const roleMap = new Map<string, string>();
    rolesData?.forEach((r: any) => roleMap.set(r.user_id, r.role));

    setWorkers(
      profileData.map((w: any) => ({
        ...w,
        role: roleMap.get(w.user_id) || "worker",
      }))
    );
  }

  useEffect(() => { fetchWorkers(); }, [profile]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !password) return;
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("admin-create-user", {
        body: { email, full_name: fullName, password, role, organization_id: profile?.organization_id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("User created");
      setEmail(""); setFullName(""); setPassword("");
      fetchWorkers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function toggleLock(userId: string, locked: boolean) {
    const { error } = await supabase.from("profiles").update({ availability_locked: !locked }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    fetchWorkers();
  }

  function openEdit(w: Worker) {
    setEditWorker(w);
    setEditName(w.full_name);
    setEditRole(w.role || "worker");
    setEditPassword("");
    setEditActive(w.active);
  }

  async function handleSaveEdit() {
    if (!editWorker) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        action: "update",
        user_id: editWorker.user_id,
        full_name: editName,
        role: editRole,
        active: editActive,
      };
      if (editPassword.trim()) body.password = editPassword;

      const res = await supabase.functions.invoke("admin-create-user", { body });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("User updated");
      setEditWorker(null);
      fetchWorkers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await supabase.functions.invoke("admin-create-user", {
        body: { action: "delete", user_id: deleteTarget.user_id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("User deleted");
      setDeleteTarget(null);
      fetchWorkers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  const roleBadgeColor = (r: string) => {
    switch (r) {
      case "admin": return "destructive";
      case "manager": return "default";
      case "shiftleader": return "secondary";
      default: return "outline";
    }
  };

  return (
    <AppLayout>
      <h1 className="page-header mb-6">👥 Workers</h1>

      <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4">
        <h2 className="text-lg font-semibold">Add User</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="shiftleader">Shift Leader</SelectItem>
              {myRole === "admin" && <SelectItem value="manager">Manager</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? "Creating..." : "Add User"}
        </Button>
      </form>

      <div className="space-y-3">
        {workers.map((w) => (
          <div key={w.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground truncate">{w.full_name}</p>
                  <Badge variant={roleBadgeColor(w.role || "worker")} className="text-[10px] capitalize">
                    {w.role === "shiftleader" ? "Shift Leader" : w.role}
                  </Badge>
                  {!w.active && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{w.username}</p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => toggleLock(w.user_id, w.availability_locked)}
                title={w.availability_locked ? "Unlock availability" : "Lock availability"}
              >
                {w.availability_locked ? <Lock className="w-4 h-4 text-warning" /> : <Unlock className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(w)} title="Edit user">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(w)} title="Delete user">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {workers.length === 0 && <p className="text-muted-foreground text-center py-8">No workers yet.</p>}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editWorker} onOpenChange={(open) => !open && setEditWorker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information, role, or password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="worker">Worker</SelectItem>
                  <SelectItem value="shiftleader">Shift Leader</SelectItem>
                  {myRole === "admin" && <SelectItem value="manager">Manager</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>New Password <span className="text-muted-foreground text-xs">(leave empty to keep current)</span></Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Account Active</Label>
              <Button
                type="button"
                variant={editActive ? "default" : "outline"}
                size="sm"
                onClick={() => setEditActive(!editActive)}
              >
                {editActive ? <><UserCheck className="w-3.5 h-3.5 mr-1.5" /> Active</> : <><UserX className="w-3.5 h-3.5 mr-1.5" /> Inactive</>}
              </Button>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSaveEdit} disabled={saving || !editName.trim()} className="flex-1">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditWorker(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.full_name}</strong>? This action cannot be undone and will remove all their data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1">
              {deleting ? "Deleting..." : "Delete User"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
