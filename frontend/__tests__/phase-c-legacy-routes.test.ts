import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const retiredRoutes = [
  ['app/app/workspace/page.tsx', 'legacy/phase-c-routes/app-workspace-page.tsx'],
  ['app/app/projects/page.tsx', 'legacy/phase-c-routes/app-projects-page.tsx'],
  ['app/app/documents/page.tsx', 'legacy/phase-c-routes/app-documents-page.tsx'],
  ['app/app/documents/[id]/page.tsx', 'legacy/phase-c-routes/app-documents-id-page.tsx'],
  ['app/app/templates/page.tsx', 'legacy/phase-c-routes/app-templates-page.tsx'],
  ['app/app/billing/page.tsx', 'legacy/phase-c-routes/app-billing-page.tsx'],
  ['app/app/settings/page.tsx', 'legacy/phase-c-routes/app-settings-page.tsx'],
] as const;

describe('Phase C legacy route files', () => {
  it('keeps retired route code outside the active app route tree', () => {
    for (const [activeRoute, legacyCopy] of retiredRoutes) {
      expect(existsSync(path.join(root, activeRoute)), `${activeRoute} should be removed from active routes`).toBe(false);
      expect(existsSync(path.join(root, legacyCopy)), `${legacyCopy} should preserve retired code`).toBe(true);
    }
  });

  it('provides account landing pages for redirected billing and settings links', () => {
    expect(existsSync(path.join(root, 'app/account/billing/page.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'app/account/settings/page.tsx'))).toBe(true);
  });
});
