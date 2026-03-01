import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Camera, Loader2 } from "lucide-react";

export default function AccountPage() {
  const { profile, user, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [uniqueKey, setUniqueKey] = useState(profile?.unique_key || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState(profile?.profile_picture || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      unique_key: uniqueKey || null,
    }).eq("user_id", user.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Profile updated");
    setSaving(false);
  }

  async function handleChangePassword() {
    if (!newPassword) return;
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); setChangingPassword(false); return; }
    toast.success("Password changed");
    setNewPassword(""); setCurrentPassword("");
    setChangingPassword(false);
  }

  return (
    <AppLayout>
      <h1 className="page-header mb-6">👤 Account</h1>

      <div className="max-w-lg space-y-6">
        {/* Profile section */}
        <div className="stat-card space-y-4">
          <div className="flex items-center gap-4 mb-2">
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

          <div className="space-y-3">
            <div>
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Unique Key</Label>
              <Input value={uniqueKey} onChange={(e) => setUniqueKey(e.target.value)} placeholder="e.g. employee ID" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
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
