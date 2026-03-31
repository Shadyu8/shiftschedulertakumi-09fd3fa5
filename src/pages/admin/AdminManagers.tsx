import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Manager {
  id: string;
  user_id: string;
  role: string;
  profiles?: { full_name: string; username: string; organization_id: string | null };
  location_ids?: string[];
}

interface Org {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  organization_id: string;
}

export default function AdminManagers() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [password, setPassword] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editManager, setEditManager] = useState<Manager | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function invokeAdminCreateUser(body: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Your session expired. Please sign in again.");
    }

    const res = await supabase.functions.invoke("admin-create-user", {
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (res.error) {
      const errorWithContext = res.error as { message?: string; context?: Response };
      let message = errorWithContext.message || "Edge Function returned a non-2xx status code";
      if (errorWithContext.context) {
        try {
          const payload = await errorWithContext.context.json();
          if (payload?.error && typeof payload.error === "string") {
            message = payload.error;
          }
        } catch {
          // Keep default error message when response isn't valid JSON
        }
      }
      throw new Error(message);
    }

    if (res.data?.error) throw new Error(res.data.error);
    return res.data;
  }

  async function fetchData() {
    const [mgrsRes, orgsRes, locsRes] = await Promise.all([
      supabase.from("user_roles").select("id, user_id, role").eq("role", "manager"),
      supabase.from("organizations").select("*"),
      supabase.from("locations").select("id, name, organization_id"),
    ]);
    if (locsRes.data) setLocations(locsRes.data);
    if (orgsRes.data) setOrgs(orgsRes.data);
    if (mgrsRes.data) {
      const userIds = mgrsRes.data.map((m: any) => m.user_id);
      const [{ data: profilesData }, { data: userLocsData }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, username, organization_id").in("user_id", userIds),
        supabase.from("user_locations").select("user_id, location_id").in("user_id", userIds),
      ]);
      const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
      const locMap = new Map<string, string[]>();
      (userLocsData || []).forEach((ul: any) => {
        if (!locMap.has(ul.user_id)) locMap.set(ul.user_id, []);
        locMap.get(ul.user_id)!.push(ul.location_id);
      });
      setManagers(mgrsRes.data.map((m: any) => ({
        ...m,
        profiles: profileMap.get(m.user_id),
        location_ids: locMap.get(m.user_id) || [],
      })) as Manager[]);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const orgLocations = (orgId: string) => locations.filter((l) => l.organization_id === orgId);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !password || !orgId) return;
    setCreating(true);
    try {
      await invokeAdminCreateUser({
        email,
        full_name: fullName,
        password,
        role: "manager",
        organization_id: orgId,
        location_ids: selectedLocations,
      });
      toast.success("Manager created");
      setEmail(""); setFullName(""); setPassword(""); setSelectedLocations([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create manager");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(mgr: Manager) {
    setEditManager(mgr);
    setEditName(mgr.profiles?.full_name || "");
    setEditPassword("");
    setEditLocations(mgr.location_ids || []);
  }

  async function handleSaveEdit() {
    if (!editManager) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        action: "update",
        user_id: editManager.user_id,
        full_name: editName,
        location_ids: editLocations,
      };
      if (editPassword.trim()) body.password = editPassword;
      await invokeAdminCreateUser(body);
      toast.success("Manager updated");
      setEditManager(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Delete this manager?")) return;
    try {
      await invokeAdminCreateUser({ action: "delete", user_id: userId });
      toast.success("Deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  }

  const editManagerOrgId = editManager?.profiles?.organization_id;
  const editOrgLocations = editManagerOrgId ? orgLocations(editManagerOrgId) : [];

  return (
    <AppLayout>
      <h1 className="page-header mb-6">👥 Managers</h1>

      <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4">
        <h2 className="text-lg font-semibold">Create Manager</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
          <Select value={orgId} onValueChange={(v) => { setOrgId(v); setSelectedLocations([]); }}>
            <SelectTrigger><SelectValue placeholder="Organization" /></SelectTrigger>
            <SelectContent>
              {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {orgId && orgLocations(orgId).length > 0 && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Locations</Label>
            <div className="flex flex-wrap gap-3">
              {orgLocations(orgId).map((loc) => (
                <label key={loc.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedLocations.includes(loc.id)}
                    onCheckedChange={(checked) =>
                      setSelectedLocations((prev) => checked ? [...prev, loc.id] : prev.filter((id) => id !== loc.id))
                    }
                  />
                  {loc.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <Button type="submit" disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? "Creating..." : "Create Manager"}
        </Button>
      </form>

      <div className="space-y-3">
        {managers.map((mgr) => (
          <div key={mgr.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{mgr.profiles?.full_name || "Unknown"}</p>
              <p className="text-sm text-muted-foreground">{mgr.profiles?.username}</p>
              {mgr.location_ids && mgr.location_ids.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {mgr.location_ids.map((lid) => locations.find((l) => l.id === lid)?.name).filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => openEdit(mgr)} title="Edit manager">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(mgr.user_id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {managers.length === 0 && <p className="text-muted-foreground text-center py-8">No managers yet.</p>}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editManager} onOpenChange={(open) => !open && setEditManager(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Manager</DialogTitle>
            <DialogDescription>Update manager details and location access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>New Password <span className="text-muted-foreground text-xs">(leave empty to keep current)</span></Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {editOrgLocations.length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Locations</Label>
                <div className="flex flex-wrap gap-3">
                  {editOrgLocations.map((loc) => (
                    <label key={loc.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={editLocations.includes(loc.id)}
                        onCheckedChange={(checked) =>
                          setEditLocations((prev) => checked ? [...prev, loc.id] : prev.filter((id) => id !== loc.id))
                        }
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
              <Button variant="outline" onClick={() => setEditManager(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
