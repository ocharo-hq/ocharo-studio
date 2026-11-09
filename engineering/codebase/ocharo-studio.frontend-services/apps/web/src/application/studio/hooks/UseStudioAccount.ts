import { onScopeDispose, readonly, shallowRef } from "vue";
import {
  getIdentitySession,
  hasSignInError,
  identityUnavailable,
  signInUrl,
  subscribeIdentitySession,
} from "../../../integration/studio/clients/IdentityAccess";
import { signOutStudio } from "../../../integration/studio/clients/StudioAuth";

/**
 * The Ocharo account state Studio's frame shows: whether someone is signed in, who, and sign-out. Only CSRF metadata
 * reaches the browser; the tokens stay on the backend. Sign-in leaves the page for the account service.
 */
export function useStudioAccount() {
  const session = shallowRef(getIdentitySession());
  const stop = subscribeIdentitySession((next) => {
    session.value = next;
  });
  onScopeDispose(stop);
  const signingOut = shallowRef(false);

  /** Ends this app's Ocharo session; resolves whether it ended. A second call while one runs does nothing. */
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
      signInUrl(window.location.pathname + window.location.search),
    );
  }

  return {
    session: readonly(session),
    signingOut: readonly(signingOut),
    /** Whether the account session could not be checked at startup. */
    unavailable: identityUnavailable(),
    /** Whether the Ocharo sign-in this page returned from failed; read on demand. */
    get signInFailed(): boolean {
      return hasSignInError();
    },
    signIn,
    signOut,
  };
}
