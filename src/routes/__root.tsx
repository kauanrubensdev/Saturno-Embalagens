import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/toaster';
import styles from '@/styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
