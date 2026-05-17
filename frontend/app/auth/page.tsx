'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { syncCurrentUser } from '@/lib/auth';
import { insforge } from '@/lib/insforge';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const value = searchParams.get('next');
    return value?.startsWith('/') ? value : '/app';
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      const { data, error: currentError } = await insforge.auth.getCurrentUser();
      if (!mounted) return;

      if (data.user) {
        await syncCurrentUser(data.user);
        router.replace(nextPath);
        return;
      }

      if (currentError && searchParams.has('insforge_code')) {
        setError(currentError.message || 'Google 로그인 처리에 실패했습니다.');
      }
      setLoading(false);
    }

    checkUser();

    return () => {
      mounted = false;
    };
  }, [nextPath, router, searchParams]);

  const signInWithGoogle = async () => {
    setSubmitting(true);
    setError(null);

    const redirectTo = `${window.location.origin}/auth?next=${encodeURIComponent(nextPath)}`;
    const { error: oauthError } = await insforge.auth.signInWithOAuth({
      provider: 'google',
      redirectTo,
    });

    if (oauthError) {
      setError(oauthError.message || 'Google 로그인을 시작하지 못했습니다.');
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-4 py-10 text-[#1F2937]">
      <section className="w-full max-w-[380px] rounded-[28px] border border-white/70 bg-white/92 px-7 py-8 text-center shadow-[0_24px_70px_rgba(31,41,55,0.12)] backdrop-blur">
        <Image
          src="/docklive-logo.svg"
          alt="DockLive"
          width={260}
          height={76}
          priority
          className="mx-auto h-auto w-[238px]"
        />

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading || submitting}
          className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#1F1F1F] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-black text-[#1F1F1F]">G</span>
          {loading ? '세션 확인 중' : submitting ? 'Google로 이동 중' : 'Google로 계속하기'}
        </button>

        {error ? <p className="mt-4 text-xs font-semibold leading-5 text-red-500">{error}</p> : null}

        <p className="mt-5 text-xs leading-5 text-[#A0A6B0]">
          계속하면 DockLive의 서비스 약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-4 py-10 text-sm font-semibold text-[#6B7280]">
          DockLive 인증을 준비하는 중입니다.
        </main>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
