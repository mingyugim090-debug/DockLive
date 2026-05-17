'use client';

import { createClient } from '@insforge/sdk';

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || 'https://jtcz6q5t.us-east.insforge.app';
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || undefined;

export const insforge = createClient({
  baseUrl,
  anonKey,
});

