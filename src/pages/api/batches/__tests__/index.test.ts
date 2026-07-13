import { describe, expect, it } from "vitest";
import { GET } from "../index";

// Fake query builder resolving to a Supabase-shaped { data, error }.
function fakeQuery(result: { data: unknown; error: unknown }) {
  return { from: () => ({ select: () => ({ order: () => Promise.resolve(result) }) }) };
}

// Minimal APIContext with just what GET reads.
function makeContext(supabase: unknown, user: unknown = { id: "u1" }) {
  return { locals: { supabase, user } } as unknown as import("astro").APIContext;
}

describe("GET /api/batches", () => {
  it("returns 200 with { data } when the query succeeds", async () => {
    const row = { id: "b1", name: "Test batch" };
    const supabase = fakeQuery({ data: [row], error: null });

    const res = await GET(makeContext(supabase));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [row] });
  });

  it("returns 500 'Failed to fetch batches' when the query errors", async () => {
    const supabase = fakeQuery({ data: null, error: { message: "boom" } });

    const res = await GET(makeContext(supabase));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch batches" });
  });

  it("returns 500 'Server configuration error' when the client is null", async () => {
    const res = await GET(makeContext(null));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server configuration error" });
  });
});
