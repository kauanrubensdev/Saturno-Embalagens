import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { getCurrentUser, getProfile } from "./lib/auth";
import type { AuthUser, Profile } from "./types/auth";

export interface RouterContext {
  user: AuthUser | null;
  profile: Profile | null;
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {
      user: null as AuthUser | null,
      profile: null as Profile | null,
    },
    defaultPreloadStaleTime: 0,
    wrapLoader: (loader) => async ({ context }) => {
      // Always fetch the current session from Supabase — do not rely on
      // cached context.user which stays null after initial boot.
      const user = await getCurrentUser();
      const profile = user ? await getProfile() : null;
      return loader({ context: { ...context, user, profile } });
    },
  });

  return router;
};
