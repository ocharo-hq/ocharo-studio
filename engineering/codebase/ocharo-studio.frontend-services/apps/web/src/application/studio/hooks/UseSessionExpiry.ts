import { onScopeDispose } from "vue";
import type { SessionExpiredListener } from "@wow-two-beta/fe/auth";
import { studioAuth } from "../../../integration/studio/clients/StudioAuth";

/** Calls `listener` each time the Studio session expires, until the calling scope ends. */
export function useSessionExpiry(listener: SessionExpiredListener): void {
  const stop = studioAuth.subscribeExpired(listener);
  onScopeDispose(stop);
}
