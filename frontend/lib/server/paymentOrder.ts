import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const CREDIT_PACKAGES: Record<number, number> = {
  4900: 10,
  9900: 25,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function paymentOrderSecret() {
  return process.env.PAYMENT_ORDER_SECRET || process.env.TOSS_SECRET_KEY || process.env.INSFORGE_API_KEY || '';
}

export function compactUserId(userId: string) {
  if (!UUID_RE.test(userId)) return null;
  return userId.replace(/-/g, '').toLowerCase();
}

export function expandUserId(compact: string) {
  if (!/^[0-9a-f]{32}$/i.test(compact)) return null;
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join('-');
}

function signOrder(compactId: string, createdAt: string, nonce: string, amount: number, secret: string) {
  return createHmac('sha256', secret)
    .update(`${compactId}.${createdAt}.${nonce}.${amount}`)
    .digest('base64url')
    .slice(0, 12);
}

export function createSignedOrderId(userId: string, amount: number) {
  const secret = paymentOrderSecret();
  const compactId = compactUserId(userId);
  if (!secret || !compactId || !CREDIT_PACKAGES[amount]) return null;

  const createdAt = Math.floor(Date.now() / 1000).toString(36);
  const nonce = randomBytes(6).toString('base64url').replace(/[^0-9a-z]/gi, '').slice(0, 6).padEnd(6, '0');
  const signature = signOrder(compactId, createdAt, nonce, amount, secret);
  return `ld_${compactId}_${createdAt}_${nonce}_${signature}`;
}

export function verifySignedOrderId(orderId: string, amount: number) {
  const secret = paymentOrderSecret();
  if (!secret || !CREDIT_PACKAGES[amount]) return null;

  const [prefix, compactId, createdAt, nonce, signature] = orderId.split('_');
  if (
    prefix !== 'ld' ||
    !compactId ||
    !createdAt ||
    !nonce ||
    !signature ||
    !/^[0-9a-f]{32}$/i.test(compactId) ||
    !/^[0-9a-z]+$/i.test(createdAt) ||
    !/^[0-9a-z]{6}$/i.test(nonce)
  ) {
    return null;
  }

  const expected = signOrder(compactId.toLowerCase(), createdAt, nonce, amount, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  const createdSeconds = Number.parseInt(createdAt, 36);
  if (!Number.isFinite(createdSeconds) || Math.floor(Date.now() / 1000) - createdSeconds > 60 * 60 * 2) {
    return null;
  }

  return {
    userId: expandUserId(compactId.toLowerCase()),
    creditsToAdd: CREDIT_PACKAGES[amount],
  };
}
