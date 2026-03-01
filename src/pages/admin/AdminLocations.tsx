import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Location {
  id: string;
  name: string;
  organization_id: string;
  timezone: string;
  organizations?: { name: string };
}

interface Org {
  id: string;
  name: string;
}

export default function AdminLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function fetchData() {
    const [locsRes, orgsRes] = await Promise.all([
      supabase.from("locations").select("*, organizations(name)").order("created_at", { ascending: false }),
      supabase.from("organizations").select("*"),
    ]);
    if (locsRes.data) setLocations(locsRes.data as Location[]);
    if (orgsRes.data) setOrgs(orgsRes.data);
  }

  useEffect(() => { fetchData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !orgId) return;
    const { error } = await supabase.from("locations").insert({ name: name.trim(), organization_id: orgId });
    if (error) { toast.error(error.message); return; }
    toast.success("Location created");
    setName("");
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this location?")) return;
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    fetchData();
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    const { error } = await supabase.from("locations").update({ name: editName.trim() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    setEditingId(null);
    fetchData();
  }

  return (
    <AppLayout>
      <h1 className="page-header mb-6">📍 Locations</h1>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-3 mb-6">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Location name..."
          className="max-w-xs"
        />
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Organization" />
          </SelectTrigger>
          <SelectContent>
            {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit"><Plus className="w-4 h-4 mr-2" /> Add</Button>
      </form>

      <div className="space-y-3">
        {locations.map((loc) => (
          <div key={loc.id} className="stat-card flex items-center justify-between">
            {editingId === loc.id ? (
              <div className="flex gap-2 flex-1">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-sm" />
                <Button size="sm" onClick={() => handleUpdate(loc.id)}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-medium text-foreground">{loc.name}</p>
                  <p className="text-sm text-muted-foreground">{loc.organizations?.name} · {loc.timezone}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(loc.id); setEditName(loc.name); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(loc.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        {locations.length === 0 && <p className="text-muted-foreground text-center py-8">No locations yet.</p>}
      </div>
    </AppLayout>
  );
}
