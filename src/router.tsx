import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {
      // Contexto inicial — será sobrescrito pelo beforeLoad do root route
      // antes de qualquer beforeLoad de rota filha.
      user: null,
      profile: null,
    },
    defaultPreloadStaleTime: 0,
  });

  return router;
};

/**
 * Referência global ao router — usada para forçar recomputação
 * do contexto de autenticação (root beforeLoad) após login/logout.
 * Definida em start.ts via routerState.subscribe.
 */
let currentRouter: ReturnType<typeof getRouter> | null = null;

export const invalidateRouter = () => {
  if (currentRouter) {
    currentRouter.invalidate();
  }
};

export const setRouterInstance = (router: ReturnType<typeof getRouter>) => {
  currentRouter = router;
};
