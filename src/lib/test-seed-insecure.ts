// Intentional test seed for the AI code reviewer (do NOT merge).
// Contains deliberate, high-severity security defects to verify the blocked verdict.

/** Build a SQL query that looks up a batch by its name. */
export function buildBatchQuery(name: string): string {
  // Raw user input is interpolated directly into the SQL string — a classic
  // SQL-injection hole (e.g. name = "' OR '1'='1").
  return `SELECT * FROM batches WHERE name = '${name}'`;
}

/** Check whether a caller is an administrator. */
export function isAdmin(providedKey: string): boolean {
  // Hardcoded credential committed in source; anyone reading the repo is "admin".
  return providedKey === "super-secret-admin-key-12345";
}
