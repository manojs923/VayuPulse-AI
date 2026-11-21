// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Server-Side Key Custody & Zero Client Bundle Leakage', () => {
  it('ensures no hardcoded API keys exist in client src directory', () => {
    const srcDir = path.resolve(__dirname, '../../src');

    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        if (file === 'test' || file === '__tests__' || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
          continue; // Exclude test files from client bundle key custody check
        }
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanFiles(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = scanFiles(srcDir);
    expect(files.length).toBeGreaterThan(5);

    // Regex checking for live key strings or client-side exposure of secret env keys
    const openAiKeyRegex = /sk-[a-zA-Z0-9]{32,}/;
    const geminiKeyRegex = /AIza[0-9A-Za-z-_]{35}/;

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toMatch(openAiKeyRegex);
      expect(content).not.toMatch(geminiKeyRegex);
      // Ensure client files never access raw secret server env variables directly
      expect(content).not.toContain('process.env.OPENAI_API_KEY');
      expect(content).not.toContain('process.env.GEMINI_API_KEY');
    }
  });

  it('verifies that if dist/ exists, no secret keys leaked into the production bundle', () => {
    const distDir = path.resolve(__dirname, '../../dist');
    if (fs.existsSync(distDir)) {
      function getAllFiles(dir: string): string[] {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat && stat.isDirectory()) {
            results = results.concat(getAllFiles(fullPath));
          } else if (stat && stat.isFile()) {
            results.push(fullPath);
          }
        }
        return results;
      }

      const distFiles = getAllFiles(distDir);
      expect(distFiles.length).toBeGreaterThan(0);

      for (const filePath of distFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
        expect(content).not.toMatch(/AIza[0-9A-Za-z-_]{35}/);
        expect(content).not.toContain('OPENAI_API_KEY');
        expect(content).not.toContain('GEMINI_API_KEY');
      }
    }
  });
});
