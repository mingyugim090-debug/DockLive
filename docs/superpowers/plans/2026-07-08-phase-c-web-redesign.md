# Phase C Web Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Phase C cleanup for the DockLive web redesign by redirecting legacy routes, preserving old pages outside active routing, aligning visible copy, fixing the active frontend build error, and deploying the verified frontend.

**Architecture:** Keep the Phase A/B six-step project pipeline as the only active app surface under `/app` and `/app/p/:id/*`. Use `next.config.mjs` redirects for retired URLs so old links do not render stale pages. Move retired app route files into `frontend/legacy/phase-c-routes/` for rollback visibility without keeping them in the Next.js route tree.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Vitest, Testing Library, repository harness frontend profile, Vercel deployment.

---

### Task 1: Legacy Redirect Contract

**Files:**
- Modify: `frontend/next.config.mjs`
- Create: `frontend/__tests__/phase-c-redirects.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import nextConfig from '@/../next.config.mjs';

describe('Phase C legacy redirects', () => {
  it('redirects retired app routes to the project pipeline IA targets', async () => {
    const redirects = await nextConfig.redirects();
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: '/app/workspace', destination: '/app/new?mode=form', permanent: true },
        { source: '/app/projects', destination: '/app', permanent: true },
        { source: '/app/documents', destination: '/app', permanent: true },
        { source: '/app/documents/:id', destination: '/app/p/:id/6-export', permanent: true },
        { source: '/app/templates', destination: '/app/new?mode=form', permanent: true },
        { source: '/app/billing', destination: '/account/billing', permanent: true },
        { source: '/app/settings', destination: '/account/settings', permanent: true },
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- phase-c-redirects.test.ts`
Expected: FAIL because `nextConfig.redirects` is not defined.

- [ ] **Step 3: Implement minimal redirect config**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/app/workspace', destination: '/app/new?mode=form', permanent: true },
      { source: '/app/projects', destination: '/app', permanent: true },
      { source: '/app/documents', destination: '/app', permanent: true },
      { source: '/app/documents/:id', destination: '/app/p/:id/6-export', permanent: true },
      { source: '/app/templates', destination: '/app/new?mode=form', permanent: true },
      { source: '/app/billing', destination: '/account/billing', permanent: true },
      { source: '/app/settings', destination: '/account/settings', permanent: true },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- phase-c-redirects.test.ts`
Expected: PASS.

### Task 2: Legacy Route Preservation

**Files:**
- Move: `frontend/app/app/workspace/page.tsx` to `frontend/legacy/phase-c-routes/app-workspace-page.tsx`
- Move: `frontend/app/app/projects/page.tsx` to `frontend/legacy/phase-c-routes/app-projects-page.tsx`
- Move: `frontend/app/app/documents/page.tsx` to `frontend/legacy/phase-c-routes/app-documents-page.tsx`
- Move: `frontend/app/app/documents/[id]/page.tsx` to `frontend/legacy/phase-c-routes/app-documents-id-page.tsx`
- Move: `frontend/app/app/templates/page.tsx` to `frontend/legacy/phase-c-routes/app-templates-page.tsx`
- Move: `frontend/app/app/billing/page.tsx` to `frontend/legacy/phase-c-routes/app-billing-page.tsx`
- Move: `frontend/app/app/settings/page.tsx` to `frontend/legacy/phase-c-routes/app-settings-page.tsx`
- Create: `frontend/app/account/billing/page.tsx`
- Create: `frontend/app/account/settings/page.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

describe('Phase C legacy route files', () => {
  it('keeps retired route code outside the active app route tree', () => {
    expect(existsSync(path.join(root, 'legacy/phase-c-routes/app-workspace-page.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'legacy/phase-c-routes/app-projects-page.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'app/app/workspace/page.tsx'))).toBe(false);
    expect(existsSync(path.join(root, 'app/app/projects/page.tsx'))).toBe(false);
  });

  it('provides account landing pages for redirected billing and settings links', () => {
    expect(existsSync(path.join(root, 'app/account/billing/page.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'app/account/settings/page.tsx'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- phase-c-legacy-routes.test.ts`
Expected: FAIL because legacy files and `/account/*` pages do not exist yet.

- [ ] **Step 3: Move files and add small account pages**

Use `Move-Item -LiteralPath` inside `frontend/` for route files. Add account pages that link back to `/app` and preserve the existing settings or billing component only if it does not resurrect a retired app navigation menu.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- phase-c-legacy-routes.test.ts`
Expected: PASS.

### Task 3: Copy And Build Error Cleanup

**Files:**
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/components/landing/HeroSection.tsx`
- Modify: `frontend/components/landing/PainSection.tsx`
- Modify: `frontend/components/landing/SocialProofSection.tsx`
- Modify: `frontend/components/layout/AppLayout.tsx`
- Modify if needed: `frontend/app/app/p/[id]/[stage]/page.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

describe('Phase C copy cleanup', () => {
  it('keeps landing CTAs pointed at the new project entry', () => {
    const home = read('app/page.tsx') + read('components/landing/HeroSection.tsx');
    expect(home).toContain('/app/new');
    expect(home).not.toContain('/auth?next=/app');
  });

  it('does not expose internal fixture or pipeline wording on landing copy', () => {
    const landing = [
      'components/landing/HeroSection.tsx',
      'components/landing/PainSection.tsx',
      'components/landing/SocialProofSection.tsx',
    ].map(read).join('\n');
    expect(landing).not.toMatch(/\bfixture\b/i);
    expect(landing).not.toMatch(/\bpipeline\b/i);
    expect(landing).not.toContain('LiveDock');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- phase-c-copy.test.ts`
Expected: FAIL while old CTAs or internal words remain.

- [ ] **Step 3: Update copy and the active TypeScript payload mismatch**

Change landing CTAs to `/app/new`, replace `LiveDock` with `DockLive`, replace internal "fixture/pipeline" wording with user-language proof labels, and ensure calls to `saveWorkflowInputs` pass `field_id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- phase-c-copy.test.ts`
Expected: PASS.

### Task 4: Verification And Deployment

**Files:**
- Modify if needed: `harness/errors/registry.json`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- phase-c-redirects.test.ts phase-c-legacy-routes.test.ts phase-c-copy.test.ts`
Expected: PASS.

- [ ] **Step 2: Run frontend gate**

Run from repository root: `.\scripts\harness.ps1 -Profile frontend`
Expected: PASS for frontend tests and production build.

- [ ] **Step 3: Deploy**

Run from `frontend/`: use the repository's Vercel deployment command or configured Vercel tool after confirming credentials. Expected: a successful production deployment URL.

- [ ] **Step 4: Smoke-check deployed routes**

Open the deployed site and verify `/`, `/app/new`, `/app`, and one legacy redirect such as `/app/projects` resolve to the intended pages.
