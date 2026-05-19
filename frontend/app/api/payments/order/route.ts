import { NextRequest, NextResponse } from 'next/server';
import { CREDIT_PACKAGES, createSignedOrderId } from '@/lib/server/paymentOrder';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      amount?: number;
      userId?: string;
    };

    const amount = Number(body.amount);
    const userId = String(body.userId ?? '');
    const credits = CREDIT_PACKAGES[amount];

    if (!credits) {
      return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
    }

    const orderId = createSignedOrderId(userId, amount);
    if (!orderId) {
      return NextResponse.json({ error: 'payment_order_unavailable' }, { status: 400 });
    }

    return NextResponse.json({
      orderId,
      orderName: `LiveDock 크레딧 ${credits}개`,
    });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
