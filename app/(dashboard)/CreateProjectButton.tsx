"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { projectHref } from "@/lib/project-utils";

export function CreateProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setError("");
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    setError("");
    setLoading(true);

    const body: Record<string, string> = { name: name.trim(), description: description.trim() };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setOpen(false);
        window.dispatchEvent(new CustomEvent("project-created"));
        router.push(projectHref(data));
        router.refresh();
      } else {
        let data: { error?: string; details?: { fieldErrors?: Record<string, string[]> } } = {};
        try { data = await res.json(); } catch { /* non-JSON response */ }
        setError(data.error ?? "Failed to create project");
      }
    } catch {
      setError("Network error - please check your connection and try again");
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
        onClose={handleClose}
        title="Create Project"
        footer={
          <>
            <Button variant="ghost" onClick={handleClose}>
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
