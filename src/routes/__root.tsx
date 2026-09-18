import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/toaster';
import styles from '@/styles.css?url';
import { useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import type { AuthUser, Profile } from '@/types/auth';

export interface RootRouteContext {
  auth: {
    authReady: boolean;
    user: AuthUser | null;
    profile: Profile | null;
    isAdmin: boolean;
  };
}

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  beforeLoad: async ({ context }) => {
    // O contexto do router recebe o estado de auth diretamente da mesma
    // fonte React usada pelos componentes — não faz chamada separada.
    // O componente RootLayoutForAuth fornece esse contexto via RouterProvider.
    return {
      auth: context.auth ?? {
        authReady: false,
        user: null,
        profile: null,
        isAdmin: false,
      },
    };
  },
  component: RootLayout,
});

function RootLayout() {
  const { theme, mounted } = useTheme();

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, mounted]);

  return (
    <html lang="pt-BR" data-theme={mounted ? theme : 'dark'}>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

// ============================================================
// Componente wrapper que injeta o contexto de auth no Router.
// DEVE envolver o RouterProvider no entry point.
// ============================================================
export function RootLayoutForAuth({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}

import type { ReactNode } from 'react';
