import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { RootRouteContext } from "./routes/__root";

export const getRouter = (initialAuth?: RootRouteContext['auth']) => {
  const router = createRouter({
    routeTree,
    context: {
      // Contexto inicial fornecido pelo AuthProvider via RouterProvider.
      // Inicializa como não-pronto para que os guards aguardem.
      auth: initialAuth ?? {
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

/**
 * Referência global ao router — usada para forçar reavaliação
 * dos guards após login/logout quando o contexto React muda
 * mas o router precisa atualizar seus guards.
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
