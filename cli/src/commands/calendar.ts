import pc from "picocolors";
import {
  apiFetch,
  ApiError,
  formatApiError,
  resolveActiveProject,
  wantsJson,
} from "../api.js";
import { loadConfig } from "../config.js";
import { renderTable } from "../util/table.js";

const EVENT_TYPES = ["meeting", "production", "release", "other"] as const;
type EventType = (typeof EVENT_TYPES)[number];

interface ScheduleEvent {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  type: EventType;
  createdBy: string;
  createdAt: string;
  creatorName: string;
  creatorAvatar: string | null;
}

interface ScheduleListResponse {
  events: ScheduleEvent[];
  myRole?: string;
}

interface ScheduleEventResponse {
  event: ScheduleEvent;
}

export interface CalendarFlags {
  title?: string;
  start?: string;
  end?: string;
  desc?: string;
  type?: string;
  from?: string;
  to?: string;
  project?: string;
  json?: boolean;
}

/**
 * Parses a date string in one of two formats:
 *   - ISO 8601 (anything `new Date()` accepts with a timezone)
 *   - Local `YYYY-MM-DD HH:mm` (parsed in the user's local timezone)
 *
 * Returns an ISO 8601 (UTC) string suitable for sending to the API.
 * Throws on unparseable input.
 *
 * Exported for testing.
 */
export function parseDateInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(`Empty date value`);
  }

  // Local format: YYYY-MM-DD HH:mm (no timezone designator).
  // Detect BEFORE handing off to `new Date()` so we don't pick up the
  // UTC-treating "YYYY-MM-DDTHH:mm" parsing that some runtimes do.
  const localMatch =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localMatch) {
    const [, yStr, moStr, dStr, hStr, miStr, sStr] = localMatch;
    const y = Number(yStr);
    const mo = Number(moStr);
    const d = Number(dStr);
    const h = Number(hStr);
    const mi = Number(miStr);
    const s = sStr ? Number(sStr) : 0;
    const dt = new Date(y, mo - 1, d, h, mi, s);
    if (Number.isNaN(dt.getTime())) {
      throw new Error(`Invalid date: ${input}`);
    }
    return dt.toISOString();
  }

  // Otherwise assume ISO 8601 with timezone (Z or ±HH:mm).
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(
      `Unrecognized date: ${input}. Use ISO 8601 (2026-06-01T10:00:00Z) or local "YYYY-MM-DD HH:mm".`,
    );
  }
  return dt.toISOString();
}

function formatLocal(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  // YYYY-MM-DD HH:mm in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(
    dt.getDate(),
  )} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function validateType(t: string | undefined): EventType {
  if (!t) return "other";
  if ((EVENT_TYPES as readonly string[]).includes(t)) {
    return t as EventType;
  }
  throw new Error(
    `Invalid --type "${t}". Must be one of: ${EVENT_TYPES.join(", ")}.`,
  );
}

