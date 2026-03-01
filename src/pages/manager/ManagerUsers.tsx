import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

interface Worker {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  active: boolean;
  availability_locked: boolean;
}

export default function ManagerUsers() {
  const { profile } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("worker");
  const [creating, setCreating] = useState(false);

  async function fetchWorkers() {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .neq("user_id", profile.user_id)
      .order("full_name");
    if (data) setWorkers(data as Worker[]);
  }

  useEffect(() => { fetchWorkers(); }, [profile]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !password) return;
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("admin-create-user", {
        body: {
          email,
          full_name: fullName,
          password,
          role,
          organization_id: profile?.organization_id,
        },
      });
      if (res.error) throw res.error;
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

  async function handleDelete(userId: string) {
    if (!confirm("Delete this user?")) return;
    const res = await supabase.functions.invoke("admin-create-user", {
      body: { action: "delete", user_id: userId },
    });
    if (res.error) { toast.error("Failed to delete"); return; }
    toast.success("Deleted");
    fetchWorkers();
  }

  return (
    <AppLayout>
      <h1 className="page-header mb-6">👥 Workers</h1>

      <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4">
        <h2 className="text-lg font-semibold">Add Worker</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="shiftleader">Shift Leader</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? "Creating..." : "Add Worker"}
        </Button>
      </form>

      <div className="space-y-3">
        {workers.map((w) => (
          <div key={w.id} className="stat-card flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{w.full_name}</p>
              <p className="text-sm text-muted-foreground">{w.username}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => toggleLock(w.user_id, w.availability_locked)}
                title={w.availability_locked ? "Unlock availability" : "Lock availability"}
              >
                {w.availability_locked ? <Lock className="w-4 h-4 text-warning" /> : <Unlock className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(w.user_id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {workers.length === 0 && <p className="text-muted-foreground text-center py-8">No workers yet.</p>}
      </div>
    </AppLayout>
  );
}
