import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Manager {
  id: string;
  user_id: string;
  role: string;
  profiles?: { full_name: string; username: string; organization_id: string | null };
}

interface Org {
  id: string;
  name: string;
}

export default function AdminManagers() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  async function fetchData() {
    const [mgrsRes, orgsRes] = await Promise.all([
      supabase.from("user_roles").select("id, user_id, role").eq("role", "manager"),
      supabase.from("organizations").select("*"),
    ]);
    if (mgrsRes.data) {
      // Fetch profiles separately for managers
      const userIds = mgrsRes.data.map((m: any) => m.user_id);
      const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name, username, organization_id").in("user_id", userIds);
      const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
      setManagers(mgrsRes.data.map((m: any) => ({ ...m, profiles: profileMap.get(m.user_id) })) as Manager[]);
    }
    if (orgsRes.data) setOrgs(orgsRes.data);
  }

  useEffect(() => { fetchData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !password || !orgId) return;
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("admin-create-user", {
        body: { email, full_name: fullName, password, role: "manager", organization_id: orgId },
      });
      if (res.error) throw res.error;
      toast.success("Manager created");
      setEmail(""); setFullName(""); setPassword("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create manager");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Delete this manager?")) return;
    const res = await supabase.functions.invoke("admin-create-user", {
      body: { action: "delete", user_id: userId },
    });
    if (res.error) { toast.error("Failed to delete"); return; }
    toast.success("Deleted");
    fetchData();
  }

  return (
    <AppLayout>
      <h1 className="page-header mb-6">👥 Managers</h1>

      <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4">
        <h2 className="text-lg font-semibold">Create Manager</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger><SelectValue placeholder="Organization" /></SelectTrigger>
            <SelectContent>
              {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? "Creating..." : "Create Manager"}
        </Button>
      </form>

      <div className="space-y-3">
        {managers.map((mgr) => (
          <div key={mgr.id} className="stat-card flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{mgr.profiles?.full_name || "Unknown"}</p>
              <p className="text-sm text-muted-foreground">{mgr.profiles?.username}</p>
            </div>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(mgr.user_id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {managers.length === 0 && <p className="text-muted-foreground text-center py-8">No managers yet.</p>}
      </div>
    </AppLayout>
  );
}
