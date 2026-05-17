import { AppLayout } from '@/components/layout/AppLayout';
import { AuthGate } from '@/components/auth/AuthGate';

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppLayout>{children}</AppLayout>
    </AuthGate>
  );
}
