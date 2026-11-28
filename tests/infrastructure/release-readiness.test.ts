import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../..');

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

describe('Phase 6 Release Readiness, Tauri Icons, CI & SEO Docs (TDD)', () => {
  it('provides valid Windows .ico, macOS .icns, and PNG icon assets configured in tauri.conf.json', () => {
    const icoPath = path.join(repoRoot, 'src-tauri/icons/icon.ico');
    expect(fs.existsSync(icoPath)).toBe(true);
    const icoBytes = fs.readFileSync(icoPath);
    // Windows ICO header: reserved 0x0000, type 0x0001 (little-endian)
    expect(icoBytes.byteLength).toBeGreaterThan(256);
    expect(icoBytes[0]).toBe(0);
    expect(icoBytes[1]).toBe(0);
    expect(icoBytes[2]).toBe(1);
    expect(icoBytes[3]).toBe(0);

    for (const rel of [
      'src-tauri/icons/32x32.png',
      'src-tauri/icons/128x128.png',
      'src-tauri/icons/128x128@2x.png',
      'src-tauri/icons/icon.icns'
    ]) {
      const fullPath = path.join(repoRoot, rel);
      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fs.statSync(fullPath).size).toBeGreaterThan(100);
    }

    const tauriConf = JSON.parse(readRepoFile('src-tauri/tauri.conf.json')) as {
      bundle?: { targets?: string[]; icon?: string[] };
    };
    expect(tauriConf.bundle?.targets).toContain('nsis');
    expect(tauriConf.bundle?.icon).toContain('icons/icon.ico');
  });

  it('includes automated Windows NSIS installer workflow, organizer manual, and Google indexing guide', () => {
    const winWorkflowPath = path.join(repoRoot, '.github/workflows/build-windows.yml');
    expect(fs.existsSync(winWorkflowPath)).toBe(true);
    const winWorkflow = readRepoFile('.github/workflows/build-windows.yml');
    expect(winWorkflow).toContain('windows-latest');
    expect(winWorkflow).toContain('npm run tauri:build');
    expect(winWorkflow).toContain('cargo test --manifest-path src-tauri/Cargo.toml');

    const manual = readRepoFile('MANUAL_ORGANIZADOR.md');
    expect(manual).toContain('Por rondas');
    expect(manual).toContain('Clasificatoria');
    expect(manual).toContain('25 min');

    const seoGuide = readRepoFile('docs/GOOGLE_INDEXING.md');
    expect(seoGuide).toContain('Google Search Console');
    expect(seoGuide).toContain('https://villasana26enrique.github.io/domino-tournament-manager/');
    expect(seoGuide).toContain('sitemap.xml');
  });

  it('keeps SEO metadata, robots.txt, and sitemap.xml aligned with the production GitHub Pages URL', () => {
    const baseUrl = 'https://villasana26enrique.github.io/domino-tournament-manager/';
    const html = readRepoFile('index.html');
    const robots = readRepoFile('public/robots.txt');
    const sitemap = readRepoFile('public/sitemap.xml');

    expect(html).toContain('<meta name="robots" content="index, follow" />');
    expect(html).toContain(baseUrl);
    expect(robots).toContain(`${baseUrl}sitemap.xml`);
    expect(sitemap).toContain(`<loc>${baseUrl}</loc>`);
    expect(sitemap).toContain('<lastmod>');
  });
});
