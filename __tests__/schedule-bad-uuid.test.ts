import { describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";

// The schedule PATCH/DELETE handlers should reject a non-UUID `eventId`
// with 400 BEFORE touching auth, drizzle, or anything else. Without this
// guard, Postgres throws on the uuid cast and the route 500s.
// (Round 1 diagnostic — BUG 7.)

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

vi.mock("@/lib/project-utils", () => ({
  // Both kept available — UUID_RE is imported by the route.
  UUID_RE: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  resolveProjectId: async (id: string) =>
    id === PROJECT_ID ? PROJECT_ID : null,
}));

// authenticate / db / schema shouldn't be reached on this path. Provide
// throwing stubs so any accidental call fails loudly.
vi.mock("@/lib/api-auth", () => ({
  authenticate: async () => {
    throw new Error("authenticate should not be called when eventId is invalid");
  },
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get() {
        throw new Error("db should not be called when eventId is invalid");
      },
    },
  ),
}));

vi.mock("@/lib/db/schema", () => ({
  scheduleEvents: { id: "id", projectId: "projectId" },
}));

vi.mock("next/server", () => {
  class FakeNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
    }
  }
  return { NextRequest: Request, NextResponse: FakeNextResponse };
});

async function loadHandlers() {
  return import(
    "@/app/api/projects/[id]/schedule/[eventId]/route"
  );
}

function makeRequest(method: "PATCH" | "DELETE", body?: unknown): NextRequest {
  return new Request("http://localhost", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

describe("schedule [eventId] route — UUID guard", () => {
  test("PATCH with non-UUID eventId returns 400", async () => {
    const { PATCH } = await loadHandlers();
    const res = await PATCH(makeRequest("PATCH", { title: "x" }), {
      params: Promise.resolve({ id: PROJECT_ID, eventId: "f72905f2" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid event id");
  });

  test("DELETE with non-UUID eventId returns 400", async () => {
    const { DELETE } = await loadHandlers();
    const res = await DELETE(makeRequest("DELETE"), {
      params: Promise.resolve({ id: PROJECT_ID, eventId: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid event id");
  });

  test("PATCH with an obviously bad string returns 400", async () => {
    const { PATCH } = await loadHandlers();
    const res = await PATCH(makeRequest("PATCH", { title: "x" }), {
      params: Promise.resolve({ id: PROJECT_ID, eventId: "" }),
    });
    expect(res.status).toBe(400);
  });
});
