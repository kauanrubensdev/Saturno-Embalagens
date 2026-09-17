import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { getCurrentUser, getProfile } from "./lib/auth";
import type { AuthUser, Profile } from "./types/auth";

export interface RouterContext {
  queryClient: QueryClient;
  user: AuthUser | null;
  profile: Profile | null;
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: {
      queryClient,
      user: null,
      profile: null,
    },
    defaultPreloadStaleTime: 0,
    wrapLoader: (loader) => async ({ context }) => {
      const user = await getCurrentUser();
      const profile = await getProfile();
      return loader({ context: { ...context, user, profile } });
    },
  });

  return router;
};
