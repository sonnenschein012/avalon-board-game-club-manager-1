import { runEmulators } from './emulator-runtime.mjs';

runEmulators({
  projectId: 'test-project-1234',
  services: 'firestore',
  command: 'vitest run src/tests/firestore.rules.test.ts',
});
