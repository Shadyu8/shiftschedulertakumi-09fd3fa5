import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Org {
  id: string;
  name: string;
  created_at: string;
}

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function fetchOrgs() {
    const { data } = await supabase.from("organizations").select("*").order("created_at", { ascending: false });
    if (data) setOrgs(data);
  }

  useEffect(() => { fetchOrgs(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("organizations").insert({ name: name.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Organization created");
    setName("");
    fetchOrgs();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this organization?")) return;
    const { error } = await supabase.from("organizations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    fetchOrgs();
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    const { error } = await supabase.from("organizations").update({ name: editName.trim() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    setEditingId(null);
    fetchOrgs();
  }

  return (
    <AppLayout>
      <h1 className="page-header mb-6">🏢 Organizations</h1>

      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Organization name..."
          className="max-w-sm"
        />
        <Button type="submit"><Plus className="w-4 h-4 mr-2" /> Add</Button>
      </form>

      <div className="space-y-3">
        {orgs.map((org) => (
          <div key={org.id} className="stat-card flex items-center justify-between">
            {editingId === org.id ? (
              <div className="flex gap-2 flex-1">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-sm" />
                <Button size="sm" onClick={() => handleUpdate(org.id)}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-medium text-foreground">{org.name}</p>
                  <p className="text-sm text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(org.id); setEditName(org.name); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(org.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        {orgs.length === 0 && <p className="text-muted-foreground text-center py-8">No organizations yet.</p>}
      </div>
    </AppLayout>
  );
}
