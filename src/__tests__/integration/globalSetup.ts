import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const TEST_PORT = 4322;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;
const STATE_FILE = resolve(__dirname, ".test-state.json");

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const TEST_EMAIL = "integration-test@example.com";
const TEST_PASSWORD = "test-password-123!";

let devServer: ChildProcess | null = null;

async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function checkLocalSupabase(): Promise<void> {
  try {
    const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: LOCAL_SUPABASE_ANON_KEY },
    });
    if (!res.ok) {
      throw new Error(`Supabase responded with ${res.status}`);
    }
  } catch (e) {
    throw new Error(
      `Local Supabase is not accessible at ${LOCAL_SUPABASE_URL}. ` +
        `Run 'npx supabase start' in WSL first.\n` +
        `Original error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function provisionTestUser(): Promise<string> {
  const adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY);

  // Delete existing test user if present (idempotent)
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existing = existingUsers.users.find((u: { email?: string }) => u.email === TEST_EMAIL);
  if (existing) {
    await adminClient.auth.admin.deleteUser(existing.id);
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to provision test user: ${error.message}`);
  }

  return data.user.id;
}

async function signInAndCaptureCookies(): Promise<string> {
  const formData = new URLSearchParams();
  formData.set("email", TEST_EMAIL);
  formData.set("password", TEST_PASSWORD);

  const res = await fetch(`${TEST_BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: TEST_BASE_URL,
    },
    body: formData.toString(),
    redirect: "manual",
  });

  const setCookieHeaders = res.headers.getSetCookie();
  if (setCookieHeaders.length === 0) {
    throw new Error(
      `Sign-in did not return Set-Cookie headers. Status: ${res.status}, ` + `Location: ${res.headers.get("location")}`,
    );
  }

  // Extract cookie name=value pairs (strip attributes like Path, HttpOnly, etc.)
  const cookies = setCookieHeaders.map((header) => header.split(";")[0]).join("; ");

  return cookies;
}

export async function setup(): Promise<void> {
  // 1. Verify local Supabase is running
  await checkLocalSupabase();

  // 2. Start Astro dev server on dedicated test port
  devServer = spawn("npx", ["astro", "dev", "--port", String(TEST_PORT)], {
    cwd: resolve(__dirname, "../../.."),
    env: {
      ...process.env,
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_KEY: LOCAL_SUPABASE_ANON_KEY,
    },
    stdio: "pipe",
    shell: true,
  });

  devServer.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString();
    if (msg.includes("ERROR") || msg.includes("Error")) {
      // eslint-disable-next-line no-console
      console.error("[test-server:stderr]", msg.trim());
    }
  });

  // 3. Wait for server readiness
  await waitForServer(TEST_BASE_URL);

  // 4. Provision test user via admin Supabase client
  const userId = await provisionTestUser();

  // 5. Sign in via running dev server to obtain session cookies
  const cookies = await signInAndCaptureCookies();

  // 6. Write test state to a shared file for test helpers
  const state = {
    baseUrl: TEST_BASE_URL,
    cookies,
    userId,
    supabaseUrl: LOCAL_SUPABASE_URL,
    supabaseServiceRoleKey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function teardown(): Promise<void> {
  // Clean up test user
  try {
    const adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY);
    const { data: users } = await adminClient.auth.admin.listUsers();
    const testUser = users.users.find((u: { email?: string }) => u.email === TEST_EMAIL);
    if (testUser) {
      await adminClient.auth.admin.deleteUser(testUser.id);
    }
  } catch {
    // Best-effort cleanup
  }

  // Kill dev server process tree (Windows shell:true creates cmd.exe wrapper)
  if (devServer?.pid) {
    try {
      // taskkill /T kills the process tree on Windows
      const { execSync } = await import("node:child_process");
      execSync(`taskkill /pid ${devServer.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // Fallback: signal-based kill
      devServer.kill("SIGKILL");
    }
  }

  // Remove state file
  try {
    rmSync(STATE_FILE);
  } catch {
    // File may not exist
  }
}
