import { AuthStatus, createAuthBridge } from "@wow-two-beta/fe/auth";
import { expireIdentitySession, signOutIdentity } from "./IdentityAccess";
import {
  createStudioApi,
  throwIfInterrupted,
  type StudioSessionDto,
} from "./StudioApi";
/** The signed-in person's Ocharo membership, as `/api/studio/session` binds it. */
export type StudioSession = StudioSessionDto;
let connectedSession: StudioSession | undefined;
/** The app's one session bridge: a signed-in session expires once, on its first current 401. */
export const studioAuth = createAuthBridge<StudioSession>({
  getIdentity: (session) => `${session.organizationId}\n${session.userId}`,
});
// A 401 clears the ended credential and settles anonymous; browser recovery and local edits stay untouched.
studioAuth.subscribeUnauthorized(() => {
  connectedSession = undefined;
  expireIdentitySession();
  if (studioAuth.getSession().status !== AuthStatus.Anonymous)
    studioAuth.publishSession({ status: AuthStatus.Anonymous, user: null });
});
/** A Studio 401: the bridge signed the session out and owns its one neutral notice, so callers never warn about it. */
export class StudioSessionExpired extends Error {
  constructor() {
    super(
      "Your sign-in ended. Sign in again; your browser recovery is preserved.",
    );
    this.name = "StudioSessionExpired";
  }
}
/** Routes a Studio 401 through the bridge and returns the error its request rejects with. */
export function handleUnauthorized(): StudioSessionExpired {
  const error = new StudioSessionExpired();
  studioAuth.onUnauthorized(error);
  return error;
}
/**
 * Ends this app's Ocharo session, leaves for Identity's end-session page and settles the bridge anonymous without an expiry notice, so later 401s of the ended
 * session stay quiet. Browser recovery and local edits are untouched. Resolves `false`, changing nothing, on failure.
 */
export async function signOutStudio(
  fetcher: typeof fetch = fetch,
  navigate?: (url: string) => void,
): Promise<boolean> {
  if (!(await signOutIdentity(fetcher, navigate))) return false;
  connectedSession = undefined;
  if (studioAuth.getSession().status !== AuthStatus.Anonymous)
    studioAuth.publishSession({ status: AuthStatus.Anonymous, user: null });
  return true;
}
export function getConnectedSession(): StudioSession | undefined {
  return connectedSession;
}
export async function loadStudioSession(
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<StudioSession> {
  const result = await createStudioApi(fetcher).readSession(signal);
  if (!result.ok) {
    const { failure } = result;
    throwIfInterrupted(failure, signal);
    if (failure.status === 401) throw handleUnauthorized();
    if (failure.status === 403)
      throw new Error(
        "Your Ocharo account has no role in an organization. Your designs remain in this browser.",
      );
    if (failure.code === "protocol")
      throw new Error("Invalid studio session response.");
    throw new Error(
      "Sign in to sync this workspace. Your designs remain in this browser.",
    );
  }
  const value = result.value;
  connectedSession = value;
  studioAuth.publishSession({ status: AuthStatus.Authenticated, user: value });
  return value;
}
