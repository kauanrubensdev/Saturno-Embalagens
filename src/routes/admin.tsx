import { createFileRoute, redirect } from '@tanstack/react-router';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/login' });
    }
    if (context.user.role !== 'admin') {
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
