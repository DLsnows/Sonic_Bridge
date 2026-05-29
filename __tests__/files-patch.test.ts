import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const FILE_ID = "22222222-2222-2222-2222-222222222222";
const FOLDER_SAME_PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const FOLDER_OTHER_PROJECT_ID = "44444444-4444-4444-4444-444444444444";
const USER_ID = "55555555-5555-5555-5555-555555555555";

type SelectShape = Record<string, unknown> | undefined;

interface FakeFile {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  size: number;
  mimeType: string;
  storageKey: string;
  uploadedBy: string;
  uploadedAt: Date;
}

interface FakeFolder {
  id: string;
  projectId: string;
}

interface FakeUser {
  id: string;
  username: string;
}

// We build a tiny in-memory store and a chainable mock that satisfies the
// drizzle fluent API surface used by the PATCH handler:
//   select(...).from(table).where(...).limit(n)
//   select(...).from(table).innerJoin(...).where(...).limit(n)
//   update(table).set(values).where(...)
const store: {
  files: FakeFile[];
  folders: FakeFolder[];
  users: FakeUser[];
} = {
  files: [],
  folders: [],
  users: [],
};


// Capture predicates by hijacking eq/and from drizzle-orm so we can evaluate
// them against the in-memory store.
vi.mock("drizzle-orm", () => {
  interface EqPredicate {
    kind: "eq";
    field: { table: string; column: string };
    value: unknown;
  }
  interface AndPredicate {
    kind: "and";
    parts: Predicate[];
  }
  type Predicate = EqPredicate | AndPredicate;

  function evaluate(pred: Predicate | null | undefined, row: Record<string, unknown>): boolean {
    if (!pred) return true;
    if (pred.kind === "eq") {
      return row[pred.field.column] === pred.value;
    }
    return pred.parts.every((p) => evaluate(p, row));
  }

  // Expose to the outer scope through globalThis so the schema mock below
  // can use the same field metadata.
  (globalThis as unknown as { __evaluate: typeof evaluate }).__evaluate = evaluate;

  return {
    eq: (field: { table: string; column: string }, value: unknown): EqPredicate => ({
      kind: "eq",
      field,
      value,
    }),
    and: (...parts: (Predicate | undefined)[]): AndPredicate => ({
      kind: "and",
      parts: parts.filter((p): p is Predicate => Boolean(p)),
    }),
    inArray: (field: { table: string; column: string }, values: unknown[]) => ({
      kind: "inArray",
      field,
      values,
    }),
  };
});

// Build field stand-ins so eq()/and() get { table, column } objects.
function mkField(table: string, column: string) {
  return { table, column };
}

const filesTable = {
  id: mkField("files", "id"),
  projectId: mkField("files", "projectId"),
  folderId: mkField("files", "folderId"),
  name: mkField("files", "name"),
  size: mkField("files", "size"),
  mimeType: mkField("files", "mimeType"),
  storageKey: mkField("files", "storageKey"),
  uploadedBy: mkField("files", "uploadedBy"),
  uploadedAt: mkField("files", "uploadedAt"),
};
const foldersTable = {
  id: mkField("folders", "id"),
  projectId: mkField("folders", "projectId"),
};
const usersTable = {
  id: mkField("users", "id"),
  username: mkField("users", "username"),
  apiToken: mkField("users", "apiToken"),
};

vi.mock("@/lib/db/schema", () => ({
  files: filesTable,
  folders: foldersTable,
  users: usersTable,
}));

