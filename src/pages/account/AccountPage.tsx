import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Camera, Loader2, Pencil, X, Check } from "lucide-react";

export default function AccountPage() {
  const { profile, user, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState(profile?.profile_picture || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setProfilePicUrl(profile?.profile_picture || null);
  }, [profile]);

  async function handleUploadPicture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploadingPicture(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error(uploadError.message);
      setUploadingPicture(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("profile-pictures")
      .getPublicUrl(filePath);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ profile_picture: publicUrl })
      .eq("user_id", user.id);

    if (updateError) {
      toast.error(updateError.message);
    } else {
      setProfilePicUrl(publicUrl);
      toast.success("Profile picture updated");
    }
    setUploadingPicture(false);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
    }).eq("user_id", user.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Profile updated");
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setFullName(profile?.full_name || "");
    setEditing(false);
  }

  async function handleChangePassword() {
    if (!newPassword) return;
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); setChangingPassword(false); return; }
    toast.success("Password changed");
    setNewPassword("");
    setChangingPassword(false);
  }

  return (
    <AppLayout>
      <h1 className="page-header mb-6">👤 Account</h1>

      <div className="max-w-lg space-y-6">
        {/* Profile section */}
        <div className="stat-card space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              {/* Avatar - always tappable to change picture */}
              <div className="relative group">
                {profilePicUrl ? (
                  <img
                    src={profilePicUrl}
                    alt={profile?.full_name || "Profile"}
                    className="w-16 h-16 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPicture}
                  className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/40 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {uploadingPicture ? (
                    <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadPicture}
                />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">{profile?.full_name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            {!editing && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Kiosk PIN */}
          {profile?.unique_key && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kiosk PIN</p>
                <p className="text-2xl font-mono font-bold tracking-[0.3em] text-foreground">{profile.unique_key}</p>
              </div>
              <p className="text-xs text-muted-foreground max-w-[140px] text-right">Use this code to clock in/out at the kiosk tablet</p>
            </div>
          )}

          {editing ? (
            <>
              <div className="space-y-3">
                <div>
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button onClick={handleCancel} variant="outline" className="flex-1">
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground">{profile?.full_name}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{user?.email}</span>
              </div>
            </div>
          )}
        </div>

        {/* Password change */}
        <div className="stat-card space-y-4">
          <h2 className="text-lg font-semibold">Change Password</h2>
          <div className="space-y-3">
            <div>
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} variant="outline">
            {changingPassword ? "Changing..." : "Change Password"}
          </Button>
        </div>

        {/* Sign out */}
        <Button onClick={signOut} variant="destructive" className="w-full">Sign Out</Button>
      </div>
    </AppLayout>
  );
}
