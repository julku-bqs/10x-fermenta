import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const STATE_FILE = resolve(__dirname, ".test-state.json");

interface TestState {
  baseUrl: string;
  cookies: string;
  userId: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

let cachedState: TestState | null = null;

function getTestState(): TestState {
  if (!cachedState) {
    const raw = readFileSync(STATE_FILE, "utf-8");
    cachedState = JSON.parse(raw) as TestState;
  }
  return cachedState;
}

export const TEST_PORT = 4322;

/**
 * Returns a Supabase admin client (service role) for direct DB operations:
 * data setup, teardown, and verification queries.
 */
export function getAdminClient() {
  const state = getTestState();
  return createClient(state.supabaseUrl, state.supabaseServiceRoleKey);
}

/**
 * Makes an authenticated HTTP request to the running dev server.
 * Injects session cookies from the test user sign-in.
 */
export async function apiRequest(
  path: string,
  options: { method?: string; body?: unknown; cookies?: string } = {},
): Promise<Response> {
  const state = getTestState();
  const { method = "GET", body, cookies } = options;

  const headers: Record<string, string> = {
    Cookie: cookies ?? state.cookies,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // Astro CSRF protection requires Origin header on non-GET requests
  if (method !== "GET") {
    headers.Origin = state.baseUrl;
  }

  return fetch(`${state.baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}

/**
 * Makes an unauthenticated HTTP request (no session cookies).
 * Used to verify middleware guard rejects unauthenticated access.
 */
export async function apiRequestUnauthenticated(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const state = getTestState();
  const { method = "GET", body } = options;

  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // Astro CSRF protection requires Origin header on non-GET requests
  if (method !== "GET") {
    headers.Origin = state.baseUrl;
  }

  return fetch(`${state.baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}

/**
 * Returns the test user ID provisioned during global setup.
 */
export function getTestUserId(): string {
  return getTestState().userId;
}
