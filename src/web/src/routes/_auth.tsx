import { Suspense } from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AuthGuard } from '../components/AuthGuard';
import { MainLayout } from '../components/layouts/MainLayout';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <AuthGuard>
      <MainLayout>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </MainLayout>
    </AuthGuard>
  );
}
