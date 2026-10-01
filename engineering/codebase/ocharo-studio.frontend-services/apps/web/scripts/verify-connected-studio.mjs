// Read-only cross-app checks. Supply a short-lived ticket through a private file or environment.
// NODE_EXTRA_CA_CERTS=<trusted local CA> OCHARO_STUDIO_API=https://localhost:8348 OCHARO_STUDIO_TICKET_FILE=<private path> node scripts/verify-connected-studio.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = new URL(process.env.OCHARO_STUDIO_API ?? "https://localhost:8260");
assert.equal(base.protocol, "https:", "Connected review requires HTTPS.");
const ticket = process.env.OCHARO_STUDIO_TICKET_FILE
  ? (await readFile(process.env.OCHARO_STUDIO_TICKET_FILE, "utf8")).trim()
  : process.env.OCHARO_STUDIO_TICKET;
assert.ok(
  ticket,
  "Supply a five-minute ocharo-studio ticket without putting it in command arguments.",
);
const request = (path, init = {}) => fetch(new URL(path, base), init);
const anonymous = await request("/api/studio/state", {
  headers: { "X-Studio-Workspace": crypto.randomUUID() },
});
assert.equal(anonymous.status, 401, "UUID alone must not authorize storage.");
const invalid = await request("/api/studio/session", {
  headers: { Authorization: "Bearer invalid-review-ticket" },
});
assert.equal(invalid.status, 401, "A fabricated ticket must be rejected.");
const authorization = { Authorization: `Bearer ${ticket}` };
const sessionResponse = await request("/api/studio/session", {
  headers: authorization,
});
assert.equal(
  sessionResponse.status,
  200,
  "Desk ticket must introspect successfully.",
);
assert.equal(sessionResponse.headers.get("cache-control"), "no-store");
const session = await sessionResponse.json();
assert.ok(session.organizationId && session.userId && session.workspaceId);
const state = await request("/api/studio/state", {
  headers: { ...authorization, "X-Studio-Workspace": session.workspaceId },
});
assert.equal(state.status, 200);
assert.equal(state.headers.get("cache-control"), "no-store");
const mismatch = await request("/api/studio/state", {
  headers: { ...authorization, "X-Studio-Workspace": crypto.randomUUID() },
});
assert.equal(
  mismatch.status,
  403,
  "A member must not select another workspace UUID.",
);
console.log(
  "PASS: Desk session introspection, HTTPS, no-store, UUID rejection and workspace isolation. No state was written.",
);
