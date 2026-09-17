import { createFileRoute, redirect } from '@tanstack/react-router';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context }) => {
    const { user, profile } = context as {
      user?: { id: string } | null;
      profile?: { role: 'customer' | 'admin' } | null;
    };
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (profile?.role !== 'admin') {
      throw redirect({ to: '/account' });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <AdminLayout>
      <AdminDashboard />
    </AdminLayout>
  );
}
