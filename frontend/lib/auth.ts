'use client';

import { insforge } from '@/lib/insforge';

type InsForgeUser = {
  id: string;
  email?: string | null;
  providers?: string[];
  profile?: {
    name?: string | null;
    avatar_url?: string | null;
    avatarUrl?: string | null;
    picture?: string | null;
  } | null;
  metadata?: Record<string, unknown> | null;
};

export async function syncCurrentUser(user: InsForgeUser) {
  const name =
    user.profile?.name ||
    (typeof user.metadata?.name === 'string' ? user.metadata.name : null) ||
    (user.email ? user.email.split('@')[0] : null);
  const avatarUrl =
    user.profile?.avatar_url ||
    user.profile?.avatarUrl ||
    user.profile?.picture ||
    (typeof user.metadata?.avatar_url === 'string' ? user.metadata.avatar_url : null) ||
    (typeof user.metadata?.picture === 'string' ? user.metadata.picture : null);
  const provider = user.providers?.[0] || 'google';

  try {
    await insforge.auth.setProfile({
      name,
      avatar_url: avatarUrl,
    });
  } catch {
    // Profile sync should never block sign-in.
  }

  try {
    await insforge.database.from('users').upsert(
      [
        {
          id: user.id,
          email: user.email,
          name,
          avatar_url: avatarUrl,
          provider,
          metadata: user.metadata || {},
          last_sign_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'id' },
    );
  } catch {
    // App-level user metadata can be retried on the next session check.
  }
}
