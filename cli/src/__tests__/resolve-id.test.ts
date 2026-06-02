import { describe, it, expect } from "vitest";
import { resolveByPrefix } from "../util/resolve-id.js";

interface Row {
  id: string;
  name?: string;
}

const ROWS: Row[] = [
  { id: "aaaaaaaa-1111-1111-1111-111111111111", name: "alpha" },
  { id: "bbbbbbbb-2222-2222-2222-222222222222", name: "beta" },
  { id: "bbcccccc-3333-3333-3333-333333333333", name: "beta-two" },
];

describe("resolveByPrefix", () => {
  it("returns the exact match when the full UUID is given", async () => {
    const result = await resolveByPrefix(
      "aaaaaaaa-1111-1111-1111-111111111111",
      async () => ROWS,
      "row",
    );
    expect(result.name).toBe("alpha");
  });

  it("returns the unique prefix match", async () => {
    const result = await resolveByPrefix(
      "aaaaaaaa",
      async () => ROWS,
      "row",
    );
    expect(result.name).toBe("alpha");
  });

  it("throws a clear error when nothing matches", async () => {
    await expect(
      resolveByPrefix("ffffffff", async () => ROWS, "event"),
    ).rejects.toThrow(/No event matches "ffffffff"/);
  });

  it("throws an ambiguous error when multiple match", async () => {
    await expect(
      resolveByPrefix("bb", async () => ROWS, "row"),
    ).rejects.toThrow(/row prefix "bb" is ambiguous.*matches 2/);
  });

  it("prefers an exact match even when prefixes would also match", async () => {
    const rows: Row[] = [
      { id: "aaaa", name: "short" },
      { id: "aaaabbb", name: "long" },
    ];
    const result = await resolveByPrefix("aaaa", async () => rows, "row");
    expect(result.name).toBe("short");
  });
});
