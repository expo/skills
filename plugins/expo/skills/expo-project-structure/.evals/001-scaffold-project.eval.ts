import { agentEval, expect } from '@expo/skill-eval-kit';

import { setupProject } from './setup';

// This is a proposed consumer of a future skill-only agentEval setup. The
// current kit requires an npm package under test and cannot run this case yet.
agentEval(
  import.meta.url,
  {
    title: 'scaffold a maintainable Expo Router project',
    prompt: `You're starting a new Expo Router app for a small task tracker. Add home and settings routes, a reusable primary button shared by both screens, and a date-formatting utility with a unit test. Organize the new project so another team can grow it, use TypeScript throughout, and configure clean non-relative imports. Replace the starter structure as needed.`,
    projectSetup: setupProject(),
  },
  (check) => {
    check('puts routes under src/app', (ws) => {
      expect(ws.exists('src/app')).toBe(true);
      expect(ws.glob('src/app/**/index.tsx').length).toBeGreaterThan(0);
      expect(ws.glob('src/app/**/*settings*.tsx').length).toBeGreaterThan(0);
    });

    check('keeps reusable UI under src/components', (ws) => {
      expect(ws.exists('src/components')).toBe(true);
      expect(ws.glob('src/components/**/*button*.tsx').length).toBeGreaterThan(0);
    });

    check('keeps non-route code out of src/app', (ws) => {
      const misplacedFiles = [
        ...ws.glob('src/app/**/*button*.ts'),
        ...ws.glob('src/app/**/*button*.tsx'),
        ...ws.glob('src/app/**/*date*.ts'),
        ...ws.glob('src/app/**/*date*.tsx'),
      ];
      expect(misplacedFiles).toEqual([]);
    });

    check('keeps styles with their components', (ws) => {
      const separateStyleFiles = [
        ...ws.glob('**/*.styles.ts'),
        ...ws.glob('**/*.styles.tsx'),
        ...ws.glob('**/*.styles.js'),
        ...ws.glob('**/*.styles.jsx'),
      ];
      expect(separateStyleFiles).toEqual([]);
    });

    check('colocates the date utility and its test', (ws) => {
      const dateUtilities = ws
        .glob('src/utils/**/*date*.ts')
        .filter((file) => !file.endsWith('.test.ts'));
      const dateTests = ws.glob('src/utils/**/*date*.test.ts');

      expect(dateUtilities.length).toBeGreaterThan(0);
      expect(dateTests.length).toBeGreaterThan(0);
      expect(ws.glob('**/__tests__/**')).toEqual([]);
    });

    check('configures the @/* path alias', (ws) => {
      expect(ws.read('tsconfig.json')).toMatch(
        /"@\/\*"\s*:\s*\[\s*"\.\/src\/\*"\s*\]/
      );
    });
  }
);
