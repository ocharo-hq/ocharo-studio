import { onScopeDispose, readonly, shallowRef } from "vue";
import {
  getSsoSession,
  ssoLoginUrl,
  ssoUnavailable,
  subscribeSsoSession,
} from "../../integration/studio/SsoAccess";
import { signOutStudio } from "../../integration/studio/access";

/**
 * The Ocharo account state Studio's frame shows: whether SSO is on, who is connected, and sign-out. Only CSRF metadata
 * reaches the browser; the grant stays on the backend. Sign-in leaves the page for the account service.
 */
export function useStudioAccount() {
  const session = shallowRef(getSsoSession());
  const stop = subscribeSsoSession((next) => {
    session.value = next;
  });
  onScopeDispose(stop);
  const signingOut = shallowRef(false);

  /** Ends this app's Ocharo grant; resolves whether it ended. A second call while one runs does nothing. */
  async function signOut(): Promise<boolean> {
    if (signingOut.value) return false;
    signingOut.value = true;
    try {
      return await signOutStudio();
    } finally {
      signingOut.value = false;
    }
  }

  /** Leaves for the Ocharo sign-in, returning to this place afterwards. */
  function signIn(): void {
    window.location.assign(
      ssoLoginUrl(window.location.pathname + window.location.search),
    );
  }

  return {
    session: readonly(session),
    signingOut: readonly(signingOut),
    /** Whether the account session could not be checked at startup. */
    unavailable: ssoUnavailable(),
    signIn,
    signOut,
  };
}
