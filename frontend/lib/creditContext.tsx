'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserSchema } from '@insforge/sdk';
import { insforge } from '@/lib/insforge';

interface CreditContextValue {
  credits: number | null;
  loading: boolean;
  user: UserSchema | null;
  refreshCredits: () => Promise<void>;
  deductCredit: () => Promise<number>;
  openPurchaseModal: () => void;
  closePurchaseModal: () => void;
  isPurchaseModalOpen: boolean;
}

const CreditContext = createContext<CreditContextValue | null>(null);

export function CreditProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserSchema | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const fetchCredits = useCallback(async () => {
    const { data: userData, error } = await insforge.auth.getCurrentUser();
    if (error || !userData.user) {
      setLoading(false);
      return;
    }

    setUser(userData.user);

    const { data } = await insforge.database
      .from('users')
      .select('credits')
      .eq('id', userData.user.id)
      .single();

    setCredits((data as { credits: number } | null)?.credits ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const deductCredit = useCallback(async (): Promise<number> => {
    const { data, error } = await insforge.database.rpc('deduct_credit');
    if (error) throw new Error(error.message || 'deduction_failed');
    const remaining = data as number;
    setCredits(remaining);
    return remaining;
  }, []);

  return (
    <CreditContext.Provider
      value={{
        credits,
        loading,
        user,
        refreshCredits: fetchCredits,
        deductCredit,
        openPurchaseModal: () => setIsPurchaseModalOpen(true),
        closePurchaseModal: () => setIsPurchaseModalOpen(false),
        isPurchaseModalOpen,
      }}
    >
      {children}
    </CreditContext.Provider>
  );
}

export function useCreditContext() {
  const ctx = useContext(CreditContext);
  if (!ctx) throw new Error('useCreditContext must be used within CreditProvider');
  return ctx;
}
