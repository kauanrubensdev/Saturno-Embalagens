import { StrictMode, startTransition, useEffect, useRef } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { RouterProvider, type AnyRouter } from '@tanstack/react-router';
import { hydrateStart } from '@tanstack/react-start/client';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

function AuthenticatedRouter({ router }: { router: AnyRouter }) {
  const auth = useAuth();
  const previousAuthKey = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.authReady) return;

    const authKey = `${auth.user?.id ?? 'signed-out'}:${auth.profile?.role ?? 'no-profile'}`;
    if (previousAuthKey.current === authKey) return;

    previousAuthKey.current = authKey;
    void router.invalidate();
  }, [auth.authReady, auth.profile?.role, auth.user?.id, router]);

  return <RouterProvider router={router} context={{ auth }} />;
}

void hydrateStart().then((router) => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <AuthProvider>
          <AuthenticatedRouter router={router} />
        </AuthProvider>
      </StrictMode>,
    );
  });
});