"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export function JoinProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!code.trim()) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/projects/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: code.trim() }),
    });

    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to join project");
    }
    setLoading(false);
  };

  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        Join Project
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Join Project"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleJoin} loading={loading}>
              Join
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#A0A0B0]">
            Enter the project ID shared by your collaborator (UUID or custom ID).
          </p>
          <Input
            label="Project ID"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="my-band or xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
          {error && <p className="text-sm text-[#FF4444]">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
