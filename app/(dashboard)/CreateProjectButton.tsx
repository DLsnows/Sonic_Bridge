"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export function CreateProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      setOpen(false);
      router.push(`/projects/${data.id}`);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create project");
    }
    setLoading(false);
  };

  return (
    <>
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        + New Project
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Project"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={loading}>
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Album Project"
            required
          />
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Working on our next EP..."
          />
          {error && <p className="text-sm text-[#FF4444]">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
