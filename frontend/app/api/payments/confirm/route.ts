import { NextRequest, NextResponse } from 'next/server';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? '';
const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL ?? '';
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY ?? '';

// Map expected amounts to credit quantities
const CREDIT_PACKAGES: Record<number, number> = {
  4900: 10,
  9900: 25,
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      paymentKey?: string;
      orderId?: string;
      amount?: number;
    };

    const { paymentKey, orderId, amount } = body;

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    const creditsToAdd = CREDIT_PACKAGES[amount];
    if (!creditsToAdd) {
      return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
    }

    // orderId format: livedock_{userId}_{base36Timestamp}_{random}
    const parts = orderId.split('_');
    if (parts[0] !== 'livedock' || parts.length < 4) {
      return NextResponse.json({ error: 'invalid_order_id' }, { status: 400 });
    }
    const userId = parts[1];

    // 1. Confirm payment with Toss Payments API
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')}`,
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const err = (await tossRes.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json(
        { error: err.message ?? 'payment_confirm_failed' },
        { status: 400 },
      );
    }

    // 2. Record payment and add credits atomically via InsForge admin RPC
    const rpcRes = await fetch(`${INSFORGE_BASE_URL}/rest/v1/rpc/record_payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: INSFORGE_API_KEY,
        Authorization: `Bearer ${INSFORGE_API_KEY}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_payment_key: paymentKey,
        p_order_id: orderId,
        p_amount: amount,
        p_credits_added: creditsToAdd,
      }),
    });

    if (!rpcRes.ok) {
      return NextResponse.json({ error: 'credit_update_failed' }, { status: 500 });
    }

    const newCredits = (await rpcRes.json()) as number;
    return NextResponse.json({ success: true, credits: newCredits, creditsAdded: creditsToAdd });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
