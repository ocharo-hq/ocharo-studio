import { createApp } from "vue";
import AppRouter from "./bootstrap/AppRouter.vue";
import { router } from "./bootstrap/router";
import "./bootstrap/index.css";

import { initializeSso, ssoLoginUrl } from "./integration/studio/SsoAccess";
async function start(): Promise<void> {
  try {
    const session = await initializeSso();
    if (session.enabled && !session.authenticated) {
      window.location.assign(
        ssoLoginUrl(window.location.pathname + window.location.search),
      );
      return;
    }
  } catch {
    /* Local recovery remains available; remote sync stays blocked until rechecked. */
  }
  createApp(AppRouter).use(router).mount("#root");
}
void start();
