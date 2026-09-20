import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/toaster';
import styles from '@/styles.css?url';
import { useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { Profile } from '@/types/auth';
import type { User } from '@supabase/supabase-js';

export interface RootRouteContext {
  auth: {
    authReady: boolean;
    user: User | null;
    profile: Profile | null;
    isAdmin: boolean;
  };
}

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: styles }],
  }),
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
