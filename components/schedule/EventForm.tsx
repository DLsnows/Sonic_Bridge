"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { z } from "zod";

interface ScheduleEvent {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  type: "meeting" | "production" | "release" | "other";
  createdBy: string;
  createdAt: string;
  creatorName: string;
}

const eventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  startTime: z.string().min(1, "Start time is required").refine((s) => !isNaN(Date.parse(s)), "Invalid start time"),
  endTime: z.string().min(1, "End time is required").refine((s) => !isNaN(Date.parse(s)), "Invalid end time"),
  type: z.enum(["meeting", "production", "release", "other"]),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventFormProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  event?: ScheduleEvent | null;
  selectedDate?: Date;
  onSaved: () => void;
}

function toLocalDatetimeString(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function EventForm({ open, onClose, projectId, event, selectedDate, onSaved }: EventFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [type, setType] = useState<"meeting" | "production" | "release" | "other">("other");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const isEdit = !!event;

  useEffect(() => {
    if (open) {
      setErrors({});
      setLoading(false);
      if (event) {
        setTitle(event.title);
        setDescription(event.description ?? "");
        setStartTime(toLocalDatetimeString(new Date(event.startTime)));
        setEndTime(toLocalDatetimeString(new Date(event.endTime)));
        setType(event.type);
      } else {
        setTitle("");
        setDescription("");
        const base = selectedDate ?? new Date();
        const start = new Date(base);
        start.setHours(10, 0, 0, 0);
        const end = new Date(base);
        end.setHours(11, 0, 0, 0);
        setStartTime(toLocalDatetimeString(start));
        setEndTime(toLocalDatetimeString(end));
        setType("other");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, selectedDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const data: EventFormData = { title, description, startTime, endTime, type };
    const parsed = eventSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    const resolvedStart = new Date(parsed.data.startTime);
    const resolvedEnd = new Date(parsed.data.endTime);

    if (resolvedEnd <= resolvedStart) {
      setErrors({ endTime: "End time must be after start time" });
      return;
    }

    setLoading(true);

    try {
      const url = isEdit
        ? `/api/projects/${projectId}/schedule/${event!.id}`
        : `/api/projects/${projectId}/schedule`;

      const bodyObj: Record<string, unknown> = {
        title: parsed.data.title,
        startTime: resolvedStart.toISOString(),
        endTime: resolvedEnd.toISOString(),
        type: parsed.data.type,
      };
      if (parsed.data.description) {
        bodyObj.description = parsed.data.description;
      }
      const body = JSON.stringify(bodyObj);

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        const err = await res.json();
        setErrors({ _form: err.error ?? "Something went wrong" });
        return;
      }

      onSaved();
      onClose();
    } catch {
      setErrors({ _form: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const typeOptions = [
    { value: "meeting", label: "Meeting", color: "#00F0FF" },
    { value: "production", label: "Production", color: "#00FF41" },
    { value: "release", label: "Release", color: "#B44DFF" },
    { value: "other", label: "Other", color: "#A0A0B0" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Event" : "New Event"}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={loading} onClick={handleSubmit}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors._form && (
          <div className="p-2 rounded bg-[#FF4444]/10 border border-[#FF4444]/30 text-xs text-[#FF4444]">
            {errors._form}
          </div>
        )}

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          error={errors.title}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#A0A0B0] font-medium uppercase tracking-wider">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
            className="w-full px-3 py-2 bg-[#0F0F13] border rounded-lg text-sm text-[#F0F0F0]
              placeholder:text-[#A0A0B0]/50 font-['Fira_Code',monospace]
              transition-all duration-200 resize-none
              focus:outline-none focus:border-[#B44DFF]/50 focus:shadow-[0_0_15px_rgba(180,77,255,0.1)]
              border-white/10 hover:border-white/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            error={errors.startTime}
          />
          <Input
            label="End"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            error={errors.endTime}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#A0A0B0] font-medium uppercase tracking-wider">
            Type
          </label>
          <div className="grid grid-cols-4 gap-2">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value as typeof type)}
                className={`py-2 px-1 rounded-lg text-xs font-['Fira_Code',monospace] border transition-all duration-200
                  ${type === opt.value
                    ? "border-[#B44DFF]/50 bg-[#B44DFF]/10 text-[#F0F0F0]"
                    : "border-white/10 text-[#A0A0B0] hover:border-white/20"}`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
