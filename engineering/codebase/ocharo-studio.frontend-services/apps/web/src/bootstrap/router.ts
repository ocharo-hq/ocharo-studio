import { createAppRouter, lazyRoute } from "@wow-two-beta/ui-vue/router";
import RouteMessage from "./RouteMessage.vue";

export const router = createAppRouter(
  [
    {
      path: "/",
      lazy: lazyRoute(
        () => import("../presentation/studio/landing/LandingPage.vue"),
      ),
      handle: {
        title: "Tradition, reimagined",
        meta: {
          description:
            "A silhouette. A textile. Your own expression. Explore Uzbek-inspired clothing in Ocharo's 3D creative studio.",
        },
      },
    },
    {
      path: "/studio/materials",
      lazy: lazyRoute(() => import("./App.vue")),
      handle: {
        title: "Material Studio",
        meta: {
          description:
            "Preview and edit a textile's shared motif scale across every saved look.",
        },
      },
    },
    { path: "/materials", redirect: "/studio/materials" },
    {
      path: "/studio",
      lazy: lazyRoute(() => import("./App.vue")),
      handle: {
        title: "Design studio",
        meta: {
          description:
            "Choose a garment, place your textiles, and save a new look in Ocharo Studio.",
        },
      },
    },
    { path: "/editor", redirect: "/studio" },
    { path: "*", component: RouteMessage, handle: { title: "Page not found" } },
  ],
  { titleSuffix: "Ocharo Studio", routePersistence: false },
);
