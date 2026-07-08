import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

describe('Phase C copy cleanup', () => {
  it('keeps landing CTAs pointed at the new project entry', () => {
    const home = read('app/page.tsx') + read('components/landing/HeroSection.tsx');

    expect(home).toContain('/app/new');
    expect(home).not.toContain('/auth?next=/app');
  });

  it('does not expose internal fixture, pipeline, or old brand wording on landing copy', () => {
    const landing = [
      'components/landing/HeroSection.tsx',
      'components/landing/PainSection.tsx',
      'components/landing/SocialProofSection.tsx',
    ]
      .map(read)
      .join('\n');

    expect(landing).not.toMatch(/\bfixture\b/i);
    expect(landing).not.toMatch(/\bpipeline\b/i);
    expect(landing).not.toContain('LiveDock');
  });

  it('uses account routes for account navigation', () => {
    const sidebar = read('components/layout/Sidebar.tsx');
    const appLayout = read('components/layout/AppLayout.tsx');

    expect(sidebar).toContain('href="/account/billing"');
    expect(sidebar).toContain('href="/account/settings"');
    expect(sidebar).not.toContain('href="/app/billing"');
    expect(sidebar).not.toContain('href="/app/settings"');
    expect(appLayout).toContain("['/account/billing'");
    expect(appLayout).toContain("['/account/settings'");
  });

  it('keeps preserved legacy pages out of production type checking', () => {
    const tsconfig = JSON.parse(read('tsconfig.json')) as { exclude?: string[] };

    expect(tsconfig.exclude).toEqual(expect.arrayContaining(['legacy']));
  });
});
