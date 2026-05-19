"use client";

import { useState, useEffect, useCallback } from "react";
import {
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
} from "date-fns";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { CalendarGrid } from "@/components/schedule/CalendarGrid";
import { EventForm } from "@/components/schedule/EventForm";
import { EventItem } from "@/components/schedule/EventItem";

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
  creatorAvatar?: string | null;
}

interface ScheduleViewProps {
  projectId: string;
  userId: string;
  userRole: string;
  backHref?: string;
}

export function ScheduleView({ projectId, userId, userRole, backHref }: ScheduleViewProps) {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const url = `/api/projects/${projectId}/schedule?startDate=${monthStart.toISOString()}&endDate=${monthEnd.toISOString()}`;

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch schedule events:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, currentMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function handleCreate() {
    setEditingEvent(null);
    setFormOpen(true);
  }

  function handleEdit(event: ScheduleEvent) {
    setEditingEvent(event);
    setFormOpen(true);
  }

  async function handleDelete(eventId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/schedule/${eventId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Delete failed:", err.error);
      }
    } catch (err) {
      console.error("Network error during delete:", err);
    }
  }

  const selectedDayEvents = events.filter((e) => {
    const eventDate = parseISO(e.startTime);
    return (
      eventDate.getFullYear() === selectedDate.getFullYear() &&
      eventDate.getMonth() === selectedDate.getMonth() &&
      eventDate.getDate() === selectedDate.getDate()
    );
  });

  return (
    <div>
      <TopBar
        title="Schedule"
        subtitle="Project timeline"
        showBack
        backHref={backHref}
        actions={
          <Button
            size="sm"
            onClick={handleCreate}
            className="bg-[#B44DFF] text-white hover:bg-[#9B3DFF] shadow-[0_0_20px_rgba(180,77,255,0.2)] hover:shadow-[0_0_30px_rgba(180,77,255,0.3)]"
          >
            + Add Event
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-[#B44DFF] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <CalendarGrid
              events={events}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
            />

            {/* Selected day event list */}
            {selectedDayEvents.length > 0 && (
              <div>
                <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#B44DFF] neon-text-purple mb-3">
                  Events on {format(selectedDate, "MMMM d, yyyy")}
                </h3>
                <div className="space-y-2">
                  {selectedDayEvents.map((event) => (
                    <EventItem
                      key={event.id}
                      event={event}
                      canEdit={event.createdBy === userId || userRole === "admin"}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All events this month */}
            {events.length > 0 && (
              <div>
                <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#B44DFF] neon-text-purple mb-3">
                  All Events — {format(currentMonth, "MMMM yyyy")}
                </h3>
                <div className="space-y-2">
                  {events.map((event) => (
                    <EventItem
                      key={event.id}
                      event={event}
                      canEdit={event.createdBy === userId || userRole === "admin"}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {events.length === 0 && (
              <div className="glass-panel text-center py-12">
                <div className="text-4xl mb-3">◷</div>
                <p className="text-sm text-[#A0A0B0]">
                  No events this month. Click "Add Event" to create one.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <EventForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingEvent(null);
        }}
        projectId={projectId}
        event={editingEvent}
        selectedDate={selectedDate}
        onSaved={fetchEvents}
      />
    </div>
  );
}
