import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { RootRouteContext } from "./routes/__root";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {
      auth: {
        authReady: false,
        user: null,
        profile: null,
        isAdmin: false,
      },
    },
    defaultPreloadStaleTime: 0,
  });

  return router;
};
