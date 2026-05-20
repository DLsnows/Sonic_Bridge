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
  const [customId, setCustomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customIdError, setCustomIdError] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setCustomId("");
    setError("");
    setCustomIdError("");
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setError("");
    setCustomIdError("");
    setLoading(true);

    const body: Record<string, string> = { name: name.trim(), description: description.trim() };
    if (customId.trim()) body.customId = customId.trim();

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setOpen(false);
        router.push(`/projects/${data.id}`);
        router.refresh();
      } else {
        setError(data.error ?? "Failed to create project");
        if (data.details?.fieldErrors?.customId) {
          setCustomIdError(data.details.fieldErrors.customId.join(" "));
        }
      }
    } catch {
      setError("Network error — please check your connection and try again");
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
            label="Custom ID (optional)"
            value={customId}
            onChange={(e) => setCustomId(e.target.value)}
            placeholder="my-band (letters, numbers, hyphens, underscores)"
            error={customIdError}
          />
          <p className="text-[10px] text-[#A0A0B0] -mt-2">
            4-32 chars, alphanumeric, hyphens, underscores. Leave blank for auto-generated UUID.
          </p>
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
