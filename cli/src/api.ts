import { loadConfig, DEFAULT_BASE_URL, type CliConfig } from "./config.js";

/** Typed error thrown by apiFetch on non-2xx responses. */
export class ApiError extends Error {
  status: number;
  body: unknown;
  url: string;
  constructor(status: number, url: string, body: unknown, message?: string) {
    super(message ?? `API ${status} from ${url}`);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  /** If true, the body is sent as-is (Buffer/stream/string). Otherwise JSON-encoded. */
  rawBody?: boolean;
  headers?: Record<string, string>;
  /** Override config base URL (useful in tests). */
  baseUrl?: string;
  /** Override token (e.g. during login before saveConfig). */
  token?: string | null;
  /** Optional AbortSignal */
  signal?: AbortSignal;
}

function joinUrl(base: string, p: string): string {
  if (/^https?:\/\//i.test(p)) return p;
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = p.startsWith("/") ? p : `/${p}`;
  return `${trimmedBase}${trimmedPath}`;
}

async function readJsonOrText(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Fetches a JSON response from the API. Adds Authorization header if a token
 * is in config (or passed via opts.token). Throws ApiError on non-2xx.
 */
export async function apiFetch<T = unknown>(
  pathOrUrl: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const cfg = await loadConfig();
  const baseUrl = opts.baseUrl ?? cfg?.baseUrl ?? DEFAULT_BASE_URL;
  const token = opts.token === null ? null : (opts.token ?? cfg?.token);
  const url = joinUrl(baseUrl, pathOrUrl);

  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (token && !headers["Authorization"] && !headers["authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.rawBody) {
      body = opts.body as BodyInit;
    } else {
      body = JSON.stringify(opts.body);
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body,
    signal: opts.signal,
  });

  if (!res.ok) {
    const parsed = await readJsonOrText(res);
    throw new ApiError(res.status, url, parsed);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  // Some endpoints return 204
  if (res.status === 204) return undefined as T;
  return (await res.text()) as unknown as T;
}

/** Returns the active project id from --project flag or config.activeProject. */
export function resolveActiveProject(
  cfg: CliConfig | null,
  flagProject: string | undefined,
): string {
  if (flagProject && flagProject.length > 0) return flagProject;
  const ap = cfg?.activeProject;
  if (ap?.id) return ap.id;
  throw new Error(
    "No project selected. Pass --project <idOrCustomId> or run `sonicbridge project use <id>`.",
  );
}

/**
 * Pretty-prints an ApiError for console output. Returns string lines.
 */
export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const bodyStr =
      typeof err.body === "string"
        ? err.body
        : err.body
          ? JSON.stringify(err.body)
          : "";
    return `API error ${err.status} ${err.url}${bodyStr ? `\n  ${bodyStr}` : ""}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Helper: returns true if --json flag is set on the command's opts.
 * Centralized so commands all share the same convention.
 */
export function wantsJson(opts: { json?: boolean } | undefined): boolean {
  return Boolean(opts?.json);
}
