/** Only CSRF metadata and the person's display identity reach JavaScript; the tokens stay on the app backend. */
export interface StudioIdentitySession {
  authenticated: boolean;
  csrfToken?: string;
  /** The person's current display name, while authenticated; absent when Identity sends none. */
  name?: string;
  /** The person's current email, while authenticated; absent when Identity sends none. */
  email?: string;
}
let session: StudioIdentitySession = { authenticated: false };
let unavailable = false;
const listeners = new Set<(session: StudioIdentitySession) => void>();
/** Replaces the cached account state and tells every subscriber, so the frame and editor follow sign-out. */
function settle(next: StudioIdentitySession): void {
  session = next;
  for (const listener of listeners) listener(next);
}
export function getIdentitySession(): StudioIdentitySession {
  return session;
}
/** Follows every change of the cached account state; returns the unsubscribe. */
export function subscribeIdentitySession(
  listener: (session: StudioIdentitySession) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function identityUnavailable(): boolean {
  return unavailable;
}
/** Settles the cached account state signed out after its session expired; the HttpOnly cookie stays server-owned. */
export function expireIdentitySession(): void {
  if (!session.authenticated) return;
  settle({ authenticated: false });
}
/** Identity's end-session address, only as an absolute http(s) URL without credentials; anything else reads as absent. */
function safeEndSessionUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    /* An unparsable address falls back to the app root. */
  }
  return undefined;
}
/**
 * Ends this app's session through `POST /api/identity/sign-out` with the session's CSRF token, then leaves for
 * Identity's end-session page, or `/` when it names none that is safe. Resolves `true` once the session is ended, after
 * which the cached state reads signed out; any failure keeps the session as it was. Browser recovery and local edits
 * are untouched.
 */
export async function signOutIdentity(
  fetcher: typeof fetch = fetch,
  navigate: (url: string) => void = (url) => window.location.assign(url),
): Promise<boolean> {
  const current = session;
  if (!current.authenticated || !current.csrfToken) return false;
  let destination: string | undefined;
  try {
    const response = await fetcher("/api/identity/sign-out", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Csrf-Token": current.csrfToken },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return false;
    const body: unknown = await response.json().catch(() => null);
    const data =
      body && typeof body === "object" && "data" in body ? body.data : null;
    destination = safeEndSessionUrl(
      data && typeof data === "object" && "endSessionUrl" in data
        ? data.endSessionUrl
        : undefined,
    );
  } catch {
    return false;
  }
  settle({ authenticated: false });
  navigate(destination ?? "/");
  return true;
}
/** The query parameter the BFF adds to the return address when a sign-in callback failed. */
const SignInErrorParameter = "signInError";
/** Whether `search` carries the BFF's mark of a failed sign-in callback. */
export function hasSignInError(search = window.location.search): boolean {
  return new URLSearchParams(search).has(SignInErrorParameter);
}
export function signInUrl(path: string): string {
  const safe =
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !/^\/api(?:[/?#]|$)/i.test(path) &&
    path.length <= 2048 &&
    !/[%\\\x00-\x1f\x7f]/.test(path)
      ? path
      : "/";
  // A sign-in that failed moments ago is not carried into the next one.
  const url = new URL(safe, "https://studio.invalid");
  url.searchParams.delete(SignInErrorParameter);
  return `/api/identity/sign-in?returnUrl=${encodeURIComponent(url.pathname + url.search + url.hash)}`;
}
/** The longest name and email the menu shows, as the backend bounds them. @internal */
const IdentityLimit = { Name: 200, Email: 256 } as const;
/** A display value the session may carry: trimmed, non-empty, bounded and free of control characters. */
function displayable(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && text.length <= maximum && !/[\x00-\x1f\x7f-\x9f]/.test(text)
    ? text
    : undefined;
}
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
export async function initializeIdentity(
  fetcher: typeof fetch = fetch,
): Promise<StudioIdentitySession> {
  unavailable = true;
  const response = await fetcher("/api/identity/session", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      "The account session could not be checked. Refresh to reconnect.",
    );
  const value = record(record(await response.json())?.data);
  if (!value || typeof value.isAuthenticated !== "boolean")
    throw new Error("Invalid account session response.");
  if (!value.isAuthenticated) {
    unavailable = false;
    settle({ authenticated: false });
    return session;
  }
  const csrf = value.csrfToken;
  const person = record(value.person);
  if (
    typeof csrf !== "string" ||
    csrf.length < 20 ||
    csrf.length > 512 ||
    typeof person?.sub !== "string" ||
    !person.sub
  )
    throw new Error("Invalid account session response.");
  const name = displayable(person.name, IdentityLimit.Name);
  const email = displayable(person.email, IdentityLimit.Email);
  unavailable = false;
  settle({
    authenticated: true,
    csrfToken: csrf,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
  });
  return session;
}
