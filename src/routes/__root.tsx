import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/toaster';
import styles from '@/styles.css?url';
import { useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { getCurrentUser, getProfile } from '@/lib/auth';
import type { AuthUser, Profile } from '@/types/auth';

export interface RootRouteContext {
  user: AuthUser | null;
  profile: Profile | null;
}

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  beforeLoad: async () => {
    // Executa ANTES dos beforeLoad de /account e /admin —
    // assim context.user já está disponível quando os guards verificam.
    const user = await getCurrentUser();
    const profile = user ? await getProfile() : null;
    return { user, profile };
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
