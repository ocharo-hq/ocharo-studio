import { getSsoSession, ssoUnavailable } from "./SsoAccess";
const TICKET_KEY = "ocharo-studio:integration-ticket";
export const DESK_ORIGIN =
  import.meta.env.VITE_OCHARO_PLATFORM_ORIGIN ?? "https://localhost:8264";
export interface StudioSession {
  workspaceId: string;
  userId: string;
  organizationId: string;
  canEdit: boolean;
  expiresAt: string;
}
let connectedSession: StudioSession | undefined;
export function getConnectedSession(): StudioSession | undefined {
  return connectedSession;
}
export function getIntegrationTicket(): string | null {
  try {
    return sessionStorage.getItem(TICKET_KEY);
  } catch {
    return null;
  }
}
export function setIntegrationTicket(ticket: string | null): void {
  if (ticket !== null && (!ticket.trim() || ticket.length > 8192))
    throw new Error("Enter a valid Desk connection ticket.");
  if (getSsoSession().enabled || ssoUnavailable())
    throw new Error("Use your Ocharo account to connect this app.");
  connectedSession = undefined;
  if (ticket === null) sessionStorage.removeItem(TICKET_KEY);
  else sessionStorage.setItem(TICKET_KEY, ticket.trim());
}
/** Removes credentials before validation; only Desk's configured origin and Studio audience are accepted. */
export function parseTicketFragment(
  fragment: string,
  expectedOrigin = DESK_ORIGIN,
): string | undefined {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const ticket = params.get("ocharo-ticket");
  if (ticket === null) return undefined;
  if (
    params.get("audience") !== "ocharo-studio" ||
    params.get("issuer") !== expectedOrigin ||
    !ticket.trim() ||
    ticket.length > 8192
  )
    throw new Error(
      "This connection was not issued for Studio by the configured Ocharo Desk.",
    );
  return ticket;
}
export function acceptTicketFragment(): string | undefined {
  if (!window.location.hash.includes("ocharo-ticket")) return undefined;
  const fragment = window.location.hash;
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
  if (getSsoSession().enabled || ssoUnavailable()) return undefined;
  try {
    const ticket = parseTicketFragment(fragment);
    if (ticket) setIntegrationTicket(ticket);
  } catch (cause) {
    return cause instanceof Error
      ? cause.message
      : "Desk connection was rejected.";
  }
  return undefined;
}
export async function loadStudioSession(
  fetcher: typeof fetch,
  ticket: string | null,
  signal?: AbortSignal,
): Promise<StudioSession> {
  const sso = getSsoSession();
  const response = await fetcher("/api/studio/session", {
    headers: sso.enabled ? {} : { Authorization: `Bearer ${ticket}` },
    credentials: sso.enabled ? "same-origin" : "omit",
    signal,
  });
  if (!response.ok)
    throw new Error(
      "Reconnect from Ocharo Desk. Your designs remain in this browser.",
    );
  const value = (await response.json()) as StudioSession;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !value ||
    !uuid.test(value.workspaceId) ||
    !uuid.test(value.organizationId) ||
    typeof value.userId !== "string" ||
    !value.userId ||
    typeof value.canEdit !== "boolean" ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    Date.parse(value.expiresAt) <= Date.now()
  )
    throw new Error("Invalid Desk session response.");
  connectedSession = value;
  return value;
}
