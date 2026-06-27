import { describe, it, expect } from "vitest";
import { apiRequest, apiRequestUnauthenticated } from "./helpers";

describe("Integration test infrastructure", () => {
  it("authenticated request to /api/batches returns 200", async () => {
    const res = await apiRequest("/api/batches");
    expect(res.status).toBe(200);
  });

  it("unauthenticated request to /api/batches is rejected with redirect", async () => {
    const res = await apiRequestUnauthenticated("/api/batches");
    // Middleware redirects unauthenticated users to /auth/signin
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });
});
