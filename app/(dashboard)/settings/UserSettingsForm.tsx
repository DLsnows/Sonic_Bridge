"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { validateImageFile, resizeAvatarImage } from "@/lib/image-utils";

interface Props {
  userId: string;
  username: string;
  email: string;
  avatar?: string | null;
}

export function UserSettingsForm({ userId, username: initialUsername, email, avatar: currentAvatar }: Props) {
  const router = useRouter();

  // Name
  const [name, setName] = useState(initialUsername);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [displayAvatar, setDisplayAvatar] = useState<string | null>(currentAvatar ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = validateImageFile(file);
    if (!result.valid) {
      setAvatarMsg(result.error ?? "Invalid file");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAvatarMsg("");
  }

  // Delete
  const [showDelete, setShowDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleUpdateName() {
    setNameLoading(true);
    setNameMsg("");
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name }),
    });
    const data = await res.json();
    setNameMsg(res.ok ? "Display name updated." : data.error ?? "Failed");
    if (res.ok) window.location.reload();
    setNameLoading(false);
  }

  async function handleChangePassword() {
    setPwLoading(true);
    setPwMsg("");
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    setPwMsg(res.ok ? "Password changed." : data.error ?? "Failed");
    if (res.ok) { setCurrentPw(""); setNewPw(""); }
    setPwLoading(false);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setAvatarLoading(true);
    setAvatarMsg("");
    try {
      const resized = await resizeAvatarImage(selectedFile);
      const formData = new FormData();
      formData.append("file", resized, "avatar.jpg");
      const res = await fetch("/api/user/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setAvatarMsg("Avatar updated.");
        setDisplayAvatar(data.avatar);
        setSelectedFile(null);
        if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
        router.refresh();
      } else {
        setAvatarMsg(data.error ?? "Failed");
      }
    } catch (err) {
      setAvatarMsg(err instanceof Error ? err.message : "Failed to process image");
    }
    setAvatarLoading(false);
  }

  async function handleRemove() {
    setAvatarLoading(true);
    setAvatarMsg("");
    const res = await fetch("/api/user/avatar", { method: "DELETE" });
    if (res.ok) {
      setAvatarMsg("Avatar removed.");
      setDisplayAvatar(null);
      setSelectedFile(null);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({ error: "Failed" }));
      setAvatarMsg(data.error ?? "Failed");
    }
    setAvatarLoading(false);
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    const res = await fetch("/api/user", { method: "DELETE" });
    if (res.ok) {
      await signOut({ callbackUrl: "/login" });
    }
    setDeleteLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Display Name */}
      <GlassPanel>
        <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#00FF41] mb-4">Display Name</h3>
        <div className="space-y-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder={initialUsername} />
          {nameMsg && <p className={`text-xs ${nameMsg.includes("updated") ? "text-[#00FF41]" : "text-[#FF4444]"}`}>{nameMsg}</p>}
          <Button size="sm" loading={nameLoading} onClick={handleUpdateName}>Save Name</Button>
        </div>
      </GlassPanel>

      {/* Change Password */}
      <GlassPanel>
        <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#00FF41] mb-4">Change Password</h3>
        <div className="space-y-3">
          <Input label="Current Password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current password" />
          <Input label="New Password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min 8 characters" />
          {pwMsg && <p className={`text-xs ${pwMsg === "Password changed." ? "text-[#00FF41]" : "text-[#FF4444]"}`}>{pwMsg}</p>}
          <Button size="sm" loading={pwLoading} onClick={handleChangePassword}>Change Password</Button>
        </div>
      </GlassPanel>

      {/* Avatar */}
      <GlassPanel>
        <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#00FF41] mb-4">Avatar</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {(previewUrl || displayAvatar) ? (
              <img
                src={previewUrl ?? displayAvatar ?? ""}
                alt="Avatar preview"
                className="w-16 h-16 rounded-full object-cover border-2 border-[#00FF41]/30 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#00FF41]/20 flex items-center justify-center text-lg text-[#00FF41] font-['Share_Tech_Mono',monospace] border-2 border-[#00FF41]/30 shrink-0">
                {initialUsername[0].toUpperCase()}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Choose Image
              </Button>
              {selectedFile && (
                <Button size="sm" loading={avatarLoading} onClick={handleUpload}>
                  Upload
                </Button>
              )}
              {displayAvatar && !selectedFile && (
                <Button size="sm" variant="danger" loading={avatarLoading} onClick={handleRemove}>
                  Remove
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-[#A0A0B0]">JPEG, PNG, GIF, or WebP. Max 5 MB. Images are resized to 256x256.</p>
          {avatarMsg && <p className={`text-xs ${avatarMsg.includes("updated") || avatarMsg.includes("removed") ? "text-[#00FF41]" : "text-[#FF4444]"}`}>{avatarMsg}</p>}
        </div>
      </GlassPanel>

      {/* Danger Zone */}
      <GlassPanel glow="none">
        <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#FF4444] mb-4">Danger Zone</h3>
        <p className="text-xs text-[#A0A0B0] mb-3">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>Delete Account</Button>
      </GlassPanel>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete Account"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={deleteLoading} onClick={handleDeleteAccount}>Delete Forever</Button>
          </>
        }
      >
        <p className="text-sm text-[#A0A0B0]">
          This will permanently delete your account <strong className="text-[#F0F0F0]">{email}</strong> and all your data. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
