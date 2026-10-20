import {
  createAppRouter,
  lazyRoute,
  type RouteConfig,
  type RouterHistoryMode,
} from "@wow-two-beta/fe/router";
import RouteMessage from "./RouteMessage.vue";

/**
 * The landing introduction and the missing page render on their own; the Designer and Materials places render inside
 * the Ocharo frame, mounted through the `/studio` layout route. Both places share one editor component, so moving
 * between them keeps the open design, its unsaved material edits and the navigation guard.
 */
export const studioRoutes: RouteConfig = [
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
    path: "/studio",
    lazy: lazyRoute(() => import("./AppLayout.vue")),
    children: [
      {
        index: true,
        lazy: lazyRoute(() => import("./App.vue")),
        handle: {
          title: "Design studio",
          label: "Designer",
          section: "designer",
          meta: {
            description:
              "Choose a garment, place your textiles, and save a new look in Ocharo Studio.",
          },
        },
      },
      {
        path: "materials",
        lazy: lazyRoute(() => import("./App.vue")),
        handle: {
          title: "Material Studio",
          label: "Materials",
          section: "materials",
          meta: {
            description:
              "Preview and edit a textile's shared motif scale across every saved look.",
          },
        },
      },
    ],
  },
  { path: "/materials", redirect: "/studio/materials" },
  { path: "/editor", redirect: "/studio" },
  { path: "*", component: RouteMessage, handle: { title: "Page not found" } },
];

/** Creates Studio's router; tests pass memory history. */
export function createStudioRouter(
  options: { history?: RouterHistoryMode } = {},
) {
  return createAppRouter(studioRoutes, {
    titleSuffix: "Ocharo Studio",
    routePersistence: false,
    ...options,
  });
}

export const router = createStudioRouter();
