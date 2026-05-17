"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";

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

const typeColors: Record<string, string> = {
  meeting: "bg-[#00F0FF]",
  production: "bg-[#00FF41]",
  release: "bg-[#B44DFF]",
  other: "bg-[#A0A0B0]",
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarGridProps {
  events: ScheduleEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function CalendarGrid({
  events,
  selectedDate,
  onSelectDate,
  currentMonth,
  onMonthChange,
}: CalendarGridProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const event of events) {
      const dayKey = format(parseISO(event.startTime), "yyyy-MM-dd");
      const list = map.get(dayKey) ?? [];
      list.push(event);
      map.set(dayKey, list);
    }
    return map;
  }, [events]);

  const groupedBySelected = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return eventsByDay.get(key) ?? [];
  }, [eventsByDay, selectedDate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="glass-panel shadow-[0_0_30px_rgba(180,77,255,0.1)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <button
              onClick={() => onMonthChange(subMonths(currentMonth, 1))}
              className="text-[#A0A0B0] hover:text-[#B44DFF] transition-colors text-lg px-2"
            >
              ◀
            </button>
            <h3 className="font-['Share_Tech_Mono',monospace] text-lg text-[#B44DFF] neon-text-purple">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <button
              onClick={() => onMonthChange(addMonths(currentMonth, 1))}
              className="text-[#A0A0B0] hover:text-[#B44DFF] transition-colors text-lg px-2"
            >
              ▶
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 border-b border-white/5">
            {dayNames.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs text-[#A0A0B0] font-['Share_Tech_Mono',monospace]"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = isSameDay(day, selectedDate);
              const today = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(day)}
                  className={`min-h-[80px] p-1.5 border border-white/5 transition-all duration-150
                    ${!isCurrentMonth ? "opacity-30" : ""}
                    ${isSelected
                      ? "bg-[#B44DFF]/15 border-[#B44DFF]/40 shadow-[0_0_15px_rgba(180,77,255,0.15)]"
                      : "hover:bg-white/[0.03]"}
                  `}
                >
                  <span
                    className={`text-xs inline-flex items-center justify-center w-6 h-6 rounded-full
                      ${today ? "bg-[#B44DFF] text-[#F0F0F0] font-bold" : "text-[#A0A0B0]"}`}
                  >
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={`w-1.5 h-1.5 rounded-full ${typeColors[ev.type]}`}
                          title={ev.title}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[9px] text-[#A0A0B0] leading-none">
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected day events */}
      <div>
        <div className="glass-panel shadow-[0_0_30px_rgba(180,77,255,0.1)]">
          <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#B44DFF] mb-3 neon-text-purple">
            {format(selectedDate, "MMMM d, yyyy")}
          </h3>
          {groupedBySelected.length === 0 ? (
            <p className="text-sm text-[#A0A0B0] py-4 text-center">No events</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {groupedBySelected.map((event) => (
                <div
                  key={event.id}
                  className="p-2 rounded-lg bg-white/[0.03] border border-white/5 hover:border-[#B44DFF]/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${typeColors[event.type]} shrink-0`} />
                    <span className="text-sm text-[#F0F0F0] truncate font-['Fira_Code',monospace]">
                      {event.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#A0A0B0] mt-1 font-['Fira_Code',monospace]">
                    {format(parseISO(event.startTime), "HH:mm")} — {format(parseISO(event.endTime), "HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