vi.mock("@/lib/db", () => {
  const evalFn = () =>
    (globalThis as unknown as {
      __evaluate: (p: unknown, row: Record<string, unknown>) => boolean;
    }).__evaluate;

  type Row = Record<string, unknown>;

  function rowsFor(table: string): Row[] {
    if (table === "files") return store.files as unknown as Row[];
    if (table === "folders") return store.folders as unknown as Row[];
    if (table === "users") return store.users as unknown as Row[];
    return [];
  }

  function projectShape(rows: Row[], shape: SelectShape): Row[] {
    if (!shape) return rows;
    return rows.map((row) => {
      const out: Row = {};
      for (const [outKey, fieldRef] of Object.entries(shape)) {
        const f = fieldRef as { table: string; column: string };
        if (f.table === "files") out[outKey] = (row as Row)[f.column];
        else if (f.table === "users") {
          // joined rows carry _user.* properties when innerJoin ran
          const joined = (row as Row).__user as Row | undefined;
          out[outKey] = joined?.[f.column];
        }
      }
      return out;
    });
  }

  function buildSelectChain(table: string, shape: SelectShape) {
    let baseRows: Row[] = rowsFor(table);
    let predicate: unknown = null;
    let limitN = Infinity;

    const chain: {
      from: () => typeof chain;
      innerJoin: () => typeof chain;
      where: (p: unknown) => typeof chain;
      limit: (n: number) => Promise<Row[]>;
      orderBy: () => typeof chain;
      then: (onFulfilled?: (rows: Row[]) => unknown) => Promise<unknown>;
    } = {
      from() {
        return chain;
      },
      innerJoin() {
        // Attach matching user row under __user for join semantics.
        baseRows = (store.files as unknown as Row[]).map((file) => {
          const u = store.users.find((u) => u.id === file.uploadedBy);
          return { ...file, __user: u as unknown as Row };
        });
        return chain;
      },
      where(p: unknown) {
        predicate = p;
        return chain;
      },
      limit(n: number) {
        limitN = n;
        return chain.then() as Promise<Row[]>;
      },
      orderBy() {
        return chain;
      },
      // Make the chain awaitable.
      then(onFulfilled?: (rows: Row[]) => unknown) {
        const filtered = baseRows.filter((r) => evalFn()(predicate, r));
        const limited =
          limitN === Infinity ? filtered : filtered.slice(0, limitN);
        const projected = projectShape(limited, shape);
        return Promise.resolve(projected).then(onFulfilled);
      },
    };
    return chain;
  }

  return {
    db: {
      select(shape?: SelectShape) {
        return {
          from(table: { id: { table: string } }) {
            const tableName = table.id.table as
              | "files"
              | "folders"
              | "users";
            return buildSelectChain(tableName, shape);
          },
        };
      },
      update(table: { id: { table: string } }) {
        const tableName = table.id.table as "files";
        return {
          set(values: Record<string, unknown>) {
            return {
              where(p: unknown) {
                // Apply update to matching rows.
                const rows = rowsFor(tableName);
                const evaluate = evalFn();
                for (const row of rows) {
                  if (evaluate(p, row)) {
                    Object.assign(row, values);
                  }
                }
                return Promise.resolve();
              },
            };
          },
        };
      },
    },
  };
});

vi.mock("@/lib/project-utils", () => ({
  resolveProjectId: async (id: string) => {
    if (id === PROJECT_ID) return PROJECT_ID;
    return null;
  },
}));

vi.mock("@/lib/api-auth", () => ({
  authenticate: async () => ({
    userId: USER_ID,
    username: "tester",
    membership: { role: "admin" },
  }),
}));

vi.mock("@/lib/storage", () => ({
  deleteFile: vi.fn(),
  normalizeKey: (k: string) => k,
}));

// Mock next/server with minimal shape used by the route.
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
    static redirect(url: string) {
      return new Response(null, { status: 302, headers: { Location: url } });
    }
  }
  return {
    NextRequest: Request,
    NextResponse: FakeNextResponse,
  };
});

// Now import the handler under test (after all mocks are registered).
async function loadPatch() {
  const mod = await import(
    "@/app/api/projects/[id]/files/[fileId]/route"
  );
  return mod.PATCH;
}

function resetStore() {
  store.files.length = 0;
  store.folders.length = 0;
  store.users.length = 0;
}

function seed() {
  store.users.push({ id: USER_ID, username: "tester" });
  store.files.push({
    id: FILE_ID,
    projectId: PROJECT_ID,
    folderId: null,
    name: "track.wav",
    size: 1024,
    mimeType: "audio/wav",
    storageKey: `${PROJECT_ID}/track.wav`,
    uploadedBy: USER_ID,
    uploadedAt: new Date("2026-05-27T00:00:00Z"),
  });
  store.folders.push({
    id: FOLDER_SAME_PROJECT_ID,
    projectId: PROJECT_ID,
  });
  store.folders.push({
    id: FOLDER_OTHER_PROJECT_ID,
    projectId: "99999999-9999-9999-9999-999999999999",
  });
}

