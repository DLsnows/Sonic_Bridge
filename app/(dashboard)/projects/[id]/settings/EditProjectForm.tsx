"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function EditProjectForm({ projectId, initialName, initialDescription }: {
  projectId: string;
  initialName: string;
  initialDescription: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error"; text: string} | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null }),
    });
    setMessage(res.ok ? { type: "success", text: "Saved" } : { type: "error", text: "Failed to save" });
    setSaving(false);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="block text-xs text-[#A0A0B0] mb-1">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={100} required
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-[#F0F0F0]" />
      </div>
      <div>
        <label className="block text-xs text-[#A0A0B0] mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3}
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-[#F0F0F0]" />
      </div>
      {message && <p className={`text-xs ${message.type === "success" ? "text-[#00FF41]" : "text-[#FF4444]"}`}>{message.text}</p>}
      <Button type="submit" loading={saving}>Save</Button>
    </form>
  );
}
