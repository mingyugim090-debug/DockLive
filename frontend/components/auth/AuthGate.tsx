'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { syncCurrentUser } from '@/lib/auth';
import { insforge } from '@/lib/insforge';

export function AuthGate({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === 'true') {
    return <>{children}</>;
  }

  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data } = await insforge.auth.getCurrentUser();
      if (!mounted) return;

      if (!data.user) {
        const next = encodeURIComponent(pathname || '/app');
        router.replace(`/auth?next=${next}`);
        return;
      }

      await syncCurrentUser(data.user);
      if (mounted) setReady(true);
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-6 text-sm font-semibold text-[#6B7280]">
        DockLive 인증을 확인하는 중입니다.
      </div>
    );
  }

  return <>{children}</>;
}