export async function runCalendarAdd(flags: CalendarFlags): Promise<void> {
  const cfg = await loadConfig();
  try {
    if (!flags.title || !flags.title.trim()) {
      console.error(pc.red("--title is required."));
      process.exit(1);
    }
    if (!flags.start) {
      console.error(pc.red("--start is required."));
      process.exit(1);
    }
    if (!flags.end) {
      console.error(pc.red("--end is required."));
      process.exit(1);
    }
    const projectId = resolveActiveProject(cfg, flags.project);
    const type = validateType(flags.type);

    const startIso = parseDateInput(flags.start);
    const endIso = parseDateInput(flags.end);
    if (new Date(endIso) <= new Date(startIso)) {
      console.error(pc.red("End time must be after start time."));
      process.exit(1);
    }

    const body: Record<string, unknown> = {
      title: flags.title.trim(),
      startTime: startIso,
      endTime: endIso,
      type,
    };
    if (flags.desc !== undefined) body.description = flags.desc;

    const result = await apiFetch<ScheduleEventResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/schedule`,
      { method: "POST", body },
    );

    if (wantsJson(flags)) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(
        pc.green(
          `Created event ${result.event.id} (${formatLocal(result.event.startTime)} → ${formatLocal(result.event.endTime)})`,
        ),
      );
    }
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runCalendarLs(flags: CalendarFlags): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);

    // Default window: next 30 days (now → now+30d).
    const now = new Date();
    const fromIso = flags.from
      ? parseDateInput(flags.from)
      : now.toISOString();
    const toIso = flags.to
      ? parseDateInput(flags.to)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const qs = new URLSearchParams();
    qs.set("startDate", fromIso);
    qs.set("endDate", toIso);
    const result = await apiFetch<ScheduleListResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/schedule?${qs.toString()}`,
    );

    if (wantsJson(flags)) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (!result.events || result.events.length === 0) {
      console.log(pc.dim("(no events in range)"));
      return;
    }
    const rows = result.events.map((e) => ({
      id: shortId(e.id),
      title: e.title,
      type: e.type,
      start: formatLocal(e.startTime),
      end: formatLocal(e.endTime),
      creator: e.creatorName,
    }));
    console.log(
      renderTable(
        [
          { header: "id", key: "id" },
          { header: "title", key: "title" },
          { header: "type", key: "type" },
          { header: "start", key: "start" },
          { header: "end", key: "end" },
          { header: "creator", key: "creator" },
        ],
        rows,
      ),
    );
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runCalendarEdit(
  eventId: string,
  flags: CalendarFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    const body: Record<string, unknown> = {};
    if (flags.title !== undefined) body.title = flags.title;
    if (flags.desc !== undefined) body.description = flags.desc;
    if (flags.type !== undefined) body.type = validateType(flags.type);
    if (flags.start !== undefined) body.startTime = parseDateInput(flags.start);
    if (flags.end !== undefined) body.endTime = parseDateInput(flags.end);

    if (Object.keys(body).length === 0) {
      console.error(
        pc.red(
          "Nothing to update — pass at least one of --title, --start, --end, --desc, --type.",
        ),
      );
      process.exit(1);
    }

    // Client-side guard: if BOTH start and end were supplied, fail early.
    // (The server checks combinations of supplied + existing; we can only
    // verify the user-supplied pair here.)
    if (body.startTime && body.endTime) {
      if (
        new Date(body.endTime as string) <= new Date(body.startTime as string)
      ) {
        console.error(pc.red("End time must be after start time."));
        process.exit(1);
      }
    }

    const result = await apiFetch<ScheduleEventResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/schedule/${encodeURIComponent(eventId)}`,
      { method: "PATCH", body },
    );

    if (wantsJson(flags)) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(pc.green(`Updated event ${result.event.id}.`));
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      console.error(
        pc.red(
          "Only the creator or a project admin can edit this event.",
        ),
      );
      process.exit(1);
    }
    if (err instanceof ApiError && err.status === 404) {
      console.error(pc.red(`Event ${eventId} not found.`));
      process.exit(1);
    }
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runCalendarRm(
  eventId: string,
  flags: CalendarFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    await apiFetch(
      `/api/projects/${encodeURIComponent(projectId)}/schedule/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
    console.log(pc.green(`Deleted event ${eventId}`));
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      console.error(
        pc.red(
          "Only the creator or a project admin can delete this event.",
        ),
      );
      process.exit(1);
    }
    if (err instanceof ApiError && err.status === 404) {
      console.error(pc.red(`Event ${eventId} not found.`));
      process.exit(1);
    }
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export const CALENDAR_HELP = {
  name: "calendar",
  summary: "Create, list, edit, and remove calendar events.",
  body: [
    "Usage:",
    "  sonicbridge calendar add --title <t> --start <date> --end <date>",
    "                          [--desc <d>] [--type meeting|production|release|other]",
    "                          [--project <p>] [--json]",
    "  sonicbridge calendar ls [--from <date>] [--to <date>] [--project <p>] [--json]",
    "  sonicbridge calendar edit <eventId> [--title] [--start] [--end] [--desc] [--type]",
    "                                       [--project <p>] [--json]",
    "  sonicbridge calendar rm <eventId> [--project <p>]",
    "",
    "Date input accepts ISO 8601 (e.g. 2026-06-01T10:00:00Z) or local",
    "`YYYY-MM-DD HH:mm` (parsed in your machine's timezone). `ls` defaults to",
    "the next 30 days when --from/--to are omitted.",
    "",
    "Only the event creator or a project admin may edit or remove an event.",
  ].join("\n"),
};
