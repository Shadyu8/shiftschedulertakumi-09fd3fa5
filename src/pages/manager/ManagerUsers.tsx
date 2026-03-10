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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Lock, Unlock, Pencil, UserX, UserCheck, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Location {
  id: string;
  name: string;
}

interface Worker {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  phone: string | null;
  active: boolean;
  availability_locked: boolean;
  role?: string;
  staff_type?: string;
  location_ids?: string[];
}

interface FulltimerScheduleEntry {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  enabled: boolean;
}

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ManagerUsers() {
  const { user, profile, role: myRole } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("worker");
  const [staffType, setStaffType] = useState("floor");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [creating, setCreating] = useState(false);

  // Manager password confirmation step
  const [pendingCreate, setPendingCreate] = useState(false);
  const [managerPassword, setManagerPassword] = useState("");
  const [confirmError, setConfirmError] = useState("");

  // Edit dialog state
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStaffType, setEditStaffType] = useState("floor");
  const [editPassword, setEditPassword] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fulltimer schedule dialog
  const [ftScheduleWorker, setFtScheduleWorker] = useState<Worker | null>(null);
  const [ftScheduleLocation, setFtScheduleLocation] = useState("");
  const [ftScheduleEntries, setFtScheduleEntries] = useState<FulltimerScheduleEntry[]>([]);
  const [ftSaving, setFtSaving] = useState(false);

  async function fetchWorkers() {
    if (!profile?.organization_id) return;
    const [{ data: profileData }, { data: locData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .neq("user_id", profile.user_id)
        .order("full_name"),
      supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", profile.organization_id),
    ]);

    if (locData) setLocations(locData);
    if (!profileData) return;

    const userIds = profileData.map((p: any) => p.user_id);
    const [{ data: rolesData }, { data: userLocsData }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      supabase.from("user_locations").select("user_id, location_id").in("user_id", userIds),
    ]);

    const roleMap = new Map<string, string>();
    rolesData?.forEach((r: any) => roleMap.set(r.user_id, r.role));

    const locMap = new Map<string, string[]>();
    userLocsData?.forEach((ul: any) => {
      if (!locMap.has(ul.user_id)) locMap.set(ul.user_id, []);
      locMap.get(ul.user_id)!.push(ul.location_id);
    });

    setWorkers(
      profileData.map((w: any) => ({
        ...w,
        role: roleMap.get(w.user_id) || "worker",
        staff_type: w.staff_type || "floor",
        location_ids: locMap.get(w.user_id) || [],
      }))
    );
  }

  useEffect(() => { fetchWorkers(); }, [profile]);

  function resetCreateForm() {
    setEmail(""); setFullName(""); setPhone(""); setPassword(""); setRole("worker"); setStaffType("floor"); setSelectedLocation("");
    setPendingCreate(false); setManagerPassword(""); setConfirmError("");
  }

  function handleCreateStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !password) return;
    setPendingCreate(true);
    setConfirmError("");
    setManagerPassword("");
  }

  async function handleConfirmCreate() {
    if (!managerPassword) return;
    setCreating(true);
    setConfirmError("");

    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: managerPassword,
      });
      if (authErr) {
        setConfirmError("Incorrect password");
        setCreating(false);
        return;
      }

      const locationIds = selectedLocation ? [selectedLocation] : [];
      const res = await supabase.functions.invoke("admin-create-user", {
        body: { email, full_name: fullName, phone: phone.trim() || null, password, role, staff_type: staffType, organization_id: profile?.organization_id, location_ids: locationIds },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("User created");
      resetCreateForm();
      setShowCreate(false);
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
    setEditPhone(w.phone || "");
    setEditRole(w.role || "worker");
    setEditStaffType(w.staff_type || "floor");
    setEditPassword("");
    setEditActive(w.active);
    setEditLocations(w.location_ids || []);
  }

  async function handleSaveEdit() {
    if (!editWorker) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        action: "update",
        user_id: editWorker.user_id,
        full_name: editName,
        phone: editPhone.trim() || null,
        role: editRole,
        staff_type: editStaffType,
        active: editActive,
        location_ids: editLocations,
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

  // Fulltimer schedule management
  async function openFtSchedule(w: Worker) {
    setFtScheduleWorker(w);
    const firstLoc = w.location_ids?.[0] || "";
    setFtScheduleLocation(firstLoc);
    if (firstLoc) {
      await loadFtSchedule(w.user_id, firstLoc);
    } else {
      setFtScheduleEntries(DAY_LABELS.map((_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "17:00", enabled: false })));
    }
  }

  async function loadFtSchedule(userId: string, locationId: string) {
    const { data } = await supabase
      .from("fulltimer_schedules")
      .select("*")
      .eq("user_id", userId)
      .eq("location_id", locationId);
    
    const existingMap = new Map((data || []).map((d: any) => [d.day_of_week, d]));
    setFtScheduleEntries(
      DAY_LABELS.map((_, i) => {
        const existing = existingMap.get(i);
        return existing
          ? { id: existing.id, day_of_week: i, start_time: existing.start_time, end_time: existing.end_time, enabled: true }
          : { day_of_week: i, start_time: "09:00", end_time: "17:00", enabled: false };
      })
    );
  }

  async function saveFtSchedule() {
    if (!ftScheduleWorker || !ftScheduleLocation) return;
    setFtSaving(true);
    try {
      // Delete existing entries for this user+location
      await supabase
        .from("fulltimer_schedules")
        .delete()
        .eq("user_id", ftScheduleWorker.user_id)
        .eq("location_id", ftScheduleLocation);

      // Insert enabled entries
      const toInsert = ftScheduleEntries
        .filter((e) => e.enabled)
        .map((e) => ({
          user_id: ftScheduleWorker.user_id,
          location_id: ftScheduleLocation,
          day_of_week: e.day_of_week,
          start_time: e.start_time,
          end_time: e.end_time,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("fulltimer_schedules").insert(toInsert);
        if (error) throw error;
      }

      toast.success("Fulltimer schedule saved");
      setFtScheduleWorker(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save schedule");
    } finally {
      setFtSaving(false);
    }
  }

  const roleBadgeColor = (r: string) => {
    switch (r) {
      case "admin": return "destructive";
      case "manager": return "default";
      case "shiftleader": return "secondary";
      case "fulltimer": return "default";
      default: return "outline";
    }
  };

  const roleLabel = (r: string) => {
    switch (r) {
      case "shiftleader": return "Shift Leader";
      case "fulltimer": return "Fulltimer";
      default: return r;
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-header">👥 Workers</h1>
        <Button onClick={() => { resetCreateForm(); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="space-y-3">
        {workers.map((w) => (
          <div key={w.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground truncate">{w.full_name}</p>
                  <Badge variant={roleBadgeColor(w.role || "worker")} className="text-[10px] capitalize">
                    {roleLabel(w.role || "worker")}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {w.staff_type === "kitchen" ? "🍳 Kitchen" : "🏠 Floor"}
                  </Badge>
                  {!w.active && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{w.username}</p>
                {w.location_ids && w.location_ids.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      {w.location_ids.map((lid) => locations.find((l) => l.id === lid)?.name).filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {w.role === "fulltimer" && (
                <Button size="icon" variant="ghost" onClick={() => openFtSchedule(w)} title="Fulltimer schedule">
                  <Calendar className="w-4 h-4 text-primary" />
                </Button>
              )}
              {w.role !== "fulltimer" && (
                <Button size="icon" variant="ghost" onClick={() => toggleLock(w.user_id, w.availability_locked)} title={w.availability_locked ? "Unlock availability" : "Lock availability"}>
                  {w.availability_locked ? <Lock className="w-4 h-4 text-warning" /> : <Unlock className="w-4 h-4" />}
                </Button>
              )}
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

      {/* Create user dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { resetCreateForm(); setShowCreate(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingCreate ? "Confirm with your password" : "Add User"}</DialogTitle>
            <DialogDescription>
              {pendingCreate
                ? "Enter your manager password to confirm creating this user."
                : "Fill in the details to create a new user account."}
            </DialogDescription>
          </DialogHeader>

          {!pendingCreate ? (
            <form onSubmit={handleCreateStep1} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+31 6 12345678" type="tel" />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" type="password" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="shiftleader">Shift Leader</SelectItem>
                      <SelectItem value="fulltimer">Fulltimer</SelectItem>
                      {myRole === "admin" && <SelectItem value="manager">Manager</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Staff Type</Label>
                  <Select value={staffType} onValueChange={setStaffType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="floor">🏠 Floor</SelectItem>
                      <SelectItem value="kitchen">🍳 Kitchen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {locations.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Continue
              </Button>
            </form>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Name:</span> {fullName}</p>
                <p><span className="text-muted-foreground">Email:</span> {email}</p>
                {phone && <p><span className="text-muted-foreground">Phone:</span> {phone}</p>}
                <p><span className="text-muted-foreground">Role:</span> {roleLabel(role)}</p>
                <p><span className="text-muted-foreground">Staff Type:</span> {staffType === "kitchen" ? "Kitchen" : "Floor"}</p>
                {selectedLocation && (
                  <p><span className="text-muted-foreground">Location:</span> {locations.find((l) => l.id === selectedLocation)?.name}</p>
                )}
              </div>
              {confirmError && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-2">{confirmError}</div>
              )}
              <div className="space-y-1.5">
                <Label>Your Password</Label>
                <Input
                  type="password"
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleConfirmCreate(); }}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleConfirmCreate} disabled={creating || !managerPassword} className="flex-1">
                  {creating ? "Creating..." : "Confirm & Create"}
                </Button>
                <Button variant="outline" onClick={() => setPendingCreate(false)}>Back</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <Label>Phone Number</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+31 6 12345678" type="tel" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worker">Worker</SelectItem>
                    <SelectItem value="shiftleader">Shift Leader</SelectItem>
                    <SelectItem value="fulltimer">Fulltimer</SelectItem>
                    {myRole === "admin" && <SelectItem value="manager">Manager</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Staff Type</Label>
                <Select value={editStaffType} onValueChange={setEditStaffType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="floor">🏠 Floor</SelectItem>
                    <SelectItem value="kitchen">🍳 Kitchen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>New Password <span className="text-muted-foreground text-xs">(leave empty to keep current)</span></Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Account Active</Label>
              <Button type="button" variant={editActive ? "default" : "outline"} size="sm" onClick={() => setEditActive(!editActive)}>
                {editActive ? <><UserCheck className="w-3.5 h-3.5 mr-1.5" /> Active</> : <><UserX className="w-3.5 h-3.5 mr-1.5" /> Inactive</>}
              </Button>
            </div>
            {locations.length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Locations</Label>
                <div className="flex flex-wrap gap-3">
                  {locations.map((loc) => (
                    <label key={loc.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={editLocations.includes(loc.id)}
                        onCheckedChange={(checked) => {
                          setEditLocations((prev) =>
                            checked ? [...prev, loc.id] : prev.filter((id) => id !== loc.id)
                          );
                        }}
                      />
                      {loc.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
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
              Are you sure you want to permanently delete <strong>{deleteTarget?.full_name}</strong>? This action cannot be undone.
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

      {/* Fulltimer Schedule Dialog */}
      <Dialog open={!!ftScheduleWorker} onOpenChange={(open) => !open && setFtScheduleWorker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fulltimer Schedule — {ftScheduleWorker?.full_name}</DialogTitle>
            <DialogDescription>Set the recurring weekly work days and times for this fulltimer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {ftScheduleWorker && ftScheduleWorker.location_ids && ftScheduleWorker.location_ids.length > 1 && (
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={ftScheduleLocation} onValueChange={(val) => { setFtScheduleLocation(val); loadFtSchedule(ftScheduleWorker.user_id, val); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ftScheduleWorker.location_ids.map((lid) => (
                      <SelectItem key={lid} value={lid}>{locations.find((l) => l.id === lid)?.name || lid}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              {ftScheduleEntries.map((entry, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg border ${entry.enabled ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
                  <Checkbox
                    checked={entry.enabled}
                    onCheckedChange={(checked) => {
                      setFtScheduleEntries((prev) => prev.map((e, i) => i === idx ? { ...e, enabled: !!checked } : e));
                    }}
                  />
                  <span className="text-sm font-medium w-24">{DAY_LABELS[entry.day_of_week]}</span>
                  {entry.enabled && (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input
                        type="time"
                        value={entry.start_time}
                        onChange={(e) => setFtScheduleEntries((prev) => prev.map((en, i) => i === idx ? { ...en, start_time: e.target.value } : en))}
                        className="h-8 text-xs w-24"
                      />
                      <span className="text-muted-foreground text-xs">–</span>
                      <Input
                        type="time"
                        value={entry.end_time}
                        onChange={(e) => setFtScheduleEntries((prev) => prev.map((en, i) => i === idx ? { ...en, end_time: e.target.value } : en))}
                        className="h-8 text-xs w-24"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={saveFtSchedule} disabled={ftSaving || !ftScheduleLocation} className="w-full">
              {ftSaving ? "Saving..." : "Save Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
