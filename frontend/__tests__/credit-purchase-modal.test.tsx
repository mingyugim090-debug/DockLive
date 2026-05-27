import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditPurchaseModal } from '@/components/credits/CreditPurchaseModal';

const tossMocks = vi.hoisted(() => ({
  loadTossPayments: vi.fn(),
  widgets: {
    setAmount: vi.fn(),
    renderPaymentMethods: vi.fn(),
    renderAgreement: vi.fn(),
    requestPayment: vi.fn(),
  },
}));

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: '@@ANONYMOUS',
  loadTossPayments: tossMocks.loadTossPayments,
}));

describe('CreditPurchaseModal TossPayments widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_TOSS_CLIENT_KEY', 'test_client_key');
    vi.stubEnv('NEXT_PUBLIC_TOSS_PAYMENT_WIDGET_VARIANT_KEY', 'DEFAULT');
    vi.stubEnv('NEXT_PUBLIC_TOSS_AGREEMENT_WIDGET_VARIANT_KEY', 'AGREEMENT');
    tossMocks.widgets.setAmount.mockResolvedValue(undefined);
    tossMocks.widgets.renderPaymentMethods.mockResolvedValue(undefined);
    tossMocks.widgets.renderAgreement.mockResolvedValue(undefined);
    tossMocks.widgets.requestPayment.mockResolvedValue(undefined);
    tossMocks.loadTossPayments.mockResolvedValue({
      widgets: () => tossMocks.widgets,
    });
  });

  it('keeps payment available when widget variants need fallback', async () => {
    const user = userEvent.setup();
    tossMocks.widgets.renderPaymentMethods
      .mockRejectedValueOnce(new Error('invalid_variant'))
      .mockResolvedValueOnce(undefined);
    tossMocks.widgets.renderAgreement.mockRejectedValueOnce(new Error('agreement_variant_missing'));

    render(
      <CreditPurchaseModal
        onClose={vi.fn()}
        userId="12345678-1234-5678-90ab-cdef12345678"
        userEmail="user@example.com"
        userName="테스트 사용자"
      />,
    );

    await user.click(screen.getByRole('button', { name: /10 크레딧 4,900원/i }));

    const payButton = await screen.findByRole('button', { name: '4,900원 결제하기' });
    await waitFor(() => expect(payButton).toBeEnabled());

    expect(tossMocks.loadTossPayments).toHaveBeenCalledWith('test_client_key');
    expect(tossMocks.widgets.setAmount).toHaveBeenCalledWith({ currency: 'KRW', value: 4900 });
    expect(tossMocks.widgets.renderPaymentMethods).toHaveBeenCalledTimes(2);
    expect(tossMocks.widgets.renderPaymentMethods.mock.calls[1][0]).toEqual({
      selector: '#toss-payment-method',
    });
  });
});
