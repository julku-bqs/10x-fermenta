import type { ZodError } from "zod";

export function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonCreated(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status = 400, details?: Record<string, string[]>): Response {
  return new Response(JSON.stringify({ error: message, ...(details && { details }) }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonValidationError(zodError: ZodError): Response {
  const details: Partial<Record<string, string[]>> = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join(".");
    details[key] ??= [];
    details[key].push(issue.message);
  }
  return jsonError("Validation failed", 400, details as Record<string, string[]>);
}
