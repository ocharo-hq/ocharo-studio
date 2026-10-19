/** Only CSRF metadata reaches JavaScript; delegation grants remain on the app backend. */
export interface StudioSsoSession {
  enabled: boolean;
  authenticated: boolean;
  csrfToken?: string;
  accountUrl?: string;
}
let session: StudioSsoSession = { enabled: false, authenticated: false };
let unavailable = false;
export function getSsoSession(): StudioSsoSession {
  return session;
}
export function ssoUnavailable(): boolean {
  return unavailable;
}
/** Settles the cached account state signed out after its session expired; the HttpOnly cookie stays server-owned. */
export function expireSsoSession(): void {
  if (!session.enabled || !session.authenticated) return;
  session = {
    ...(session.accountUrl ? { accountUrl: session.accountUrl } : {}),
    enabled: true,
    authenticated: false,
  };
}
export function ssoLoginUrl(path: string): string {
  const safe =
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/api/") &&
    path.length <= 2048 &&
    !/[%\\\x00-\x1f\x7f]/.test(path)
      ? path
      : "/";
  return `/api/sso/login?returnUrl=${encodeURIComponent(safe)}`;
}
function accountOrigin(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    )
      return url.origin;
  } catch {
    /* Optional metadata must never create an unsafe account link. */
  }
  return undefined;
}
export async function initializeSso(
  fetcher: typeof fetch = fetch,
): Promise<StudioSsoSession> {
  unavailable = true;
  const response = await fetcher("/api/sso/session", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      "The account session could not be checked. Refresh to reconnect.",
    );
  const body: unknown = await response.json();
  const value =
    body && typeof body === "object" && "data" in body ? body.data : undefined;
  if (
    !value ||
    typeof value !== "object" ||
    !("enabled" in value) ||
    typeof value.enabled !== "boolean" ||
    !("authenticated" in value) ||
    typeof value.authenticated !== "boolean"
  )
    throw new Error("Invalid account session response.");
  const csrf = "csrfToken" in value ? value.csrfToken : undefined;
  if (
    value.enabled &&
    value.authenticated &&
    (typeof csrf !== "string" || csrf.length < 20 || csrf.length > 512)
  )
    throw new Error("Invalid account session response.");
  const accountUrl = accountOrigin(
    "accountUrl" in value ? value.accountUrl : undefined,
  );
  session = {
    ...(accountUrl ? { accountUrl } : {}),
    enabled: value.enabled,
    authenticated: value.authenticated,
    ...(typeof csrf === "string" ? { csrfToken: csrf } : {}),
  };
  unavailable = false;
  if (session.enabled) {
    try {
      sessionStorage.removeItem("ocharo-studio:integration-ticket");
    } catch {
      /* Storage is optional. */
    }
  }
  return session;
}
