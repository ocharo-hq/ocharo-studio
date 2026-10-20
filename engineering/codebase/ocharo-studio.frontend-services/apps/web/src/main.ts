import { createApp } from "vue";
import AppRouter from "./bootstrap/AppRouter.vue";
import { router } from "./bootstrap/router";
import "./bootstrap/index.css";

import {
  loadOcharoApps,
  ocharoAppsPlugin,
  reportOcharoAppsStartup,
} from "./application/common/UseOcharoApps";
import { initializeSso, ssoLoginUrl } from "./integration/studio/SsoAccess";

async function start(): Promise<void> {
  // The app links load beside the account check within a bounded wait; the landing page can open the frame in place,
  // so every entry resolves them. A failure keeps the build-time addresses.
  const links = loadOcharoApps().catch(() => null);
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
  const app = createApp(AppRouter).use(router);
  const startup = await links;
  if (startup) {
    app.use(ocharoAppsPlugin(startup));
    reportOcharoAppsStartup(startup);
  }
  app.mount("#root");
}
void start();