function buildRequest(body: unknown): NextRequest {
  return new Request(
    `http://test.local/api/projects/${PROJECT_ID}/files/${FILE_ID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  ) as unknown as NextRequest;
}

const params = Promise.resolve({ id: PROJECT_ID, fileId: FILE_ID });

beforeEach(() => {
  resetStore();
  seed();
});

afterEach(() => {
  resetStore();
});

describe("PATCH /api/projects/[id]/files/[fileId]", () => {
  test("happy path: moves file to existing folder in same project", async () => {
    const PATCH = await loadPatch();
    const res = await PATCH(buildRequest({ folderId: FOLDER_SAME_PROJECT_ID }), {
      params,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { file: { folderId: string | null } };
    expect(json.file.folderId).toBe(FOLDER_SAME_PROJECT_ID);
    expect(store.files[0].folderId).toBe(FOLDER_SAME_PROJECT_ID);
  });

  test("folderId: null moves file to root", async () => {
    // First put file inside a folder so the null transition is observable.
    store.files[0].folderId = FOLDER_SAME_PROJECT_ID;
    const PATCH = await loadPatch();
    const res = await PATCH(buildRequest({ folderId: null }), { params });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { file: { folderId: string | null } };
    expect(json.file.folderId).toBeNull();
    expect(store.files[0].folderId).toBeNull();
  });

  test("404 when target folder belongs to a different project", async () => {
    const PATCH = await loadPatch();
    const res = await PATCH(
      buildRequest({ folderId: FOLDER_OTHER_PROJECT_ID }),
      { params },
    );
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Folder not found");
    // file should not have moved
    expect(store.files[0].folderId).toBeNull();
  });

  test("400 when neither folderId nor name is provided", async () => {
    const PATCH = await loadPatch();
    const res = await PATCH(buildRequest({}), { params });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid input");
  });

  test("happy path: renames file and returns updated row", async () => {
    const PATCH = await loadPatch();
    const res = await PATCH(buildRequest({ name: "new-name.wav" }), { params });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { file: { name: string } };
    expect(json.file.name).toBe("new-name.wav");
    expect(store.files[0].name).toBe("new-name.wav");
  });

  test("400 when name contains a path separator (zod refine via FILE_NAME_FORBIDDEN_RE)", async () => {
    const PATCH = await loadPatch();
    const res = await PATCH(buildRequest({ name: "../evil.wav" }), { params });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid input");
    // file should not have been renamed
    expect(store.files[0].name).toBe("track.wav");
  });

  test("400 when name is empty (zod min(1))", async () => {
    const PATCH = await loadPatch();
    const res = await PATCH(buildRequest({ name: "" }), { params });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid input");
    expect(store.files[0].name).toBe("track.wav");
  });

  test("400 when name exceeds 255 characters (zod max(255))", async () => {
    const PATCH = await loadPatch();
    const longName = "a".repeat(256);
    const res = await PATCH(buildRequest({ name: longName }), { params });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid input");
    expect(store.files[0].name).toBe("track.wav");
  });

  test("rename within same extension succeeds (mix.wav -> mix-final.wav)", async () => {
    // Re-seed the file with a known name so we don't depend on the default seed.
    store.files[0].name = "mix.wav";
    const PATCH = await loadPatch();
    const res = await PATCH(buildRequest({ name: "mix-final.wav" }), { params });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { file: { name: string } };
    expect(json.file.name).toBe("mix-final.wav");
    expect(store.files[0].name).toBe("mix-final.wav");
  });

  test("422 extension_change_not_allowed when extension differs (mix.wav -> mix.mp3)", async () => {
    store.files[0].name = "mix.wav";
    const PATCH = await loadPatch();
    const res = await PATCH(buildRequest({ name: "mix.mp3" }), { params });
    expect(res.status).toBe(422);
    const json = (await res.json()) as {
      error: string;
      currentExt: string;
      newExt: string;
    };
    expect(json.error).toBe("extension_change_not_allowed");
    expect(json.currentExt).toBe("wav");
    expect(json.newExt).toBe("mp3");
    // File should not have been renamed.
    expect(store.files[0].name).toBe("mix.wav");
  });

  test("rename succeeds when neither name has an extension (README -> READMEv2)", async () => {
    store.files[0].name = "README";
    const PATCH = await loadPatch();
    const res = await PATCH(buildRequest({ name: "READMEv2" }), { params });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { file: { name: string } };
    expect(json.file.name).toBe("READMEv2");
    expect(store.files[0].name).toBe("READMEv2");
  });
});
